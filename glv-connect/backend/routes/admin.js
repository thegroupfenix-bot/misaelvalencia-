const express = require("express");
const bcrypt = require("bcryptjs");
const db = require("../db/database");
const { authenticate } = require("../middleware/auth");
const { requireAdmin, ALL_ROLES } = require("../middleware/rbac");

const router = express.Router();
router.use(authenticate, requireAdmin);

// GET /admin/users — list all users with profile data
router.get("/users", (req, res) => {
  const users = db.prepare(`
    SELECT u.id, u.username, u.role, u.name, u.email, u.department, u.position,
           u.country, u.preferred_lang, u.first_login, u.active, u.created_at,
           u.profile_completed,
           p.cargo, p.phone, p.completed as agent_profile_completed
    FROM users u
    LEFT JOIN agent_profiles p ON p.user_id = u.id
    ORDER BY u.role, u.name
  `).all();
  res.json(users);
});

// POST /admin/users — create new user
router.post("/users", (req, res) => {
  const {
    username, name, email, role, department, position, country,
    preferred_lang, temporary_password,
  } = req.body;

  if (!username || !name || !email || !role || !temporary_password) {
    return res.status(400).json({ error: "Faltan campos obligatorios: username, name, email, role, temporary_password" });
  }

  if (!ALL_ROLES.includes(role)) {
    return res.status(400).json({ error: `Rol inválido. Roles válidos: ${ALL_ROLES.join(", ")}` });
  }

  const existing = db.prepare("SELECT id FROM users WHERE username = ?").get(username.toLowerCase());
  if (existing) return res.status(409).json({ error: "El nombre de usuario ya existe" });

  const hash = bcrypt.hashSync(temporary_password, 10);

  const result = db.prepare(`
    INSERT INTO users (username, password, role, name, email, department, position, country, preferred_lang, first_login, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
  `).run(
    username.toLowerCase(), hash, role, name, email,
    department || null, position || null, country || null,
    preferred_lang || "es", req.user.id
  );

  db.prepare("INSERT INTO audit_log (username, action, ip) VALUES (?, ?, ?)").run(
    req.user.username, `created_user:${username}`, req.ip
  );

  const created = db.prepare("SELECT id, username, role, name, email, department, position, preferred_lang, first_login, active, created_at FROM users WHERE id = ?").get(result.lastInsertRowid);
  res.status(201).json(created);
});

// PATCH /admin/users/:id — update user (role, active, department, etc.)
router.patch("/users/:id", (req, res) => {
  const { role, active, department, position, country, preferred_lang, name, email } = req.body;
  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(req.params.id);
  if (!user) return res.status(404).json({ error: "Usuario no encontrado" });

  // Super Admin cannot be demoted except by themselves
  if (user.role === "SUPER_ADMIN" && req.user.id !== user.id && req.user.role !== "SUPER_ADMIN") {
    return res.status(403).json({ error: "No puede modificar un Super Admin" });
  }

  if (role && !ALL_ROLES.includes(role)) {
    return res.status(400).json({ error: "Rol inválido" });
  }

  db.prepare(`
    UPDATE users SET
      role = COALESCE(?, role),
      active = COALESCE(?, active),
      department = COALESCE(?, department),
      position = COALESCE(?, position),
      country = COALESCE(?, country),
      preferred_lang = COALESCE(?, preferred_lang),
      name = COALESCE(?, name),
      email = COALESCE(?, email)
    WHERE id = ?
  `).run(role || null, active !== undefined ? (active ? 1 : 0) : null,
         department || null, position || null, country || null,
         preferred_lang || null, name || null, email || null, req.params.id);

  db.prepare("INSERT INTO audit_log (username, action, ip) VALUES (?, ?, ?)").run(
    req.user.username, `updated_user:${user.username}`, req.ip
  );

  const updated = db.prepare("SELECT id, username, role, name, email, department, position, preferred_lang, first_login, active FROM users WHERE id = ?").get(req.params.id);
  res.json(updated);
});

// POST /admin/users/:id/reset-password — reset to temp password
router.post("/users/:id/reset-password", (req, res) => {
  const { temporary_password } = req.body;
  if (!temporary_password || temporary_password.length < 6) {
    return res.status(400).json({ error: "La contraseña temporal debe tener al menos 6 caracteres" });
  }

  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(req.params.id);
  if (!user) return res.status(404).json({ error: "Usuario no encontrado" });

  const AGENT_ROLES = new Set(["AGENTE", "LOGISTICS", "CLIENT", "SUPPLIER"]);
  const hash = bcrypt.hashSync(temporary_password, 10);
  const resetProfile = AGENT_ROLES.has(user.role) ? 0 : user.profile_completed || 1;
  db.prepare("UPDATE users SET password = ?, first_login = 1, profile_completed = ? WHERE id = ?")
    .run(hash, resetProfile, req.params.id);

  db.prepare("INSERT INTO audit_log (username, action, ip) VALUES (?, ?, ?)").run(
    req.user.username, `reset_password:${user.username}`, req.ip
  );

  res.json({ ok: true, message: "Contraseña restablecida. El usuario deberá cambiarla en su próximo inicio de sesión." });
});

// GET /admin/roles — list all available roles
router.get("/roles", (req, res) => {
  res.json(ALL_ROLES);
});

// DELETE /admin/users/:id — permanently delete user
router.delete("/users/:id", (req, res) => {
  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(req.params.id);
  if (!user) return res.status(404).json({ error: "Usuario no encontrado" });

  if (user.role === "SUPER_ADMIN" && req.user.id !== user.id) {
    return res.status(403).json({ error: "No puede eliminar un Super Admin" });
  }

  if (user.id === req.user.id) {
    return res.status(400).json({ error: "No puede eliminar su propia cuenta" });
  }

  db.prepare("DELETE FROM users WHERE id = ?").run(req.params.id);
  db.prepare("INSERT INTO audit_log (username, action, ip) VALUES (?, ?, ?)").run(
    req.user.username, `deleted_user:${user.username}`, req.ip
  );

  res.json({ ok: true });
});

module.exports = router;
