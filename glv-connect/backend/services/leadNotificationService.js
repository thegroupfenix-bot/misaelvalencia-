"use strict";
const nodemailer = require("nodemailer");
const db = require("../db/database");

const APP_BASE_URL = process.env.APP_URL || process.env.FRONTEND_URL || "https://glv-connect.up.railway.app";

function esc(s) {
  if (!s) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

let _cachedTransporter = null;
function getTransporter() {
  const host = process.env.SMTP_HOST || "";
  const user = process.env.SMTP_USER || "";
  const pass = process.env.SMTP_PASS || "";
  const port = parseInt(process.env.SMTP_PORT || "587", 10);
  if (!host || !user || !pass) return null;
  if (!_cachedTransporter) {
    _cachedTransporter = nodemailer.createTransport({
      host, port,
      secure: port === 465,
      auth: { user, pass },
    });
  }
  return _cachedTransporter;
}

function buildLeadEmailHtml(lead, notif) {
  const waDigits = lead.phone_norm ? lead.phone_norm.replace("+", "") : null;
  const expedienteUrl = `${APP_BASE_URL}/leads/${lead.id}`;
  const eventLabel = notif.event_type === "LEAD_REASSIGNED" ? "Reasignación de lead" : "Nuevo lead asignado";
  const deadline = lead.first_contact_deadline
    ? new Date(lead.first_contact_deadline).toLocaleString("es", { dateStyle: "medium", timeStyle: "short" })
    : "—";

  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><style>
  body{font-family:Arial,sans-serif;color:#1B2A4A;background:#f4f6f8;margin:0;padding:20px}
  .card{background:#fff;border-radius:8px;padding:32px;max-width:520px;margin:0 auto;border-top:4px solid #2563eb}
  .label{color:#6b7280;font-size:12px;text-transform:uppercase;letter-spacing:.05em}
  .value{color:#1B2A4A;font-size:15px;margin-bottom:12px}
  .btn{display:inline-block;background:#2563eb;color:#fff;padding:10px 24px;border-radius:6px;text-decoration:none;font-weight:bold;margin-top:8px}
  .wa{display:inline-block;background:#25d366;color:#fff;padding:10px 24px;border-radius:6px;text-decoration:none;font-weight:bold;margin-top:8px;margin-left:8px}
  .badge{display:inline-block;background:#1B2A4A;color:#fff;border-radius:4px;padding:2px 8px;font-size:12px}
  .footer{color:#9ca3af;font-size:11px;margin-top:24px;border-top:1px solid #e5e7eb;padding-top:12px}
</style></head>
<body><div class="card">
  <p style="color:#2563eb;font-size:12px;font-weight:bold;letter-spacing:.1em;margin-bottom:4px">GLV CONNECT — GOS LEADS</p>
  <h2 style="margin:0 0 8px">${eventLabel}</h2>

  ${lead.glv_code ? `<p class="label">Código GLV</p><p class="value"><strong>${esc(lead.glv_code)}</strong></p>` : ""}
  ${lead.company_name ? `<p class="label">Empresa</p><p class="value">${esc(lead.company_name)}</p>` : ""}
  ${lead.contact_name ? `<p class="label">Contacto</p><p class="value">${esc(lead.contact_name)}</p>` : ""}
  ${lead.country_code ? `<p class="label">País</p><p class="value">${esc(lead.country_code)}</p>` : ""}
  ${lead.zone ? `<p class="label">Zona</p><p class="value">${esc(lead.zone)}</p>` : ""}
  ${lead.origin_channel ? `<p class="label">Canal de origen</p><p class="value"><span class="badge">${esc(lead.origin_channel)}</span></p>` : ""}
  ${lead.language ? `<p class="label">Idioma</p><p class="value">${esc(lead.language)}</p>` : ""}
  ${lead.product_type ? `<p class="label">Producto / Servicio</p><p class="value">${esc(lead.product_type)}</p>` : ""}
  ${lead.quantity ? `<p class="label">Cantidad</p><p class="value">${esc(String(lead.quantity))} ${esc(lead.quantity_unit || "")}</p>` : ""}
  ${lead.destination ? `<p class="label">Destino / Puerto</p><p class="value">${esc(lead.destination)}${lead.port ? ` — ${esc(lead.port)}` : ""}</p>` : ""}
  <p class="label">Límite primer contacto</p><p class="value" style="color:#dc2626;font-weight:bold">${deadline}</p>

  <div style="margin-top:16px">
    <a href="${expedienteUrl}" class="btn">Ver expediente →</a>
    ${waDigits ? `<a href="https://wa.me/${waDigits}" class="wa" target="_blank" rel="noopener">WhatsApp →</a>` : ""}
  </div>

  <div class="footer">
    Notificación corporativa automática GOS — GLV Connect.<br>
    No responder a este correo. Acceda al sistema directamente.<br>
    Este mensaje no contiene documentos KYC, datos bancarios ni información confidencial.
  </div>
</div></body></html>`;
}

function isDuplicate(leadId, agentUsername, eventType) {
  const row = db.prepare(
    `SELECT id FROM lead_agent_notifications WHERE lead_id=? AND agent_username=? AND event_type=? AND status IN ('PENDING','SENT')`
  ).get(leadId, agentUsername, eventType);
  return !!row;
}

function createAndSendLeadNotification(leadId, agentUsername, eventType) {
  if (isDuplicate(leadId, agentUsername, eventType)) return;

  const agent = db.prepare("SELECT email FROM users WHERE username=?").get(agentUsername);
  if (!agent?.email) return;

  let notifId;
  try {
    const r = db.prepare(
      `INSERT INTO lead_agent_notifications (lead_id, agent_username, agent_email, event_type)
       VALUES (?,?,?,?)`
    ).run(leadId, agentUsername, agent.email, eventType);
    notifId = r.lastInsertRowid;
  } catch (e) {
    if (e.message?.includes("UNIQUE")) return;
    throw e;
  }

  setImmediate(() => sendLeadNotification(notifId));
}

async function sendLeadNotification(notifId) {
  const notif = db.prepare("SELECT * FROM lead_agent_notifications WHERE id=?").get(notifId);
  if (!notif || notif.status === "SENT") return;
  if (notif.attempts >= 3) {
    db.prepare("UPDATE lead_agent_notifications SET status='FAILED', updated_at=datetime('now') WHERE id=?").run(notifId);
    return;
  }

  const host = process.env.SMTP_HOST || "";
  const user = process.env.SMTP_USER || "";
  const pass = process.env.SMTP_PASS || "";
  const mailFrom = process.env.MAIL_FROM || process.env.SMTP_FROM || "";

  if (!host || !user || !pass || !mailFrom) {
    db.prepare(
      `UPDATE lead_agent_notifications SET status='FAILED', last_error='SMTP corporativo no configurado (variables de entorno faltantes)', attempts=attempts+1, last_attempt_at=datetime('now'), updated_at=datetime('now') WHERE id=?`
    ).run(notifId);
    return;
  }

  db.prepare("UPDATE lead_agent_notifications SET attempts=attempts+1, last_attempt_at=datetime('now') WHERE id=?").run(notifId);

  const lead = db.prepare("SELECT * FROM leads WHERE id=?").get(notif.lead_id);
  if (!lead) return;

  const t = getTransporter();
  if (!t) {
    db.prepare("UPDATE lead_agent_notifications SET status='FAILED', last_error='No transporter', updated_at=datetime('now') WHERE id=?").run(notifId);
    return;
  }

  const labelMap = {
    LEAD_ASSIGNED:   "Nuevo lead asignado a usted",
    LEAD_REASSIGNED: "Reasignación de lead: asignado a usted",
  };

  try {
    const info = await t.sendMail({
      from: mailFrom,
      to: notif.agent_email,
      subject: `GOS — ${labelMap[notif.event_type] || notif.event_type}: ${lead.glv_code || `Lead #${lead.id}`}`,
      html: buildLeadEmailHtml(lead, notif),
    });
    db.prepare(
      `UPDATE lead_agent_notifications SET status='SENT', delivered_at=datetime('now'), provider_message_id=?, updated_at=datetime('now') WHERE id=?`
    ).run(info.messageId || null, notifId);
  } catch (err) {
    const errMsg = (err.message || String(err)).slice(0, 500);
    db.prepare(
      `UPDATE lead_agent_notifications SET status='FAILED', last_error=?, updated_at=datetime('now') WHERE id=?`
    ).run(errMsg, notifId);
    const fresh = db.prepare("SELECT attempts FROM lead_agent_notifications WHERE id=?").get(notifId);
    if (fresh && fresh.attempts < 3) {
      setTimeout(() => sendLeadNotification(notifId), Math.pow(2, fresh.attempts) * 30000);
    }
  }
}

module.exports = { createAndSendLeadNotification };
