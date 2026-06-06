const express = require("express");
const multer  = require("multer");
const crypto  = require("crypto");
const path    = require("path");
const db      = require("../db/database");
const { authenticate }         = require("../middleware/auth");
const { requireLevel, ROLE_LEVEL } = require("../middleware/rbac");
const r2      = require("../storage/r2");

const router = express.Router();

// ─── Valid KYC status transitions ─────────────────────────────────────────────
const KYC_STATUSES = [
  "PRE_REGISTRATION",
  "UNDER_REVIEW",
  "COMPLIANCE_APPROVED",
  "COMMERCIAL_APPROVED",
  "REJECTED",
  "ACTIVE_CLIENT",
];

// ─── PUBLIC: Web KYC ingestion ────────────────────────────────────────────────
// No auth required — called from public web portal (registro-clientes.html)
router.post("/kyc", (req, res) => {
  try {
    const body = req.body || {};
    const { glv_code, empresa, email, submission_type } = body;

    if (!glv_code || !empresa || !email) {
      return res.status(400).json({ error: "glv_code, empresa y email son obligatorios." });
    }

    const submType = submission_type || "CLIENT";
    const rawJson  = JSON.stringify(body);
    const clientIp = (req.headers["x-forwarded-for"] || req.ip || "").toString().split(",")[0].trim();
    const ua       = (req.headers["user-agent"] || "").slice(0, 512);

    // 1. Guardar en kyc_submissions (staging)
    const sub = db.prepare(`
      INSERT INTO kyc_submissions (submission_type, glv_code, raw_data, ip_address, user_agent, status)
      VALUES (?, ?, ?, ?, ?, 'PENDING')
    `).run(submType, glv_code, rawJson, clientIp, ua);
    const submissionId = sub.lastInsertRowid;

    // 2. Verificar si ya existe cliente con ese glv_code
    let clientId;
    const existing = db.prepare("SELECT id FROM clients WHERE glv_code = ?").get(glv_code);

    const { rep, pais, tel, nit, comercial } = body;

    if (existing) {
      db.prepare(`
        UPDATE clients SET
          name                = COALESCE(?, name),
          company             = ?,
          country             = COALESCE(?, country),
          representative      = COALESCE(?, representative),
          email               = ?,
          phone               = COALESCE(?, phone),
          tax_id              = COALESCE(?, tax_id),
          kyc_data            = ?,
          registration_source = 'WEB_KYC',
          kyc_status          = CASE WHEN kyc_status = 'REJECTED' THEN 'PRE_REGISTRATION' ELSE kyc_status END
        WHERE glv_code = ?
      `).run(
        comercial || empresa, empresa, pais || null, rep || null,
        email, tel || null, nit || null, rawJson, glv_code
      );
      clientId = existing.id;
    } else {
      const ins = db.prepare(`
        INSERT INTO clients
          (type, name, company, country, representative, email, phone, tax_id,
           glv_code, lead_status, kyc_status, registration_source, kyc_data,
           commercial_score, compliance_flag, active)
        VALUES ('buyer', ?, ?, ?, ?, ?, ?, ?, ?, 'UNASSIGNED', 'PRE_REGISTRATION', 'WEB_KYC', ?, 0, 0, 1)
      `).run(
        comercial || empresa, empresa, pais || null, rep || null,
        email, tel || null, nit || null, glv_code, rawJson
      );
      clientId = ins.lastInsertRowid;
    }

    // 3. Marcar submission como procesada
    db.prepare(`
      UPDATE kyc_submissions
      SET status = 'PROCESSED', processed_at = datetime('now'), mapped_to_id = ?
      WHERE id = ?
    `).run(clientId, submissionId);

    // 4. Audit log — KYC_SUBMITTED
    db.prepare(`
      INSERT INTO audit_log (username, action, doc_id, client_id, ip)
      VALUES ('WEB_PORTAL', 'KYC_SUBMITTED', ?, ?, ?)
    `).run(glv_code, clientId, clientIp);

    // 5. Crear tarea automática para COMPLIANCE
    const complianceUser = db.prepare(
      "SELECT id FROM users WHERE role = 'COMPLIANCE' AND active = 1 ORDER BY id LIMIT 1"
    ).get();

    db.prepare(`
      INSERT INTO tasks (title, description, priority, assigned_to, created_by, status)
      VALUES (?, ?, 'high', ?, ?, 'pending')
    `).run(
      `KYC REVIEW REQUIRED — ${glv_code}`,
      `Nueva pre-inscripción web recibida.\nEmpresa: ${empresa}\nEmail: ${email}\nGLV Code: ${glv_code}\nFuente: WEB_KYC`,
      complianceUser ? complianceUser.id : null,
      complianceUser ? complianceUser.id : null
    );

    return res.status(201).json({
      ok: true,
      client_id: clientId,
      glv_code,
      kyc_status: "PRE_REGISTRATION",
      lead_status: "UNASSIGNED",
      message: "KYC recibido. Expediente en proceso de revisión.",
    });
  } catch (e) {
    console.error("[POST /clients/kyc]", e.message);
    return res.status(500).json({ error: "Error procesando KYC. Los datos han sido guardados localmente." });
  }
});

// ─── All remaining routes require authentication ──────────────────────────────
router.use(authenticate);

// ─── GET /clients — list active clients (excludes WEB_KYC leads not yet activated) ──
router.get("/", (req, res) => {
  const { type } = req.query;
  // WEB_KYC leads only appear here once fully activated (ACTIVE_CLIENT)
  let q = `SELECT * FROM clients
    WHERE (registration_source IS NULL OR registration_source = 'MANUAL'
           OR (registration_source = 'WEB_KYC' AND kyc_status = 'ACTIVE_CLIENT'))`;
  const params = [];
  if (type) { q += " AND type = ?"; params.push(type); }
  q += " ORDER BY name";
  res.json(db.prepare(q).all(...params));
});

// ─── GET /clients/leads — KYC leads list (COMPLIANCE 65+) ────────────────────
router.get("/leads", requireLevel(65), (req, res) => {
  try {
    const { kyc_status, lead_status, assigned_agent } = req.query;
    let q = `
      SELECT
        c.id, c.glv_code, c.name, c.company, c.country, c.email, c.phone,
        c.representative,
        c.lead_status, c.kyc_status, c.registration_source, c.commercial_score,
        c.compliance_flag, c.created_at, c.last_contact_at,
        c.lifecycle_status, c.lifecycle_reason, c.duplicate_of,
        u.name       AS assigned_agent_name,
        u.username   AS assigned_agent_username,
        rv.name      AS reviewed_by_name
      FROM clients c
      LEFT JOIN users u  ON u.id  = c.assigned_agent
      LEFT JOIN users rv ON rv.id = c.kyc_reviewed_by
      WHERE c.registration_source IS NOT NULL
    `;
    const params = [];
    if (kyc_status)     { q += " AND c.kyc_status = ?";     params.push(kyc_status); }
    if (lead_status)    { q += " AND c.lead_status = ?";    params.push(lead_status); }
    if (assigned_agent) { q += " AND c.assigned_agent = ?"; params.push(assigned_agent); }
    q += " ORDER BY c.created_at DESC LIMIT 500";
    res.json(db.prepare(q).all(...params));
  } catch (e) {
    console.error("[GET /clients/leads]", e.message);
    res.status(500).json({ error: e.message });
  }
});

// ─── GET /clients/:id — single client ────────────────────────────────────────
router.get("/:id", (req, res) => {
  const c = db.prepare("SELECT * FROM clients WHERE id = ?").get(req.params.id);
  if (!c) return res.status(404).json({ error: "Cliente no encontrado" });
  res.json(c);
});

// ─── GET /clients/:id/kyc-data — full KYC expediente (COMPLIANCE 65+) ────────
router.get("/:id/kyc-data", requireLevel(65), (req, res) => {
  try {
    const client = db.prepare("SELECT * FROM clients WHERE id = ?").get(req.params.id);
    if (!client) return res.status(404).json({ error: "Cliente no encontrado" });

    const submissions = db.prepare(`
      SELECT id, submission_type, glv_code, submitted_at, status, processed_at, ip_address
      FROM kyc_submissions WHERE mapped_to_id = ? ORDER BY submitted_at DESC
    `).all(req.params.id);

    const auditEvents = db.prepare(`
      SELECT ts, username, action, ip
      FROM audit_log WHERE client_id = ? ORDER BY ts DESC LIMIT 50
    `).all(req.params.id);

    const tasks = db.prepare(`
      SELECT t.id, t.title, t.status, t.priority, t.created_at, u.name AS assigned_name
      FROM tasks t
      LEFT JOIN users u ON u.id = t.assigned_to
      WHERE t.title LIKE ? ORDER BY t.created_at DESC
    `).all(`%${client.glv_code || client.id}%`);

    let parsedKycData = null;
    if (client.kyc_data) {
      try { parsedKycData = JSON.parse(client.kyc_data); } catch (_) {}
    }

    res.json({
      client: { ...client, kyc_data: parsedKycData },
      submissions,
      audit_trail: auditEvents,
      tasks,
    });
  } catch (e) {
    console.error("[GET /clients/:id/kyc-data]", e.message);
    res.status(500).json({ error: e.message });
  }
});

// ─── PATCH /clients/:id/kyc-status (COMPLIANCE 65+) ─────────────────────────
router.patch("/:id/kyc-status", requireLevel(65), (req, res) => {
  try {
    const { kyc_status, lead_status, assigned_agent, onboarding_notes } = req.body;

    if (kyc_status && !KYC_STATUSES.includes(kyc_status)) {
      return res.status(400).json({
        error: `kyc_status inválido. Valores permitidos: ${KYC_STATUSES.join(", ")}`,
      });
    }

    const client = db.prepare("SELECT id, glv_code, kyc_status FROM clients WHERE id = ?").get(req.params.id);
    if (!client) return res.status(404).json({ error: "Cliente no encontrado" });

    const updates = [];
    const vals    = [];

    if (kyc_status)        { updates.push("kyc_status = ?");       vals.push(kyc_status); }
    if (lead_status)       { updates.push("lead_status = ?");      vals.push(lead_status); }
    if (assigned_agent !== undefined) {
      updates.push("assigned_agent = ?");
      vals.push(assigned_agent || null);
    }
    if (onboarding_notes)  { updates.push("onboarding_notes = ?"); vals.push(onboarding_notes); }

    if (kyc_status === "COMPLIANCE_APPROVED" || kyc_status === "COMMERCIAL_APPROVED") {
      updates.push("kyc_reviewed_by = ?");
      updates.push("kyc_reviewed_at = datetime('now')");
      vals.push(req.user.id);
    }
    if (kyc_status === "ACTIVE_CLIENT") {
      updates.push("lead_status = 'QUALIFIED'");
      updates.push("active = 1");
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: "Sin campos para actualizar." });
    }

    db.prepare(`UPDATE clients SET ${updates.join(", ")} WHERE id = ?`).run(...vals, req.params.id);

    const actionMap = {
      UNDER_REVIEW:        "KYC_ASSIGNED",
      COMPLIANCE_APPROVED: "KYC_APPROVED",
      COMMERCIAL_APPROVED: "KYC_APPROVED",
      REJECTED:            "KYC_REJECTED",
      ACTIVE_CLIENT:       "CLIENT_ACTIVATED",
    };
    const action = actionMap[kyc_status] || "KYC_REVIEWED";
    db.prepare(
      "INSERT INTO audit_log (username, action, doc_id, client_id, ip) VALUES (?, ?, ?, ?, ?)"
    ).run(req.user.username, action, client.glv_code, client.id, req.ip);

    // Auto-task on activation
    if (kyc_status === "ACTIVE_CLIENT") {
      db.prepare(`
        INSERT INTO tasks (title, description, priority, assigned_to, created_by, status)
        VALUES (?, ?, 'medium', ?, ?, 'pending')
      `).run(
        `CLIENT ACTIVATED — ${client.glv_code}`,
        `Cliente activado y listo para operaciones.\nGLV Code: ${client.glv_code}\nActivado por: ${req.user.username}`,
        req.user.id, req.user.id
      );
    }

    res.json(db.prepare("SELECT * FROM clients WHERE id = ?").get(req.params.id));
  } catch (e) {
    console.error("[PATCH /clients/:id/kyc-status]", e.message);
    res.status(500).json({ error: e.message });
  }
});

// ─── POST /clients — create client (ERP internal) ────────────────────────────
router.post("/", (req, res) => {
  const { type, name, company, country, representative, email, phone, whatsapp, address, tax_id, preferred_lang } = req.body;
  if (!name) return res.status(400).json({ error: "Nombre requerido" });

  const r = db.prepare(`
    INSERT INTO clients
      (type, name, company, country, representative, email, phone, whatsapp, address, tax_id, preferred_lang, created_by, registration_source)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'MANUAL')
  `).run(
    type || "buyer", name, company || null, country || null, representative || null,
    email || null, phone || null, whatsapp || null, address || null,
    tax_id || null, preferred_lang || "en", req.user.id
  );

  res.status(201).json(db.prepare("SELECT * FROM clients WHERE id = ?").get(r.lastInsertRowid));
});

// ─── PUT /clients/:id — update client ────────────────────────────────────────
router.put("/:id", (req, res) => {
  const c = db.prepare("SELECT id FROM clients WHERE id = ?").get(req.params.id);
  if (!c) return res.status(404).json({ error: "Cliente no encontrado" });

  const { type, name, company, country, representative, email, phone, whatsapp, address, tax_id, preferred_lang, active } = req.body;
  db.prepare(`
    UPDATE clients SET
      type = COALESCE(?, type), name = COALESCE(?, name), company = COALESCE(?, company),
      country = COALESCE(?, country), representative = COALESCE(?, representative),
      email = COALESCE(?, email), phone = COALESCE(?, phone), whatsapp = COALESCE(?, whatsapp),
      address = COALESCE(?, address), tax_id = COALESCE(?, tax_id),
      preferred_lang = COALESCE(?, preferred_lang), active = COALESCE(?, active)
    WHERE id = ?
  `).run(
    type||null, name||null, company||null, country||null, representative||null,
    email||null, phone||null, whatsapp||null, address||null, tax_id||null,
    preferred_lang||null, active !== undefined ? (active ? 1 : 0) : null, req.params.id
  );

  res.json(db.prepare("SELECT * FROM clients WHERE id = ?").get(req.params.id));
});

// ─── PATCH /clients/:id/archive — archive client (DIRECTOR 75+) ──────────────
router.patch("/:id/archive", requireLevel(75), (req, res) => {
  try {
    const client = db.prepare("SELECT id, glv_code, kyc_status FROM clients WHERE id = ?").get(req.params.id);
    if (!client) return res.status(404).json({ error: "Cliente no encontrado" });

    db.prepare("UPDATE clients SET active = 0, lead_status = 'ARCHIVED' WHERE id = ?").run(req.params.id);

    db.prepare(
      "INSERT INTO audit_log (username, action, doc_id, client_id, ip) VALUES (?, ?, ?, ?, ?)"
    ).run(req.user.username, "CLIENT_ARCHIVED", client.glv_code, client.id, req.ip);

    res.json(db.prepare("SELECT * FROM clients WHERE id = ?").get(req.params.id));
  } catch (e) {
    console.error("[PATCH /clients/:id/archive]", e.message);
    res.status(500).json({ error: e.message });
  }
});

// ─── PATCH /clients/:id/lifecycle — lifecycle transition (COMPLIANCE 65+) ────
const LIFECYCLE_ACTIONS  = ["ARCHIVE", "ON_HOLD", "DUPLICATE", "REACTIVATE"];
const LIFECYCLE_STATUSES = { ARCHIVE: "ARCHIVED", ON_HOLD: "ON_HOLD", DUPLICATE: "DUPLICATE", REACTIVATE: "ACTIVE" };
const LIFECYCLE_AUDITS   = { ARCHIVE: "LIFECYCLE_ARCHIVED", ON_HOLD: "LIFECYCLE_ON_HOLD", DUPLICATE: "LIFECYCLE_DUPLICATE", REACTIVATE: "LIFECYCLE_REACTIVATED" };

router.patch("/:id/lifecycle", requireLevel(65), (req, res) => {
  try {
    const { action, reason, duplicate_of } = req.body;

    if (!LIFECYCLE_ACTIONS.includes(action)) {
      return res.status(400).json({ error: `Acción inválida. Valores: ${LIFECYCLE_ACTIONS.join(", ")}` });
    }
    const userLevel = ROLE_LEVEL[req.user?.role] || 0;
    if (["ARCHIVE", "ON_HOLD"].includes(action) && userLevel < 75) {
      return res.status(403).json({ error: "Se requiere nivel DIRECTOR (75) para archivar o suspender." });
    }
    if (action === "DUPLICATE" && !duplicate_of) {
      return res.status(400).json({ error: "Se requiere duplicate_of (id del registro canónico)." });
    }
    if (action === "REACTIVATE" && userLevel < 75) {
      return res.status(403).json({ error: "Se requiere nivel DIRECTOR (75) para reactivar." });
    }

    const client = db.prepare(
      "SELECT id, glv_code, kyc_status, lifecycle_status FROM clients WHERE id = ?"
    ).get(req.params.id);
    if (!client) return res.status(404).json({ error: "Cliente no encontrado" });

    if (action === "REACTIVATE" && client.lifecycle_status === "ACTIVE") {
      return res.status(400).json({ error: "El cliente ya está activo." });
    }

    const updates = [
      "lifecycle_status = ?",
      "lifecycle_reason = ?",
      "lifecycle_updated_by = ?",
      "lifecycle_updated_at = datetime('now')",
    ];
    const vals = [LIFECYCLE_STATUSES[action], reason || null, req.user.id];

    if (action === "DUPLICATE") { updates.push("duplicate_of = ?"); vals.push(duplicate_of); }
    updates.push(`active = ${action === "REACTIVATE" ? 1 : 0}`);

    db.prepare(`UPDATE clients SET ${updates.join(", ")} WHERE id = ?`).run(...vals, req.params.id);

    db.prepare(
      "INSERT INTO audit_log (username, action, doc_id, client_id, ip) VALUES (?, ?, ?, ?, ?)"
    ).run(req.user.username, LIFECYCLE_AUDITS[action], client.glv_code, client.id, req.ip);

    res.json(db.prepare("SELECT * FROM clients WHERE id = ?").get(req.params.id));
  } catch (e) {
    console.error("[PATCH /clients/:id/lifecycle]", e.message);
    res.status(500).json({ error: e.message });
  }
});

// ─── GET /clients/:id/lifecycle-history (COMPLIANCE 65+) ─────────────────────
router.get("/:id/lifecycle-history", requireLevel(65), (req, res) => {
  try {
    const client = db.prepare(
      "SELECT id, glv_code, lifecycle_status, lifecycle_reason, lifecycle_updated_at, duplicate_of FROM clients WHERE id = ?"
    ).get(req.params.id);
    if (!client) return res.status(404).json({ error: "Cliente no encontrado" });

    const history = db.prepare(`
      SELECT al.ts, al.username, al.action, al.ip, u.name AS actor_name
      FROM audit_log al
      LEFT JOIN users u ON u.username = al.username
      WHERE al.client_id = ? AND al.action LIKE 'LIFECYCLE_%'
      ORDER BY al.ts DESC LIMIT 100
    `).all(req.params.id);

    res.json({ client, history });
  } catch (e) {
    console.error("[GET /clients/:id/lifecycle-history]", e.message);
    res.status(500).json({ error: e.message });
  }
});

// ─── canDeleteClient — referential integrity check ───────────────────────────
function canDeleteClient(clientId) {
  const operations     = db.prepare("SELECT COUNT(*) AS n FROM operations WHERE client_id = ?").get(clientId)?.n || 0;
  const documents      = db.prepare("SELECT COUNT(*) AS n FROM client_documents WHERE client_id = ? AND status != 'DELETED'").get(clientId)?.n || 0;
  const tasks          = db.prepare("SELECT COUNT(*) AS n FROM tasks t JOIN operations o ON o.id = t.operation_id WHERE o.client_id = ?").get(clientId)?.n || 0;
  const kyc_submissions = db.prepare("SELECT COUNT(*) AS n FROM kyc_submissions WHERE mapped_to_id = ?").get(clientId)?.n || 0;

  const allowed = operations === 0 && documents === 0 && tasks === 0 && kyc_submissions === 0;
  const reason  = allowed
    ? null
    : "Este cliente posee operaciones, documentos o registros vinculados. No puede eliminarse permanentemente. Utilice ARCHIVE.";

  return { allowed, reason, operations, documents, tasks, kyc_submissions };
}

// ─── DELETE /clients/:id — PERMANENT DELETE (SUPER_ADMIN 100 only) ───────────
router.delete("/:id", requireLevel(100), (req, res) => {
  try {
    const client = db.prepare("SELECT id, glv_code, active, lead_status FROM clients WHERE id = ?").get(req.params.id);
    if (!client) return res.status(404).json({ error: "Cliente no encontrado" });

    if (client.active !== 0 && client.lead_status !== "ARCHIVED") {
      return res.status(400).json({ error: "No se puede eliminar un cliente activo. Archive el cliente primero." });
    }

    const integrity = canDeleteClient(req.params.id);
    if (!integrity.allowed) {
      return res.status(409).json({
        error: integrity.reason,
        counts: {
          operations:      integrity.operations,
          documents:       integrity.documents,
          tasks:           integrity.tasks,
          kyc_submissions: integrity.kyc_submissions,
        },
      });
    }

    db.prepare("DELETE FROM clients WHERE id = ?").run(req.params.id);

    db.prepare(
      "INSERT INTO audit_log (username, action, doc_id, client_id, ip) VALUES (?, ?, ?, ?, ?)"
    ).run(req.user.username, "CLIENT_PERMANENT_DELETE", client.glv_code, client.id, req.ip);

    res.json({ ok: true, deleted_id: Number(req.params.id), glv_code: client.glv_code });
  } catch (e) {
    console.error("[DELETE /clients/:id]", e.message);
    res.status(500).json({ error: e.message });
  }
});

// ─── Document upload multer config ───────────────────────────────────────────
const docUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter(_req, file, cb) {
    const allowed = [
      "image/jpeg", "image/png", "image/webp", "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error("Tipo de archivo no permitido. Use PDF, imagen o documento Office."));
  },
});

// ─── GET /clients/:id/documents (COMPLIANCE 65+) ─────────────────────────────
router.get("/:id/documents", requireLevel(65), (req, res) => {
  try {
    const docs = db.prepare(`
      SELECT d.*, u.name AS uploaded_by_name
      FROM client_documents d
      LEFT JOIN users u ON u.id = d.uploaded_by
      WHERE d.client_id = ? AND d.status = 'ACTIVE'
      ORDER BY d.uploaded_at DESC
    `).all(req.params.id);
    res.json(docs);
  } catch (e) {
    console.error("[GET /clients/:id/documents]", e.message);
    res.status(500).json({ error: e.message });
  }
});

// ─── POST /clients/:id/documents/upload (COMPLIANCE 65+) ─────────────────────
router.post("/:id/documents/upload", requireLevel(65), docUpload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No se recibió archivo." });

    const client = db.prepare("SELECT id, glv_code FROM clients WHERE id = ?").get(req.params.id);
    if (!client) return res.status(404).json({ error: "Cliente no encontrado" });

    const { document_type, notes } = req.body;
    const ext = path.extname(req.file.originalname).toLowerCase() || "";
    const key = `client-docs/${req.params.id}/${crypto.randomUUID()}${ext}`;

    let url = null;
    try {
      url = await r2.uploadObject(key, req.file.buffer, req.file.mimetype);
    } catch (e) {
      console.warn("[doc-upload] R2 unavailable, record stored without URL:", e.message);
    }

    const ins = db.prepare(`
      INSERT INTO client_documents
        (client_id, document_type, file_name, file_size, mime_type, r2_key, url, uploaded_by, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      req.params.id, document_type || "OTHER",
      req.file.originalname, req.file.size, req.file.mimetype,
      key, url, req.user.id, notes || null
    );

    db.prepare(
      "INSERT INTO audit_log (username, action, doc_id, client_id, ip) VALUES (?, ?, ?, ?, ?)"
    ).run(req.user.username, "DOCUMENT_UPLOADED", `${document_type || "OTHER"}:${req.file.originalname}`, client.id, req.ip);

    res.status(201).json(db.prepare(
      "SELECT d.*, u.name AS uploaded_by_name FROM client_documents d LEFT JOIN users u ON u.id = d.uploaded_by WHERE d.id = ?"
    ).get(ins.lastInsertRowid));
  } catch (e) {
    console.error("[POST /clients/:id/documents/upload]", e.message);
    res.status(500).json({ error: e.message });
  }
});

// ─── DELETE /clients/:id/documents/:docId (COMPLIANCE 65+) ───────────────────
router.delete("/:id/documents/:docId", requireLevel(65), async (req, res) => {
  try {
    const doc = db.prepare(
      "SELECT * FROM client_documents WHERE id = ? AND client_id = ? AND status = 'ACTIVE'"
    ).get(req.params.docId, req.params.id);
    if (!doc) return res.status(404).json({ error: "Documento no encontrado" });

    db.prepare("UPDATE client_documents SET status = 'DELETED' WHERE id = ?").run(req.params.docId);

    if (doc.r2_key) {
      try { await r2.deleteObject(doc.r2_key); } catch (e) { console.warn("[doc-delete] R2 delete failed:", e.message); }
    }

    db.prepare(
      "INSERT INTO audit_log (username, action, doc_id, client_id, ip) VALUES (?, ?, ?, ?, ?)"
    ).run(req.user.username, "DOCUMENT_DELETED", doc.file_name, parseInt(req.params.id), req.ip);

    res.json({ ok: true, deleted_id: Number(req.params.docId) });
  } catch (e) {
    console.error("[DELETE /clients/:id/documents/:docId]", e.message);
    res.status(500).json({ error: e.message });
  }
});

// ─── GET /clients/:id/documents/:docId/url (COMPLIANCE 65+) ──────────────────
router.get("/:id/documents/:docId/url", requireLevel(65), async (req, res) => {
  try {
    const doc = db.prepare(
      "SELECT * FROM client_documents WHERE id = ? AND client_id = ? AND status = 'ACTIVE'"
    ).get(req.params.docId, req.params.id);
    if (!doc) return res.status(404).json({ error: "Documento no encontrado" });

    let url = doc.url;
    if (doc.r2_key) {
      try { url = await r2.getSignedDownloadUrl(doc.r2_key, 3600); } catch (e) {}
    }
    res.json({ url, file_name: doc.file_name, mime_type: doc.mime_type });
  } catch (e) {
    console.error("[GET /clients/:id/documents/:docId/url]", e.message);
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
