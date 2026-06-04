const express = require("express");
const db = require("../db/database");
const { authenticate } = require("../middleware/auth");
const { requireLevel } = require("../middleware/rbac");

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

// ─── DELETE /clients/:id — delete lead (CORPORATE_ADMIN 90+, not if ACTIVE_CLIENT) ──
router.delete("/:id", requireLevel(90), (req, res) => {
  try {
    const client = db.prepare("SELECT id, glv_code, kyc_status FROM clients WHERE id = ?").get(req.params.id);
    if (!client) return res.status(404).json({ error: "Cliente no encontrado" });
    if (client.kyc_status === "ACTIVE_CLIENT") {
      return res.status(400).json({ error: "No se puede eliminar un cliente activo. Use la función de archivar." });
    }

    db.prepare("DELETE FROM kyc_submissions WHERE mapped_to_id = ?").run(req.params.id);
    db.prepare("DELETE FROM clients WHERE id = ?").run(req.params.id);

    db.prepare(
      "INSERT INTO audit_log (username, action, doc_id, client_id, ip) VALUES (?, ?, ?, ?, ?)"
    ).run(req.user.username, "LEAD_DELETED", client.glv_code, client.id, req.ip);

    res.json({ ok: true, deleted_id: Number(req.params.id), glv_code: client.glv_code });
  } catch (e) {
    console.error("[DELETE /clients/:id]", e.message);
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
