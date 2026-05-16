const express = require("express");
const db = require("../db/database");
const { authenticate } = require("../middleware/auth");

const router = express.Router();
router.use(authenticate);

// GET /profile/me
router.get("/me", (req, res) => {
  const user = db
    .prepare("SELECT id, username, name, email, role FROM users WHERE id = ?")
    .get(req.user.id);
  if (!user) return res.status(404).json({ error: "Usuario no encontrado" });

  const profile = db
    .prepare("SELECT * FROM agent_profiles WHERE user_id = ?")
    .get(req.user.id);

  res.json({
    id: user.id,
    username: user.username,
    name: user.name,
    email: user.email,
    role: user.role,
    cargo: profile?.cargo || null,
    phone: profile?.phone || null,
    country: profile?.country || null,
    languages: profile?.languages ? JSON.parse(profile.languages) : [],
    signature_b64: profile?.signature_b64 || null,
    photo_b64: profile?.photo_b64 || null,
    reg_number: profile?.reg_number || null,
    completed: profile?.completed || 0,
    updated_at: profile?.updated_at || null,
  });
});

// PUT /profile/me
router.put("/me", (req, res) => {
  const { cargo, phone, country, languages, signature_b64, photo_b64, reg_number } = req.body;

  const completed = (cargo && phone && country && signature_b64) ? 1 : 0;
  const langsJson = Array.isArray(languages) ? JSON.stringify(languages) : (languages || "[]");

  const existing = db
    .prepare("SELECT user_id FROM agent_profiles WHERE user_id = ?")
    .get(req.user.id);

  if (existing) {
    db.prepare(`
      UPDATE agent_profiles
      SET cargo = ?, phone = ?, country = ?, languages = ?, signature_b64 = ?,
          photo_b64 = ?, reg_number = ?, completed = ?, updated_at = datetime('now')
      WHERE user_id = ?
    `).run(cargo || null, phone || null, country || null, langsJson,
           signature_b64 || null, photo_b64 || null, reg_number || null,
           completed, req.user.id);
  } else {
    db.prepare(`
      INSERT INTO agent_profiles (user_id, cargo, phone, country, languages, signature_b64, photo_b64, reg_number, completed)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(req.user.id, cargo || null, phone || null, country || null, langsJson,
           signature_b64 || null, photo_b64 || null, reg_number || null, completed);
  }

  const updated = db.prepare("SELECT * FROM agent_profiles WHERE user_id = ?").get(req.user.id);
  const user = db.prepare("SELECT id, username, name, email, role FROM users WHERE id = ?").get(req.user.id);

  res.json({
    id: user.id,
    username: user.username,
    name: user.name,
    email: user.email,
    role: user.role,
    cargo: updated.cargo,
    phone: updated.phone,
    country: updated.country,
    languages: updated.languages ? JSON.parse(updated.languages) : [],
    signature_b64: updated.signature_b64,
    photo_b64: updated.photo_b64,
    reg_number: updated.reg_number,
    completed: updated.completed,
    updated_at: updated.updated_at,
  });
});

module.exports = router;
