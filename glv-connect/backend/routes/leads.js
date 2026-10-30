"use strict";
const express = require("express");
const router  = express.Router();
const db      = require("../db/database");
const { authenticate } = require("../middleware/auth");
const { requireLevel } = require("../middleware/rbac");

router.use(authenticate);
const { normalisePhone, generateLeadCode, autoAssign, findDuplicates } = require("../services/leadAssignmentService");
const { addBusinessHours } = require("../services/businessHoursService");
const { createAndSendLeadNotification } = require("../services/leadNotificationService");

const AGENT_LEVEL    = 42;
const MANAGER_LEVEL  = 72;
const DIRECTOR_LEVEL = 75;
const ADMIN_LEVEL    = 90;

function addTimeline(leadId, eventType, actor, description, metadata) {
  db.prepare(
    `INSERT INTO lead_timeline (lead_id, event_type, actor, description, metadata) VALUES (?,?,?,?,?)`
  ).run(leadId, eventType, actor || "SYSTEM", description || null, metadata ? JSON.stringify(metadata) : null);
}

function getUserId(username) {
  const u = db.prepare("SELECT id FROM users WHERE username=?").get(username);
  return u ? u.id : null;
}

// ── POST /leads ───────────────────────────────────────────────────────────────
router.post("/", requireLevel(AGENT_LEVEL), (req, res) => {
  try {
    const {
      contact_name, origin_channel = "OTHER", campaign, country_code, zone, city,
      language = "ES", company_name, phone_raw, email, product_type,
      quantity, quantity_unit, destination, port, notes,
    } = req.body;

    if (!contact_name) return res.status(400).json({ error: "contact_name requerido" });

    const phone_norm = normalisePhone(phone_raw);

    // Duplicate detection
    const possible_duplicates = findDuplicates(phone_norm, email, company_name);
    // Don't block; just warn (409 if exact phone match to prevent obvious duplication)
    if (phone_norm && possible_duplicates.length > 0) {
      // Return existing lead ids as warning but allow creation
    }

    const glv_code = generateLeadCode();

    const ins = db.prepare(`
      INSERT INTO leads (glv_code, origin_channel, campaign, country_code, zone, city,
        language, company_name, contact_name, phone_raw, phone_norm, email,
        product_type, quantity, quantity_unit, destination, port, notes, created_by)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `).run(
      glv_code, origin_channel, campaign || null, country_code || null, zone || null, city || null,
      language, company_name || null, contact_name, phone_raw || null, phone_norm,
      email || null, product_type || null, quantity || null, quantity_unit || null,
      destination || null, port || null, notes || null, req.user.username
    );
    const leadId = ins.lastInsertRowid;

    addTimeline(leadId, "CREATED", req.user.username, `Lead creado — canal: ${origin_channel}`);

    // Auto-assignment
    const leadData = { country_code, zone, product_type, origin_channel, language };
    const { agent, ruleId } = autoAssign(leadId, leadData);

    if (agent) {
      addTimeline(leadId, "ASSIGNED", "SYSTEM", `Auto-asignado a ${agent} por regla #${ruleId}`);

      // Create task for agent (assigned_to = user id)
      try {
        const agentUser = db.prepare("SELECT id FROM users WHERE username=?").get(agent);
        const deadline = db.prepare("SELECT first_contact_deadline FROM leads WHERE id=?").get(leadId)?.first_contact_deadline;
        db.prepare(`
          INSERT INTO tasks (title, description, priority, assigned_to, created_by, deadline)
          VALUES (?, ?, 'high', ?, ?, ?)
        `).run(
          `Realizar primer contacto con ${glv_code}`,
          `Lead ${glv_code} asignado. Canal: ${origin_channel}. Empresa: ${company_name || "—"}. Producto: ${product_type || "—"}. Límite: ${deadline || "—"}.`,
          agentUser ? agentUser.id : null,
          getUserId(req.user.username),
          deadline || null
        );
      } catch (te) { /* non-fatal */ }

      // Send notification (async)
      createAndSendLeadNotification(leadId, agent, "LEAD_ASSIGNED");
    }

    const lead = db.prepare("SELECT * FROM leads WHERE id=?").get(leadId);
    return res.status(201).json({ ...lead, possible_duplicates });
  } catch (e) {
    console.error("[POST /leads]", e.message);
    res.status(500).json({ error: "Error creando lead" });
  }
});

// ── GET /leads ────────────────────────────────────────────────────────────────
router.get("/", requireLevel(AGENT_LEVEL), (req, res) => {
  try {
    const { status, origin_channel, country_code, assigned_agent, limit = 200 } = req.query;
    const userLevel = require("../middleware/rbac").ROLE_LEVEL[req.user.role] || 0;

    let conditions = [];
    let params = [];

    // Agent isolation: agents see only their leads
    if (userLevel < MANAGER_LEVEL) {
      conditions.push("assigned_agent=?");
      params.push(req.user.username);
    }

    if (status)          { conditions.push("status=?");          params.push(status); }
    if (origin_channel)  { conditions.push("origin_channel=?");  params.push(origin_channel); }
    if (country_code)    { conditions.push("country_code=?");    params.push(country_code); }
    if (assigned_agent && userLevel >= MANAGER_LEVEL) {
      conditions.push("assigned_agent=?"); params.push(assigned_agent);
    }

    const where = conditions.length ? "WHERE " + conditions.join(" AND ") : "";
    const leads = db.prepare(`SELECT * FROM leads ${where} ORDER BY created_at DESC LIMIT ?`).all(...params, Number(limit));
    res.json(leads);
  } catch (e) {
    console.error("[GET /leads]", e.message);
    res.status(500).json({ error: "Error listando leads" });
  }
});

// ── GET /leads/:id ────────────────────────────────────────────────────────────
router.get("/:id", requireLevel(AGENT_LEVEL), (req, res) => {
  try {
    const lead = db.prepare("SELECT * FROM leads WHERE id=?").get(req.params.id);
    if (!lead) return res.status(404).json({ error: "Lead no encontrado" });

    const userLevel = require("../middleware/rbac").ROLE_LEVEL[req.user.role] || 0;
    if (userLevel < MANAGER_LEVEL && lead.assigned_agent !== req.user.username) {
      return res.status(403).json({ error: "Sin acceso a este lead" });
    }
    res.json(lead);
  } catch (e) {
    res.status(500).json({ error: "Error" });
  }
});

// ── PATCH /leads/:id/assign ───────────────────────────────────────────────────
router.patch("/:id/assign", requireLevel(MANAGER_LEVEL), (req, res) => {
  try {
    const lead = db.prepare("SELECT * FROM leads WHERE id=?").get(req.params.id);
    if (!lead) return res.status(404).json({ error: "Lead no encontrado" });

    const { agent_username, reason, status: newStatus } = req.body;
    const userLevel = require("../middleware/rbac").ROLE_LEVEL[req.user.role] || 0;

    const prevAgent  = lead.assigned_agent;
    const prevStatus = lead.status;

    let updates = [];
    let vals = [];

    if (agent_username && agent_username !== prevAgent) {
      if (userLevel < DIRECTOR_LEVEL) {
        return res.status(403).json({ error: "Solo DIRECTOR+ puede reasignar leads" });
      }
      const deadline = addBusinessHours(new Date(), 4);
      updates.push("assigned_agent=?", "assignment_rule_id=NULL", "status='ASSIGNED'",
        "assigned_at=datetime('now')", `first_contact_deadline='${deadline}'`);
      vals.push(agent_username);
    }

    if (newStatus) {
      updates.push("status=?"); vals.push(newStatus);
    }

    if (!updates.length) return res.status(400).json({ error: "Nada que actualizar" });

    updates.push("updated_at=datetime('now')");
    db.prepare(`UPDATE leads SET ${updates.join(",")} WHERE id=?`).run(...vals, lead.id);

    // Immutable audit
    db.prepare(`
      INSERT INTO lead_assignment_history (lead_id,prev_agent,new_agent,prev_status,new_status,changed_by,reason)
      VALUES (?,?,?,?,?,?,?)
    `).run(lead.id, prevAgent, agent_username || null, prevStatus, newStatus || "ASSIGNED", req.user.username, reason || null);

    if (agent_username && agent_username !== prevAgent) {
      addTimeline(lead.id, "REASSIGNED", req.user.username, `Reasignado a ${agent_username}. Motivo: ${reason || "—"}`);

      // Task for new agent
      try {
        const agentUser = db.prepare("SELECT id FROM users WHERE username=?").get(agent_username);
        db.prepare(`
          INSERT INTO tasks (title, description, priority, assigned_to, created_by)
          VALUES (?,?,?,?,?)
        `).run(
          `Realizar primer contacto con ${lead.glv_code}`,
          `Lead reasignado a usted. GLV: ${lead.glv_code}`,
          "high",
          agentUser ? agentUser.id : null,
          getUserId(req.user.username)
        );
      } catch (_) {}

      createAndSendLeadNotification(lead.id, agent_username, "LEAD_REASSIGNED");
    }

    if (newStatus === "ESCALATED") {
      addTimeline(lead.id, "ESCALATED", req.user.username, `Escalado. Motivo: ${reason || "—"}`);
    }

    const updated = db.prepare("SELECT * FROM leads WHERE id=?").get(lead.id);
    res.json(updated);
  } catch (e) {
    console.error("[PATCH /leads/:id/assign]", e.message);
    res.status(500).json({ error: "Error asignando lead" });
  }
});

// ── GET /leads/:id/timeline ───────────────────────────────────────────────────
router.get("/:id/timeline", requireLevel(AGENT_LEVEL), (req, res) => {
  try {
    const lead = db.prepare("SELECT * FROM leads WHERE id=?").get(req.params.id);
    if (!lead) return res.status(404).json({ error: "Lead no encontrado" });

    const userLevel = require("../middleware/rbac").ROLE_LEVEL[req.user.role] || 0;
    if (userLevel < MANAGER_LEVEL && lead.assigned_agent !== req.user.username) {
      return res.status(403).json({ error: "Sin acceso" });
    }
    const timeline = db.prepare("SELECT * FROM lead_timeline WHERE lead_id=? ORDER BY created_at ASC").all(req.params.id);
    res.json(timeline);
  } catch (e) {
    res.status(500).json({ error: "Error" });
  }
});

// ── POST /leads/:id/first-contact ─────────────────────────────────────────────
router.post("/:id/first-contact", requireLevel(AGENT_LEVEL), (req, res) => {
  try {
    const lead = db.prepare("SELECT * FROM leads WHERE id=?").get(req.params.id);
    if (!lead) return res.status(404).json({ error: "Lead no encontrado" });

    const userLevel = require("../middleware/rbac").ROLE_LEVEL[req.user.role] || 0;
    if (userLevel < MANAGER_LEVEL && lead.assigned_agent !== req.user.username) {
      return res.status(403).json({ error: "Sin acceso a este lead" });
    }

    const { contact_channel, contact_at, contacted_person, result, summary,
      confirmed_product, next_action, next_action_at, evidence_url } = req.body;

    if (!contact_channel || !contact_at || !result) {
      return res.status(400).json({ error: "contact_channel, contact_at y result son requeridos" });
    }

    const fcIns = db.prepare(`
      INSERT INTO lead_first_contacts
        (lead_id, contact_channel, contact_at, contacted_person, result, summary,
         confirmed_product, next_action, next_action_at, evidence_url, recorded_by)
      VALUES (?,?,?,?,?,?,?,?,?,?,?)
    `).run(
      lead.id, contact_channel, contact_at, contacted_person || null, result,
      summary || null, confirmed_product || null, next_action || null,
      next_action_at || null, evidence_url || null, req.user.username
    );

    // Update lead status
    db.prepare("UPDATE leads SET status='FIRST_CONTACT_DONE', updated_at=datetime('now') WHERE id=?").run(lead.id);

    // Mark first-contact task done
    try {
      const agentUser = db.prepare("SELECT id FROM users WHERE username=?").get(lead.assigned_agent || req.user.username);
      if (agentUser) {
        db.prepare(
          `UPDATE tasks SET status='completed', updated_at=datetime('now')
           WHERE assigned_to=? AND title LIKE ? AND status != 'completed'`
        ).run(agentUser.id, `%${lead.glv_code}%`);
      }
    } catch (_) {}

    // Create follow-up (48 biz hours)
    const fuDeadline = addBusinessHours(new Date(), 48);
    let fuTaskId = null;
    try {
      const agentUser2 = db.prepare("SELECT id FROM users WHERE username=?").get(lead.assigned_agent || req.user.username);
      const tIns = db.prepare(`
        INSERT INTO tasks (title, description, priority, assigned_to, created_by, deadline)
        VALUES (?,?,?,?,?,?)
      `).run(
        `Registrar respuesta de ${lead.glv_code}`,
        `Seguimiento a lead ${lead.glv_code}. Confirmar respuesta del cliente en las próximas 48 horas hábiles.`,
        "medium",
        agentUser2 ? agentUser2.id : null,
        getUserId(req.user.username),
        fuDeadline
      );
      fuTaskId = tIns.lastInsertRowid;
    } catch (_) {}

    const fuIns = db.prepare(`
      INSERT INTO lead_followups (lead_id, task_id, deadline)
      VALUES (?,?,?)
    `).run(lead.id, fuTaskId, fuDeadline);

    // Update lead status to awaiting response
    db.prepare("UPDATE leads SET status='AWAITING_RESPONSE', updated_at=datetime('now') WHERE id=?").run(lead.id);

    addTimeline(lead.id, "CONTACTED", req.user.username, `Primer contacto vía ${contact_channel}. Resultado: ${result}`);

    res.status(201).json({
      first_contact: { id: fcIns.lastInsertRowid },
      followup: { id: fuIns.lastInsertRowid, deadline: fuDeadline },
    });
  } catch (e) {
    console.error("[POST /leads/:id/first-contact]", e.message);
    res.status(500).json({ error: "Error registrando primer contacto" });
  }
});

// ── PATCH /leads/:id/followup/:fid ────────────────────────────────────────────
router.patch("/:id/followup/:fid", requireLevel(AGENT_LEVEL), (req, res) => {
  try {
    const fu = db.prepare("SELECT * FROM lead_followups WHERE id=? AND lead_id=?").get(req.params.fid, req.params.id);
    if (!fu) return res.status(404).json({ error: "Seguimiento no encontrado" });

    const { status, escalated_to, closed_by } = req.body;
    const updates = ["updated_at=datetime('now')"];
    const vals = [];

    if (status) { updates.push("status=?"); vals.push(status); }
    if (escalated_to) { updates.push("escalated_to=?", "escalated_at=datetime('now')"); vals.push(escalated_to); }
    if (status === "CLOSED") { updates.push("closed_at=datetime('now')", "closed_by=?"); vals.push(closed_by || req.user.username); }

    db.prepare(`UPDATE lead_followups SET ${updates.join(",")} WHERE id=?`).run(...vals, fu.id);

    // Sync lead status
    if (status) {
      const leadStatus = {
        CLIENT_RESPONDED: "CLIENT_RESPONDED",
        ESCALATED: "ESCALATED",
        CLOSED: "CLOSED",
      }[status];
      if (leadStatus) {
        db.prepare("UPDATE leads SET status=?, updated_at=datetime('now') WHERE id=?").run(leadStatus, req.params.id);
        addTimeline(req.params.id, status, req.user.username, `Seguimiento actualizado: ${status}`);
      }
    }

    res.json(db.prepare("SELECT * FROM lead_followups WHERE id=?").get(fu.id));
  } catch (e) {
    res.status(500).json({ error: "Error actualizando seguimiento" });
  }
});

// ── Lead Assignment Rules ─────────────────────────────────────────────────────
router.get("/rules/list", requireLevel(DIRECTOR_LEVEL), (req, res) => {
  res.json(db.prepare("SELECT * FROM lead_assignment_rules ORDER BY priority DESC, created_at DESC").all());
});

router.post("/rules/create", requireLevel(DIRECTOR_LEVEL), (req, res) => {
  const { country_code, zone, product_type, origin_channel, language, agent_username, priority = 50, valid_from, valid_until } = req.body;
  if (!agent_username) return res.status(400).json({ error: "agent_username requerido" });
  const r = db.prepare(`
    INSERT INTO lead_assignment_rules (country_code,zone,product_type,origin_channel,language,agent_username,priority,valid_from,valid_until,created_by)
    VALUES (?,?,?,?,?,?,?,?,?,?)
  `).run(country_code || null, zone || null, product_type || null, origin_channel || null, language || null,
    agent_username, priority, valid_from || null, valid_until || null, req.user.username);
  res.status(201).json(db.prepare("SELECT * FROM lead_assignment_rules WHERE id=?").get(r.lastInsertRowid));
});

router.patch("/rules/:id", requireLevel(DIRECTOR_LEVEL), (req, res) => {
  const { agent_username, priority, is_active, valid_until } = req.body;
  const updates = ["updated_at=datetime('now')"];
  const vals = [];
  if (agent_username !== undefined) { updates.push("agent_username=?"); vals.push(agent_username); }
  if (priority !== undefined)      { updates.push("priority=?");       vals.push(priority); }
  if (is_active !== undefined)     { updates.push("is_active=?");      vals.push(is_active); }
  if (valid_until !== undefined)   { updates.push("valid_until=?");    vals.push(valid_until); }
  db.prepare(`UPDATE lead_assignment_rules SET ${updates.join(",")} WHERE id=?`).run(...vals, req.params.id);
  res.json(db.prepare("SELECT * FROM lead_assignment_rules WHERE id=?").get(req.params.id));
});

router.delete("/rules/:id", requireLevel(DIRECTOR_LEVEL), (req, res) => {
  db.prepare("UPDATE lead_assignment_rules SET is_active=0, updated_at=datetime('now') WHERE id=?").run(req.params.id);
  res.json({ ok: true });
});

// ── Business Hours Config ─────────────────────────────────────────────────────
router.get("/config/business-hours", requireLevel(DIRECTOR_LEVEL), (req, res) => {
  res.json(db.prepare("SELECT * FROM business_hours_config WHERE id=1").get());
});

router.patch("/config/business-hours", requireLevel(ADMIN_LEVEL), (req, res) => {
  const { timezone, workday_start, workday_end, work_days, holiday_dates } = req.body;
  const updates = ["updated_at=datetime('now')", "updated_by=?"];
  const vals = [req.user.username];
  if (timezone !== undefined)      { updates.push("timezone=?");      vals.push(timezone); }
  if (workday_start !== undefined) { updates.push("workday_start=?"); vals.push(workday_start); }
  if (workday_end !== undefined)   { updates.push("workday_end=?");   vals.push(workday_end); }
  if (work_days !== undefined)     { updates.push("work_days=?");     vals.push(work_days); }
  if (holiday_dates !== undefined) { updates.push("holiday_dates=?"); vals.push(JSON.stringify(holiday_dates)); }
  db.prepare(`UPDATE business_hours_config SET ${updates.join(",")} WHERE id=1`).run(...vals);
  res.json(db.prepare("SELECT * FROM business_hours_config WHERE id=1").get());
});

module.exports = router;
