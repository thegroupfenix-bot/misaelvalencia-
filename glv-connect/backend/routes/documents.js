const express = require("express");
const db = require("../db/database");
const { authenticate } = require("../middleware/auth");
const { requireLevel, ROLE_LEVEL, DIRECTORS } = require("../middleware/rbac");
const { sendDocumentEmail } = require("../utils/email");
const pii = require("../utils/piiCrypto");

const router = express.Router();
router.use(authenticate);

// ─── Document status whitelist + valid transitions ────────────────────────────
const ALLOWED_DOC_STATUSES = new Set([
  "Emitido", "Pendiente", "Firmado", "Activo", "Rechazado", "Cancelado", "Archivado",
]);
const DOC_STATUS_TRANSITIONS = {
  "Emitido":   ["Pendiente", "Firmado", "Rechazado", "Cancelado"],
  "Pendiente": ["Firmado", "Rechazado", "Cancelado"],
  "Firmado":   ["Activo", "Cancelado"],
  "Activo":    ["Cancelado"],
  "Rechazado": [],  // terminal
  "Cancelado": [],  // terminal
  "Archivado": [],  // terminal
};

// Ownership: directors+ can access any doc; others only own docs (by username)
function canAccessDoc(doc, user) {
  if (DIRECTORS.has(user.role)) return true;
  if ((ROLE_LEVEL[user.role] || 0) >= 70) return true;
  return doc.agent === user.username;
}

const PRICE_TABLE = {
  "UAE":                   { port: "Jebel Ali / Port Rashid, Dubai",   price: 5.70, transit: "25–28" },
  "Saudi Arabia (East)":   { port: "Port of Dammam",                   price: 5.80, transit: "27–30" },
  "Saudi Arabia (West)":   { port: "Port of Jeddah",                   price: 5.85, transit: "29–32" },
  "Türkiye (South)":       { port: "Port of Mersin",                   price: 5.95, transit: "20–24" },
  "Türkiye (Northwest)":   { port: "Port of Derince / Istanbul",       price: 6.00, transit: "22–26" },
  "China":                 { port: "Port of Shanghai / Tianjin",       price: 5.65, transit: "32–38" },
};

// Fuzzy lookup: handles "United Arab Emirates", "Saudi Arabia", full country names
function lookupDestInfo(destination) {
  if (!destination) return {};
  if (PRICE_TABLE[destination]) return PRICE_TABLE[destination];
  const d = destination.toLowerCase();
  if (d.includes("arab emirate") || d.includes("uae") || d.includes("dubai") || d.includes("abu dhabi")) return PRICE_TABLE["UAE"];
  if (d.includes("saudi") && (d.includes("east") || d.includes("dammam"))) return PRICE_TABLE["Saudi Arabia (East)"];
  if (d.includes("saudi") && (d.includes("west") || d.includes("jeddah"))) return PRICE_TABLE["Saudi Arabia (West)"];
  if (d.includes("saudi")) return PRICE_TABLE["Saudi Arabia (East)"]; // default
  if (d.includes("china")) return PRICE_TABLE["China"];
  if (d.includes("turk") || d.includes("türk")) return PRICE_TABLE["Türkiye (South)"];
  return {};
}

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
    paymentOption: d.payment_option,
    docTrigger: d.doc_trigger,
    hasGuarantee: d.has_guarantee,
    guaranteeType: d.guarantee_type,
    guaranteeBank: d.guarantee_bank,
    validityDays: d.validity_days || 15,
    customProductName: d.custom_product_name,
    customProductDesc: d.custom_product_desc,
    customUnit: d.custom_unit,
    fcoConfirmed: d.fco_confirmed,
    clientIdDocB64: pii.isConfigured() ? pii.decrypt(d.client_id_doc_b64) : d.client_id_doc_b64,
    productCategory: d.product_category,
    lang: d.lang,
    commercialData: d.commercial_data ? (typeof d.commercial_data === "string" ? JSON.parse(d.commercial_data) : d.commercial_data) : null,
  };
}

// GET /documents — restricted users see only their own docs (by agent username)
router.get("/", (req, res) => {
  const { type } = req.query;
  const isRestricted = (ROLE_LEVEL[req.user.role] || 0) < 70;
  let stmt;
  if (isRestricted) {
    stmt = type
      ? db.prepare("SELECT * FROM documents WHERE agent = ? AND type = ? AND (deleted = 0 OR deleted IS NULL) ORDER BY date DESC")
      : db.prepare("SELECT * FROM documents WHERE agent = ? AND (deleted = 0 OR deleted IS NULL) ORDER BY date DESC");
    const rows = type
      ? stmt.all(req.user.username, type)
      : stmt.all(req.user.username);
    return res.json(rows.map(toRow));
  }
  stmt = type
    ? db.prepare("SELECT * FROM documents WHERE type = ? AND (deleted = 0 OR deleted IS NULL) ORDER BY date DESC")
    : db.prepare("SELECT * FROM documents WHERE (deleted = 0 OR deleted IS NULL) ORDER BY date DESC");
  const rows = type ? stmt.all(type) : stmt.all();
  res.json(rows.map(toRow));
});

// GET /documents/:id
router.get("/:id", (req, res) => {
  const doc = db.prepare("SELECT * FROM documents WHERE id = ?").get(req.params.id);
  if (!doc) return res.status(404).json({ error: "Documento no encontrado" });
  if (!canAccessDoc(doc, req.user)) {
    return res.status(403).json({ error: "Acceso denegado" });
  }
  res.json(toRow(doc));
});

// POST /documents
router.post("/", requireLevel(40), async (req, res) => {
  const {
    type, client, clientCountry, clientRepresentative,
    clientEmail, clientPhone, destination, product,
    headcount, avgWeight, origin, paymentMethod,
    observations, parentId,
    // Extended fields
    payment_option, doc_trigger, has_guarantee, guarantee_type, guarantee_bank,
    validity_days, custom_product_name, custom_product_desc, custom_unit,
    fco_confirmed, client_id_doc_b64,
    commercial_data,
  } = req.body;

  // Derive product from commercial_data if not provided directly
  const effectiveProduct = product || (commercial_data?.rows?.[0]?.category) || (commercial_data?.category) || null;
  const effectiveDestination = destination || commercial_data?.destination || null;

  if (!type || !client || !effectiveProduct || !effectiveDestination) {
    return res.status(400).json({ error: "Faltan campos obligatorios: type, client, product/commercial_data, destination" });
  }
  if (!["SCO", "FCO", "SPA"].includes(type)) {
    return res.status(400).json({ error: "Tipo inválido" });
  }
  if (type === "SPA" && (ROLE_LEVEL[req.user.role] || 0) < 75) {
    return res.status(403).json({ error: "Solo DIRECTOR o superior puede crear SPA" });
  }

  const isChina = effectiveDestination?.toLowerCase().includes("china");
  const exporter = isChina ? "GLV Services SAS (Colombia)" : "GLV Global Food Services LLC (Miami, FL)";
  const domain = isChina ? "glvservicesexp.com" : "glvglobalfoodservices.com";
  const gaccNote = isChina ? "GACC No. YA11000PDY110K805" : null;
  const effectiveOrigin = isChina ? "Colombia" : (origin || "Brazil");

  const destInfo = lookupDestInfo(effectiveDestination);

  // Read unit price from CommercialEngine data when not in PRICE_TABLE
  const cdData = (typeof commercial_data === "string") ? (() => { try { return JSON.parse(commercial_data); } catch { return {}; } })() : (commercial_data || {});
  const cdRow0 = cdData?.rows?.[0] || {};
  const cdInc  = (cdRow0.incoterms || ["CFR"])[0];
  const cdUnitPrice = parseFloat(cdRow0.incotermPrices?.[cdInc] || cdRow0.unitPrice || 0);
  const cdAvgWeight = parseFloat(cdRow0.specs?.avgWeight || cdRow0.avgWeight || 0);
  const cdHeadCount = parseFloat(cdRow0.specs?.headCount || cdRow0.quantity || headcount || 0);

  const pricePerKg = destInfo.price || cdUnitPrice || null;
  const effectiveAvgWeight = parseFloat(avgWeight) || cdAvgWeight || null;
  const effectiveHeadcount = parseFloat(headcount) || cdHeadCount || null;
  const totalKg = (effectiveHeadcount || 0) * (effectiveAvgWeight || 0);

  // Contract value: try summary → recompute from raw
  let cdContractValue = cdData?.summary?.contractValue || cdRow0?.summary?.contractValue || 0;
  if (cdContractValue === 0 && cdHeadCount > 0 && cdUnitPrice > 0) {
    const avW = cdAvgWeight || parseFloat(avgWeight) || 45;
    const shipV = cdHeadCount * avW * cdUnitPrice;
    const freq  = cdRow0.deliveryFrequency || "ONE_SHIPMENT";
    const spY   = freq === "MONTHLY" ? 12 : freq === "QUARTERLY" ? 4 : freq === "BIMONTHLY" ? 6 : parseFloat(cdRow0.numShipments || 1);
    const dur   = parseFloat(cdRow0.contractDuration || 12);
    const mV    = freq === "ONE_SHIPMENT" ? shipV : shipV * spY / 12;
    cdContractValue = mV * dur;
  }
  const totalValue = (totalKg && pricePerKg ? totalKg * pricePerKg : null) || cdContractValue || null;

  const id = genId(type);
  const status = type === "SPA" ? "Activo" : "Emitido";
  const date = new Date().toISOString().split("T")[0];

  db.prepare(`
    INSERT INTO documents
      (id, type, status, client, client_country, client_representative, client_email, client_phone,
       agent, date, destination, product, headcount, avg_weight, price_per_kg, origin,
       total_value, payment_method, exporter, domain, gacc_note, parent_id, observations,
       payment_option, doc_trigger, has_guarantee, guarantee_type, guarantee_bank,
       validity_days, custom_product_name, custom_product_desc, custom_unit,
       fco_confirmed, client_id_doc_b64, commercial_data)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `).run(
    id, type, status, client, clientCountry || null, clientRepresentative || null,
    clientEmail || null, clientPhone || null,
    req.user.username, date, effectiveDestination, effectiveProduct,
    effectiveHeadcount, effectiveAvgWeight, pricePerKg,
    effectiveOrigin, totalValue, paymentMethod || null,
    exporter, domain, gaccNote, parentId || null, observations || null,
    payment_option || null, doc_trigger || null, has_guarantee ? 1 : 0,
    guarantee_type || null, guarantee_bank || null,
    parseInt(validity_days) || 15,
    custom_product_name || null, custom_product_desc || null, custom_unit || null,
    fco_confirmed ? 1 : 0, (client_id_doc_b64 && pii.isConfigured()) ? pii.encrypt(client_id_doc_b64) : (client_id_doc_b64 || null),
    commercial_data ? JSON.stringify(commercial_data) : null
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

// PATCH /documents/:id/status — DIRECTOR+ (level 75) only
router.patch("/:id/status", requireLevel(75), (req, res) => {
  const { status } = req.body;
  if (!status || typeof status !== "string") {
    return res.status(400).json({ error: "status requerido" });
  }
  if (!ALLOWED_DOC_STATUSES.has(status)) {
    return res.status(400).json({
      error: `Estado inválido: "${status}". Estados permitidos: ${[...ALLOWED_DOC_STATUSES].join(", ")}`,
    });
  }

  const doc = db.prepare("SELECT * FROM documents WHERE id = ?").get(req.params.id);
  if (!doc) return res.status(404).json({ error: "Documento no encontrado" });

  const current = doc.status || "Emitido";
  const allowed = DOC_STATUS_TRANSITIONS[current] || [];

  // SUPER_ADMIN can force any transition for corrections
  if (req.user.role !== "SUPER_ADMIN" && !allowed.includes(status)) {
    return res.status(400).json({
      error: `Transición inválida: "${current}" → "${status}". Transiciones permitidas: ${allowed.join(", ") || "(ninguna — estado terminal)"}`,
    });
  }

  db.prepare("UPDATE documents SET status = ? WHERE id = ?").run(status, req.params.id);
  db.prepare("INSERT INTO audit_log (username, action, doc_id, ip) VALUES (?, ?, ?, ?)")
    .run(req.user.username, `doc_status: ${current} → ${status}`, req.params.id, req.ip);

  res.json(toRow(db.prepare("SELECT * FROM documents WHERE id = ?").get(req.params.id)));
});

// DELETE /documents/:id — soft delete
// AGENTE: can only delete own docs with status "Emitido" (not signed/active)
// DIRECTIVO/ADMIN: can delete any doc
router.delete("/:id", requireLevel(40), (req, res) => {
  const doc = db.prepare("SELECT * FROM documents WHERE id = ?").get(req.params.id);
  if (!doc) return res.status(404).json({ error: "Documento no encontrado" });
  if (doc.deleted) return res.status(410).json({ error: "Documento ya eliminado" });

  const isAdmin = (ROLE_LEVEL[req.user.role] || 0) >= 70;
  const isOwner = doc.agent === req.user.username;

  if (!isAdmin && !isOwner) {
    return res.status(403).json({ error: "Acceso denegado" });
  }
  if (!isAdmin && !["Emitido", "Pendiente"].includes(doc.status)) {
    return res.status(403).json({ error: "Solo puede eliminar documentos en estado Emitido o Pendiente" });
  }

  db.prepare("UPDATE documents SET deleted = 1, deleted_at = datetime('now'), deleted_by = ? WHERE id = ?")
    .run(req.user.username, req.params.id);
  db.prepare("INSERT INTO audit_log (username, action, doc_id, ip) VALUES (?, ?, ?, ?)")
    .run(req.user.username, `eliminado (soft delete)`, req.params.id, req.ip);

  res.json({ ok: true, id: req.params.id });
});

module.exports = router;
