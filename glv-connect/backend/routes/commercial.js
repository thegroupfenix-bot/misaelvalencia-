"use strict";

const express = require("express");
const db      = require("../db/database");
const { authenticate } = require("../middleware/auth");
const { requireLevel, ROLE_LEVEL } = require("../middleware/rbac");

const router = express.Router();
router.use(authenticate);

const VALID_INCOTERMS = ["EXW","FCA","FAS","FOB","CFR","CIF","CPT","CIP","DAP","DPU","DDP"];

// ── Helpers ───────────────────────────────────────────────────────────────────

function quoteAudit(quoteId, action, actor, actorRole, before, after, result, detail) {
  try {
    db.prepare(`
      INSERT INTO commercial_quote_audit (quote_id, action, actor, actor_role, before_json, after_json, result, detail)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      quoteId, action, actor, actorRole,
      before ? JSON.stringify(before) : null,
      after  ? JSON.stringify(after)  : null,
      result || "OK",
      detail || null
    );
  } catch (e) {
    console.error("[commercial_quote_audit] failed to write:", e.message);
  }
}

function sanitizeForClient(quote) {
  const { base_cost, freight_cost, insurance_cost, operational_cost,
          target_margin, internal_notes, min_authorized_price,
          matrix_id, rule_id, ...pub } = quote;
  return pub;
}

function nextQuoteNumber() {
  const year = new Date().getFullYear();
  const seq = db.prepare(
    "UPDATE doc_id_sequences SET last_seq = last_seq + 1 WHERE type = 'QUOTE' RETURNING last_seq"
  ).get();
  return `GLV-Q-${year}-${String(seq.last_seq).padStart(5, "0")}`;
}

// ── PRICE MATRIX ──────────────────────────────────────────────────────────────

// GET /commercial/price-matrix  (level >= 40, not CLIENT/SUPPLIER)
router.get("/price-matrix", requireLevel(40), (req, res) => {
  if (req.user.role === "CLIENT" || req.user.role === "SUPPLIER") {
    return res.status(403).json({ error: "Acceso denegado — clientes externos no acceden a la matriz de precios." });
  }
  try {
    const rows = db.prepare(`
      SELECT m.*, p.name_es AS product_name
      FROM commercial_price_matrix m
      LEFT JOIN pc_products p ON p.id = m.product_id
      ORDER BY m.updated_at DESC
    `).all();
    return res.json(rows);
  } catch (e) {
    console.error("[GET /commercial/price-matrix]", e.message);
    return res.status(500).json({ error: "Error recuperando la matriz de precios." });
  }
});

// POST /commercial/price-matrix  (level >= 70 = COMMERCIAL_DIRECTOR+)
router.post("/price-matrix", requireLevel(70), (req, res) => {
  try {
    const {
      product_id, product_code, origin_country, destination_country,
      incoterm = "CIF", currency = "USD", unit = "kg",
      base_cost, freight_cost = 0, insurance_cost = 0, operational_cost = 0,
      target_margin = 0.15, valid_from, valid_until,
    } = req.body;

    if (!origin_country || !destination_country || base_cost == null) {
      return res.status(400).json({ error: "origin_country, destination_country y base_cost son obligatorios." });
    }
    if (!VALID_INCOTERMS.includes(incoterm)) {
      return res.status(400).json({ error: `Incoterm inválido. Válidos: ${VALID_INCOTERMS.join(", ")}` });
    }
    if (typeof base_cost !== "number" || base_cost < 0) {
      return res.status(400).json({ error: "base_cost debe ser un número >= 0." });
    }
    if (typeof target_margin !== "number" || target_margin < 0 || target_margin >= 1) {
      return res.status(400).json({ error: "target_margin debe estar entre 0 y 0.99 (porcentaje decimal)." });
    }

    // Backend calculates sale_price and min_authorized_price — never from client
    const totalCost = base_cost + (freight_cost || 0) + (insurance_cost || 0) + (operational_cost || 0);
    const sale_price = parseFloat((totalCost / (1 - target_margin)).toFixed(6));
    const min_authorized_price = parseFloat((totalCost * 1.01).toFixed(6));

    const result = db.prepare(`
      INSERT INTO commercial_price_matrix
        (product_id, product_code, origin_country, destination_country, incoterm,
         currency, unit, base_cost, freight_cost, insurance_cost, operational_cost,
         target_margin, min_authorized_price, sale_price, valid_from, valid_until, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      product_id || null, product_code || null, origin_country, destination_country, incoterm,
      currency, unit, base_cost, freight_cost || 0, insurance_cost || 0, operational_cost || 0,
      target_margin, min_authorized_price, sale_price,
      valid_from || new Date().toISOString().slice(0, 10),
      valid_until || null,
      req.user.username
    );

    const matrix = db.prepare("SELECT * FROM commercial_price_matrix WHERE id = ?").get(result.lastInsertRowid);
    db.prepare(
      "INSERT INTO audit_log (username, action, doc_id, ip) VALUES (?, 'PRICE_MATRIX_CREATED', ?, ?)"
    ).run(req.user.username, String(matrix.id), req.ip || "");
    return res.status(201).json(matrix);
  } catch (e) {
    console.error("[POST /commercial/price-matrix]", e.message);
    return res.status(500).json({ error: "Error creando entrada de matriz de precios." });
  }
});

// PATCH /commercial/price-matrix/:id  (level >= 70)
router.patch("/price-matrix/:id", requireLevel(70), (req, res) => {
  try {
    const existing = db.prepare("SELECT * FROM commercial_price_matrix WHERE id = ?").get(req.params.id);
    if (!existing) return res.status(404).json({ error: "Entrada de matriz no encontrada." });

    const allowed = ["origin_country","destination_country","incoterm","currency","unit",
                     "base_cost","freight_cost","insurance_cost","operational_cost",
                     "target_margin","valid_from","valid_until","status","product_id","product_code"];
    const sets = [], params = [];
    for (const key of allowed) {
      if (req.body[key] !== undefined) { sets.push(`${key} = ?`); params.push(req.body[key]); }
    }
    if (sets.length === 0) return res.status(400).json({ error: "No hay campos para actualizar." });
    if (req.body.status && !["ACTIVE","INACTIVE","SUPERSEDED"].includes(req.body.status)) {
      return res.status(400).json({ error: "status inválido." });
    }

    // Recalculate derived fields from merged state
    const merged = { ...existing, ...req.body };
    const totalCost = merged.base_cost + merged.freight_cost + merged.insurance_cost + merged.operational_cost;
    const sale_price = parseFloat((totalCost / (1 - merged.target_margin)).toFixed(6));
    const min_authorized_price = parseFloat((totalCost * 1.01).toFixed(6));
    sets.push("sale_price = ?", "min_authorized_price = ?", "updated_at = datetime('now')");
    params.push(sale_price, min_authorized_price, req.params.id);

    db.prepare(`UPDATE commercial_price_matrix SET ${sets.join(", ")} WHERE id = ?`).run(...params);
    db.prepare(
      "INSERT INTO audit_log (username, action, doc_id, ip) VALUES (?, 'PRICE_MATRIX_UPDATED', ?, ?)"
    ).run(req.user.username, String(req.params.id), req.ip || "");

    return res.json(db.prepare("SELECT * FROM commercial_price_matrix WHERE id = ?").get(req.params.id));
  } catch (e) {
    console.error("[PATCH /commercial/price-matrix/:id]", e.message);
    return res.status(500).json({ error: "Error actualizando la matriz de precios." });
  }
});

// ── COMMERCIAL RULES ──────────────────────────────────────────────────────────

// GET /commercial/rules  (level >= 40, not CLIENT/SUPPLIER)
router.get("/rules", requireLevel(40), (req, res) => {
  if (req.user.role === "CLIENT" || req.user.role === "SUPPLIER") {
    return res.status(403).json({ error: "Acceso denegado — clientes externos no acceden a reglas comerciales." });
  }
  try {
    const rows = db.prepare(`
      SELECT r.*, p.name_es AS product_name
      FROM commercial_rules r
      LEFT JOIN pc_products p ON p.id = r.product_id
      ORDER BY r.updated_at DESC
    `).all();
    return res.json(rows);
  } catch (e) {
    console.error("[GET /commercial/rules]", e.message);
    return res.status(500).json({ error: "Error recuperando reglas comerciales." });
  }
});

// POST /commercial/rules  (level >= 70)
router.post("/rules", requireLevel(70), (req, res) => {
  try {
    const {
      product_id, product_code, origin_country, destination_country, incoterm,
      min_volume, min_volume_unit = "kg", currency = "USD",
      min_price_floor, max_discount_pct = 0, valid_from, valid_until, notes,
    } = req.body;

    if (typeof max_discount_pct !== "number" || max_discount_pct < 0 || max_discount_pct > 100) {
      return res.status(400).json({ error: "max_discount_pct debe estar entre 0 y 100." });
    }

    const result = db.prepare(`
      INSERT INTO commercial_rules
        (product_id, product_code, origin_country, destination_country, incoterm,
         min_volume, min_volume_unit, currency, min_price_floor, max_discount_pct,
         valid_from, valid_until, notes, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      product_id || null, product_code || null, origin_country || null, destination_country || null, incoterm || null,
      min_volume || null, min_volume_unit, currency,
      min_price_floor || null, max_discount_pct,
      valid_from || new Date().toISOString().slice(0, 10),
      valid_until || null, notes || null,
      req.user.username
    );

    const rule = db.prepare("SELECT * FROM commercial_rules WHERE id = ?").get(result.lastInsertRowid);
    db.prepare(
      "INSERT INTO audit_log (username, action, doc_id, ip) VALUES (?, 'COMMERCIAL_RULE_CREATED', ?, ?)"
    ).run(req.user.username, String(rule.id), req.ip || "");
    return res.status(201).json(rule);
  } catch (e) {
    console.error("[POST /commercial/rules]", e.message);
    return res.status(500).json({ error: "Error creando regla comercial." });
  }
});

// PATCH /commercial/rules/:id  (level >= 70)
router.patch("/rules/:id", requireLevel(70), (req, res) => {
  try {
    const existing = db.prepare("SELECT * FROM commercial_rules WHERE id = ?").get(req.params.id);
    if (!existing) return res.status(404).json({ error: "Regla no encontrada." });

    const allowed = ["product_id","product_code","origin_country","destination_country","incoterm",
                     "min_volume","min_volume_unit","currency","min_price_floor","max_discount_pct",
                     "valid_from","valid_until","status","notes"];
    const sets = [], params = [];
    for (const key of allowed) {
      if (req.body[key] !== undefined) { sets.push(`${key} = ?`); params.push(req.body[key]); }
    }
    if (sets.length === 0) return res.status(400).json({ error: "No hay campos para actualizar." });
    sets.push("updated_at = datetime('now')");
    params.push(req.params.id);

    db.prepare(`UPDATE commercial_rules SET ${sets.join(", ")} WHERE id = ?`).run(...params);
    db.prepare(
      "INSERT INTO audit_log (username, action, doc_id, ip) VALUES (?, 'COMMERCIAL_RULE_UPDATED', ?, ?)"
    ).run(req.user.username, String(req.params.id), req.ip || "");
    return res.json(db.prepare("SELECT * FROM commercial_rules WHERE id = ?").get(req.params.id));
  } catch (e) {
    console.error("[PATCH /commercial/rules/:id]", e.message);
    return res.status(500).json({ error: "Error actualizando regla comercial." });
  }
});

// ── COMMERCIAL QUOTES ─────────────────────────────────────────────────────────

// GET /commercial/quotes
router.get("/quotes", requireLevel(20), (req, res) => {
  try {
    const isClient = req.user.role === "CLIENT" || req.user.role === "SUPPLIER";
    let sql = `
      SELECT q.*, p.name_es AS product_name_lookup, c.glv_code AS client_glv
      FROM commercial_quotes q
      LEFT JOIN pc_products p ON p.id = q.product_id
      LEFT JOIN clients c ON c.id = q.client_id
    `;
    const params = [];
    if (isClient) {
      if (!req.user.linked_client_id) return res.json([]);
      sql += " WHERE q.client_id = ? AND q.status = 'APPROVED'";
      params.push(req.user.linked_client_id);
    }
    sql += " ORDER BY q.updated_at DESC LIMIT 100";

    const rows = db.prepare(sql).all(...params);
    const result = isClient ? rows.map(sanitizeForClient) : rows;
    return res.json(result);
  } catch (e) {
    console.error("[GET /commercial/quotes]", e.message);
    return res.status(500).json({ error: "Error recuperando cotizaciones." });
  }
});

// GET /commercial/quotes/:id
router.get("/quotes/:id", requireLevel(20), (req, res) => {
  try {
    const quote = db.prepare(`
      SELECT q.*, p.name_es AS product_name_lookup, c.glv_code AS client_glv
      FROM commercial_quotes q
      LEFT JOIN pc_products p ON p.id = q.product_id
      LEFT JOIN clients c ON c.id = q.client_id
      WHERE q.id = ?
    `).get(req.params.id);
    if (!quote) return res.status(404).json({ error: "Cotización no encontrada." });

    const isClient = req.user.role === "CLIENT" || req.user.role === "SUPPLIER";
    if (isClient) {
      if (req.user.linked_client_id !== quote.client_id) return res.status(403).json({ error: "Acceso denegado." });
      if (quote.status !== "APPROVED") return res.status(404).json({ error: "Cotización no encontrada." });
      return res.json(sanitizeForClient(quote));
    }

    const audit = db.prepare(
      "SELECT * FROM commercial_quote_audit WHERE quote_id = ? ORDER BY ts DESC LIMIT 50"
    ).all(quote.id);
    return res.json({ ...quote, audit });
  } catch (e) {
    console.error("[GET /commercial/quotes/:id]", e.message);
    return res.status(500).json({ error: "Error recuperando cotización." });
  }
});

// POST /commercial/quotes  — create draft (level >= 40, NOT CLIENT/SUPPLIER)
router.post("/quotes", requireLevel(40), (req, res) => {
  if (req.user.role === "CLIENT" || req.user.role === "SUPPLIER") {
    return res.status(403).json({ error: "Clientes externos no pueden crear cotizaciones." });
  }
  try {
    const {
      product_id, product_code, quantity, unit = "kg",
      origin_country, destination_country, incoterm = "CIF", currency = "USD",
      client_id, payment_conditions, validity_days = 15, internal_notes,
    } = req.body;

    if (!origin_country || !destination_country || quantity == null) {
      return res.status(400).json({ error: "origin_country, destination_country y quantity son obligatorios." });
    }
    if (typeof quantity !== "number" || quantity <= 0) {
      return res.status(400).json({ error: "quantity debe ser un número positivo." });
    }
    if (!VALID_INCOTERMS.includes(incoterm)) {
      return res.status(400).json({ error: `Incoterm inválido. Válidos: ${VALID_INCOTERMS.join(", ")}` });
    }

    let product_name_es = null;
    if (product_id) {
      const prod = db.prepare("SELECT name_es FROM pc_products WHERE id = ?").get(product_id);
      product_name_es = prod ? prod.name_es : null;
    }

    const quote_number = nextQuoteNumber();
    const valid_until = new Date(Date.now() + (validity_days || 15) * 86400000).toISOString().slice(0, 10);

    const result = db.prepare(`
      INSERT INTO commercial_quotes
        (quote_number, status, product_id, product_code, product_name_es, quantity, unit,
         origin_country, destination_country, incoterm, currency, client_id,
         payment_conditions, validity_days, valid_until, internal_notes, created_by)
      VALUES (?, 'DRAFT', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      quote_number,
      product_id || null, product_code || null, product_name_es,
      quantity, unit, origin_country, destination_country, incoterm, currency,
      client_id || null, payment_conditions || null, validity_days || 15, valid_until,
      internal_notes || null, req.user.username
    );

    const quote = db.prepare("SELECT * FROM commercial_quotes WHERE id = ?").get(result.lastInsertRowid);
    quoteAudit(quote.id, "QUOTE_CREATED", req.user.username, req.user.role,
      null, { quote_number, status: "DRAFT", quantity, origin_country, destination_country }, "OK");

    return res.status(201).json(quote);
  } catch (e) {
    console.error("[POST /commercial/quotes]", e.message);
    return res.status(500).json({ error: "Error creando cotización." });
  }
});

// POST /commercial/quotes/:id/calculate
// CRITICAL: Backend recalculates ALL price fields from authorized matrix.
// Browser-submitted price values are COMPLETELY IGNORED.
router.post("/quotes/:id/calculate", requireLevel(40), (req, res) => {
  if (req.user.role === "CLIENT" || req.user.role === "SUPPLIER") {
    return res.status(403).json({ error: "Clientes externos no pueden calcular cotizaciones." });
  }
  try {
    const quote = db.prepare("SELECT * FROM commercial_quotes WHERE id = ?").get(req.params.id);
    if (!quote) return res.status(404).json({ error: "Cotización no encontrada." });
    if (quote.price_locked) return res.status(409).json({ error: "Cotización aprobada — precio bloqueado." });
    if (!["DRAFT","REJECTED"].includes(quote.status)) {
      return res.status(409).json({ error: "Solo cotizaciones en DRAFT o REJECTED pueden recalcularse." });
    }

    // Find active matrix entry — most specific first, then fall back to route-only
    let matrix = null;
    const routeParams = [quote.origin_country, quote.destination_country, quote.incoterm];

    if (quote.product_id) {
      matrix = db.prepare(`
        SELECT * FROM commercial_price_matrix
        WHERE status = 'ACTIVE'
          AND origin_country = ? AND destination_country = ? AND incoterm = ?
          AND product_id = ?
          AND valid_from <= date('now')
          AND (valid_until IS NULL OR valid_until >= date('now'))
        ORDER BY id DESC LIMIT 1
      `).get(...routeParams, quote.product_id);
    }

    if (!matrix && quote.product_code) {
      matrix = db.prepare(`
        SELECT * FROM commercial_price_matrix
        WHERE status = 'ACTIVE'
          AND origin_country = ? AND destination_country = ? AND incoterm = ?
          AND product_code = ?
          AND valid_from <= date('now')
          AND (valid_until IS NULL OR valid_until >= date('now'))
        ORDER BY id DESC LIMIT 1
      `).get(...routeParams, quote.product_code);
    }

    // Route-level fallback (no product restriction)
    if (!matrix) {
      matrix = db.prepare(`
        SELECT * FROM commercial_price_matrix
        WHERE status = 'ACTIVE'
          AND origin_country = ? AND destination_country = ? AND incoterm = ?
          AND product_id IS NULL AND product_code IS NULL
          AND valid_from <= date('now')
          AND (valid_until IS NULL OR valid_until >= date('now'))
        ORDER BY id DESC LIMIT 1
      `).get(...routeParams);
    }

    if (!matrix) {
      quoteAudit(quote.id, "CALCULATION_FAILED", req.user.username, req.user.role,
        { status: quote.status }, null, "BLOCKED", "No active price matrix entry found for route/product");
      return res.status(422).json({
        error: "No existe entrada activa en la matriz de precios para este producto y ruta.",
        blocked: true,
      });
    }

    // Find applicable commercial rule (product-specific first, then route-level)
    const rule = db.prepare(`
      SELECT * FROM commercial_rules
      WHERE status = 'ACTIVE'
        AND (product_id = ? OR product_id IS NULL)
        AND (origin_country = ? OR origin_country IS NULL)
        AND (destination_country = ? OR destination_country IS NULL)
        AND (incoterm = ? OR incoterm IS NULL)
        AND valid_from <= date('now')
        AND (valid_until IS NULL OR valid_until >= date('now'))
      ORDER BY product_id DESC, id DESC LIMIT 1
    `).get(
      quote.product_id || null,
      quote.origin_country, quote.destination_country, quote.incoterm
    );

    // All price values come exclusively from the authorized matrix
    const base_cost          = matrix.base_cost;
    const freight_cost       = matrix.freight_cost;
    const insurance_cost     = matrix.insurance_cost;
    const operational_cost   = matrix.operational_cost;
    const total_cost_per_unit = base_cost + freight_cost + insurance_cost + operational_cost;
    const target_margin      = matrix.target_margin;
    const price_per_unit     = matrix.sale_price;
    const min_authorized_price = matrix.min_authorized_price;
    const total_value        = parseFloat((price_per_unit * quote.quantity).toFixed(4));

    // Check effective floor from rule
    const ruleFloor    = rule ? (rule.min_price_floor || 0) : 0;
    const effectiveMin = Math.max(min_authorized_price, ruleFloor);

    if (price_per_unit < effectiveMin) {
      try {
        db.prepare(`
          INSERT INTO tasks (title, description, priority, status)
          VALUES (?, ?, 'high', 'pending')
        `).run(
          `PRECIO INFERIOR AL MÍNIMO — ${quote.quote_number}`,
          `Cotización ${quote.quote_number}: precio calculado (${price_per_unit}) es inferior al mínimo autorizado (${effectiveMin}). Requiere revisión del COMMERCIAL_DIRECTOR.`
        );
      } catch (_) {}

      quoteAudit(quote.id, "PRICE_BELOW_MINIMUM", req.user.username, req.user.role,
        { price_per_unit: quote.price_per_unit }, { price_per_unit, effectiveMin }, "BLOCKED",
        `Precio ${price_per_unit} < mínimo ${effectiveMin}`);

      return res.status(422).json({
        error: "Precio calculado inferior al mínimo autorizado. Se creó tarea interna para revisión.",
        price_per_unit, min_authorized_price: effectiveMin, blocked: true,
      });
    }

    const now = new Date().toISOString();
    db.prepare(`
      UPDATE commercial_quotes SET
        base_cost = ?, freight_cost = ?, insurance_cost = ?, operational_cost = ?,
        total_cost_per_unit = ?, target_margin = ?, price_per_unit = ?,
        total_value = ?, min_authorized_price = ?,
        matrix_id = ?, rule_id = ?,
        calculated_by = ?, calculated_at = ?,
        status = 'DRAFT', updated_at = datetime('now')
      WHERE id = ?
    `).run(
      base_cost, freight_cost, insurance_cost, operational_cost,
      total_cost_per_unit, target_margin, price_per_unit,
      total_value, min_authorized_price,
      matrix.id, rule ? rule.id : null,
      req.user.username, now,
      quote.id
    );

    const updated = db.prepare("SELECT * FROM commercial_quotes WHERE id = ?").get(quote.id);
    quoteAudit(quote.id, "CALCULATED", req.user.username, req.user.role,
      { price_per_unit: quote.price_per_unit, status: quote.status },
      { price_per_unit, total_value, matrix_id: matrix.id, rule_id: rule ? rule.id : null },
      "OK");

    return res.json(updated);
  } catch (e) {
    console.error("[POST /commercial/quotes/:id/calculate]", e.message);
    return res.status(500).json({ error: "Error calculando cotización." });
  }
});

// POST /commercial/quotes/:id/submit  (level >= 40, NOT CLIENT/SUPPLIER)
router.post("/quotes/:id/submit", requireLevel(40), (req, res) => {
  if (req.user.role === "CLIENT" || req.user.role === "SUPPLIER") {
    return res.status(403).json({ error: "Acceso denegado." });
  }
  try {
    const quote = db.prepare("SELECT * FROM commercial_quotes WHERE id = ?").get(req.params.id);
    if (!quote) return res.status(404).json({ error: "Cotización no encontrada." });
    if (quote.status !== "DRAFT") return res.status(409).json({ error: "Solo DRAFT puede enviarse a aprobación." });
    if (!quote.price_per_unit) return res.status(422).json({ error: "Calcule la cotización antes de enviarla." });

    const now = new Date().toISOString();
    db.prepare(`
      UPDATE commercial_quotes SET
        status = 'PENDING_APPROVAL', submitted_by = ?, submitted_at = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(req.user.username, now, quote.id);

    const updated = db.prepare("SELECT * FROM commercial_quotes WHERE id = ?").get(quote.id);
    quoteAudit(quote.id, "SUBMITTED", req.user.username, req.user.role,
      { status: "DRAFT" }, { status: "PENDING_APPROVAL", submitted_by: req.user.username }, "OK");

    try {
      const approver = db.prepare(
        "SELECT id FROM users WHERE role IN ('COMMERCIAL_DIRECTOR','DIRECTOR','SUPER_ADMIN') AND active = 1 ORDER BY id LIMIT 1"
      ).get();
      db.prepare(`
        INSERT INTO tasks (title, description, priority, assigned_to, created_by, status)
        VALUES (?, ?, 'high', ?, NULL, 'pending')
      `).run(
        `COTIZACIÓN PENDIENTE APROBACIÓN — ${quote.quote_number}`,
        `Cotización ${quote.quote_number} requiere aprobación comercial. Precio calculado por backend: ${quote.price_per_unit} ${quote.currency}/${quote.unit}.`,
        approver ? approver.id : null
      );
    } catch (_) {}

    return res.json(updated);
  } catch (e) {
    console.error("[POST /commercial/quotes/:id/submit]", e.message);
    return res.status(500).json({ error: "Error enviando cotización a aprobación." });
  }
});

// POST /commercial/quotes/:id/approve  (level >= 70)
router.post("/quotes/:id/approve", requireLevel(70), (req, res) => {
  try {
    const quote = db.prepare("SELECT * FROM commercial_quotes WHERE id = ?").get(req.params.id);
    if (!quote) return res.status(404).json({ error: "Cotización no encontrada." });
    if (quote.status !== "PENDING_APPROVAL") {
      return res.status(409).json({ error: "Solo cotizaciones PENDING_APPROVAL pueden aprobarse." });
    }
    if (!quote.price_per_unit) {
      return res.status(422).json({ error: "Cotización sin precio calculado — recalcule antes de aprobar." });
    }
    if (quote.price_per_unit < quote.min_authorized_price) {
      quoteAudit(quote.id, "APPROVAL_BLOCKED", req.user.username, req.user.role,
        { price_per_unit: quote.price_per_unit }, null, "BLOCKED",
        `Precio ${quote.price_per_unit} < mínimo ${quote.min_authorized_price}`);
      return res.status(422).json({
        error: "Precio inferior al mínimo autorizado. No se puede aprobar.",
        blocked: true,
      });
    }

    const now = new Date().toISOString();
    db.prepare(`
      UPDATE commercial_quotes SET
        status = 'APPROVED', approved_by = ?, approved_at = ?,
        price_locked = 1, updated_at = datetime('now')
      WHERE id = ?
    `).run(req.user.username, now, quote.id);

    const updated = db.prepare("SELECT * FROM commercial_quotes WHERE id = ?").get(quote.id);
    quoteAudit(quote.id, "APPROVED", req.user.username, req.user.role,
      { status: "PENDING_APPROVAL" },
      { status: "APPROVED", approved_by: req.user.username, price_locked: 1 },
      "OK");

    db.prepare(
      "INSERT INTO audit_log (username, action, doc_id, ip) VALUES (?, 'COMMERCIAL_QUOTE_APPROVED', ?, ?)"
    ).run(req.user.username, quote.quote_number, req.ip || "");

    return res.json(updated);
  } catch (e) {
    console.error("[POST /commercial/quotes/:id/approve]", e.message);
    return res.status(500).json({ error: "Error aprobando cotización." });
  }
});

// POST /commercial/quotes/:id/reject  (level >= 70)
router.post("/quotes/:id/reject", requireLevel(70), (req, res) => {
  try {
    const quote = db.prepare("SELECT * FROM commercial_quotes WHERE id = ?").get(req.params.id);
    if (!quote) return res.status(404).json({ error: "Cotización no encontrada." });
    if (!["PENDING_APPROVAL","DRAFT"].includes(quote.status)) {
      return res.status(409).json({ error: "Cotización no puede rechazarse en su estado actual." });
    }
    const { reason } = req.body;

    const now = new Date().toISOString();
    db.prepare(`
      UPDATE commercial_quotes SET
        status = 'REJECTED', rejected_by = ?, rejected_at = ?,
        rejection_reason = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(req.user.username, now, reason || null, quote.id);

    const updated = db.prepare("SELECT * FROM commercial_quotes WHERE id = ?").get(quote.id);
    quoteAudit(quote.id, "REJECTED", req.user.username, req.user.role,
      { status: quote.status }, { status: "REJECTED", rejection_reason: reason }, "OK");

    db.prepare(
      "INSERT INTO audit_log (username, action, doc_id, ip) VALUES (?, 'COMMERCIAL_QUOTE_REJECTED', ?, ?)"
    ).run(req.user.username, quote.quote_number, req.ip || "");

    return res.json(updated);
  } catch (e) {
    console.error("[POST /commercial/quotes/:id/reject]", e.message);
    return res.status(500).json({ error: "Error rechazando cotización." });
  }
});

// POST /commercial/quotes/:id/link-document  (level >= 40, NOT CLIENT/SUPPLIER)
router.post("/quotes/:id/link-document", requireLevel(40), (req, res) => {
  if (req.user.role === "CLIENT" || req.user.role === "SUPPLIER") {
    return res.status(403).json({ error: "Acceso denegado." });
  }
  try {
    const quote = db.prepare("SELECT * FROM commercial_quotes WHERE id = ?").get(req.params.id);
    if (!quote) return res.status(404).json({ error: "Cotización no encontrada." });
    if (quote.status !== "APPROVED") {
      return res.status(409).json({ error: "Solo cotizaciones APPROVED pueden vincularse a documentos." });
    }

    const { doc_id } = req.body;
    if (!doc_id) return res.status(400).json({ error: "doc_id es obligatorio." });

    const doc = db.prepare("SELECT id, type FROM documents WHERE id = ?").get(doc_id);
    if (!doc) return res.status(404).json({ error: "Documento no encontrado." });
    if (!["SCO","FCO","SPA"].includes(doc.type)) {
      return res.status(400).json({ error: "Solo SCO, FCO y SPA pueden vincularse a cotizaciones." });
    }

    db.prepare("UPDATE commercial_quotes SET doc_id = ?, updated_at = datetime('now') WHERE id = ?")
      .run(doc_id, quote.id);
    db.prepare("UPDATE documents SET quote_id = ? WHERE id = ?").run(quote.id, doc_id);

    const updated = db.prepare("SELECT * FROM commercial_quotes WHERE id = ?").get(quote.id);
    quoteAudit(quote.id, "DOCUMENT_LINKED", req.user.username, req.user.role,
      { doc_id: quote.doc_id }, { doc_id, doc_type: doc.type }, "OK");

    return res.json(updated);
  } catch (e) {
    console.error("[POST /commercial/quotes/:id/link-document]", e.message);
    return res.status(500).json({ error: "Error vinculando cotización a documento." });
  }
});

module.exports = router;
