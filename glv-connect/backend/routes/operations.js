"use strict";
const express = require("express");
const db = require("../db/database");
const { authenticate } = require("../middleware/auth");
const { requireLevel, DIRECTORS, ROLE_LEVEL } = require("../middleware/rbac");

const router = express.Router();
router.use(authenticate);

// ─── Valid operation status state machine ─────────────────────────────────────
// Only listed transitions are permitted. Terminals have no outgoing transitions.
const OP_STATUS_TRANSITIONS = {
  DRAFT:        ["NEGOTIATING", "CANCELLED"],
  NEGOTIATING:  ["ACTIVE", "CANCELLED"],
  ACTIVE:       ["NEGOTIATING", "PENDING_DOCS", "CANCELLED"],
  PENDING_DOCS: ["ACTIVE", "SIGNED", "CANCELLED"],
  SIGNED:       ["SHIPPED", "CANCELLED"],
  SHIPPED:      ["COMPLETED", "CANCELLED"],
  COMPLETED:    [],  // terminal
  CANCELLED:    [],  // terminal
};

function genOperationId(category, origin) {
  const codes = {
    LIVE_ANIMALS: "AV", FROZEN_MEAT: "CM", COMMODITIES: "GR",
    OILS: "AC", FRUIT_PRODUCTS: "FR", EGGS: "HV",
  };
  const originCodes = { Brazil: "BR", Uruguay: "UY", Colombia: "CO", Argentina: "AR", Chile: "CL", USA: "US" };
  const cat  = codes[category] || "OP";
  const orig = originCodes[origin] || "XX";
  const year  = new Date().getFullYear();
  const count = db.prepare("SELECT COUNT(*) AS c FROM operations").get().c + 1;
  return `${orig}-${cat}-${year}-${String(count).padStart(3, "0")}`;
}

// Helper: returns true if user can access this operation
// Directors+ see all; agents see only their own (assigned or created)
function canViewOperation(op, user) {
  if (DIRECTORS.has(user.role)) return true;
  if ((ROLE_LEVEL[user.role] || 0) >= 70) return true;
  return op.assigned_agent === user.id || op.created_by === user.id;
}

// GET /operations
router.get("/", (req, res) => {
  const { status, category, agent } = req.query;
  let q = `
    SELECT o.*,
           COALESCE(ua.name, ub.name) as agent_name,
           COALESCE(ua.username, ub.username) as agent_username,
           c.name as client_name
    FROM operations o
    LEFT JOIN users ua ON ua.id = o.assigned_agent
    LEFT JOIN users ub ON ub.id = o.created_by AND o.assigned_agent IS NULL
    LEFT JOIN clients c ON c.id = o.client_id
  `;
  const conditions = [];
  const params = [];
  if (status)   { conditions.push("o.status = ?");           params.push(status); }
  if (category) { conditions.push("o.product_category = ?"); params.push(category); }
  if (agent)    { conditions.push("o.assigned_agent = ?");   params.push(agent); }

  // Agents (level < 70) only see their own operations
  if ((ROLE_LEVEL[req.user.role] || 0) < 70) {
    conditions.push("(o.assigned_agent = ? OR o.created_by = ?)");
    params.push(req.user.id, req.user.id);
  }

  if (conditions.length) q += " WHERE " + conditions.join(" AND ");
  q += " ORDER BY o.created_at DESC";
  res.json(db.prepare(q).all(...params));
});

// GET /operations/:id
router.get("/:id", (req, res) => {
  const op = db.prepare(`
    SELECT o.*,
           COALESCE(ua.name, ub.name) as agent_name,
           COALESCE(ua.username, ub.username) as agent_username,
           c.name as client_name
    FROM operations o
    LEFT JOIN users ua ON ua.id = o.assigned_agent
    LEFT JOIN users ub ON ub.id = o.created_by AND o.assigned_agent IS NULL
    LEFT JOIN clients c ON c.id = o.client_id
    WHERE o.id = ?
  `).get(req.params.id);

  if (!op) return res.status(404).json({ error: "Operación no encontrada" });

  if (!canViewOperation(op, req.user)) {
    return res.status(403).json({ error: "Acceso denegado" });
  }

  const docs = db.prepare("SELECT id, type, status, date FROM documents WHERE operation_id = ? ORDER BY date").all(req.params.id);
  res.json({ ...op, documents: docs });
});

// POST /operations
router.post("/", requireLevel(40), (req, res) => {
  const {
    product_category, product_detail, commercial_data,
    origin_country, destination_country, counterpart_country, incoterm, currency,
    shipment_qty, unit_type, unit_price,
    shipment_value, monthly_value, contract_value,
    delivery_frequency, num_shipments, contract_duration,
    client_id, assigned_agent,
    counterpart_name, product_name, notes, origin, destination,
  } = req.body;

  const cd  = commercial_data || {};
  const cat = product_category || cd.category;
  if (!cat) return res.status(400).json({ error: "Categoría de producto requerida" });

  const orig = origin_country || origin || null;
  const dest = destination_country || counterpart_country || destination || null;
  const cur  = currency || cd.currency || "USD";
  const sv   = shipment_value || cd.summary?.shipmentValue || null;
  const mv   = monthly_value  || cd.summary?.monthlyValue  || null;
  const cv   = contract_value || cd.summary?.contractValue || null;

  const id = genOperationId(cat, orig);

  db.prepare(`
    INSERT INTO operations (
      id, status, product_category, product_detail, commercial_data,
      origin_country, destination_country, incoterm, currency,
      shipment_qty, unit_type, unit_price,
      shipment_value, monthly_value, contract_value,
      delivery_frequency, num_shipments, contract_duration,
      client_id, assigned_agent, created_by
    ) VALUES (?, 'ACTIVE', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, cat,
    product_detail  ? JSON.stringify(product_detail)  : null,
    commercial_data ? JSON.stringify(commercial_data) : null,
    orig, dest,
    incoterm || cd.incoterm || "CFR", cur,
    shipment_qty || null, unit_type || cd.unitType || null, unit_price || cd.unitPrice || null,
    sv, mv, cv,
    delivery_frequency || cd.deliveryFrequency || null,
    num_shipments || cd.numShipments || null,
    contract_duration || cd.contractDuration || null,
    client_id || null, assigned_agent || req.user.id, req.user.id
  );

  try {
    db.prepare("UPDATE operations SET counterpart_name = ?, product_name = ?, notes = ? WHERE id = ?")
      .run(counterpart_name || null, product_name || null, notes || null, id);
  } catch (_) {}

  db.prepare("INSERT INTO audit_log (username, action, doc_id, ip) VALUES (?, ?, ?, ?)").run(
    req.user.username, "operation_created", id, req.ip
  );

  res.status(201).json(db.prepare("SELECT * FROM operations WHERE id = ?").get(id));
});

// PATCH /operations/:id/status
router.patch("/:id/status", requireLevel(40), (req, res) => {
  const { status } = req.body;
  if (!status || typeof status !== "string") {
    return res.status(400).json({ error: "status requerido" });
  }

  const normalized = status.toUpperCase().trim();
  if (!OP_STATUS_TRANSITIONS.hasOwnProperty(normalized)) {
    return res.status(400).json({
      error: `Estado inválido: "${normalized}". Estados válidos: ${Object.keys(OP_STATUS_TRANSITIONS).join(", ")}`,
    });
  }

  const op = db.prepare("SELECT id, status, assigned_agent, created_by FROM operations WHERE id = ?").get(req.params.id);
  if (!op) return res.status(404).json({ error: "Operación no encontrada" });

  // Ownership: agents (level < 70) can only update their own operations
  if ((ROLE_LEVEL[req.user.role] || 0) < 70) {
    if (op.assigned_agent !== req.user.id && op.created_by !== req.user.id) {
      return res.status(403).json({ error: "Acceso denegado — solo puedes modificar tus propias operaciones" });
    }
  }

  const currentStatus = (op.status || "ACTIVE").toUpperCase();
  const allowed = OP_STATUS_TRANSITIONS[currentStatus] || [];

  // Directors+ can bypass state machine for corrections
  if ((ROLE_LEVEL[req.user.role] || 0) < 70 && !allowed.includes(normalized)) {
    return res.status(400).json({
      error: `Transición inválida: "${currentStatus}" → "${normalized}". Transiciones permitidas: ${allowed.join(", ") || "(ninguna — estado terminal)"}`,
    });
  }

  db.prepare("UPDATE operations SET status = ?, updated_at = datetime('now') WHERE id = ?")
    .run(normalized, req.params.id);

  db.prepare("INSERT INTO audit_log (username, action, doc_id, ip) VALUES (?, ?, ?, ?)").run(
    req.user.username, `operation_status: ${currentStatus} → ${normalized}`, req.params.id, req.ip
  );

  res.json({ ok: true, id: req.params.id, status: normalized });
});

module.exports = router;
