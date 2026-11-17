"use strict";

const express = require("express");
const db = require("../db/database");
const { authenticate } = require("../middleware/auth");
const { requireLevel, ROLE_LEVEL } = require("../middleware/rbac");

const router = express.Router();
router.use(authenticate);

const REQUEST_STATUSES = new Set(["draft", "submitted", "approved", "rejected", "cancelled"]);
const ORDER_STATUSES = new Set(["draft", "issued", "partially_received", "received", "cancelled"]);
const MOVEMENT_TYPES = new Set(["receipt", "issue", "reservation", "release", "transfer_in", "transfer_out", "adjustment_in", "adjustment_out"]);

db.exec(`
  CREATE TABLE IF NOT EXISTS warehouses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    country TEXT,
    address TEXT,
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS warehouse_locations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    warehouse_id INTEGER NOT NULL REFERENCES warehouses(id),
    code TEXT NOT NULL,
    name TEXT,
    active INTEGER NOT NULL DEFAULT 1,
    UNIQUE(warehouse_id, code)
  );
  CREATE TABLE IF NOT EXISTS inventory_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sku TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT,
    unit TEXT NOT NULL,
    minimum_stock REAL NOT NULL DEFAULT 0,
    standard_cost REAL NOT NULL DEFAULT 0,
    currency TEXT NOT NULL DEFAULT 'USD',
    active INTEGER NOT NULL DEFAULT 1,
    created_by INTEGER REFERENCES users(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS inventory_lots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    item_id INTEGER NOT NULL REFERENCES inventory_items(id),
    lot_code TEXT NOT NULL,
    supplier_name TEXT,
    expiry_date TEXT,
    operation_id TEXT REFERENCES operations(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(item_id, lot_code)
  );
  CREATE TABLE IF NOT EXISTS purchase_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'draft',
    priority TEXT NOT NULL DEFAULT 'medium',
    department TEXT,
    cost_center TEXT,
    operation_id TEXT REFERENCES operations(id),
    requested_by INTEGER NOT NULL REFERENCES users(id),
    approved_by INTEGER REFERENCES users(id),
    approved_at TEXT,
    rejection_reason TEXT,
    needed_by TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS purchase_request_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    request_id INTEGER NOT NULL REFERENCES purchase_requests(id) ON DELETE CASCADE,
    item_id INTEGER REFERENCES inventory_items(id),
    description TEXT NOT NULL,
    quantity REAL NOT NULL CHECK(quantity > 0),
    unit TEXT NOT NULL,
    estimated_cost REAL,
    currency TEXT NOT NULL DEFAULT 'USD'
  );
  CREATE TABLE IF NOT EXISTS purchase_orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT NOT NULL UNIQUE,
    request_id INTEGER REFERENCES purchase_requests(id),
    supplier_name TEXT NOT NULL,
    supplier_tax_id TEXT,
    status TEXT NOT NULL DEFAULT 'draft',
    currency TEXT NOT NULL DEFAULT 'USD',
    cost_center TEXT,
    operation_id TEXT REFERENCES operations(id),
    expected_date TEXT,
    created_by INTEGER NOT NULL REFERENCES users(id),
    approved_by INTEGER REFERENCES users(id),
    approved_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS purchase_order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    purchase_order_id INTEGER NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
    item_id INTEGER REFERENCES inventory_items(id),
    description TEXT NOT NULL,
    quantity REAL NOT NULL CHECK(quantity > 0),
    unit TEXT NOT NULL,
    unit_cost REAL NOT NULL CHECK(unit_cost >= 0),
    received_quantity REAL NOT NULL DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS goods_receipts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT NOT NULL UNIQUE,
    purchase_order_id INTEGER NOT NULL REFERENCES purchase_orders(id),
    warehouse_id INTEGER NOT NULL REFERENCES warehouses(id),
    received_by INTEGER NOT NULL REFERENCES users(id),
    received_at TEXT NOT NULL DEFAULT (datetime('now')),
    document_ref TEXT,
    notes TEXT
  );
  CREATE TABLE IF NOT EXISTS goods_receipt_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    receipt_id INTEGER NOT NULL REFERENCES goods_receipts(id) ON DELETE CASCADE,
    purchase_order_item_id INTEGER NOT NULL REFERENCES purchase_order_items(id),
    quantity REAL NOT NULL CHECK(quantity > 0),
    lot_code TEXT,
    expiry_date TEXT
  );
  CREATE TABLE IF NOT EXISTS inventory_movements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    item_id INTEGER NOT NULL REFERENCES inventory_items(id),
    lot_id INTEGER REFERENCES inventory_lots(id),
    warehouse_id INTEGER NOT NULL REFERENCES warehouses(id),
    location_id INTEGER REFERENCES warehouse_locations(id),
    movement_type TEXT NOT NULL,
    quantity REAL NOT NULL CHECK(quantity > 0),
    unit_cost REAL NOT NULL DEFAULT 0,
    operation_id TEXT REFERENCES operations(id),
    reference_type TEXT,
    reference_id INTEGER,
    notes TEXT,
    created_by INTEGER NOT NULL REFERENCES users(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS inventory_reservations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    item_id INTEGER NOT NULL REFERENCES inventory_items(id),
    warehouse_id INTEGER NOT NULL REFERENCES warehouses(id),
    operation_id TEXT REFERENCES operations(id),
    quantity REAL NOT NULL CHECK(quantity > 0),
    status TEXT NOT NULL DEFAULT 'active',
    created_by INTEGER NOT NULL REFERENCES users(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS entity_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    action TEXT NOT NULL,
    actor_id INTEGER REFERENCES users(id),
    details_json TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_movements_item_warehouse ON inventory_movements(item_id, warehouse_id, created_at);
  CREATE INDEX IF NOT EXISTS idx_events_entity ON entity_events(entity_type, entity_id, created_at);
`);

function code(prefix) {
  return prefix + "-" + new Date().toISOString().slice(0, 10).replace(/-/g, "") + "-" + Math.random().toString(36).slice(2, 7).toUpperCase();
}
function event(entityType, entityId, action, userId, details = {}) {
  db.prepare("INSERT INTO entity_events (entity_type,entity_id,action,actor_id,details_json) VALUES (?,?,?,?,?)")
    .run(entityType, String(entityId), action, userId, JSON.stringify(details));
}
function availableStock(itemId, warehouseId) {
  const received = db.prepare(`SELECT COALESCE(SUM(CASE WHEN movement_type IN ('receipt','transfer_in','adjustment_in') THEN quantity ELSE -quantity END),0) quantity
    FROM inventory_movements WHERE item_id=? AND warehouse_id=?`).get(itemId, warehouseId).quantity;
  const reserved = db.prepare("SELECT COALESCE(SUM(quantity),0) quantity FROM inventory_reservations WHERE item_id=? AND warehouse_id=? AND status='active'")
    .get(itemId, warehouseId).quantity;
  return { physical: received, available: received - reserved, reserved };
}
function purchaseAccess(req, res, next) {
  if ((ROLE_LEVEL[req.user.role] || 0) < 40) return res.status(403).json({ error: "Permisos insuficientes para compras." });
  next();
}
function inventoryAccess(req, res, next) {
  if ((ROLE_LEVEL[req.user.role] || 0) < 45) return res.status(403).json({ error: "Permisos insuficientes para inventario." });
  next();
}

router.get("/requests", purchaseAccess, (_req, res) => {
  const rows = db.prepare(`SELECT r.*,u.name requested_name,a.name approved_name,
    (SELECT COUNT(*) FROM purchase_request_items i WHERE i.request_id=r.id) item_count
    FROM purchase_requests r JOIN users u ON u.id=r.requested_by LEFT JOIN users a ON a.id=r.approved_by
    ORDER BY r.created_at DESC LIMIT 200`).all();
  res.json(rows);
});
router.post("/requests", purchaseAccess, (req, res) => {
  const { title, description = null, priority = "medium", department = null, cost_center = null, operation_id = null, needed_by = null, items } = req.body || {};
  if (!title || !Array.isArray(items) || items.length === 0) return res.status(400).json({ error: "Título e ítems son obligatorios." });
  if (items.some(i => !i.description || !(Number(i.quantity) > 0) || !i.unit)) return res.status(400).json({ error: "Cada ítem requiere descripción, cantidad y unidad." });
  const create = db.transaction(() => {
    const result = db.prepare(`INSERT INTO purchase_requests (code,title,description,priority,department,cost_center,operation_id,requested_by,needed_by)
      VALUES (?,?,?,?,?,?,?,?,?)`).run(code("SC"), title.trim(), description, priority, department, cost_center, operation_id, req.user.id, needed_by);
    const add = db.prepare(`INSERT INTO purchase_request_items (request_id,item_id,description,quantity,unit,estimated_cost,currency)
      VALUES (?,?,?,?,?,?,?)`);
    for (const item of items) add.run(result.lastInsertRowid, item.item_id || null, item.description.trim(), Number(item.quantity), item.unit, item.estimated_cost || null, item.currency || "USD");
    event("purchase_request", result.lastInsertRowid, "created", req.user.id, { items: items.length });
    return result.lastInsertRowid;
  });
  const id = create();
  res.status(201).json(db.prepare("SELECT * FROM purchase_requests WHERE id=?").get(id));
});
router.post("/requests/:id/submit", purchaseAccess, (req, res) => {
  const request = db.prepare("SELECT * FROM purchase_requests WHERE id=?").get(req.params.id);
  if (!request) return res.status(404).json({ error: "Solicitud no encontrada." });
  if (request.requested_by !== req.user.id && (ROLE_LEVEL[req.user.role] || 0) < 65) return res.status(403).json({ error: "Solo el solicitante o supervisión puede enviar la solicitud." });
  if (request.status !== "draft") return res.status(409).json({ error: "La solicitud ya fue procesada." });
  db.prepare("UPDATE purchase_requests SET status='submitted',updated_at=datetime('now') WHERE id=?").run(request.id);
  event("purchase_request", request.id, "submitted", req.user.id);
  res.json(db.prepare("SELECT * FROM purchase_requests WHERE id=?").get(request.id));
});
router.post("/requests/:id/approve", requireLevel(65), (req, res) => {
  const request = db.prepare("SELECT * FROM purchase_requests WHERE id=?").get(req.params.id);
  if (!request) return res.status(404).json({ error: "Solicitud no encontrada." });
  if (request.requested_by === req.user.id) return res.status(403).json({ error: "El solicitante no puede aprobar su propia solicitud." });
  if (request.status !== "submitted") return res.status(409).json({ error: "La solicitud debe estar enviada para aprobación." });
  const decision = req.body?.decision;
  if (!["approved", "rejected"].includes(decision)) return res.status(400).json({ error: "Decisión inválida." });
  db.prepare(`UPDATE purchase_requests SET status=?,approved_by=?,approved_at=datetime('now'),rejection_reason=?,updated_at=datetime('now') WHERE id=?`)
    .run(decision, req.user.id, decision === "rejected" ? (req.body.reason || null) : null, request.id);
  event("purchase_request", request.id, decision, req.user.id, { reason: req.body?.reason || null });
  res.json(db.prepare("SELECT * FROM purchase_requests WHERE id=?").get(request.id));
});

router.get("/orders", purchaseAccess, (_req, res) => {
  res.json(db.prepare(`SELECT o.*,u.name created_name,a.name approved_name,
    (SELECT COALESCE(SUM(quantity*unit_cost),0) FROM purchase_order_items i WHERE i.purchase_order_id=o.id) total
    FROM purchase_orders o JOIN users u ON u.id=o.created_by LEFT JOIN users a ON a.id=o.approved_by ORDER BY o.created_at DESC LIMIT 200`).all());
});
router.post("/orders", requireLevel(45), (req, res) => {
  const { request_id = null, supplier_name, supplier_tax_id = null, currency = "USD", cost_center = null, operation_id = null, expected_date = null, items } = req.body || {};
  if (!supplier_name || !Array.isArray(items) || !items.length) return res.status(400).json({ error: "Proveedor e ítems son obligatorios." });
  if (items.some(i => !i.description || !(Number(i.quantity) > 0) || !(Number(i.unit_cost) >= 0) || !i.unit)) return res.status(400).json({ error: "Cada ítem requiere descripción, cantidad, unidad y costo." });
  if (request_id) {
    const request = db.prepare("SELECT status FROM purchase_requests WHERE id=?").get(request_id);
    if (!request || request.status !== "approved") return res.status(409).json({ error: "La orden requiere una solicitud aprobada." });
  }
  const create = db.transaction(() => {
    const result = db.prepare(`INSERT INTO purchase_orders (code,request_id,supplier_name,supplier_tax_id,currency,cost_center,operation_id,expected_date,created_by)
      VALUES (?,?,?,?,?,?,?,?,?)`).run(code("OC"), request_id, supplier_name.trim(), supplier_tax_id, currency, cost_center, operation_id, expected_date, req.user.id);
    const add = db.prepare(`INSERT INTO purchase_order_items (purchase_order_id,item_id,description,quantity,unit,unit_cost) VALUES (?,?,?,?,?,?)`);
    for (const item of items) add.run(result.lastInsertRowid, item.item_id || null, item.description.trim(), Number(item.quantity), item.unit, Number(item.unit_cost));
    event("purchase_order", result.lastInsertRowid, "created", req.user.id, { items: items.length, request_id });
    return result.lastInsertRowid;
  });
  const id = create();
  res.status(201).json(db.prepare("SELECT * FROM purchase_orders WHERE id=?").get(id));
});
router.post("/orders/:id/issue", requireLevel(65), (req, res) => {
  const order = db.prepare("SELECT * FROM purchase_orders WHERE id=?").get(req.params.id);
  if (!order) return res.status(404).json({ error: "Orden no encontrada." });
  if (order.status !== "draft") return res.status(409).json({ error: "La orden ya fue emitida." });
  if (order.created_by === req.user.id) return res.status(403).json({ error: "El creador no puede emitir su propia orden." });
  db.prepare("UPDATE purchase_orders SET status='issued',approved_by=?,approved_at=datetime('now'),updated_at=datetime('now') WHERE id=?").run(req.user.id, order.id);
  event("purchase_order", order.id, "issued", req.user.id);
  res.json(db.prepare("SELECT * FROM purchase_orders WHERE id=?").get(order.id));
});
router.post("/orders/:id/receipts", inventoryAccess, (req, res) => {
  const { warehouse_id, document_ref = null, notes = null, items } = req.body || {};
  if (!warehouse_id || !Array.isArray(items) || !items.length) return res.status(400).json({ error: "Bodega e ítems recibidos son obligatorios." });
  const order = db.prepare("SELECT * FROM purchase_orders WHERE id=?").get(req.params.id);
  if (!order) return res.status(404).json({ error: "Orden no encontrada." });
  if (!["issued", "partially_received"].includes(order.status)) return res.status(409).json({ error: "La orden debe estar emitida para recibir mercancía." });
  const receipt = db.transaction(() => {
    const result = db.prepare(`INSERT INTO goods_receipts (code,purchase_order_id,warehouse_id,received_by,document_ref,notes) VALUES (?,?,?,?,?,?)`)
      .run(code("REC"), order.id, warehouse_id, req.user.id, document_ref, notes);
    const addLine = db.prepare("INSERT INTO goods_receipt_items (receipt_id,purchase_order_item_id,quantity,lot_code,expiry_date) VALUES (?,?,?,?,?)");
    const orderLine = db.prepare("SELECT * FROM purchase_order_items WHERE id=? AND purchase_order_id=?");
    const receiveLine = db.prepare("UPDATE purchase_order_items SET received_quantity=received_quantity+? WHERE id=?");
    const findLot = db.prepare("SELECT id FROM inventory_lots WHERE item_id=? AND lot_code=?");
    const createLot = db.prepare("INSERT INTO inventory_lots (item_id,lot_code,supplier_name,expiry_date,operation_id) VALUES (?,?,?,?,?)");
    const movement = db.prepare(`INSERT INTO inventory_movements (item_id,lot_id,warehouse_id,movement_type,quantity,unit_cost,operation_id,reference_type,reference_id,notes,created_by)
      VALUES (?,?,?,?,?,?,?,?,?,?,?)`);
    for (const line of items) {
      const source = orderLine.get(line.purchase_order_item_id, order.id);
      const qty = Number(line.quantity);
      if (!source || !(qty > 0) || source.received_quantity + qty > source.quantity + 0.000001) throw new Error("Cantidad de recepción inválida.");
      addLine.run(result.lastInsertRowid, source.id, qty, line.lot_code || null, line.expiry_date || null);
      receiveLine.run(qty, source.id);
      let lotId = null;
      if (source.item_id && line.lot_code) {
        const existing = findLot.get(source.item_id, line.lot_code);
        lotId = existing?.id || createLot.run(source.item_id, line.lot_code, order.supplier_name, line.expiry_date || null, order.operation_id).lastInsertRowid;
      }
      if (source.item_id) movement.run(source.item_id, lotId, warehouse_id, "receipt", qty, source.unit_cost, order.operation_id, "goods_receipt", result.lastInsertRowid, notes, req.user.id);
    }
    const remaining = db.prepare("SELECT COUNT(*) c FROM purchase_order_items WHERE purchase_order_id=? AND received_quantity < quantity").get(order.id).c;
    db.prepare("UPDATE purchase_orders SET status=?,updated_at=datetime('now') WHERE id=?").run(remaining ? "partially_received" : "received", order.id);
    event("goods_receipt", result.lastInsertRowid, "received", req.user.id, { order_id: order.id, items: items.length });
    return result.lastInsertRowid;
  });
  try { const id = receipt(); res.status(201).json(db.prepare("SELECT * FROM goods_receipts WHERE id=?").get(id)); }
  catch (e) { res.status(400).json({ error: e.message }); }
});

router.get("/warehouses", inventoryAccess, (_req, res) => res.json(db.prepare("SELECT * FROM warehouses WHERE active=1 ORDER BY name").all()));
router.post("/warehouses", requireLevel(65), (req, res) => {
  const { code: warehouseCode, name, country = null, address = null } = req.body || {};
  if (!warehouseCode || !name) return res.status(400).json({ error: "Código y nombre son obligatorios." });
  try { const result = db.prepare("INSERT INTO warehouses (code,name,country,address) VALUES (?,?,?,?)").run(warehouseCode.trim().toUpperCase(), name.trim(), country, address);
    event("warehouse", result.lastInsertRowid, "created", req.user.id); res.status(201).json(db.prepare("SELECT * FROM warehouses WHERE id=?").get(result.lastInsertRowid)); }
  catch (_) { res.status(409).json({ error: "El código de bodega ya existe." }); }
});
router.get("/items", inventoryAccess, (_req, res) => res.json(db.prepare("SELECT * FROM inventory_items WHERE active=1 ORDER BY name LIMIT 500").all()));
router.post("/items", requireLevel(45), (req, res) => {
  const { sku, name, description = null, unit, minimum_stock = 0, standard_cost = 0, currency = "USD" } = req.body || {};
  if (!sku || !name || !unit || Number(minimum_stock) < 0 || Number(standard_cost) < 0) return res.status(400).json({ error: "SKU, nombre, unidad y valores válidos son obligatorios." });
  try { const result = db.prepare(`INSERT INTO inventory_items (sku,name,description,unit,minimum_stock,standard_cost,currency,created_by) VALUES (?,?,?,?,?,?,?,?)`)
    .run(sku.trim().toUpperCase(), name.trim(), description, unit, Number(minimum_stock), Number(standard_cost), currency, req.user.id);
    event("inventory_item", result.lastInsertRowid, "created", req.user.id); res.status(201).json(db.prepare("SELECT * FROM inventory_items WHERE id=?").get(result.lastInsertRowid)); }
  catch (_) { res.status(409).json({ error: "El SKU ya existe." }); }
});
router.post("/movements", inventoryAccess, (req, res) => {
  const { item_id, warehouse_id, movement_type, quantity, unit_cost = 0, operation_id = null, notes = null } = req.body || {};
  if (!item_id || !warehouse_id || !MOVEMENT_TYPES.has(movement_type) || !(Number(quantity) > 0)) return res.status(400).json({ error: "Datos de movimiento inválidos." });
  const reducing = ["issue", "transfer_out", "adjustment_out"].includes(movement_type);
  if (reducing && availableStock(item_id, warehouse_id).available < Number(quantity)) return res.status(409).json({ error: "Stock disponible insuficiente." });
  const result = db.prepare(`INSERT INTO inventory_movements (item_id,warehouse_id,movement_type,quantity,unit_cost,operation_id,notes,created_by)
    VALUES (?,?,?,?,?,?,?,?)`).run(item_id, warehouse_id, movement_type, Number(quantity), Number(unit_cost), operation_id, notes, req.user.id);
  event("inventory_movement", result.lastInsertRowid, movement_type, req.user.id, { item_id, warehouse_id, quantity: Number(quantity) });
  res.status(201).json(db.prepare("SELECT * FROM inventory_movements WHERE id=?").get(result.lastInsertRowid));
});
router.get("/kardex", inventoryAccess, (req, res) => {
  const { item_id, warehouse_id } = req.query;
  let sql = `SELECT m.*,i.sku,i.name,w.code warehouse_code,w.name warehouse_name,l.lot_code
    FROM inventory_movements m JOIN inventory_items i ON i.id=m.item_id JOIN warehouses w ON w.id=m.warehouse_id
    LEFT JOIN inventory_lots l ON l.id=m.lot_id`;
  const parts=[], values=[];
  if (item_id) { parts.push("m.item_id=?"); values.push(item_id); }
  if (warehouse_id) { parts.push("m.warehouse_id=?"); values.push(warehouse_id); }
  if (parts.length) sql += " WHERE " + parts.join(" AND ");
  res.json(db.prepare(sql + " ORDER BY m.created_at DESC LIMIT 1000").all(...values));
});
router.get("/stock", inventoryAccess, (_req, res) => {
  const rows=db.prepare(`SELECT i.id item_id,i.sku,i.name,i.unit,i.minimum_stock,w.id warehouse_id,w.code warehouse_code,w.name warehouse_name,
    COALESCE(SUM(CASE WHEN m.movement_type IN ('receipt','transfer_in','adjustment_in') THEN m.quantity ELSE -m.quantity END),0) physical,
    COALESCE((SELECT SUM(r.quantity) FROM inventory_reservations r WHERE r.item_id=i.id AND r.warehouse_id=w.id AND r.status='active'),0) reserved,
    COALESCE(SUM(CASE WHEN m.movement_type IN ('receipt','transfer_in','adjustment_in') THEN m.quantity ELSE -m.quantity END),0)
     - COALESCE((SELECT SUM(r.quantity) FROM inventory_reservations r WHERE r.item_id=i.id AND r.warehouse_id=w.id AND r.status='active'),0) available,
    COALESCE(SUM(CASE WHEN m.movement_type IN ('receipt','transfer_in','adjustment_in') THEN m.quantity*m.unit_cost ELSE 0 END),0) inventory_value
    FROM inventory_items i CROSS JOIN warehouses w LEFT JOIN inventory_movements m ON m.item_id=i.id AND m.warehouse_id=w.id
    WHERE i.active=1 AND w.active=1 GROUP BY i.id,w.id HAVING physical != 0 OR reserved != 0 OR i.minimum_stock > 0 ORDER BY i.name,w.name`).all();
  res.json(rows);
});
router.get("/events/:type/:id", requireLevel(55), (req,res) => res.json(db.prepare("SELECT e.*,u.name actor_name FROM entity_events e LEFT JOIN users u ON u.id=e.actor_id WHERE e.entity_type=? AND e.entity_id=? ORDER BY e.created_at DESC").all(req.params.type,req.params.id)));

module.exports=router;
