const nodemailer = require("nodemailer");

function createTransport() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || "587", 10),
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

const fmt = (n) =>
  n != null
    ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n)
    : "—";

async function sendDocumentEmail(doc, agent) {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) return;

  const transporter = createTransport();

  const subject = `[GLV-Connect] Nuevo ${doc.type} generado — ${doc.id}`;

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
      <div style="background:#1B2A4A;padding:20px;border-radius:8px 8px 0 0">
        <h2 style="color:#fff;margin:0;font-size:18px">GLV-Connect — Nuevo documento generado</h2>
      </div>
      <div style="background:#f9fafb;padding:24px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px">
        <table style="width:100%;border-collapse:collapse;font-size:14px">
          <tr><td style="padding:8px 0;color:#6b7280;width:180px">Número de documento</td><td style="padding:8px 0;font-weight:600;color:#1B2A4A">${doc.id}</td></tr>
          <tr><td style="padding:8px 0;color:#6b7280">Tipo</td><td style="padding:8px 0">${doc.type}</td></tr>
          <tr><td style="padding:8px 0;color:#6b7280">Cliente</td><td style="padding:8px 0">${doc.client}</td></tr>
          <tr><td style="padding:8px 0;color:#6b7280">Producto</td><td style="padding:8px 0">${doc.product}</td></tr>
          <tr><td style="padding:8px 0;color:#6b7280">Destino</td><td style="padding:8px 0">${doc.destination}</td></tr>
          <tr><td style="padding:8px 0;color:#6b7280">Exportador</td><td style="padding:8px 0">${doc.exporter}</td></tr>
          ${doc.gaccNote ? `<tr><td style="padding:8px 0;color:#6b7280">GACC China</td><td style="padding:8px 0;color:#d97706;font-weight:600">${doc.gaccNote}</td></tr>` : ""}
          <tr><td style="padding:8px 0;color:#6b7280">Valor referencial</td><td style="padding:8px 0;font-weight:600;color:#059669">${fmt(doc.totalValue)}</td></tr>
          <tr><td style="padding:8px 0;color:#6b7280">Agente</td><td style="padding:8px 0">${agent.name} (${agent.username})</td></tr>
          <tr><td style="padding:8px 0;color:#6b7280">Fecha</td><td style="padding:8px 0">${doc.date}</td></tr>
        </table>
        <p style="font-size:12px;color:#9ca3af;margin-top:20px">
          Este mensaje fue generado automáticamente por GLV-Connect. No responder a este correo.
        </p>
      </div>
    </div>
  `;

  await transporter.sendMail({
    from: process.env.MAIL_FROM || '"GLV-Connect" <notificaciones@glvservicesexp.com>',
    to: process.env.MAIL_TO || "contabilidad@glvservicesexp.com",
    subject,
    html,
  });
}

module.exports = { sendDocumentEmail };
