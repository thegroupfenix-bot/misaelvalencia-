const express = require("express");
const bcrypt  = require("bcryptjs");
const jwt     = require("jsonwebtoken");
const crypto  = require("crypto");
const db      = require("../db/database");
const { authenticate, COOKIE_NAME } = require("../middleware/auth");

const router = express.Router();

const MAX_ATTEMPTS  = 5;
const LOCKOUT_MS    = 15 * 60 * 1000;
const RESET_TTL_MS  = 60 * 60 * 1000;
const MIN_PW_LENGTH = 12;
const IS_PROD       = (process.env.NODE_ENV || "").toLowerCase() === "production";

const ROLE_LEVELS = {
  SUPER_ADMIN: 100, CORPORATE_ADMIN: 90, CFO: 80,
  DIRECTOR: 75, DIRECTIVO: 75, COMMERCIAL_DIRECTOR: 70,
  COMPLIANCE: 65, ACCOUNTING: 60, TREASURY: 60,
  AUDIT: 55, TAX_REVIEWER: 50, COUNTRY_ACCOUNTANT: 50,
  LOGISTICS: 45, AGENTE: 40, MEDIA_MANAGER: 35,
  CLIENT: 20, SUPPLIER: 20,
};

function roleLevel(role) { return ROLE_LEVELS[role] || 0; }

function buildPayload(user) {
  return {
    id: user.id,
    username: user.username,
    role: user.role,
    name: user.name,
    email: user.email,
    department: user.department || null,
    position: user.position || null,
    preferred_lang: user.preferred_lang || "es",
    first_login: user.first_login || 0,
    profile_completed: user.profile_completed || 0,
    linked_client_id: user.linked_client_id || null,
  };
}

function setCookie(res, token) {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure:   IS_PROD,
    sameSite: IS_PROD ? "strict" : "lax",
    maxAge:   8 * 60 * 60 * 1000,
    path:     "/",
  });
}

// ── Rate-limiting helpers ────────────────────────────────────────────────────

function checkRateLimit(identifier) {
  const row = db.prepare(
    "SELECT attempt_count, locked_until FROM login_attempts WHERE identifier = ?"
  ).get(identifier);
  if (!row) return { blocked: false };
  if (row.locked_until && new Date(row.locked_until) > new Date()) {
    return { blocked: true, lockedUntil: row.locked_until };
  }
  return { blocked: false };
}

function recordFailedAttempt(identifier) {
  const existing = db.prepare("SELECT id, attempt_count FROM login_attempts WHERE identifier = ?").get(identifier);
  const now = new Date();
  if (!existing) {
    db.prepare(
      "INSERT INTO login_attempts (identifier, attempt_count, last_attempt) VALUES (?, 1, ?)"
    ).run(identifier, now.toISOString().slice(0, 19).replace("T", " "));
    return;
  }
  const newCount = existing.attempt_count + 1;
  const lockedUntil = newCount >= MAX_ATTEMPTS
    ? new Date(now.getTime() + LOCKOUT_MS).toISOString().slice(0, 19).replace("T", " ")
    : null;
  db.prepare(
    "UPDATE login_attempts SET attempt_count = ?, locked_until = ?, last_attempt = ? WHERE identifier = ?"
  ).run(newCount, lockedUntil, now.toISOString().slice(0, 19).replace("T", " "), identifier);
}

function clearAttempts(identifier) {
  db.prepare("DELETE FROM login_attempts WHERE identifier = ?").run(identifier);
}

// ── POST /auth/login ─────────────────────────────────────────────────────────

router.post("/login", (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: "Usuario y contraseña requeridos" });
  }

  const identifier = `${(req.ip || "").slice(0, 45)}:${username.toLowerCase()}`;
  const rl = checkRateLimit(identifier);
  if (rl.blocked) {
    try {
      db.prepare("INSERT INTO audit_log (username, action, ip) VALUES (?, ?, ?)")
        .run(username.toLowerCase(), "LOGIN_BRUTE_FORCE_BLOCKED", (req.ip || "").slice(0, 45));
    } catch (_) {}
    return res.status(429).json({ error: "Cuenta bloqueada temporalmente. Intenta más tarde.", lockedUntil: rl.lockedUntil });
  }

  const user = db.prepare("SELECT * FROM users WHERE username = ? AND active = 1").get(username.toLowerCase());

  if (!user || !bcrypt.compareSync(password, user.password)) {
    recordFailedAttempt(identifier);
    return res.status(401).json({ error: "Credenciales incorrectas" });
  }

  clearAttempts(identifier);

  const payload = buildPayload(user);
  const token = jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "8h",
  });

  setCookie(res, token);
  db.prepare("INSERT INTO audit_log (username, action, ip) VALUES (?, ?, ?)").run(user.username, "login", req.ip);

  res.json({ token, user: payload });
});

// ── POST /auth/logout ────────────────────────────────────────────────────────

router.post("/logout", authenticate, (req, res) => {
  res.clearCookie(COOKIE_NAME, { path: "/" });
  db.prepare("INSERT INTO audit_log (username, action, ip) VALUES (?, ?, ?)").run(req.user.username, "logout", req.ip);
  res.json({ ok: true });
});

// ── GET /auth/me ─────────────────────────────────────────────────────────────

router.get("/me", authenticate, (req, res) => {
  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(req.user.id);
  if (!user) return res.status(404).json({ error: "Usuario no encontrado" });
  res.json(buildPayload(user));
});

// ── POST /auth/change-password ───────────────────────────────────────────────

router.post("/change-password", authenticate, (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!newPassword || newPassword.length < MIN_PW_LENGTH) {
    return res.status(400).json({ error: `La nueva contraseña debe tener al menos ${MIN_PW_LENGTH} caracteres` });
  }

  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(req.user.id);
  if (!user) return res.status(404).json({ error: "Usuario no encontrado" });

  if (!user.first_login) {
    if (!currentPassword || !bcrypt.compareSync(currentPassword, user.password)) {
      return res.status(401).json({ error: "Contraseña actual incorrecta" });
    }
  }

  const hash = bcrypt.hashSync(newPassword, 10);
  const AGENT_ROLES = new Set(["AGENTE", "LOGISTICS", "CLIENT", "SUPPLIER"]);
  const needsProfile = AGENT_ROLES.has(user.role) ? 0 : 1;
  db.prepare(
    "UPDATE users SET password = ?, first_login = 0, password_changed = 1, profile_completed = ? WHERE id = ?"
  ).run(hash, needsProfile, user.id);
  db.prepare("INSERT INTO audit_log (username, action, ip) VALUES (?, ?, ?)").run(user.username, "password_changed", req.ip);

  // Refresh cookie with new token
  const newPayload = buildPayload({ ...user, first_login: 0, profile_completed: needsProfile });
  const token = jwt.sign(newPayload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "8h",
  });
  setCookie(res, token);

  res.json({ ok: true, token, message: "Contraseña actualizada" });
});

// ── POST /auth/forgot-password ───────────────────────────────────────────────

router.post("/forgot-password", (req, res) => {
  const { email } = req.body;
  // Always respond success to avoid user enumeration
  res.json({ ok: true, message: "Si el correo existe, recibirás instrucciones." });

  if (!email) return;
  try {
    const user = db.prepare("SELECT id, email, username, active FROM users WHERE email = ? AND active = 1").get(email);
    if (!user) return;

    const rawToken   = crypto.randomBytes(32).toString("hex");
    const tokenHash  = crypto.createHash("sha256").update(rawToken).digest("hex");
    const now        = new Date();
    const expiresAt  = new Date(now.getTime() + RESET_TTL_MS).toISOString().slice(0, 19).replace("T", " ");
    const createdAt  = now.toISOString().slice(0, 19).replace("T", " ");

    db.prepare(
      "INSERT INTO password_reset_tokens (token_hash, user_id, created_at, expires_at, created_from_ip) VALUES (?, ?, ?, ?, ?)"
    ).run(tokenHash, user.id, createdAt, expiresAt, (req.ip || "").slice(0, 45));

    const resetUrl = `${process.env.CLIENT_ORIGIN || ""}/reset-password?token=${rawToken}`;
    try {
      const { sendPasswordResetEmail } = require("../utils/email");
      sendPasswordResetEmail(user, resetUrl).catch(() => {});
    } catch (_) {}

    db.prepare("INSERT INTO audit_log (username, action, ip) VALUES (?, ?, ?)").run(user.username, "forgot_password_requested", req.ip);
  } catch (e) {
    console.error("[forgot-password] error:", e.message);
  }
});

// ── POST /auth/reset-password ────────────────────────────────────────────────

router.post("/reset-password", (req, res) => {
  const { token, newPassword } = req.body;
  if (!token || !newPassword) {
    return res.status(400).json({ error: "Token y nueva contraseña requeridos" });
  }
  if (newPassword.length < MIN_PW_LENGTH) {
    return res.status(400).json({ error: `La contraseña debe tener al menos ${MIN_PW_LENGTH} caracteres` });
  }

  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  const row = db.prepare(
    "SELECT id, user_id, expires_at, used_at FROM password_reset_tokens WHERE token_hash = ?"
  ).get(tokenHash);

  if (!row) return res.status(400).json({ error: "Token inválido o expirado" });
  if (row.used_at) return res.status(400).json({ error: "Token ya utilizado" });
  if (new Date(row.expires_at) < new Date()) return res.status(400).json({ error: "Token expirado" });

  const user = db.prepare("SELECT * FROM users WHERE id = ? AND active = 1").get(row.user_id);
  if (!user) return res.status(400).json({ error: "Usuario no encontrado" });

  const hash = bcrypt.hashSync(newPassword, 10);
  const now  = new Date().toISOString().slice(0, 19).replace("T", " ");

  db.transaction(() => {
    db.prepare("UPDATE users SET password = ?, first_login = 0, password_changed = 1 WHERE id = ?").run(hash, user.id);
    db.prepare("UPDATE password_reset_tokens SET used_at = ? WHERE id = ?").run(now, row.id);
  })();

  db.prepare("INSERT INTO audit_log (username, action, ip) VALUES (?, ?, ?)").run(user.username, "password_reset", req.ip);
  res.json({ ok: true, message: "Contraseña restablecida exitosamente" });
});

// ── GET /auth/migration-status (level 90+) ───────────────────────────────────

router.get("/migration-status", authenticate, (req, res) => {
  if (roleLevel(req.user.role) < 90) {
    return res.status(403).json({ error: "Acceso denegado" });
  }
  try {
    res.json(db.getMigrationStatus());
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
