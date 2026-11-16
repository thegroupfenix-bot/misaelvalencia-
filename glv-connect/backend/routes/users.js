const express = require("express");
const db = require("../db/database");
const { authenticate } = require("../middleware/auth");
const { requireLevel } = require("../middleware/rbac");

const router = express.Router();
router.use(authenticate, requireLevel(75));

router.get("/", (req, res) => {
  const rows = db
    .prepare("SELECT id, username, role, name, email, active, created_at FROM users ORDER BY role, username")
    .all();
  res.json(rows);
});

router.patch("/:id/active", (req, res) => {
  const { active } = req.body;
  if (active === undefined) return res.status(400).json({ error: "active requerido" });

  const target = db.prepare("SELECT id, username FROM users WHERE id = ?").get(req.params.id);
  if (!target) return res.status(404).json({ error: "Usuario no encontrado" });

  db.prepare("UPDATE users SET active = ? WHERE id = ?").run(active ? 1 : 0, req.params.id);

  const action = active ? `user_activated:${target.username}` : `user_deactivated:${target.username}`;
  db.prepare("INSERT INTO audit_log (username, action, ip) VALUES (?, ?, ?)").run(req.user.username, action, req.ip);

  res.json({ ok: true });
});

module.exports = router;
