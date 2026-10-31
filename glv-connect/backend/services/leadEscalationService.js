"use strict";
const db = require("../db/database");

function getSupervisorUsername() {
  const cols = db.prepare("PRAGMA table_info(users)").all().map(c => c.name);
  const hasStatus = cols.includes("status");
  const query = hasStatus
    ? `SELECT username FROM users WHERE role IN ('COMMERCIAL_MANAGER','DIRECTOR','SUPER_ADMIN') AND status='active' ORDER BY id LIMIT 1`
    : `SELECT username FROM users WHERE role IN ('COMMERCIAL_MANAGER','DIRECTOR','SUPER_ADMIN') ORDER BY id LIMIT 1`;
  const row = db.prepare(query).get();
  return row ? row.username : null;
}

function hasTimeline(leadId, eventType) {
  return !!db.prepare(
    `SELECT id FROM lead_timeline WHERE lead_id=? AND event_type=?`
  ).get(leadId, eventType);
}

/**
 * Idempotent escalation + reminder check.
 * Runs every 5 minutes in production.
 */
function runEscalationCheck() {
  const now             = new Date().toISOString();
  const oneHourFromNow  = new Date(Date.now() + 3600000).toISOString();

  // ── First contact escalation ────────────────────────────────────────────────
  const overdueFC = db.prepare(`
    SELECT * FROM leads
    WHERE status IN ('ASSIGNED','FIRST_CONTACT_PENDING')
      AND first_contact_deadline IS NOT NULL
      AND first_contact_deadline < ?
  `).all(now);

  for (const lead of overdueFC) {
    if (hasTimeline(lead.id, "ESCALATED_FIRST_CONTACT")) continue;

    db.prepare(`
      INSERT INTO lead_timeline (lead_id, event_type, actor, description, created_at)
      VALUES (?,?,?,?,datetime('now'))
    `).run(lead.id, "ESCALATED_FIRST_CONTACT", "system",
      `Vencimiento de primer contacto sin respuesta. Lead escalado a supervisor.`);

    db.prepare(`UPDATE leads SET status='ESCALATED', updated_at=datetime('now') WHERE id=?`).run(lead.id);

    // Create supervisor task (idempotent check)
    const existing = db.prepare(
      `SELECT id FROM tasks WHERE title LIKE ? AND status NOT IN ('COMPLETADA','CANCELADA','completed')`
    ).get(`%ESCALADO%${lead.glv_code}%`);
    if (!existing) {
      const sup = getSupervisorUsername();
      if (sup) {
        const supUser = db.prepare(`SELECT id FROM users WHERE username=?`).get(sup);
        db.prepare(`
          INSERT INTO tasks (title, description, status, priority, assigned_to, created_by)
          VALUES (?,?,?,?,?,?)
        `).run(
          `[ESCALADO] Primer contacto vencido: ${lead.glv_code}`,
          `El agente ${lead.assigned_agent || "—"} no completó el primer contacto. Requiere decisión humana.`,
          "PENDIENTE", "ALTA",
          supUser ? supUser.id : null,
          null
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
    db.prepare(`
      INSERT INTO lead_timeline (lead_id, event_type, actor, description, created_at)
      VALUES (?,?,?,?,datetime('now'))
    `).run(lead.id, "REMINDER_FIRST_CONTACT", "system",
      `Recordatorio: primer contacto vence en menos de 1 hora.`);
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

    db.prepare(`
      INSERT INTO lead_timeline (lead_id, event_type, actor, description, created_at)
      VALUES (?,?,?,?,datetime('now'))
    `).run(fu.lead_id, "ESCALATED_FOLLOWUP", "system",
      `Seguimiento sin actualización por 48 horas hábiles. Lead escalado a supervisor.`);

    db.prepare(`UPDATE lead_followups SET status='ESCALATED', escalated_at=datetime('now'), updated_at=datetime('now') WHERE id=?`).run(fu.id);
    db.prepare(`UPDATE leads SET status='ESCALATED', updated_at=datetime('now') WHERE id=?`).run(fu.lead_id);
  }

  // ── Follow-up reminder ──────────────────────────────────────────────────────
  const dueSoonFU = db.prepare(`
    SELECT lf.* FROM lead_followups lf
    WHERE lf.status NOT IN ('CLOSED','ESCALATED')
      AND lf.deadline > ?
      AND lf.deadline <= ?
  `).all(now, oneHourFromNow);

  for (const fu of dueSoonFU) {
    if (hasTimeline(fu.lead_id, "REMINDER_FOLLOWUP")) continue;
    db.prepare(`
      INSERT INTO lead_timeline (lead_id, event_type, actor, description, created_at)
      VALUES (?,?,?,?,datetime('now'))
    `).run(fu.lead_id, "REMINDER_FOLLOWUP", "system",
      `Recordatorio: vencimiento de seguimiento en menos de 1 hora.`);
  }
}

module.exports = { runEscalationCheck };
