"use strict";

const express = require("express");
const crypto  = require("crypto");
const db      = require("../db/database");
const { rateLimit } = require("../middleware/rateLimiter");
const pii     = require("../utils/piiCrypto");
const mailer  = require("../utils/email");

const router = express.Router();

const EMAIL_REGEX   = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CODE_EXPIRY   = 15 * 60 * 1000; // 15 minutes
const MAX_ATTEMPTS  = 5;
const MAX_RESENDS   = 3;

const resendInFlight = new Set();

const requestLimiter = rateLimit(15 * 60 * 1000, 8);
const verifyLimiter  = rateLimit(15 * 60 * 1000, 15);
const resendLimiter  = rateLimit(15 * 60 * 1000, 4);

function codeSecret() {
  return process.env.REGISTRATION_CODE_SECRET || "glv-reg-default-dev-secret-change-in-production";
}

function hashCode(code, email) {
  return crypto.createHmac("sha256", codeSecret())
    .update(`${email.toLowerCase()}:${code}`)
    .digest("hex");
}

function genCode() {
  return String(100000 + (crypto.randomInt(900000))).slice(-6);
}

function maskEmail(email) {
  const [local, domain] = email.split("@");
  const m = local.length > 2 ? local[0] + "***" + local.slice(-1) : local[0] + "***";
  return `${m}@${domain}`;
}

function generateGlvCode() {
  const year = new Date().getFullYear();
  const prefix = `GLV-CL-${year}-`;
  const last = db.prepare(
    "SELECT glv_code FROM clients WHERE glv_code LIKE ? ORDER BY glv_code DESC LIMIT 1"
  ).get(prefix + "%");
  let seq = 1;
  if (last) {
    const n = parseInt((last.glv_code || "").split("-").pop(), 10);
    if (!isNaN(n)) seq = n + 1;
  }
  let glvCode, tries = 0;
  do {
    glvCode = prefix + String(seq).padStart(6, "0");
    if (!db.prepare("SELECT id FROM clients WHERE glv_code = ?").get(glvCode)) break;
    seq++;
  } while (++tries < 100);
  return glvCode;
}

// ─── POST /registration/request-code ─────────────────────────────────────────
router.post("/request-code", requestLimiter, async (req, res) => {
  try {
    const body = req.body || {};
    const { email, empresa } = body;

    if (!email || !empresa) {
      return res.status(400).json({ error: "email y empresa son obligatorios." });
    }
    if (!EMAIL_REGEX.test(email) || email.length > 254) {
      return res.status(400).json({ error: "Email inválido." });
    }
    if (typeof empresa !== "string" || empresa.trim().length < 2) {
      return res.status(400).json({ error: "Nombre de empresa inválido." });
    }

    const em = email.toLowerCase().trim();

    // Block if email already active
    const active = db.prepare(
      "SELECT glv_code FROM clients WHERE lower(email) = ? AND kyc_status = 'ACTIVE_CLIENT'"
    ).get(em);
    if (active) {
      return res.status(409).json({
        error: "Este correo ya tiene una cuenta activa. Acceda al portal de clientes.",
        glv_code: active.glv_code,
      });
    }

    // Reuse existing pending code (idempotent)
    const pending = db.prepare(`
      SELECT id, created_at, resend_count
      FROM registration_codes
      WHERE lower(email) = ? AND used = 0 AND invalidated = 0
        AND expires_at > datetime('now')
      ORDER BY id DESC LIMIT 1
    `).get(em);
    if (pending) {
      const resendAt = new Date(new Date(pending.created_at).getTime() + 60_000).toISOString();
      return res.json({
        ok: true,
        state: "PENDING",
        email: maskEmail(em),
        resend_at: resendAt,
        message: "Ya tiene un código pendiente. Revise su correo.",
      });
    }

    const code     = genCode();
    const codeHash = hashCode(code, em);
    const expiresAt = new Date(Date.now() + CODE_EXPIRY)
      .toISOString().replace("T", " ").slice(0, 19);
    const rawData   = JSON.stringify(body);
    const pendingData = pii.isConfigured() ? pii.encrypt(rawData) : rawData;

    const ins = db.prepare(
      "INSERT INTO registration_codes (email, code_hash, expires_at, pending_data) VALUES (?, ?, ?, ?)"
    ).run(em, codeHash, expiresAt, pendingData);

    // El envío debe confirmarse; si falla, se invalida el código para permitir un nuevo intento.
    try {
      await mailer.sendVerificationCode(em, code, empresa.trim(), body.lang || "es");
    } catch (err) {
      console.error("[reg/request-code] email error:", err.message);
      db.prepare("UPDATE registration_codes SET invalidated=1, updated_at=datetime('now') WHERE id=?")
        .run(ins.lastInsertRowid);
      return res.status(503).json({
        error: "No pudimos enviar el código a su correo. Intente nuevamente en unos minutos.",
        retryable: true,
      });
    }

    return res.json({
      ok: true,
      state: "PENDING",
      email: maskEmail(em),
      resend_at: new Date(Date.now() + 60_000).toISOString(),
    });
  } catch (e) {
    console.error("[POST /registration/request-code]", e.message);
    return res.status(500).json({ error: "Error al iniciar el registro. Intente nuevamente." });
  }
});

// ─── POST /registration/verify-code ──────────────────────────────────────────
router.post("/verify-code", verifyLimiter, (req, res) => {
  try {
    const { email, code } = req.body || {};

    if (!email || !code) {
      return res.status(400).json({ error: "email y code son obligatorios." });
    }
    if (!EMAIL_REGEX.test(email)) {
      return res.status(400).json({ error: "Email inválido." });
    }

    const em = email.toLowerCase().trim();
    const submittedCode = String(code).trim();

    const record = db.prepare(`
      SELECT id, code_hash, expires_at, attempts, pending_data
      FROM registration_codes
      WHERE lower(email) = ? AND used = 0 AND invalidated = 0
      ORDER BY id DESC LIMIT 1
    `).get(em);

    if (!record) {
      return res.status(404).json({
        error: "No hay solicitud activa. Reinicie el proceso.",
        expired: true,
      });
    }

    if (new Date(record.expires_at) < new Date()) {
      db.prepare("UPDATE registration_codes SET invalidated=1 WHERE id=?").run(record.id);
      return res.status(410).json({ error: "Código expirado. Solicite uno nuevo.", expired: true });
    }

    if (record.attempts >= MAX_ATTEMPTS) {
      db.prepare("UPDATE registration_codes SET invalidated=1 WHERE id=?").run(record.id);
      return res.status(429).json({ error: "Demasiados intentos. Solicite un nuevo código.", too_many_attempts: true });
    }

    if (hashCode(submittedCode, em) !== record.code_hash) {
      db.prepare("UPDATE registration_codes SET attempts=attempts+1, updated_at=datetime('now') WHERE id=?")
        .run(record.id);
      const remaining = MAX_ATTEMPTS - record.attempts - 1;
      return res.status(400).json({
        error: `Código incorrecto. Quedan ${Math.max(0, remaining)} intentos.`,
        remaining,
      });
    }

    // Code correct — decrypt form data
    let formData;
    try {
      const dec = pii.isConfigured() ? pii.decrypt(record.pending_data) : record.pending_data;
      formData = JSON.parse(dec);
    } catch (e) {
      console.error("[reg/verify-code] decrypt error:", e.message);
      return res.status(500).json({ error: "Error interno. Contacte soporte." });
    }

    const { empresa, rep, pais, tel, nit, comercial } = formData;
    const ip = (req.headers["x-forwarded-for"] || req.ip || "").toString().split(",")[0].trim();

    // Atomic client creation
    let glvCode;
    const txResult = db.transaction(() => {
      glvCode = generateGlvCode();

      // Guard against duplicates
      const dup = db.prepare(
        "SELECT id, glv_code FROM clients WHERE lower(email) = ? AND kyc_status != 'REJECTED'"
      ).get(em);
      if (dup) return { dup };

      const rawJson     = JSON.stringify(formData);
      const encryptedKyc = pii.isConfigured() ? pii.encrypt(rawJson) : rawJson;

      const sub = db.prepare(`
        INSERT INTO kyc_submissions (submission_type, glv_code, raw_data, ip_address, status)
        VALUES ('CLIENT', ?, ?, ?, 'PROCESSED')
      `).run(glvCode, rawJson, ip);

      const ins = db.prepare(`
        INSERT INTO clients
          (type, name, company, country, representative, email, phone, tax_id,
           glv_code, lead_status, kyc_status, registration_source, kyc_data,
           commercial_score, compliance_flag, active)
        VALUES ('buyer', ?, ?, ?, ?, ?, ?, ?, ?, 'UNASSIGNED', 'PRE_REGISTRATION', 'WEB_KYC', ?, 0, 0, 1)
      `).run(
        comercial || empresa, empresa,
        pais   || null, rep  || null,
        em, tel || null, nit  || null,
        glvCode, encryptedKyc
      );
      const clientId = ins.lastInsertRowid;

      db.prepare(
        "UPDATE kyc_submissions SET mapped_to_id=?, processed_at=datetime('now') WHERE id=?"
      ).run(clientId, sub.lastInsertRowid);

      db.prepare(`
        INSERT INTO audit_log (username, action, doc_id, client_id, ip)
        VALUES ('WEB_PORTAL', 'CLIENT_REGISTERED', ?, ?, ?)
      `).run(glvCode, clientId, ip);

      const compUser = db.prepare(
        "SELECT id FROM users WHERE role='COMPLIANCE' AND active=1 ORDER BY id LIMIT 1"
      ).get();
      db.prepare(`
        INSERT INTO tasks (title, description, priority, assigned_to, created_by, status)
        VALUES (?, ?, 'high', ?, ?, 'pending')
      `).run(
        `KYC REVIEW — ${glvCode}`,
        `Pre-inscripción web verificada por correo.\nEmpresa: ${empresa}\nEmail: ${em}\nGLV: ${glvCode}`,
        compUser ? compUser.id : null,
        compUser ? compUser.id : null
      );

      db.prepare("UPDATE registration_codes SET used=1, updated_at=datetime('now') WHERE id=?")
        .run(record.id);

      return { clientId, glvCode };
    })();

    if (txResult.dup) {
      db.prepare("UPDATE registration_codes SET used=1, updated_at=datetime('now') WHERE id=?").run(record.id);
      glvCode = txResult.dup.glv_code;
    }

    mailer.sendRegistrationConfirmation(em, glvCode, empresa, formData.lang || "es")
      .catch(err => console.error("[reg/verify-code] confirm email error:", err.message));

    return res.status(201).json({
      ok: true,
      glv_code: glvCode,
      empresa,
      registeredAt: new Date().toISOString(),
    });
  } catch (e) {
    console.error("[POST /registration/verify-code]", e.message);
    return res.status(500).json({ error: "Error verificando código. Intente nuevamente." });
  }
});

// ─── POST /registration/resend-code ──────────────────────────────────────────
router.post("/resend-code", resendLimiter, async (req, res) => {
  try {
    const { email } = req.body || {};
    if (!email || !EMAIL_REGEX.test(email)) {
      return res.status(400).json({ error: "Email inválido." });
    }
    const em = email.toLowerCase().trim();

    const record = db.prepare(`
      SELECT id, resend_count, pending_data, created_at
      FROM registration_codes
      WHERE lower(email) = ? AND used = 0 AND invalidated = 0
        AND expires_at > datetime('now')
      ORDER BY id DESC LIMIT 1
    `).get(em);

    if (!record) {
      return res.status(404).json({ error: "No hay solicitud activa. Reinicie el proceso.", expired: true });
    }
    if (record.resend_count >= MAX_RESENDS) {
      return res.status(429).json({ error: "Límite de reenvíos alcanzado. Reinicie el proceso." });
    }

    let empresa = "";
    try {
      const dec = pii.isConfigured() ? pii.decrypt(record.pending_data) : record.pending_data;
      empresa = (JSON.parse(dec).empresa || "").trim();
    } catch (_) {}

    // Protege la transición frente a reenvíos concurrentes del mismo correo.
    if (resendInFlight.has(em)) {
      return res.status(409).json({ error: "Ya hay un reenvío en curso. Espere unos segundos.", retryable: true });
    }
    resendInFlight.add(em);
    try {
      const newCode    = genCode();
      const newHash    = hashCode(newCode, em);
      const expiresAt  = new Date(Date.now() + CODE_EXPIRY)
        .toISOString().replace("T", " ").slice(0, 19);
      const newResends = record.resend_count + 1;

      // 1) Enviar primero: el código anterior y su contador siguen intactos si falla.
      try {
        await mailer.sendVerificationCode(em, newCode, empresa, "es");
      } catch (err) {
        console.error("[reg/resend-code] email error:", err.message);
        return res.status(503).json({
          error: "No pudimos reenviar el código. Intente nuevamente en unos minutos.",
          retryable: true,
        });
      }

      // 2) Envío confirmado: activar el reemplazo de forma atómica y condicionada al estado leído.
      const swapped = db.transaction(() => {
        const upd = db.prepare(`
          UPDATE registration_codes SET invalidated=1, updated_at=datetime('now')
          WHERE id=? AND used=0 AND invalidated=0 AND resend_count=?
        `).run(record.id, record.resend_count);
        if (upd.changes !== 1) return false;
        db.prepare(`
          INSERT INTO registration_codes (email, code_hash, expires_at, resend_count, pending_data)
          VALUES (?, ?, ?, ?, ?)
        `).run(em, newHash, expiresAt, newResends, record.pending_data);
        return true;
      })();
      if (!swapped) {
        return res.status(409).json({ error: "La solicitud cambió. Reinicie el proceso.", retryable: true });
      }

      return res.json({
        ok: true,
        resent_at: new Date().toISOString(),
        resend_at: new Date(Date.now() + 60_000).toISOString(),
        resends_remaining: MAX_RESENDS - newResends,
      });
    } finally {
      resendInFlight.delete(em);
    }
  } catch (e) {
    console.error("[POST /registration/resend-code]", e.message);
    return res.status(500).json({ error: "Error reenviando código. Intente nuevamente." });
  }
});

module.exports = router;
