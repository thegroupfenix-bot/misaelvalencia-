"use strict";
const nodemailer = require("nodemailer");
const db = require("../db/database");

const APP_BASE_URL = process.env.APP_URL || process.env.FRONTEND_URL || "https://misaelvalencia-production.up.railway.app";

let _cachedTransporter = null;

function getTransporter() {
  const host = process.env.SMTP_HOST || "";
  const user = process.env.SMTP_USER || "";
  const pass = process.env.SMTP_PASS || "";
  const port = parseInt(process.env.SMTP_PORT || "587", 10);
  if (!host || !user || !pass) return null;
  if (!_cachedTransporter) {
    try {
      _cachedTransporter = nodemailer.createTransport({
        host, port,
        secure: port === 465,
        auth: { user, pass },
      });
    } catch (_) { return null; }
  }
  return _cachedTransporter;
}

function esc(s) {
  if (!s) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

function isDuplicate(clientId, agentUsername, eventType) {
  try {
    return !!db.prepare(
      `SELECT id FROM client_agent_notifications
       WHERE client_id=? AND agent_username=? AND event_type=?
       AND status != 'SKIPPED'`
    ).get(clientId, agentUsername, eventType);
  } catch (_) { return false; }
}

/**
 * Insert a PENDING notification record. Safe to call inside a db.transaction().
 * Returns the new notifId, or null on deduplication or error.
 */
function insertNotificationRecord(clientId, agentUsername, agentEmail, eventType, clientData) {
  if (isDuplicate(clientId, agentUsername, eventType)) return null;
  try {
    const r = db.prepare(
      `INSERT INTO client_agent_notifications
       (client_id, agent_username, agent_email, event_type, client_name, glv_code,
        status_at_event, kyc_status_at_event, registration_source, country, representative_name)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)`
    ).run(
      clientId, agentUsername, agentEmail, eventType,
      clientData.company_name || clientData.client_name || clientData.name || null,
      clientData.glv_code || null,
      clientData.status || null,
      clientData.kyc_status || null,
      clientData.registration_source || null,
      clientData.country || null,
      clientData.representative_name || clientData.contact_name || null
    );
    return r.lastInsertRowid;
  } catch (e) {
    if (e.message && e.message.includes("UNIQUE")) return null;
    return null;
  }
}

/**
 * Legacy interface: look up agent by userId, insert record, then fire async send.
 * Kept for direct service-call tests.
 */
function createAndSend(clientId, agentUserId, eventType, clientData) {
  if (!agentUserId) return;
  let agent;
  try {
    agent = db.prepare(`SELECT id, username, email FROM users WHERE id=?`).get(agentUserId);
  } catch (_) { return; }
  if (!agent || !agent.email) return;

  const notifId = insertNotificationRecord(clientId, agent.username, agent.email, eventType, clientData);
  if (notifId) setImmediate(() => sendNotification(notifId));
}

function buildEmailHtml(notif) {
  const eventLabels = {
    AGENT_ASSIGNED_ON_ACTIVATION:     "Cliente activado y asignado a usted",
    AGENT_ASSIGNED_TO_ACTIVE_CLIENT:  "Nuevo cliente activo asignado a usted",
    AGENT_REASSIGNED:                 "Reasignación: cliente activo asignado a usted",
  };
  const expedienteUrl = `${APP_BASE_URL}/clients/${notif.client_id}`;
  const eventLabel = esc(eventLabels[notif.event_type] || notif.event_type);
  let fecha;
  try { fecha = new Date(notif.created_at).toLocaleDateString("es", { day: "numeric", month: "long", year: "numeric" }); }
  catch (_) { fecha = notif.created_at || ""; }

  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><style>
  body{font-family:Arial,sans-serif;color:#1B2A4A;background:#f4f6f8;margin:0;padding:20px}
  .card{background:#fff;border-radius:8px;padding:32px;max-width:520px;margin:0 auto;border-top:4px solid #2563eb}
  .lbl{color:#6b7280;font-size:11px;text-transform:uppercase;letter-spacing:.05em;margin:0}
  .val{color:#1B2A4A;font-size:14px;margin:2px 0 12px}
  .badge{display:inline-block;background:#059669;color:#fff;border-radius:4px;padding:2px 8px;font-size:12px}
  .btn{display:inline-block;background:#2563eb;color:#fff;padding:10px 24px;border-radius:6px;text-decoration:none;font-weight:bold;margin-top:16px}
  .foot{color:#9ca3af;font-size:11px;margin-top:24px;border-top:1px solid #e5e7eb;padding-top:12px}
</style></head>
<body><div class="card">
  <p style="color:#2563eb;font-size:11px;font-weight:bold;letter-spacing:.1em;margin-bottom:4px">GLV CONNECT — GOS</p>
  <h2 style="margin:0 0 4px;font-size:18px">${eventLabel}</h2>
  <p style="color:#6b7280;margin-bottom:20px;font-size:13px">${esc(fecha)}</p>
  ${notif.glv_code ? `<p class="lbl">Código GLV</p><p class="val"><strong>${esc(notif.glv_code)}</strong></p>` : ""}
  ${notif.client_name ? `<p class="lbl">Empresa / Cliente</p><p class="val">${esc(notif.client_name)}</p>` : ""}
  ${notif.representative_name ? `<p class="lbl">Representante</p><p class="val">${esc(notif.representative_name)}</p>` : ""}
  ${notif.country ? `<p class="lbl">País</p><p class="val">${esc(notif.country)}</p>` : ""}
  ${notif.status_at_event ? `<p class="lbl">Estado</p><p class="val"><span class="badge">${esc(notif.status_at_event)}</span></p>` : ""}
  ${notif.kyc_status_at_event ? `<p class="lbl">Estado KYC</p><p class="val">${esc(notif.kyc_status_at_event)}</p>` : ""}
  ${notif.registration_source ? `<p class="lbl">Fuente de registro</p><p class="val">${esc(notif.registration_source)}</p>` : ""}
  <p class="lbl">Fecha de registro en GOS</p><p class="val">${esc(fecha)}</p>
  <a href="${expedienteUrl}" class="btn">Ver expediente completo →</a>
  <div class="foot">
    Notificación corporativa automática del sistema GOS de GLV.<br>
    No responder a este correo. Este mensaje no contiene datos KYC, bancarios ni documentos del cliente.
  </div>
</div></body></html>`;
}

async function sendNotification(notifId) {
  let notif;
  try { notif = db.prepare(`SELECT * FROM client_agent_notifications WHERE id=?`).get(notifId); }
  catch (_) { return; }
  if (!notif || notif.status === "SENT") return;
  if (notif.attempts >= 3) {
    try { db.prepare(`UPDATE client_agent_notifications SET status='FAILED', updated_at=datetime('now') WHERE id=?`).run(notifId); } catch (_) {}
    return;
  }

  try { db.prepare(`UPDATE client_agent_notifications SET attempts=attempts+1, last_attempt_at=datetime('now') WHERE id=?`).run(notifId); }
  catch (_) {}

  // Require full corporate SMTP config — no fallback sender allowed
  const smtpHost = process.env.SMTP_HOST || "";
  const smtpUser = process.env.SMTP_USER || "";
  const smtpPass = process.env.SMTP_PASS || "";
  const mailFrom = process.env.MAIL_FROM || process.env.SMTP_FROM || "";

  if (!smtpHost || !smtpUser || !smtpPass || !mailFrom) {
    try {
      db.prepare(
        `UPDATE client_agent_notifications SET status='FAILED', last_error='SMTP corporativo no configurado (variables de entorno faltantes)', updated_at=datetime('now') WHERE id=?`
      ).run(notifId);
    } catch (_) {}
    return;
  }

  const t = getTransporter();
  if (!t) {
    try { db.prepare(`UPDATE client_agent_notifications SET status='FAILED', last_error='No se pudo crear el transporter SMTP', updated_at=datetime('now') WHERE id=?`).run(notifId); } catch (_) {}
    return;
  }

  const subjectMap = {
    AGENT_ASSIGNED_ON_ACTIVATION:    "Cliente activado asignado a usted",
    AGENT_ASSIGNED_TO_ACTIVE_CLIENT: "Nuevo cliente activo asignado a usted",
    AGENT_REASSIGNED:                "Reasignación: cliente activo asignado a usted",
  };
  const clientLabel = notif.client_name || notif.glv_code || `Cliente #${notif.client_id}`;

  try {
    const freshNotif = db.prepare(`SELECT * FROM client_agent_notifications WHERE id=?`).get(notifId);
    const info = await t.sendMail({
      from: mailFrom,
      to: notif.agent_email,
      subject: `GOS — ${subjectMap[notif.event_type] || notif.event_type}: ${clientLabel}`,
      html: buildEmailHtml(freshNotif || notif),
    });
    try {
      db.prepare(
        `UPDATE client_agent_notifications SET status='SENT', delivered_at=datetime('now'), provider_message_id=?, updated_at=datetime('now') WHERE id=?`
      ).run(info.messageId || null, notifId);
    } catch (_) {}
  } catch (err) {
    const errMsg = String(err.message || err).slice(0, 500);
    try {
      db.prepare(
        `UPDATE client_agent_notifications SET status='FAILED', last_error=?, updated_at=datetime('now') WHERE id=?`
      ).run(errMsg, notifId);
    } catch (_) {}

    let fresh;
    try { fresh = db.prepare(`SELECT attempts FROM client_agent_notifications WHERE id=?`).get(notifId); } catch (_) {}
    if (fresh && fresh.attempts < 3) {
      const delay = Math.pow(2, fresh.attempts) * 30000;
      setTimeout(() => sendNotification(notifId), delay);
    }
  }
}

function retryNotification(notifId) {
  const notif = db.prepare(`SELECT * FROM client_agent_notifications WHERE id=?`).get(notifId);
  if (!notif) throw new Error("Notificación no encontrada");
  if (notif.status === "SENT") throw new Error("Ya enviada");
  db.prepare(
    `UPDATE client_agent_notifications SET status='PENDING', attempts=0, last_error=NULL, updated_at=datetime('now') WHERE id=?`
  ).run(notifId);
  setImmediate(() => sendNotification(notifId));
  return { ok: true };
}

module.exports = { createAndSend, insertNotificationRecord, sendNotification, retryNotification };
