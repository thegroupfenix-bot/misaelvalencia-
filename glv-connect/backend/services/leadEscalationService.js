"use strict";
const db = require("../db/database");
const { isCorporateEmail } = require("../utils/emailValidator");

const TASK_TYPE = {
  ESCALATION_FIRST_CONTACT: "ESCALATION_FIRST_CONTACT",
  ESCALATION_FOLLOWUP:      "ESCALATION_FOLLOWUP",
  REMINDER_FIRST_CONTACT:   "REMINDER_FIRST_CONTACT",
  REMINDER_FOLLOWUP:        "REMINDER_FOLLOWUP",
};

function getSupervisorId() {
  const candidates = db.prepare(
    `SELECT id, username, email FROM users
     WHERE role IN ('COMMERCIAL_MANAGER','DIRECTOR','SUPER_ADMIN')
       AND active=1
     ORDER BY id`
  ).all();
  for (const c of candidates) {
    try {
      if (isCorporateEmail(c.email)) return { id: c.id, username: c.username };
    } catch (_) { /* skip if email check throws in production */ }
  }
  return null;
}

function hasTimeline(leadId, eventType) {
  return !!db.prepare(`SELECT id FROM lead_timeline WHERE lead_id=? AND event_type=?`).get(leadId, eventType);
}

function hasTask(leadId, taskType) {
  return !!db.prepare(
    `SELECT id FROM tasks WHERE lead_id=? AND task_type=? AND status NOT IN ('COMPLETADA','CANCELADA','completed')`
  ).get(leadId, taskType);
}

function getAgentId(username) {
  if (!username) return null;
  const u = db.prepare("SELECT id FROM users WHERE username=?").get(username);
  return u ? u.id : null;
}

/**
 * Idempotent escalation + reminder check.
 * Runs every 5 minutes in production.
 */
function runEscalationCheck() {
  const now            = new Date().toISOString();
  const oneHourFromNow = new Date(Date.now() + 3600000).toISOString();

  // ── First contact escalation ────────────────────────────────────────────────
  const overdueFC = db.prepare(`
    SELECT * FROM leads
    WHERE status IN ('ASSIGNED','FIRST_CONTACT_PENDING')
      AND first_contact_deadline IS NOT NULL
      AND first_contact_deadline < ?
  `).all(now);

  for (const lead of overdueFC) {
    if (hasTimeline(lead.id, "ESCALATED_FIRST_CONTACT")) continue;

    db.prepare(`INSERT INTO lead_timeline (lead_id, event_type, actor, description, created_at) VALUES (?,?,?,?,datetime('now'))`)
      .run(lead.id, "ESCALATED_FIRST_CONTACT", "system",
        `Vencimiento de primer contacto sin respuesta. Lead escalado a supervisor.`);

    db.prepare(`UPDATE leads SET status='ESCALATED', updated_at=datetime('now') WHERE id=?`).run(lead.id);

    // Supervisor task (idempotent by lead_id + task_type)
    if (!hasTask(lead.id, TASK_TYPE.ESCALATION_FIRST_CONTACT)) {
      const sup = getSupervisorId();
      if (sup) {
        db.prepare(`INSERT INTO tasks (title, description, status, priority, assigned_to, created_by, lead_id, task_type) VALUES (?,?,?,?,?,?,?,?)`)
          .run(
            `[ESCALADO] Primer contacto vencido: ${lead.glv_code}`,
            `El agente ${lead.assigned_agent || "—"} no completó el primer contacto. Requiere decisión humana. No reasignar automáticamente.`,
            "PENDIENTE", "ALTA", sup.id, null, lead.id, TASK_TYPE.ESCALATION_FIRST_CONTACT
          );
      }
    }
  }

  // ── First contact reminder ──────────────────────────────────────────────────
  const dueSoonFC = db.prepare(`
    SELECT * FROM leads
    WHERE status IN ('ASSIGNED','FIRST_CONTACT_PENDING')
      AND first_contact_deadline IS NOT NULL
      AND first_contact_deadline > ?
      AND first_contact_deadline <= ?
  `).all(now, oneHourFromNow);

  for (const lead of dueSoonFC) {
    if (hasTimeline(lead.id, "REMINDER_FIRST_CONTACT")) continue;

    db.prepare(`INSERT INTO lead_timeline (lead_id, event_type, actor, description, created_at) VALUES (?,?,?,?,datetime('now'))`)
      .run(lead.id, "REMINDER_FIRST_CONTACT", "system",
        `Recordatorio: primer contacto vence en menos de 1 hora.`);

    // Agent reminder task (idempotent by lead_id + task_type)
    if (lead.assigned_agent && !hasTask(lead.id, TASK_TYPE.REMINDER_FIRST_CONTACT)) {
      const agentId = getAgentId(lead.assigned_agent);
      if (agentId) {
        db.prepare(`INSERT INTO tasks (title, description, status, priority, assigned_to, created_by, lead_id, task_type) VALUES (?,?,?,?,?,?,?,?)`)
          .run(
            `[RECORDATORIO] Primer contacto próximo a vencer: ${lead.glv_code}`,
            `El plazo para el primer contacto con ${lead.glv_code} vence en menos de 1 hora. Realice el contacto ahora.`,
            "PENDIENTE", "ALTA", agentId, null, lead.id, TASK_TYPE.REMINDER_FIRST_CONTACT
          );
      }
    }
  }

  // ── Follow-up escalation ────────────────────────────────────────────────────
  const overdueFollowup = db.prepare(`
    SELECT lf.*, l.glv_code, l.assigned_agent FROM lead_followups lf
    JOIN leads l ON l.id = lf.lead_id
    WHERE lf.status NOT IN ('CLOSED','ESCALATED')
      AND lf.deadline < ?
  `).all(now);

  for (const fu of overdueFollowup) {
    if (hasTimeline(fu.lead_id, "ESCALATED_FOLLOWUP")) continue;

    db.prepare(`INSERT INTO lead_timeline (lead_id, event_type, actor, description, created_at) VALUES (?,?,?,?,datetime('now'))`)
      .run(fu.lead_id, "ESCALATED_FOLLOWUP", "system",
        `Seguimiento sin actualización por 48 horas hábiles. Lead escalado a supervisor.`);

    db.prepare(`UPDATE lead_followups SET status='ESCALATED', escalated_at=datetime('now'), updated_at=datetime('now') WHERE id=?`).run(fu.id);
    db.prepare(`UPDATE leads SET status='ESCALATED', updated_at=datetime('now') WHERE id=?`).run(fu.lead_id);

    // Supervisor task for follow-up escalation (idempotent by lead_id + task_type)
    if (!hasTask(fu.lead_id, TASK_TYPE.ESCALATION_FOLLOWUP)) {
      const sup = getSupervisorId();
      if (sup) {
        db.prepare(`INSERT INTO tasks (title, description, status, priority, assigned_to, created_by, lead_id, task_type) VALUES (?,?,?,?,?,?,?,?)`)
          .run(
            `[ESCALADO] Seguimiento sin respuesta: ${fu.glv_code}`,
            `El agente ${fu.assigned_agent || "—"} no registró respuesta en 48 horas hábiles para el lead ${fu.glv_code}. Requiere revisión del supervisor. No reasignar automáticamente.`,
            "PENDIENTE", "ALTA", sup.id, null, fu.lead_id, TASK_TYPE.ESCALATION_FOLLOWUP
          );
      }
    }
  }

  // ── Follow-up reminder ──────────────────────────────────────────────────────
  const dueSoonFU = db.prepare(`
    SELECT lf.*, l.glv_code, l.assigned_agent FROM lead_followups lf
    JOIN leads l ON l.id = lf.lead_id
    WHERE lf.status NOT IN ('CLOSED','ESCALATED')
      AND lf.deadline > ?
      AND lf.deadline <= ?
  `).all(now, oneHourFromNow);

  for (const fu of dueSoonFU) {
    if (hasTimeline(fu.lead_id, "REMINDER_FOLLOWUP")) continue;

    db.prepare(`INSERT INTO lead_timeline (lead_id, event_type, actor, description, created_at) VALUES (?,?,?,?,datetime('now'))`)
      .run(fu.lead_id, "REMINDER_FOLLOWUP", "system",
        `Recordatorio: vencimiento de seguimiento en menos de 1 hora.`);

    // Agent reminder task (idempotent by lead_id + task_type)
    if (fu.assigned_agent && !hasTask(fu.lead_id, TASK_TYPE.REMINDER_FOLLOWUP)) {
      const agentId = getAgentId(fu.assigned_agent);
      if (agentId) {
        db.prepare(`INSERT INTO tasks (title, description, status, priority, assigned_to, created_by, lead_id, task_type) VALUES (?,?,?,?,?,?,?,?)`)
          .run(
            `[RECORDATORIO] Seguimiento próximo a vencer: ${fu.glv_code}`,
            `El plazo de seguimiento del cliente ${fu.glv_code} vence en menos de 1 hora.`,
            "PENDIENTE", "ALTA", agentId, null, fu.lead_id, TASK_TYPE.REMINDER_FOLLOWUP
          );
      }
    }
  }
}

module.exports = { runEscalationCheck };
