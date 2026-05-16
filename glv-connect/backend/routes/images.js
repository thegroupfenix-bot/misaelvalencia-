const express = require("express");
const db = require("../db/database");
const { authenticate } = require("../middleware/auth");
const { requireRole } = require("../middleware/rbac");

const router = express.Router();
router.use(authenticate);

// GET /images — todos pueden leer
router.get("/", (req, res) => {
  const rows = db.prepare("SELECT key, file_id, updated_at FROM image_library ORDER BY key").all();
  res.json(rows);
});

// PUT /images/:key — solo DIRECTIVO puede editar
router.put("/:key", requireRole("DIRECTIVO"), (req, res) => {
  const { key } = req.params;
  const { fileId } = req.body;
  if (fileId === undefined) return res.status(400).json({ error: "fileId requerido" });

  const existing = db.prepare("SELECT key FROM image_library WHERE key = ?").get(key);
  if (existing) {
    db.prepare("UPDATE image_library SET file_id = ?, updated_at = datetime('now') WHERE key = ?").run(fileId, key);
  } else {
    db.prepare("INSERT INTO image_library (key, file_id) VALUES (?, ?)").run(key, fileId);
  }
  const row = db.prepare("SELECT key, file_id, updated_at FROM image_library WHERE key = ?").get(key);
  res.json(row);
});

module.exports = router;
