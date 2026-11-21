"use strict";

const express = require("express");
const db = require("../db/database");
const pii = require("../utils/piiCrypto");
const { authenticate } = require("../middleware/auth");

const router = express.Router();
router.use(authenticate);

function requireClient(req, res) {
  if (req.user.role !== "CLIENT" || !req.user.linked_client_id) {
    res.status(403).json({ error: "Acceso exclusivo para clientes activos." });
    return null;
  }
  const client = db.prepare("SELECT * FROM clients WHERE id = ? AND active = 1").get(req.user.linked_client_id);
  if (!client) {
    res.status(404).json({ error: "Cuenta de cliente no vinculada o inactiva." });
    return null;
  }
  return client;
}

function clientData(client) {
  let kyc = {};
  try {
    if (client.kyc_data) kyc = JSON.parse(pii.isConfigured() ? pii.decrypt(client.kyc_data) : client.kyc_data);
  } catch (_) {}
  return kyc;
}

function publicProfile(client, user) {
  const kyc = clientData(client);
  return {
    client_id: client.id,
    username: user.username,
    glv_code: client.glv_code,
    company: client.company || kyc.empresa || client.name,
    country: client.country || kyc.pais || null,
    representative: client.representative || kyc.rep || null,
    email: user.email || client.email || kyc.email || null,
    phone: client.phone || kyc.tel || null,
    whatsapp: client.whatsapp || null,
    address: client.address || null,
    kyc_status: client.kyc_status,
  };
}

// GET /client-portal/me
router.get("/me", (req, res) => {
  const client = requireClient(req, res);
  if (!client) return;
  const user = db.prepare("SELECT id, username, email FROM users WHERE id = ?").get(req.user.id);
  res.json(publicProfile(client, user));
});

// PATCH /client-portal/contact
router.patch("/contact", (req, res) => {
  const client = requireClient(req, res);
  if (!client) return;
  const { email, phone, whatsapp, address } = req.body || {};
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email))) {
    return res.status(400).json({ error: "Ingrese un correo válido." });
  }
  for (const value of [phone, whatsapp]) {
    if (value != null && String(value).length > 40) return res.status(400).json({ error: "El número telefónico es demasiado largo." });
  }
  if (address != null && String(address).length > 500) return res.status(400).json({ error: "La dirección supera el máximo permitido." });

  const emailNorm = String(email).trim().toLowerCase();
  const kyc = clientData(client);
  kyc.email = emailNorm;
  if (phone != null) kyc.tel = String(phone).trim();

  const encrypted = pii.isConfigured() ? pii.encrypt(JSON.stringify(kyc)) : JSON.stringify(kyc);
  db.transaction(() => {
    db.prepare("UPDATE clients SET email=?, phone=?, whatsapp=?, address=?, kyc_data=? WHERE id=?")
      .run(emailNorm, phone ? String(phone).trim() : null, whatsapp ? String(whatsapp).trim() : null, address ? String(address).trim() : null, encrypted, client.id);
    db.prepare("UPDATE users SET email=? WHERE id=?").run(emailNorm, req.user.id);
    db.prepare("INSERT INTO audit_log (username, action, doc_id, client_id, ip) VALUES (?, ?, ?, ?, ?)")
      .run(req.user.username, "CLIENT_CONTACT_UPDATED", client.glv_code, client.id, req.ip);
  })();

  const updated = db.prepare("SELECT * FROM clients WHERE id=?").get(client.id);
  const user = db.prepare("SELECT id, username, email FROM users WHERE id=?").get(req.user.id);
  res.json(publicProfile(updated, user));
});

// GET /client-portal/name-change-requests
router.get("/name-change-requests", (req, res) => {
  const client = requireClient(req, res);
  if (!client) return;
  const rows = db.prepare(`SELECT id, requested_name, reason, evidence_document_id, status, created_at, reviewed_at, review_notes
    FROM client_name_change_requests WHERE client_id=? ORDER BY created_at DESC`).all(client.id);
  res.json(rows);
});

// POST /client-portal/name-change-requests
router.post("/name-change-requests", (req, res) => {
  const client = requireClient(req, res);
  if (!client) return;
  const { requested_name, reason, evidence_document_id } = req.body || {};
  const name = String(requested_name || "").trim();
  if (name.length < 2 || name.length > 200) return res.status(400).json({ error: "La razón social debe tener entre 2 y 200 caracteres." });
  if (!evidence_document_id) return res.status(400).json({ error: "Adjunte el certificado de Cámara de Comercio o documento comercial vigente." });

  const doc = db.prepare("SELECT id FROM client_documents WHERE id=? AND client_id=? AND status='ACTIVE'").get(evidence_document_id, client.id);
  if (!doc) return res.status(400).json({ error: "El documento adjunto no pertenece a esta cuenta." });

  const existing = db.prepare("SELECT id FROM client_name_change_requests WHERE client_id=? AND status='PENDING'").get(client.id);
  if (existing) return res.status(409).json({ error: "Ya existe una solicitud de cambio de razón social en revisión." });

  const ins = db.prepare(`INSERT INTO client_name_change_requests
    (client_id, requested_name, reason, evidence_document_id, status)
    VALUES (?, ?, ?, ?, 'PENDING')`).run(client.id, name, String(reason || "").trim() || null, evidence_document_id);

  db.prepare("INSERT INTO audit_log (username, action, doc_id, client_id, ip) VALUES (?, ?, ?, ?, ?)")
    .run(req.user.username, "CLIENT_NAME_CHANGE_REQUESTED", client.glv_code, client.id, req.ip);
  res.status(201).json(db.prepare("SELECT * FROM client_name_change_requests WHERE id=?").get(ins.lastInsertRowid));
});

module.exports = router;
