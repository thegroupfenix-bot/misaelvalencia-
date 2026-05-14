const express = require("express");
const db = require("../db/database");
const { authenticate } = require("../middleware/auth");
const { requireRole } = require("../middleware/rbac");

const router = express.Router();
router.use(authenticate, requireRole("DIRECTIVO"));

router.get("/", (req, res) => {
  const rows = db
    .prepare("SELECT id, username, role, name, email, active, created_at FROM users ORDER BY role, username")
    .all();
  res.json(rows);
});

router.patch("/:id/active", (req, res) => {
  const { active } = req.body;
  if (active === undefined) return res.status(400).json({ error: "active requerido" });
  db.prepare("UPDATE users SET active = ? WHERE id = ?").run(active ? 1 : 0, req.params.id);
  res.json({ ok: true });
});

module.exports = router;
