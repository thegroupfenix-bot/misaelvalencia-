const express = require("express");
const multer  = require("multer");
const crypto  = require("crypto");
const path    = require("path");
const db      = require("../db/database");
const { authenticate }         = require("../middleware/auth");
const { requireLevel, ROLE_LEVEL } = require("../middleware/rbac");
const r2      = require("../storage/r2");

const router = express.Router();

const { rateLimit } = require("../middleware/rateLimiter");
const pii = require("../utils/piiCrypto");

const kycLimiter = rateLimit(15 * 60 * 1000, 10);

// ─── Valid KYC status transitions ─────────────────────────────────────────────
const KYC_STATUSES = [
  "PRE_REGISTRATION",
  "UNDER_REVIEW",
  "COMPLIANCE_APPROVED",
  "COMMERCIAL_APPROVED",
  "REJECTED",
  "ACTIVE_CLIENT",
];

const KYC_MAX_BODY_SIZE = 50 * 1024;
const GLV_CODE_REGEX = /^[A-Za-z0-9\-_]{2,50}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ─── PUBLIC: Web KYC ingestion ────────────────────────────────────────────────
// No auth required — called from public web portal (registro-clientes.html)
router.post("/kyc", kycLimiter, (req, res) => {
  try {
    const body = req.body || {};

    const rawSize = JSON.stringify(body).length;
    if (rawSize > KYC_MAX_BODY_SIZE) {
      return res.status(413).json({ error: "Payload excede el tamaño máximo permitido." });
    }

    const { glv_code, empresa, email, submission_type } = body;

    if (!glv_code || !empresa || !email) {
      return res.status(400).json({ error: "glv_code, empresa y email son obligatorios." });
    }

    if (!GLV_CODE_REGEX.test(glv_code)) {
      return res.status(400).json({ error: "glv_code contiene caracteres no permitidos." });
    }
    if (typeof empresa !== "string" || empresa.length > 200) {
      return res.status(400).json({ error: "empresa debe ser texto con máximo 200 caracteres." });
    }
    if (!EMAIL_REGEX.test(email) || email.length > 254) {
      return res.status(400).json({ error: "email inválido." });
    }
    if (submission_type && !["CLIENT", "SUPPLIER", "BROKER"].includes(submission_type)) {
      return res.status(400).json({ error: "submission_type inválido." });
    }

    const submType = submission_type || "CLIENT";
    const rawJson  = JSON.stringify(body);
    const encryptedJson = pii.isConfigured() ? pii.encrypt(rawJson) : rawJson;
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
        email, tel || null, nit || null, encryptedJson, glv_code
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
        email, tel || null, nit || null, glv_code, encryptedJson
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
  let q = `
    SELECT
      c.*,
      (SELECT COUNT(*) FROM operations   o WHERE o.client_id    = c.id) AS operations_count,
      (SELECT COUNT(*) FROM client_documents d WHERE d.client_id = c.id AND d.status != 'DELETED') AS documents_count
    FROM clients c
    WHERE (c.registration_source IS NULL OR c.registration_source = 'MANUAL'
           OR (c.registration_source = 'WEB_KYC' AND c.kyc_status = 'ACTIVE_CLIENT'))`;
  const params = [];
  if (type) { q += " AND c.type = ?"; params.push(type); }
  q += " ORDER BY c.name";
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
      const decrypted = pii.isConfigured() ? pii.decrypt(client.kyc_data) : client.kyc_data;
      try { parsedKycData = JSON.parse(decrypted); } catch (_) {}
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
router.post("/", requireLevel(40), (req, res) => {
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
router.put("/:id", requireLevel(40), (req, res) => {
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
  const operations = db.prepare("SELECT COUNT(*) AS n FROM operations WHERE client_id = ?").get(clientId)?.n || 0;
  const documents  = db.prepare("SELECT COUNT(*) AS n FROM client_documents WHERE client_id = ? AND status != 'DELETED'").get(clientId)?.n || 0;
  const tasks      = db.prepare("SELECT COUNT(*) AS n FROM tasks t JOIN operations o ON o.id = t.operation_id WHERE o.client_id = ?").get(clientId)?.n || 0;

  const allowed = operations === 0 && documents === 0 && tasks === 0;
  const reason  = allowed
    ? null
    : "Este cliente posee operaciones, documentos o tareas vinculadas. No puede eliminarse permanentemente. Utilice ARCHIVE.";

  return { allowed, reason, operations, documents, tasks };
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
    const { operations, documents, tasks } = integrity;

    // Hard block: operations or documents exist — no role can override
    if (operations > 0 || documents > 0) {
      return res.status(409).json({
        error: `No se puede eliminar el cliente. Operations: ${operations} | Documents: ${documents} | Tasks: ${tasks}`,
        counts: { operations, documents, tasks },
      });
    }

    // Force-delete path: only orphan tasks remain — SUPER_ADMIN may proceed
    const isForce = tasks > 0;
    if (isForce) {
      db.prepare(
        "DELETE FROM tasks WHERE operation_id IN (SELECT id FROM operations WHERE client_id = ?)"
      ).run(req.params.id);
    }

    // Unlink KYC submissions — preserve history, clear FK to allow DELETE
    const kycUnlinked = db.prepare(
      "UPDATE kyc_submissions SET mapped_to_id = NULL WHERE mapped_to_id = ?"
    ).run(req.params.id).changes;

    if (kycUnlinked > 0) {
      db.prepare(
        "INSERT INTO audit_log (username, action, doc_id, client_id, ip) VALUES (?, ?, ?, ?, ?)"
      ).run(req.user.username, "CLIENT_UNLINK_KYC", client.glv_code, client.id, req.ip);
    }

    db.prepare("DELETE FROM clients WHERE id = ?").run(req.params.id);

    const auditAction = isForce ? "CLIENT_FORCE_DELETE" : "CLIENT_PERMANENT_DELETE";
    db.prepare(
      "INSERT INTO audit_log (username, action, doc_id, client_id, ip) VALUES (?, ?, ?, ?, ?)"
    ).run(req.user.username, auditAction, client.glv_code, client.id, req.ip);

    res.json({ ok: true, deleted_id: Number(req.params.id), glv_code: client.glv_code, force: isForce, kyc_unlinked: kycUnlinked });
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

// ═══════════════════════════════════════════════════════════════════════════════
// GOS-06J — Enterprise API Layer
// ═══════════════════════════════════════════════════════════════════════════════

// ─── helpers ──────────────────────────────────────────────────────────────────
function getClientOrFail(id, res) {
  const c = db.prepare("SELECT id FROM clients WHERE id = ?").get(id);
  if (!c) { res.status(404).json({ error: "Cliente no encontrado" }); return null; }
  return c;
}

// ─── CATALOG ROUTES (no client prefix) ────────────────────────────────────────

// GET /clients/catalog/countries — country_catalog
router.get("/catalog/countries", requireLevel(65), (_req, res) => {
  res.json(db.prepare("SELECT * FROM country_catalog WHERE active=1 ORDER BY name").all());
});

// GET /clients/catalog/entity-types
router.get("/catalog/entity-types", requireLevel(65), (_req, res) => {
  res.json(db.prepare("SELECT * FROM entity_types WHERE active=1 ORDER BY category,name").all());
});

// GET /clients/catalog/products
router.get("/catalog/products", requireLevel(65), (_req, res) => {
  res.json(db.prepare("SELECT * FROM product_catalog WHERE active=1 ORDER BY category,name").all());
});

// GET /clients/catalog/document-categories
router.get("/catalog/document-categories", requireLevel(65), (_req, res) => {
  res.json(db.prepare("SELECT * FROM document_categories WHERE active=1 ORDER BY name").all());
});

// GET /clients/catalog/document-types
router.get("/catalog/document-types", requireLevel(65), (req, res) => {
  const { category_id } = req.query;
  let q = "SELECT dt.*, dc.code AS category_code, dc.name AS category_name FROM document_type_catalog dt JOIN document_categories dc ON dc.id=dt.category_id WHERE dt.active=1";
  const params = [];
  if (category_id) { q += " AND dt.category_id=?"; params.push(category_id); }
  q += " ORDER BY dc.name, dt.name";
  res.json(db.prepare(q).all(...params));
});

// POST /clients/catalog/document-types (CORPORATE_ADMIN 90+)
router.post("/catalog/document-types", requireLevel(90), (req, res) => {
  const { code, name, category_id, applicable_countries, requires_expiry, description } = req.body;
  if (!code || !name || !category_id) return res.status(400).json({ error: "code, name y category_id son requeridos" });
  try {
    const r = db.prepare(
      "INSERT INTO document_type_catalog (code,name,category_id,applicable_countries,requires_expiry,description,created_by) VALUES (?,?,?,?,?,?,?)"
    ).run(code.toUpperCase(), name, category_id, applicable_countries || null, requires_expiry ? 1 : 0, description || null, req.user.id);
    res.status(201).json(db.prepare("SELECT * FROM document_type_catalog WHERE id=?").get(r.lastInsertRowid));
  } catch (e) {
    if (e.message.includes("UNIQUE")) return res.status(409).json({ error: "Ya existe un tipo con ese código" });
    res.status(500).json({ error: e.message });
  }
});

// ─── COUNTRY INTELLIGENCE (:id/countries) ─────────────────────────────────────

// GET /clients/:id/countries
router.get("/:id/countries", requireLevel(65), (req, res) => {
  if (!getClientOrFail(req.params.id, res)) return;
  const rows = db.prepare(`
    SELECT cc.*, cat.name AS country_name, cat.name_es, cat.region, cat.subregion
    FROM client_countries cc
    JOIN country_catalog cat ON cat.code = cc.country_code
    WHERE cc.client_id = ?
    ORDER BY cc.relationship_type, cat.name
  `).all(req.params.id);
  res.json(rows);
});

// POST /clients/:id/countries
router.post("/:id/countries", requireLevel(65), (req, res) => {
  if (!getClientOrFail(req.params.id, res)) return;
  const { country_code, relationship_type, notes } = req.body;
  const VALID_TYPES = ["CONSTITUTION","OPERATES","BUYS","SELLS","INTEREST"];
  if (!country_code || !relationship_type) return res.status(400).json({ error: "country_code y relationship_type son requeridos" });
  if (!VALID_TYPES.includes(relationship_type)) return res.status(400).json({ error: `relationship_type debe ser: ${VALID_TYPES.join("|")}` });
  const catalog = db.prepare("SELECT code FROM country_catalog WHERE code=?").get(country_code);
  if (!catalog) return res.status(400).json({ error: `País no encontrado en catálogo: ${country_code}` });
  try {
    const r = db.prepare(
      "INSERT INTO client_countries (client_id,country_code,relationship_type,notes) VALUES (?,?,?,?)"
    ).run(req.params.id, country_code, relationship_type, notes || null);
    res.status(201).json(db.prepare("SELECT cc.*,cat.name AS country_name,cat.region,cat.subregion FROM client_countries cc JOIN country_catalog cat ON cat.code=cc.country_code WHERE cc.id=?").get(r.lastInsertRowid));
  } catch (e) {
    if (e.message.includes("UNIQUE")) return res.status(409).json({ error: "Ya existe esa combinación cliente/país/tipo" });
    res.status(500).json({ error: e.message });
  }
});

// DELETE /clients/:id/countries/:countryRelId
router.delete("/:id/countries/:countryRelId", requireLevel(65), (req, res) => {
  const row = db.prepare("SELECT id FROM client_countries WHERE id=? AND client_id=?").get(req.params.countryRelId, req.params.id);
  if (!row) return res.status(404).json({ error: "Relación no encontrada" });
  db.prepare("DELETE FROM client_countries WHERE id=?").run(req.params.countryRelId);
  res.json({ ok: true });
});

// ─── ENTITY CLASSIFICATION (:id/entity-types) ─────────────────────────────────

// GET /clients/:id/entity-types
router.get("/:id/entity-types", requireLevel(65), (req, res) => {
  if (!getClientOrFail(req.params.id, res)) return;
  res.json(db.prepare(`
    SELECT cet.id, et.id AS entity_type_id, et.code, et.name, et.category, cet.created_at
    FROM client_entity_types cet
    JOIN entity_types et ON et.id = cet.entity_type_id
    WHERE cet.client_id = ?
    ORDER BY et.category, et.name
  `).all(req.params.id));
});

// POST /clients/:id/entity-types
router.post("/:id/entity-types", requireLevel(65), (req, res) => {
  if (!getClientOrFail(req.params.id, res)) return;
  const { entity_type_id } = req.body;
  if (!entity_type_id) return res.status(400).json({ error: "entity_type_id es requerido" });
  const et = db.prepare("SELECT id FROM entity_types WHERE id=? AND active=1").get(entity_type_id);
  if (!et) return res.status(400).json({ error: "Tipo de entidad no válido" });
  try {
    const r = db.prepare("INSERT INTO client_entity_types (client_id,entity_type_id) VALUES (?,?)").run(req.params.id, entity_type_id);
    res.status(201).json(db.prepare("SELECT cet.id, et.id AS entity_type_id, et.code, et.name, et.category, cet.created_at FROM client_entity_types cet JOIN entity_types et ON et.id=cet.entity_type_id WHERE cet.id=?").get(r.lastInsertRowid));
  } catch (e) {
    if (e.message.includes("UNIQUE")) return res.status(409).json({ error: "El cliente ya tiene ese tipo de entidad" });
    res.status(500).json({ error: e.message });
  }
});

// DELETE /clients/:id/entity-types/:relId
router.delete("/:id/entity-types/:relId", requireLevel(65), (req, res) => {
  const row = db.prepare("SELECT id FROM client_entity_types WHERE id=? AND client_id=?").get(req.params.relId, req.params.id);
  if (!row) return res.status(404).json({ error: "Relación no encontrada" });
  db.prepare("DELETE FROM client_entity_types WHERE id=?").run(req.params.relId);
  res.json({ ok: true });
});

// ─── PRODUCT INTELLIGENCE (:id/products) ──────────────────────────────────────

// GET /clients/:id/products
router.get("/:id/products", requireLevel(65), (req, res) => {
  if (!getClientOrFail(req.params.id, res)) return;
  res.json(db.prepare(`
    SELECT cp.id, cp.relationship_type, cp.priority, cp.notes, cp.created_at,
           pc.id AS product_id, pc.code, pc.name, pc.category, pc.subcategory, pc.hs_code, pc.unit
    FROM client_products cp
    JOIN product_catalog pc ON pc.id = cp.product_id
    WHERE cp.client_id = ?
    ORDER BY cp.priority, pc.category, pc.name
  `).all(req.params.id));
});

// POST /clients/:id/products
router.post("/:id/products", requireLevel(65), (req, res) => {
  if (!getClientOrFail(req.params.id, res)) return;
  const { product_id, relationship_type, priority, notes } = req.body;
  const VALID_RT = ["INTEREST","BUY","SELL","IMPORT","EXPORT"];
  const VALID_PRI = ["PRIMARY","SECONDARY","OCCASIONAL"];
  if (!product_id || !relationship_type) return res.status(400).json({ error: "product_id y relationship_type son requeridos" });
  if (!VALID_RT.includes(relationship_type)) return res.status(400).json({ error: `relationship_type debe ser: ${VALID_RT.join("|")}` });
  if (priority && !VALID_PRI.includes(priority)) return res.status(400).json({ error: `priority debe ser: ${VALID_PRI.join("|")}` });
  const prod = db.prepare("SELECT id FROM product_catalog WHERE id=? AND active=1").get(product_id);
  if (!prod) return res.status(400).json({ error: "Producto no válido" });
  try {
    const r = db.prepare(
      "INSERT INTO client_products (client_id,product_id,relationship_type,priority,notes) VALUES (?,?,?,?,?)"
    ).run(req.params.id, product_id, relationship_type, priority || "PRIMARY", notes || null);
    res.status(201).json(db.prepare("SELECT cp.*,pc.code,pc.name,pc.category FROM client_products cp JOIN product_catalog pc ON pc.id=cp.product_id WHERE cp.id=?").get(r.lastInsertRowid));
  } catch (e) {
    if (e.message.includes("UNIQUE")) return res.status(409).json({ error: "Ya existe esa combinación cliente/producto/tipo" });
    res.status(500).json({ error: e.message });
  }
});

// DELETE /clients/:id/products/:relId
router.delete("/:id/products/:relId", requireLevel(65), (req, res) => {
  const row = db.prepare("SELECT id FROM client_products WHERE id=? AND client_id=?").get(req.params.relId, req.params.id);
  if (!row) return res.status(404).json({ error: "Relación no encontrada" });
  db.prepare("DELETE FROM client_products WHERE id=?").run(req.params.relId);
  res.json({ ok: true });
});

// ─── CLIENT TIMELINE (:id/timeline) ───────────────────────────────────────────

// GET /clients/:id/timeline
router.get("/:id/timeline", requireLevel(65), (req, res) => {
  if (!getClientOrFail(req.params.id, res)) return;
  const { severity, event_type, limit = 100 } = req.query;
  let q = "SELECT ct.*, u.name AS created_by_name FROM client_timeline ct LEFT JOIN users u ON u.id=ct.created_by WHERE ct.client_id=?";
  const params = [req.params.id];
  if (severity)   { q += " AND ct.severity=?";    params.push(severity); }
  if (event_type) { q += " AND ct.event_type=?";  params.push(event_type); }
  q += ` ORDER BY ct.created_at DESC LIMIT ${Math.min(Number(limit) || 100, 500)}`;
  res.json(db.prepare(q).all(...params));
});

// POST /clients/:id/timeline (manual note-type events)
router.post("/:id/timeline", requireLevel(65), (req, res) => {
  if (!getClientOrFail(req.params.id, res)) return;
  const { event_type, event_description, severity, metadata } = req.body;
  const VALID_SEV = ["INFO","WARNING","CRITICAL"];
  if (!event_type || !event_description) return res.status(400).json({ error: "event_type y event_description son requeridos" });
  if (severity && !VALID_SEV.includes(severity)) return res.status(400).json({ error: `severity debe ser: ${VALID_SEV.join("|")}` });
  const r = db.prepare(
    "INSERT INTO client_timeline (client_id,event_type,event_description,severity,metadata,created_by) VALUES (?,?,?,?,?,?)"
  ).run(req.params.id, event_type, event_description, severity || "INFO", metadata ? JSON.stringify(metadata) : null, req.user.id);
  res.status(201).json(db.prepare("SELECT * FROM client_timeline WHERE id=?").get(r.lastInsertRowid));
});

// ─── CLIENT RELATIONSHIPS (:id/relationships) ─────────────────────────────────

const REL_TYPES = ["SUPPLIER_OF","BUYER_OF","BROKER_FOR","MANDATE_FOR","BANK_OF","LOGISTICS_PROVIDER_FOR","INSPECTION_PROVIDER_FOR","CERTIFICATION_PROVIDER_FOR"];

// GET /clients/:id/relationships
router.get("/:id/relationships", requireLevel(65), (req, res) => {
  if (!getClientOrFail(req.params.id, res)) return;
  const rows = db.prepare(`
    SELECT cr.id, cr.relationship_type, cr.notes, cr.created_at,
           src.id AS source_id, src.glv_code AS source_code, src.company AS source_company, src.name AS source_name,
           tgt.id AS target_id, tgt.glv_code AS target_code, tgt.company AS target_company, tgt.name AS target_name
    FROM client_relationships cr
    JOIN clients src ON src.id = cr.source_client_id
    JOIN clients tgt ON tgt.id = cr.target_client_id
    WHERE cr.source_client_id = ? OR cr.target_client_id = ?
    ORDER BY cr.created_at DESC
  `).all(req.params.id, req.params.id);
  res.json(rows);
});

// POST /clients/:id/relationships
router.post("/:id/relationships", requireLevel(75), (req, res) => {
  if (!getClientOrFail(req.params.id, res)) return;
  const { target_client_id, relationship_type, notes } = req.body;
  if (!target_client_id || !relationship_type) return res.status(400).json({ error: "target_client_id y relationship_type son requeridos" });
  if (!REL_TYPES.includes(relationship_type)) return res.status(400).json({ error: `relationship_type debe ser uno de: ${REL_TYPES.join("|")}` });
  if (Number(target_client_id) === Number(req.params.id)) return res.status(400).json({ error: "Un cliente no puede relacionarse consigo mismo" });
  const target = db.prepare("SELECT id FROM clients WHERE id=?").get(target_client_id);
  if (!target) return res.status(404).json({ error: "Cliente destino no encontrado" });
  try {
    const r = db.prepare(
      "INSERT INTO client_relationships (source_client_id,target_client_id,relationship_type,notes) VALUES (?,?,?,?)"
    ).run(req.params.id, target_client_id, relationship_type, notes || null);
    res.status(201).json(db.prepare("SELECT * FROM client_relationships WHERE id=?").get(r.lastInsertRowid));
  } catch (e) {
    if (e.message.includes("UNIQUE")) return res.status(409).json({ error: "Esa relación ya existe" });
    res.status(500).json({ error: e.message });
  }
});

// DELETE /clients/:id/relationships/:relId
router.delete("/:id/relationships/:relId", requireLevel(75), (req, res) => {
  const row = db.prepare("SELECT id FROM client_relationships WHERE id=? AND (source_client_id=? OR target_client_id=?)").get(req.params.relId, req.params.id, req.params.id);
  if (!row) return res.status(404).json({ error: "Relación no encontrada" });
  db.prepare("DELETE FROM client_relationships WHERE id=?").run(req.params.relId);
  res.json({ ok: true });
});

// ─── CLIENT NOTES (:id/notes) ─────────────────────────────────────────────────

// GET /clients/:id/notes
router.get("/:id/notes", requireLevel(65), (req, res) => {
  if (!getClientOrFail(req.params.id, res)) return;
  res.json(db.prepare(`
    SELECT cn.*, u.name AS created_by_name
    FROM client_notes cn
    LEFT JOIN users u ON u.id = cn.created_by
    WHERE cn.client_id = ?
    ORDER BY cn.pinned DESC, cn.created_at DESC
  `).all(req.params.id));
});

// POST /clients/:id/notes
router.post("/:id/notes", requireLevel(65), (req, res) => {
  if (!getClientOrFail(req.params.id, res)) return;
  const { body, pinned } = req.body;
  if (!body?.trim()) return res.status(400).json({ error: "body es requerido" });
  const r = db.prepare(
    "INSERT INTO client_notes (client_id,body,pinned,created_by) VALUES (?,?,?,?)"
  ).run(req.params.id, body.trim(), pinned ? 1 : 0, req.user.id);
  res.status(201).json(db.prepare("SELECT cn.*,u.name AS created_by_name FROM client_notes cn LEFT JOIN users u ON u.id=cn.created_by WHERE cn.id=?").get(r.lastInsertRowid));
});

// PATCH /clients/:id/notes/:noteId
router.patch("/:id/notes/:noteId", requireLevel(65), (req, res) => {
  const row = db.prepare("SELECT id, created_by FROM client_notes WHERE id=? AND client_id=?").get(req.params.noteId, req.params.id);
  if (!row) return res.status(404).json({ error: "Nota no encontrada" });
  const userLevel = ROLE_LEVEL[req.user?.role] || 0;
  if (row.created_by !== req.user.id && userLevel < 90) return res.status(403).json({ error: "Solo el autor o un administrador puede editar esta nota" });
  const { body, pinned } = req.body;
  const updates = [];
  const params = [];
  if (body !== undefined) { updates.push("body=?"); params.push(body.trim()); }
  if (pinned !== undefined) { updates.push("pinned=?"); params.push(pinned ? 1 : 0); }
  if (!updates.length) return res.status(400).json({ error: "Nada que actualizar" });
  updates.push("updated_at=datetime('now')");
  params.push(req.params.noteId);
  db.prepare(`UPDATE client_notes SET ${updates.join(",")} WHERE id=?`).run(...params);
  res.json(db.prepare("SELECT cn.*,u.name AS created_by_name FROM client_notes cn LEFT JOIN users u ON u.id=cn.created_by WHERE cn.id=?").get(req.params.noteId));
});

// DELETE /clients/:id/notes/:noteId
router.delete("/:id/notes/:noteId", requireLevel(65), (req, res) => {
  const row = db.prepare("SELECT id, created_by FROM client_notes WHERE id=? AND client_id=?").get(req.params.noteId, req.params.id);
  if (!row) return res.status(404).json({ error: "Nota no encontrada" });
  const userLevel = ROLE_LEVEL[req.user?.role] || 0;
  if (row.created_by !== req.user.id && userLevel < 90) return res.status(403).json({ error: "Solo el autor o un administrador puede eliminar esta nota" });
  db.prepare("DELETE FROM client_notes WHERE id=?").run(req.params.noteId);
  res.json({ ok: true });
});

module.exports = router;
