"use strict";
const express = require("express");
const router  = express.Router();
const db      = require("../db/database");
const { authenticate } = require("../middleware/auth");
const { requireLevel, ROLE_LEVEL } = require("../middleware/rbac");

router.use(authenticate);
const { normalisePhone, generateLeadCode, autoAssign, findDuplicates } = require("../services/leadAssignmentService");
const { addBusinessHours } = require("../services/businessHoursService");
const { createAndSendLeadNotification } = require("../services/leadNotificationService");
const { isCorporateEmail } = require("../utils/emailValidator");

const AGENT_LEVEL    = 42;
const MANAGER_LEVEL  = 72;
const DIRECTOR_LEVEL = 75;
const ADMIN_LEVEL    = 90;

const COMMERCIAL_ROLES = new Set([
  "COMMERCIAL_AGENT","COMMERCIAL_MANAGER","COMMERCIAL_DIRECTOR","AGENTE","DIRECTOR","SUPER_ADMIN","CORPORATE_ADMIN",
]);

const TASK_TYPE = {
  FIRST_CONTACT:            "FIRST_CONTACT",
  CLIENT_RESPONSE_FOLLOWUP: "CLIENT_RESPONSE_FOLLOWUP",
  ESCALATION_FIRST_CONTACT: "ESCALATION_FIRST_CONTACT",
  ESCALATION_FOLLOWUP:      "ESCALATION_FOLLOWUP",
  REMINDER_FIRST_CONTACT:   "REMINDER_FIRST_CONTACT",
  REMINDER_FOLLOWUP:        "REMINDER_FOLLOWUP",
};

function validateAgent(agentUsername) {
  const user = db.prepare("SELECT * FROM users WHERE username=?").get(agentUsername);
  if (!user) return { ok: false, reason: `Agente ${agentUsername} no existe` };
  if ('active' in user && user.active === 0) {
    return { ok: false, reason: `${agentUsername} no tiene cuenta activa` };
  }
  if (!COMMERCIAL_ROLES.has(user.role)) {
    return { ok: false, reason: `${agentUsername} no tiene rol comercial autorizado` };
  }
  try {
    if (!isCorporateEmail(user.email)) {
      return { ok: false, reason: `${agentUsername} no tiene correo corporativo válido` };
    }
  } catch (e) {
    return { ok: false, reason: e.message };
  }
  return { ok: true, user };
}

function addTimeline(leadId, eventType, actor, description, metadata) {
  db.prepare(
    `INSERT INTO lead_timeline (lead_id, event_type, actor, description, metadata) VALUES (?,?,?,?,?)`
  ).run(leadId, eventType, actor || "SYSTEM", description || null, metadata ? JSON.stringify(metadata) : null);
}

function getUserId(username) {
  const u = db.prepare("SELECT id FROM users WHERE username=?").get(username);
  return u ? u.id : null;
}

function cancelActiveTask(leadId, agentUsername) {
  const agentUser = db.prepare("SELECT id FROM users WHERE username=?").get(agentUsername);
  if (!agentUser) return;
  db.prepare(
    `UPDATE tasks SET status='CANCELADA', updated_at=datetime('now')
     WHERE lead_id=? AND task_type=? AND assigned_to=? AND status NOT IN ('COMPLETADA','CANCELADA','completed')`
  ).run(leadId, TASK_TYPE.FIRST_CONTACT, agentUser.id);
}

function createContactTask(glvCode, agentUsername, deadlineISO, createdByUsername, description) {
  const agentUser = db.prepare("SELECT id FROM users WHERE username=?").get(agentUsername);
  const creatorId = getUserId(createdByUsername);
  db.prepare(`
    INSERT INTO tasks (title, description, priority, assigned_to, created_by, deadline)
    VALUES (?,?,?,?,?,?)
  `).run(
    `Realizar primer contacto con ${glvCode}`,
    description || `Lead ${glvCode} asignado. Límite: ${deadlineISO || "—"}.`,
    "high",
    agentUser ? agentUser.id : null,
    creatorId,
    deadlineISO || null
  );
  const row = db.prepare("SELECT id FROM tasks ORDER BY id DESC LIMIT 1").get();
  return row ? row.id : null;
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

    // Duplicate detection (warn only)
    const possible_duplicates = findDuplicates(phone_norm, email, company_name);

    const glv_code = generateLeadCode();

    // Determine auto-assignment before transaction (read-only)
    const leadData = { country_code, zone, product_type, origin_channel, language };
    const rule = (() => {
      const { findRule } = require("../services/leadAssignmentService");
      return findRule(leadData);
    })();

    // Validate rule agent before committing (Finding 6)
    let validatedRule = rule;
    let agentValidationFailure = null;
    if (rule) {
      const v = validateAgent(rule.agent_username);
      if (!v.ok) {
        validatedRule = null;
        agentValidationFailure = { ruleId: rule.id, agentUsername: rule.agent_username, reason: v.reason };
      }
    }

    const deadline = validatedRule ? addBusinessHours(new Date(), 4) : null;

    // Transactional creation: lead + assignment + timeline + task + notification
    const createTx = db.transaction(() => {
      const ins = db.prepare(`
        INSERT INTO leads (glv_code, origin_channel, campaign, country_code, zone, city,
          language, company_name, contact_name, phone_raw, phone_norm, email,
          product_type, quantity, quantity_unit, destination, port, notes,
          status, assigned_agent, assignment_rule_id, assigned_at, first_contact_deadline, created_by)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
      `).run(
        glv_code, origin_channel, campaign || null, country_code || null, zone || null, city || null,
        language, company_name || null, contact_name, phone_raw || null, phone_norm,
        email || null, product_type || null, quantity || null, quantity_unit || null,
        destination || null, port || null, notes || null,
        validatedRule ? "ASSIGNED" : "PENDING_ASSIGNMENT",
        validatedRule ? validatedRule.agent_username : null,
        validatedRule ? validatedRule.id : null,
        validatedRule ? new Date().toISOString() : null,
        deadline,
        req.user.username
      );
      const leadId = ins.lastInsertRowid;

      // Timeline: CREATED
      db.prepare(`INSERT INTO lead_timeline (lead_id, event_type, actor, description) VALUES (?,?,?,?)`)
        .run(leadId, "CREATED", req.user.username, `Lead creado — canal: ${origin_channel}`);

      // If agent validation failed, log audit event + supervisor task
      if (agentValidationFailure) {
        db.prepare(`INSERT INTO lead_timeline (lead_id, event_type, actor, description) VALUES (?,?,?,?)`)
          .run(leadId, "ASSIGNMENT_FAILED", "SYSTEM",
            `Regla #${agentValidationFailure.ruleId} intentó asignar a ${agentValidationFailure.agentUsername}: ${agentValidationFailure.reason}. Lead enviado a cola.`);
        const sup = db.prepare(`SELECT id,username FROM users WHERE role IN ('COMMERCIAL_MANAGER','DIRECTOR','SUPER_ADMIN') ORDER BY id LIMIT 1`).get();
        if (sup) {
          db.prepare(`INSERT INTO tasks (title,description,status,priority,assigned_to,created_by,lead_id,task_type) VALUES (?,?,?,?,?,?,?,?)`)
            .run(`[PENDIENTE] Lead sin agente válido: ${glv_code}`,
              `Regla automática falló: ${agentValidationFailure.reason}`,
              "PENDIENTE","ALTA", sup.id, null, leadId, TASK_TYPE.ESCALATION_FIRST_CONTACT);
        }
      }

      if (validatedRule) {
        // Timeline: ASSIGNED
        db.prepare(`INSERT INTO lead_timeline (lead_id, event_type, actor, description) VALUES (?,?,?,?)`)
          .run(leadId, "ASSIGNED", "SYSTEM", `Auto-asignado a ${validatedRule.agent_username} por regla #${validatedRule.id}`);

        // Assignment history
        db.prepare(`
          INSERT INTO lead_assignment_history (lead_id,prev_agent,new_agent,prev_status,new_status,rule_id,changed_by,reason)
          VALUES (?,?,?,?,?,?,?,?)
        `).run(leadId, null, validatedRule.agent_username, "PENDING_ASSIGNMENT", "ASSIGNED", validatedRule.id, "SYSTEM", "Auto-asignación por regla");

        // Task for agent (linked by lead_id + task_type)
        const agentUser = db.prepare("SELECT id FROM users WHERE username=?").get(validatedRule.agent_username);
        db.prepare(`
          INSERT INTO tasks (title, description, priority, assigned_to, created_by, deadline, lead_id, task_type)
          VALUES (?,?,?,?,?,?,?,?)
        `).run(
          `Realizar primer contacto con ${glv_code}`,
          `Lead ${glv_code} asignado. Canal: ${origin_channel}. Empresa: ${company_name || "—"}. Límite: ${deadline || "—"}.`,
          "high",
          agentUser ? agentUser.id : null,
          getUserId(req.user.username),
          deadline || null,
          leadId,
          TASK_TYPE.FIRST_CONTACT
        );

        // Notification inserted outside transaction to allow async send to update status
      }

      return leadId;
    });

    const leadId = createTx();

    // Async email send (after commit)
    if (validatedRule) {
      setImmediate(() => {
        try { createAndSendLeadNotification(leadId, validatedRule.agent_username, "LEAD_ASSIGNED"); } catch (_) {}
      });
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
    const userLevel = ROLE_LEVEL[req.user.role] || 0;
    const conditions = [];
    const params = [];

    if (userLevel < MANAGER_LEVEL) {
      conditions.push("assigned_agent=?");
      params.push(req.user.username);
    }

    if (status)         { conditions.push("status=?");         params.push(status); }
    if (origin_channel) { conditions.push("origin_channel=?"); params.push(origin_channel); }
    if (country_code)   { conditions.push("country_code=?");   params.push(country_code); }
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
router.get("/:id(\\d+)", requireLevel(AGENT_LEVEL), (req, res) => {
  try {
    const lead = db.prepare("SELECT * FROM leads WHERE id=?").get(req.params.id);
    if (!lead) return res.status(404).json({ error: "Lead no encontrado" });
    const userLevel = ROLE_LEVEL[req.user.role] || 0;
    if (userLevel < MANAGER_LEVEL && lead.assigned_agent !== req.user.username) {
      return res.status(403).json({ error: "Sin acceso a este lead" });
    }
    res.json(lead);
  } catch (e) {
    res.status(500).json({ error: "Error" });
  }
});

// ── PATCH /leads/:id/assign ───────────────────────────────────────────────────
router.patch("/:id(\\d+)/assign", requireLevel(MANAGER_LEVEL), (req, res) => {
  try {
    const lead = db.prepare("SELECT * FROM leads WHERE id=?").get(req.params.id);
    if (!lead) return res.status(404).json({ error: "Lead no encontrado" });

    const { agent_username, reason, status: newStatus } = req.body;
    const userLevel  = ROLE_LEVEL[req.user.role] || 0;
    const prevAgent  = lead.assigned_agent;
    const prevStatus = lead.status;

    // Handle pure status change (e.g. ESCALATED) without agent change
    if (!agent_username && newStatus) {
      db.prepare(`UPDATE leads SET status=?, updated_at=datetime('now') WHERE id=?`).run(newStatus, lead.id);
      db.prepare(`
        INSERT INTO lead_assignment_history (lead_id,prev_agent,new_agent,prev_status,new_status,changed_by,reason)
        VALUES (?,?,?,?,?,?,?)
      `).run(lead.id, prevAgent, prevAgent, prevStatus, newStatus, req.user.username, reason || null);
      addTimeline(lead.id, newStatus, req.user.username, `Estado cambiado a ${newStatus}. Motivo: ${reason || "—"}`);
      return res.json(db.prepare("SELECT * FROM leads WHERE id=?").get(lead.id));
    }

    // Reassignment requires DIRECTOR+
    if (userLevel < DIRECTOR_LEVEL) {
      return res.status(403).json({ error: "Solo DIRECTOR+ puede reasignar leads" });
    }
    if (!agent_username) return res.status(400).json({ error: "agent_username requerido" });
    if (!reason || !reason.trim()) return res.status(400).json({ error: "Motivo de reasignación requerido" });

    // Validate new agent
    const vResult = validateAgent(agent_username);
    if (!vResult.ok) {
      return res.status(400).json({ error: vResult.reason });
    }
    const newAgentUser = vResult.user;

    const newDeadline = addBusinessHours(new Date(), 4);

    const reassignTx = db.transaction(() => {
      // Cancel old agent's task (by lead_id + task_type)
      if (prevAgent && prevAgent !== agent_username) {
        cancelActiveTask(lead.id, prevAgent);
      }

      // Update lead
      db.prepare(`
        UPDATE leads SET assigned_agent=?, assignment_rule_id=NULL, status='ASSIGNED',
          assigned_at=datetime('now'), first_contact_deadline=?, updated_at=datetime('now')
        WHERE id=?
      `).run(agent_username, newDeadline, lead.id);

      // Immutable audit
      db.prepare(`
        INSERT INTO lead_assignment_history (lead_id,prev_agent,new_agent,prev_status,new_status,changed_by,reason)
        VALUES (?,?,?,?,?,?,?)
      `).run(lead.id, prevAgent, agent_username, prevStatus, "ASSIGNED", req.user.username, reason);

      // Timeline
      db.prepare(`INSERT INTO lead_timeline (lead_id, event_type, actor, description) VALUES (?,?,?,?)`)
        .run(lead.id, "REASSIGNED", req.user.username, `Reasignado a ${agent_username}. Motivo: ${reason}`);

      // New task for new agent (linked by lead_id + task_type)
      const agentUser = db.prepare("SELECT id FROM users WHERE username=?").get(agent_username);
      db.prepare(`
        INSERT INTO tasks (title, description, priority, assigned_to, created_by, deadline, lead_id, task_type)
        VALUES (?,?,?,?,?,?,?,?)
      `).run(
        `Realizar primer contacto con ${lead.glv_code}`,
        `Lead reasignado a usted. GLV: ${lead.glv_code}. Límite: ${newDeadline}.`,
        "high",
        agentUser ? agentUser.id : null,
        getUserId(req.user.username),
        newDeadline,
        lead.id,
        TASK_TYPE.FIRST_CONTACT
      );

    });

    reassignTx();

    // Async email (no pre-insert — createAndSendLeadNotification owns insert+send)
    setImmediate(() => {
      try { createAndSendLeadNotification(lead.id, agent_username, "LEAD_REASSIGNED"); } catch (_) {}
    });

    res.json(db.prepare("SELECT * FROM leads WHERE id=?").get(lead.id));
  } catch (e) {
    console.error("[PATCH /leads/:id/assign]", e.message);
    res.status(500).json({ error: "Error asignando lead" });
  }
});

// ── GET /leads/:id/timeline ───────────────────────────────────────────────────
router.get("/:id(\\d+)/timeline", requireLevel(AGENT_LEVEL), (req, res) => {
  try {
    const lead = db.prepare("SELECT * FROM leads WHERE id=?").get(req.params.id);
    if (!lead) return res.status(404).json({ error: "Lead no encontrado" });
    const userLevel = ROLE_LEVEL[req.user.role] || 0;
    if (userLevel < MANAGER_LEVEL && lead.assigned_agent !== req.user.username) {
      return res.status(403).json({ error: "Sin acceso" });
    }
    res.json(db.prepare("SELECT * FROM lead_timeline WHERE lead_id=? ORDER BY created_at ASC").all(req.params.id));
  } catch (e) {
    res.status(500).json({ error: "Error" });
  }
});

// ── POST /leads/:id/first-contact ─────────────────────────────────────────────
router.post("/:id(\\d+)/first-contact", requireLevel(AGENT_LEVEL), (req, res) => {
  try {
    const lead = db.prepare("SELECT * FROM leads WHERE id=?").get(req.params.id);
    if (!lead) return res.status(404).json({ error: "Lead no encontrado" });

    const userLevel = ROLE_LEVEL[req.user.role] || 0;
    if (userLevel < MANAGER_LEVEL && lead.assigned_agent !== req.user.username) {
      return res.status(403).json({ error: "Sin acceso a este lead" });
    }

    // First contact is immutable — only one allowed
    const existing = db.prepare("SELECT id FROM lead_first_contacts WHERE lead_id=?").get(lead.id);
    if (existing) {
      return res.status(409).json({ error: "Ya existe un registro de primer contacto para este lead" });
    }

    const { contact_channel, contact_at, contacted_person, result, summary,
      confirmed_product, next_action, next_action_at, evidence_url } = req.body;

    if (!contact_channel || !contact_at || !result) {
      return res.status(400).json({ error: "contact_channel, contact_at y result son requeridos" });
    }

    const fuDeadline = addBusinessHours(new Date(), 48);

    const firstContactTx = db.transaction(() => {
      // Insert first contact (unique index enforces one per lead)
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

      // Close FIRST_CONTACT task by lead_id + task_type (not title LIKE)
      db.prepare(
        `UPDATE tasks SET status='COMPLETADA', updated_at=datetime('now')
         WHERE lead_id=? AND task_type=? AND status NOT IN ('COMPLETADA','CANCELADA','completed')`
      ).run(lead.id, TASK_TYPE.FIRST_CONTACT);

      // Create follow-up task (linked by lead_id + task_type)
      const agentForTask = lead.assigned_agent || req.user.username;
      const agentUser2 = db.prepare("SELECT id FROM users WHERE username=?").get(agentForTask);
      const tIns = db.prepare(`
        INSERT INTO tasks (title, description, priority, assigned_to, created_by, deadline, lead_id, task_type)
        VALUES (?,?,?,?,?,?,?,?)
      `).run(
        `Registrar respuesta de ${lead.glv_code}`,
        `Seguimiento a lead ${lead.glv_code}. Confirmar respuesta en 48 horas hábiles.`,
        "medium",
        agentUser2 ? agentUser2.id : null,
        getUserId(req.user.username),
        fuDeadline,
        lead.id,
        TASK_TYPE.CLIENT_RESPONSE_FOLLOWUP
      );

      // Follow-up record
      const fuIns = db.prepare(`
        INSERT INTO lead_followups (lead_id, task_id, deadline) VALUES (?,?,?)
      `).run(lead.id, tIns.lastInsertRowid, fuDeadline);

      // Update lead status
      db.prepare("UPDATE leads SET status='AWAITING_RESPONSE', updated_at=datetime('now') WHERE id=?").run(lead.id);

      // Timeline
      db.prepare(`INSERT INTO lead_timeline (lead_id, event_type, actor, description) VALUES (?,?,?,?)`)
        .run(lead.id, "CONTACTED", req.user.username, `Primer contacto vía ${contact_channel}. Resultado: ${result}`);

      return { fcId: fcIns.lastInsertRowid, fuId: fuIns.lastInsertRowid };
    });

    const { fcId, fuId } = firstContactTx();

    res.status(201).json({
      first_contact: { id: fcId },
      followup: { id: fuId, deadline: fuDeadline },
    });
  } catch (e) {
    if (e.message?.includes("UNIQUE")) {
      return res.status(409).json({ error: "Ya existe un registro de primer contacto para este lead" });
    }
    console.error("[POST /leads/:id/first-contact]", e.message);
    res.status(500).json({ error: "Error registrando primer contacto" });
  }
});

// ── PATCH /leads/:id/followup/:fid ────────────────────────────────────────────
router.patch("/:id(\\d+)/followup/:fid", requireLevel(AGENT_LEVEL), (req, res) => {
  try {
    const fu = db.prepare("SELECT * FROM lead_followups WHERE id=? AND lead_id=?").get(req.params.fid, req.params.id);
    if (!fu) return res.status(404).json({ error: "Seguimiento no encontrado" });

    // Load lead to check agent isolation
    const lead = db.prepare("SELECT * FROM leads WHERE id=?").get(req.params.id);
    if (!lead) return res.status(404).json({ error: "Lead no encontrado" });

    const userLevel = ROLE_LEVEL[req.user.role] || 0;
    if (userLevel < MANAGER_LEVEL && lead.assigned_agent !== req.user.username) {
      return res.status(403).json({ error: "No autorizado para modificar este seguimiento" });
    }

    const { status, escalated_to, closed_by } = req.body;

    // Validate state transition
    const validTransitions = {
      AWAITING_RESPONSE:       ["CLIENT_RESPONDED","SECOND_CONTACT_REQUIRED","FOLLOW_UP_SCHEDULED","ESCALATED","CLOSED"],
      SECOND_CONTACT_REQUIRED: ["AWAITING_RESPONSE","FOLLOW_UP_SCHEDULED","ESCALATED","CLOSED"],
      FOLLOW_UP_SCHEDULED:     ["AWAITING_RESPONSE","SECOND_CONTACT_REQUIRED","ESCALATED","CLOSED"],
      CLIENT_RESPONDED:        ["CLOSED"],
      ESCALATED:               ["CLOSED"],
    };
    if (status && validTransitions[fu.status] && !validTransitions[fu.status].includes(status)) {
      return res.status(400).json({ error: `Transición inválida: ${fu.status} → ${status}` });
    }

    const updates = ["updated_at=datetime('now')"];
    const vals    = [];

    if (status)       { updates.push("status=?");                    vals.push(status); }
    if (escalated_to) { updates.push("escalated_to=?","escalated_at=datetime('now')"); vals.push(escalated_to); }
    if (status === "CLOSED") {
      updates.push("closed_at=datetime('now')","closed_by=?");
      vals.push(closed_by || req.user.username);
    }

    db.prepare(`UPDATE lead_followups SET ${updates.join(",")} WHERE id=?`).run(...vals, fu.id);

    if (status) {
      const leadStatus = { CLIENT_RESPONDED:"CLIENT_RESPONDED", ESCALATED:"ESCALATED", CLOSED:"CLOSED" }[status];
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
  `).run(country_code || null, zone || null, product_type || null, origin_channel || null,
    language || null, agent_username, priority, valid_from || null, valid_until || null, req.user.username);
  res.status(201).json(db.prepare("SELECT * FROM lead_assignment_rules WHERE id=?").get(r.lastInsertRowid));
});

router.patch("/rules/:id", requireLevel(DIRECTOR_LEVEL), (req, res) => {
  const { agent_username, priority, is_active, valid_until } = req.body;
  const updates = ["updated_at=datetime('now')"]; const vals = [];
  if (agent_username !== undefined) { updates.push("agent_username=?"); vals.push(agent_username); }
  if (priority !== undefined)       { updates.push("priority=?");       vals.push(priority); }
  if (is_active !== undefined)      { updates.push("is_active=?");      vals.push(is_active); }
  if (valid_until !== undefined)    { updates.push("valid_until=?");    vals.push(valid_until); }
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
  const updates = ["updated_at=datetime('now')","updated_by=?"]; const vals = [req.user.username];
  if (timezone !== undefined)      { updates.push("timezone=?");      vals.push(timezone); }
  if (workday_start !== undefined) { updates.push("workday_start=?"); vals.push(workday_start); }
  if (workday_end !== undefined)   { updates.push("workday_end=?");   vals.push(workday_end); }
  if (work_days !== undefined)     { updates.push("work_days=?");     vals.push(work_days); }
  if (holiday_dates !== undefined) { updates.push("holiday_dates=?"); vals.push(JSON.stringify(holiday_dates)); }
  db.prepare(`UPDATE business_hours_config SET ${updates.join(",")} WHERE id=1`).run(...vals);
  res.json(db.prepare("SELECT * FROM business_hours_config WHERE id=1").get());
});

module.exports = router;
