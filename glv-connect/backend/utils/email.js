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

async function sendVerificationCode(to, code, empresa, lang) {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.warn("[email] SMTP not configured — verification code not sent:", code);
    return;
  }
  const transporter = createTransport();
  const isEs = !lang || lang === "es";
  const subject = isEs
    ? `Tu código de verificación GLV: ${code}`
    : `Your GLV verification code: ${code}`;

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto">
      <div style="background:#1B2A4A;padding:24px 28px;border-radius:8px 8px 0 0">
        <h2 style="color:#C9A84C;margin:0;font-size:20px;letter-spacing:0.04em">GLV Services SAS</h2>
        <p style="color:#94a3b8;margin:4px 0 0;font-size:13px">${isEs ? "Verificación de correo electrónico" : "Email verification"}</p>
      </div>
      <div style="background:#f9fafb;padding:28px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px">
        <p style="color:#374151;font-size:15px;margin-top:0">
          ${isEs
            ? `Hola, recibimos su solicitud de registro para <strong>${empresa}</strong>.`
            : `We received your registration request for <strong>${empresa}</strong>.`}
        </p>
        <p style="color:#374151;font-size:14px">
          ${isEs ? "Su código de verificación es:" : "Your verification code is:"}
        </p>
        <div style="text-align:center;margin:20px 0">
          <span style="font-size:38px;font-weight:700;letter-spacing:0.25em;color:#1B2A4A;background:#fffbe6;padding:12px 24px;border-radius:8px;border:2px solid #C9A84C;display:inline-block">${code}</span>
        </div>
        <p style="color:#6b7280;font-size:13px">
          ${isEs
            ? "Este código expira en <strong>15 minutos</strong>. No lo comparta con nadie."
            : "This code expires in <strong>15 minutes</strong>. Do not share it with anyone."}
        </p>
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0">
        <p style="color:#9ca3af;font-size:11px;margin:0">
          ${isEs
            ? "Si no solicitó este registro, ignore este correo. Generado automáticamente por GLV-Connect."
            : "If you did not request this registration, ignore this email. Auto-generated by GLV-Connect."}
        </p>
      </div>
    </div>`;

  await transporter.sendMail({
    from: process.env.MAIL_FROM || '"GLV Services" <notificaciones@glvservicesexp.com>',
    to,
    subject,
    html,
  });
}

async function sendRegistrationConfirmation(to, glvCode, empresa, lang) {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.warn("[email] SMTP not configured — confirmation not sent for:", glvCode);
    return;
  }
  const transporter = createTransport();
  const isEs = !lang || lang === "es";
  const subject = isEs
    ? `¡Bienvenido a GLV Services! Su código: ${glvCode}`
    : `Welcome to GLV Services! Your code: ${glvCode}`;

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto">
      <div style="background:#1B2A4A;padding:24px 28px;border-radius:8px 8px 0 0">
        <h2 style="color:#C9A84C;margin:0;font-size:20px;letter-spacing:0.04em">GLV Services SAS</h2>
        <p style="color:#94a3b8;margin:4px 0 0;font-size:13px">${isEs ? "Confirmación de registro KYC" : "KYC Registration confirmation"}</p>
      </div>
      <div style="background:#f9fafb;padding:28px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px">
        <p style="color:#374151;font-size:15px;margin-top:0">
          ${isEs
            ? `Estimado/a representante de <strong>${empresa}</strong>,`
            : `Dear representative of <strong>${empresa}</strong>,`}
        </p>
        <p style="color:#374151;font-size:14px">
          ${isEs
            ? "Su pre-registro KYC ha sido recibido exitosamente. Este es su código único GLV:"
            : "Your KYC pre-registration has been successfully received. This is your unique GLV code:"}
        </p>
        <div style="text-align:center;margin:20px 0">
          <span style="font-size:22px;font-weight:700;letter-spacing:0.15em;color:#1B2A4A;background:#fffbe6;padding:12px 24px;border-radius:8px;border:2px solid #C9A84C;display:inline-block">${glvCode}</span>
        </div>
        <p style="color:#374151;font-size:14px">
          ${isEs
            ? "Guarde este código. Es su identificador único en GLV Services. Nuestro equipo de Compliance revisará su expediente en <strong>3–7 días hábiles</strong> y le notificará sobre la activación de su cuenta."
            : "Save this code. It is your unique GLV Services identifier. Our Compliance team will review your file within <strong>3–7 business days</strong> and notify you about account activation."}
        </p>
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0">
        <p style="color:#9ca3af;font-size:11px;margin:0">
          GLV Services SAS · Where Trust Moves Markets · <a href="https://www.glvservicesexp.com" style="color:#9ca3af">glvservicesexp.com</a>
        </p>
      </div>
    </div>`;

  await transporter.sendMail({
    from: process.env.MAIL_FROM || '"GLV Services" <notificaciones@glvservicesexp.com>',
    to,
    subject,
    html,
  });
}

module.exports = { sendDocumentEmail, sendVerificationCode, sendRegistrationConfirmation };
