const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const db = require("../db/database");
const { authenticate } = require("../middleware/auth");

const router = express.Router();

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
  };
}

router.post("/login", (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: "Usuario y contraseña requeridos" });
  }

  const user = db
    .prepare("SELECT * FROM users WHERE username = ? AND active = 1")
    .get(username.toLowerCase());

  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.status(401).json({ error: "Credenciales incorrectas" });
  }

  const payload = buildPayload(user);
  const token = jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "8h",
  });

  db.prepare("INSERT INTO audit_log (username, action, ip) VALUES (?, ?, ?)").run(user.username, "login", req.ip);

  res.json({ token, user: payload });
});

router.get("/me", authenticate, (req, res) => {
  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(req.user.id);
  if (!user) return res.status(404).json({ error: "Usuario no encontrado" });
  res.json(buildPayload(user));
});

// POST /auth/change-password — first login or voluntary change
router.post("/change-password", authenticate, (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!newPassword || newPassword.length < 8) {
    return res.status(400).json({ error: "La nueva contraseña debe tener al menos 8 caracteres" });
  }

  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(req.user.id);
  if (!user) return res.status(404).json({ error: "Usuario no encontrado" });

  // On first_login, skip current password check
  if (!user.first_login && currentPassword) {
    if (!bcrypt.compareSync(currentPassword, user.password)) {
      return res.status(401).json({ error: "Contraseña actual incorrecta" });
    }
  }

  const hash = bcrypt.hashSync(newPassword, 10);
  db.prepare("UPDATE users SET password = ?, first_login = 0 WHERE id = ?").run(hash, user.id);
  db.prepare("INSERT INTO audit_log (username, action, ip) VALUES (?, ?, ?)").run(user.username, "password_changed", req.ip);

  res.json({ ok: true, message: "Contraseña actualizada" });
});

module.exports = router;
