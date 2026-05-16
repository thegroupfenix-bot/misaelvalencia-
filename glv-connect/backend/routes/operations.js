const express = require("express");
const db = require("../db/database");
const { authenticate } = require("../middleware/auth");

const router = express.Router();
router.use(authenticate);

function genOperationId(category, origin) {
  const codes = {
    LIVE_ANIMALS: "AV", FROZEN_MEAT: "CM", COMMODITIES: "GR",
    OILS: "AC", FRUIT_PRODUCTS: "FR", EGGS: "HV",
  };
  const originCodes = { Brazil: "BR", Uruguay: "UY", Colombia: "CO", Argentina: "AR", Chile: "CL", USA: "US" };
  const cat = codes[category] || "OP";
  const orig = originCodes[origin] || "XX";
  const year = new Date().getFullYear();
  const count = db.prepare("SELECT COUNT(*) AS c FROM operations").get().c + 1;
  return `${orig}-${cat}-${year}-${String(count).padStart(3, "0")}`;
}

router.get("/", (req, res) => {
  const { status, category, agent } = req.query;
  let q = `
    SELECT o.*, u.name as agent_name, c.name as client_name
    FROM operations o
    LEFT JOIN users u ON u.id = o.assigned_agent
    LEFT JOIN clients c ON c.id = o.client_id
  `;
  const conditions = [];
  const params = [];
  if (status) { conditions.push("o.status = ?"); params.push(status); }
  if (category) { conditions.push("o.product_category = ?"); params.push(category); }
  if (agent) { conditions.push("o.assigned_agent = ?"); params.push(agent); }

  // Agents only see their own operations
  const { DIRECTORS } = require("../middleware/rbac");
  if (!DIRECTORS.has(req.user.role)) {
    conditions.push("o.assigned_agent = ?");
    params.push(req.user.id);
  }

  if (conditions.length) q += " WHERE " + conditions.join(" AND ");
  q += " ORDER BY o.created_at DESC";
  res.json(db.prepare(q).all(...params));
});

router.get("/:id", (req, res) => {
  const op = db.prepare(`
    SELECT o.*, u.name as agent_name, c.name as client_name
    FROM operations o
    LEFT JOIN users u ON u.id = o.assigned_agent
    LEFT JOIN clients c ON c.id = o.client_id
    WHERE o.id = ?
  `).get(req.params.id);
  if (!op) return res.status(404).json({ error: "Operación no encontrada" });

  const docs = db.prepare("SELECT id, type, status, date FROM documents WHERE operation_id = ? ORDER BY date").all(req.params.id);
  res.json({ ...op, documents: docs });
});

router.post("/", (req, res) => {
  const {
    product_category, product_detail, commercial_data,
    origin_country, destination_country, incoterm, currency,
    shipment_qty, unit_type, unit_price,
    shipment_value, monthly_value, contract_value,
    delivery_frequency, num_shipments, contract_duration,
    client_id, assigned_agent,
  } = req.body;

  if (!product_category) return res.status(400).json({ error: "Categoría de producto requerida" });

  const id = genOperationId(product_category, origin_country);

  db.prepare(`
    INSERT INTO operations (
      id, product_category, product_detail, commercial_data,
      origin_country, destination_country, incoterm, currency,
      shipment_qty, unit_type, unit_price,
      shipment_value, monthly_value, contract_value,
      delivery_frequency, num_shipments, contract_duration,
      client_id, assigned_agent, created_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    product_category,
    product_detail ? JSON.stringify(product_detail) : null,
    commercial_data ? JSON.stringify(commercial_data) : null,
    origin_country || null, destination_country || null,
    incoterm || "CFR", currency || "USD",
    shipment_qty || null, unit_type || null, unit_price || null,
    shipment_value || null, monthly_value || null, contract_value || null,
    delivery_frequency || null, num_shipments || null, contract_duration || null,
    client_id || null, assigned_agent || req.user.id, req.user.id
  );

  db.prepare("INSERT INTO audit_log (username, action, doc_id, ip) VALUES (?, ?, ?, ?)").run(
    req.user.username, "operation_created", id, req.ip
  );

  res.status(201).json(db.prepare("SELECT * FROM operations WHERE id = ?").get(id));
});

router.patch("/:id/status", (req, res) => {
  const { status } = req.body;
  const valid = ["active","paused","completed","cancelled"];
  if (!valid.includes(status)) return res.status(400).json({ error: `Estado inválido. Use: ${valid.join(", ")}` });

  const op = db.prepare("SELECT id FROM operations WHERE id = ?").get(req.params.id);
  if (!op) return res.status(404).json({ error: "Operación no encontrada" });

  db.prepare("UPDATE operations SET status = ?, updated_at = datetime('now') WHERE id = ?").run(status, req.params.id);
  res.json({ ok: true, id: req.params.id, status });
});

module.exports = router;
