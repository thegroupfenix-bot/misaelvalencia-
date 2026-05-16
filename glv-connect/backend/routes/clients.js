const express = require("express");
const db = require("../db/database");
const { authenticate } = require("../middleware/auth");

const router = express.Router();
router.use(authenticate);

router.get("/", (req, res) => {
  const { type } = req.query;
  let q = "SELECT * FROM clients";
  const params = [];
  if (type) { q += " WHERE type = ?"; params.push(type); }
  q += " ORDER BY name";
  res.json(db.prepare(q).all(...params));
});

router.get("/:id", (req, res) => {
  const c = db.prepare("SELECT * FROM clients WHERE id = ?").get(req.params.id);
  if (!c) return res.status(404).json({ error: "Cliente no encontrado" });
  res.json(c);
});

router.post("/", (req, res) => {
  const { type, name, company, country, representative, email, phone, whatsapp, address, tax_id, preferred_lang } = req.body;
  if (!name) return res.status(400).json({ error: "Nombre requerido" });

  const r = db.prepare(`
    INSERT INTO clients (type, name, company, country, representative, email, phone, whatsapp, address, tax_id, preferred_lang, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(type || "buyer", name, company || null, country || null, representative || null,
         email || null, phone || null, whatsapp || null, address || null,
         tax_id || null, preferred_lang || "en", req.user.id);

  res.status(201).json(db.prepare("SELECT * FROM clients WHERE id = ?").get(r.lastInsertRowid));
});

router.put("/:id", (req, res) => {
  const c = db.prepare("SELECT id FROM clients WHERE id = ?").get(req.params.id);
  if (!c) return res.status(404).json({ error: "Cliente no encontrado" });

  const { type, name, company, country, representative, email, phone, whatsapp, address, tax_id, preferred_lang, active } = req.body;
  db.prepare(`
    UPDATE clients SET
      type = COALESCE(?, type), name = COALESCE(?, name), company = COALESCE(?, company),
      country = COALESCE(?, country), representative = COALESCE(?, representative),
      email = COALESCE(?, email), phone = COALESCE(?, phone), whatsapp = COALESCE(?, whatsapp),
      address = COALESCE(?, address), tax_id = COALESCE(?, tax_id),
      preferred_lang = COALESCE(?, preferred_lang), active = COALESCE(?, active)
    WHERE id = ?
  `).run(type||null, name||null, company||null, country||null, representative||null,
         email||null, phone||null, whatsapp||null, address||null, tax_id||null,
         preferred_lang||null, active !== undefined ? (active ? 1 : 0) : null, req.params.id);

  res.json(db.prepare("SELECT * FROM clients WHERE id = ?").get(req.params.id));
});

module.exports = router;
