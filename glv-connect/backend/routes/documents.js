const express = require("express");
const db = require("../db/database");
const { authenticate } = require("../middleware/auth");
const { requireRole } = require("../middleware/rbac");
const { sendDocumentEmail } = require("../utils/email");

const router = express.Router();
router.use(authenticate);

const PRICE_TABLE = {
  "UAE":                   { port: "Jebel Ali / Port Rashid, Dubai",   price: 5.70, transit: "25–28" },
  "Saudi Arabia (East)":   { port: "Port of Dammam",                   price: 5.80, transit: "27–30" },
  "Saudi Arabia (West)":   { port: "Port of Jeddah",                   price: 5.85, transit: "29–32" },
  "Türkiye (South)":       { port: "Port of Mersin",                   price: 5.95, transit: "20–24" },
  "Türkiye (Northwest)":   { port: "Port of Derince / Istanbul",       price: 6.00, transit: "22–26" },
  "China":                 { port: "Port of Shanghai / Tianjin",       price: 5.65, transit: "32–38" },
};

function genId(type) {
  const count = db
    .prepare("SELECT COUNT(*) AS c FROM documents WHERE type = ?")
    .get(type).c;
  return `${type}-GLV-2026-${String(count + 2).padStart(3, "0")}`;
}

function toRow(d) {
  return {
    id: d.id,
    type: d.type,
    status: d.status,
    client: d.client,
    clientCountry: d.client_country,
    clientRepresentative: d.client_representative,
    clientEmail: d.client_email,
    clientPhone: d.client_phone,
    agent: d.agent,
    date: d.date,
    destination: d.destination,
    product: d.product,
    headcount: d.headcount,
    avgWeight: d.avg_weight,
    pricePerKg: d.price_per_kg,
    origin: d.origin,
    totalValue: d.total_value,
    paymentMethod: d.payment_method,
    exporter: d.exporter,
    domain: d.domain,
    gaccNote: d.gacc_note,
    parentId: d.parent_id,
    observations: d.observations,
    createdAt: d.created_at,
  };
}

// GET /documents  — AGENTE sees own docs; DIRECTIVO sees all
router.get("/", (req, res) => {
  const { type } = req.query;
  let stmt;
  if (req.user.role === "AGENTE") {
    stmt = type
      ? db.prepare("SELECT * FROM documents WHERE agent = ? AND type = ? ORDER BY date DESC")
      : db.prepare("SELECT * FROM documents WHERE agent = ? ORDER BY date DESC");
    const rows = type
      ? stmt.all(req.user.username, type)
      : stmt.all(req.user.username);
    return res.json(rows.map(toRow));
  }
  stmt = type
    ? db.prepare("SELECT * FROM documents WHERE type = ? ORDER BY date DESC")
    : db.prepare("SELECT * FROM documents ORDER BY date DESC");
  const rows = type ? stmt.all(type) : stmt.all();
  res.json(rows.map(toRow));
});

// GET /documents/:id
router.get("/:id", (req, res) => {
  const doc = db
    .prepare("SELECT * FROM documents WHERE id = ?")
    .get(req.params.id);
  if (!doc) return res.status(404).json({ error: "Documento no encontrado" });
  if (req.user.role === "AGENTE" && doc.agent !== req.user.username) {
    return res.status(403).json({ error: "Acceso denegado" });
  }
  res.json(toRow(doc));
});

// POST /documents
router.post("/", async (req, res) => {
  const {
    type, client, clientCountry, clientRepresentative,
    clientEmail, clientPhone, destination, product,
    headcount, avgWeight, origin, paymentMethod,
    observations, parentId,
  } = req.body;

  if (!type || !client || !product || !destination) {
    return res.status(400).json({ error: "Faltan campos obligatorios: type, client, product, destination" });
  }
  if (!["SCO", "FCO", "SPA"].includes(type)) {
    return res.status(400).json({ error: "Tipo inválido" });
  }
  if (type === "SPA" && req.user.role !== "DIRECTIVO") {
    return res.status(403).json({ error: "Solo DIRECTIVO puede crear SPA" });
  }

  const isChina = destination === "China";
  const exporter = isChina ? "GLV Services SAS (Colombia)" : "GLV Global Food Services LLC (Miami, FL)";
  const domain = isChina ? "glvservicesexp.com" : "glvglobalfoodservices.com";
  const gaccNote = isChina ? "GACC No. YA11000PDY110K805" : null;
  const effectiveOrigin = isChina ? "Colombia" : (origin || "Brazil");

  const destInfo = PRICE_TABLE[destination] || {};
  const pricePerKg = destInfo.price || null;
  const totalKg = (parseFloat(headcount) || 0) * (parseFloat(avgWeight) || 0);
  const totalValue = totalKg && pricePerKg ? totalKg * pricePerKg : null;

  const id = genId(type);
  const status = type === "SPA" ? "Activo" : "Emitido";
  const date = new Date().toISOString().split("T")[0];

  db.prepare(`
    INSERT INTO documents
      (id, type, status, client, client_country, client_representative, client_email, client_phone,
       agent, date, destination, product, headcount, avg_weight, price_per_kg, origin,
       total_value, payment_method, exporter, domain, gacc_note, parent_id, observations)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `).run(
    id, type, status, client, clientCountry || null, clientRepresentative || null,
    clientEmail || null, clientPhone || null,
    req.user.username, date, destination, product,
    parseFloat(headcount) || null, parseFloat(avgWeight) || null, pricePerKg,
    effectiveOrigin, totalValue, paymentMethod || "SBLC",
    exporter, domain, gaccNote, parentId || null, observations || null
  );

  db.prepare(
    "INSERT INTO audit_log (username, action, doc_id, ip) VALUES (?, ?, ?, ?)"
  ).run(req.user.username, `${type} generado`, id, req.ip);

  const newDoc = toRow(db.prepare("SELECT * FROM documents WHERE id = ?").get(id));

  sendDocumentEmail(newDoc, req.user).catch(err =>
    console.error("[email] Error enviando notificación:", err.message)
  );

  res.status(201).json(newDoc);
});

// PATCH /documents/:id/status  — DIRECTIVO only
router.patch("/:id/status", requireRole("DIRECTIVO"), (req, res) => {
  const { status } = req.body;
  if (!status) return res.status(400).json({ error: "status requerido" });

  const doc = db.prepare("SELECT * FROM documents WHERE id = ?").get(req.params.id);
  if (!doc) return res.status(404).json({ error: "Documento no encontrado" });

  db.prepare("UPDATE documents SET status = ? WHERE id = ?").run(status, req.params.id);
  db.prepare(
    "INSERT INTO audit_log (username, action, doc_id, ip) VALUES (?, ?, ?, ?)"
  ).run(req.user.username, `status → ${status}`, req.params.id, req.ip);

  res.json(toRow(db.prepare("SELECT * FROM documents WHERE id = ?").get(req.params.id)));
});

module.exports = router;
