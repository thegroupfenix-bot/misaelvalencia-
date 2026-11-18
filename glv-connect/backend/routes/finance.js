const express = require("express");
const db = require("../db/database");
const { authenticate } = require("../middleware/auth");
const { requireLevel, ROLE_LEVEL } = require("../middleware/rbac");

const router = express.Router();
router.use(authenticate);

function totalsByCurrency(rows, field) {
  return rows.reduce((totals, row) => {
    const currency = row.currency || "USD";
    totals[currency] = (totals[currency] || 0) + (Number(row[field]) || 0);
    return totals;
  }, {});
}

const DOCUMENT_TYPES = new Set(["PROFORMA", "COMMERCIAL_INVOICE"]);
const INCOTERMS = new Set(["EXW", "FCA", "FAS", "FOB", "CFR", "CIF", "CPT", "CIP", "DAP", "DPU", "DDP"]);

function financeManager(user) {
  return (ROLE_LEVEL[user?.role] || 0) >= 60;
}

function canReadDocument(user, document) {
  return financeManager(user) || Number(document.created_by) === Number(user.id);
}

function rowWithLines(document) {
  if (!document) return null;
  const lines = db.prepare(`
    SELECT line_no, description, quantity, unit, unit_price_minor, line_total_minor,
           hs_code, country_of_origin, packages, gross_weight_kg, net_weight_kg
    FROM commercial_document_lines WHERE commercial_document_id = ? ORDER BY line_no
  `).all(document.id);
  return { ...document, fiscal_notice: "Documento comercial no fiscal. No reemplaza una factura electrónica ni tributaria.", lines };
}

function nextDocumentNumber(type) {
  const sequence = db.prepare(
    "UPDATE doc_id_sequences SET last_seq = last_seq + 1 WHERE type = ? RETURNING last_seq"
  ).get(type);
  if (!sequence) throw new Error(`Secuencia no disponible para ${type}`);
  const prefix = type === "PROFORMA" ? "GOS-PI" : "GOS-CI";
  return `${prefix}-${new Date().getUTCFullYear()}-${String(sequence.last_seq).padStart(6, "0")}`;
}

function validateLines(lines) {
  if (!Array.isArray(lines) || !lines.length) throw new Error("Se requiere al menos una línea comercial.");
  return lines.map((line, index) => {
    if (!line || typeof line.description !== "string" || !line.description.trim()) {
      throw new Error(`La línea ${index + 1} requiere descripción.`);
    }
    if (typeof line.quantity !== "string" && typeof line.quantity !== "number") {
      throw new Error(`La línea ${index + 1} requiere cantidad.`);
    }
    if (!line.unit || !Number.isSafeInteger(line.unit_price_minor) || line.unit_price_minor < 0) {
      throw new Error(`La línea ${index + 1} requiere unidad y precio entero en unidades menores.`);
    }
    if (!Number.isSafeInteger(line.line_total_minor) || line.line_total_minor < 0) {
      throw new Error(`La línea ${index + 1} requiere total entero en unidades menores.`);
    }
    return { ...line, quantity: String(line.quantity) };
  });
}

// ─── GET /finance/summary — dashboard financiero ──────────────────────────────
router.get("/summary", requireLevel(50), (req, res) => {
  try {
    const docs = db.prepare(`
      SELECT type, status, total_value, currency, created_at, client, destination, agent
      FROM documents WHERE total_value IS NOT NULL
    `).all();

    const ops = db.prepare(`
      SELECT status, contract_value, currency, created_at, destination_country
      FROM operations WHERE contract_value IS NOT NULL
    `).all();

    const docTotalsByCurrency = totalsByCurrency(docs, "total_value");
    const opTotalsByCurrency  = totalsByCurrency(ops, "contract_value");

    const byType = {};
    docs.forEach(d => {
      if (!byType[d.type]) byType[d.type] = { count: 0, byCurrency: {} };
      byType[d.type].count++;
      const currency = d.currency || "USD";
      byType[d.type].byCurrency[currency] = (byType[d.type].byCurrency[currency] || 0) + (Number(d.total_value) || 0);
    });

    const byStatus = {};
    ops.forEach(o => {
      if (!byStatus[o.status]) byStatus[o.status] = { count: 0, byCurrency: {} };
      byStatus[o.status].count++;
      const currency = o.currency || "USD";
      byStatus[o.status].byCurrency[currency] = (byStatus[o.status].byCurrency[currency] || 0) + (Number(o.contract_value) || 0);
    });

    const recent = db.prepare(`
      SELECT id, type, status, total_value, client, agent, created_at
      FROM documents ORDER BY created_at DESC LIMIT 10
    `).all();

    res.json({ docTotalsByCurrency, opTotalsByCurrency, byType, byStatus, recent });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// ─── GET /finance/invoices — tabla de facturas/valores por operación ──────────
router.get("/invoices", requireLevel(50), (req, res) => {
  try {
    const rows = db.prepare(`
      SELECT o.id AS operation_id, o.status, o.contract_value, o.currency,
             o.destination_country, o.created_at,
             u.name AS agent_name,
             c.name AS client_name
      FROM operations o
      LEFT JOIN users u ON u.id = o.assigned_agent
      LEFT JOIN clients c ON c.id = o.client_id
      ORDER BY o.created_at DESC
    `).all();
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── Legal entities for commercial documents. These are not tax registrations.
router.get("/legal-entities", requireLevel(42), (_req, res) => {
  try {
    res.json(db.prepare(`SELECT id, legal_name, country_code, tax_id, address, active FROM legal_entities WHERE active=1 ORDER BY legal_name`).all());
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/legal-entities", requireLevel(70), (req, res) => {
  const { legal_name, country_code, tax_id = null, address = null } = req.body || {};
  if (!legal_name || !/^[A-Za-z]{2}$/.test(String(country_code || ""))) {
    return res.status(400).json({ error: "legal_name y country_code ISO de dos letras son obligatorios." });
  }
  try {
    const result = db.prepare(`INSERT INTO legal_entities (legal_name, country_code, tax_id, address, created_by) VALUES (?, ?, ?, ?, ?)`)
      .run(legal_name.trim(), country_code.toUpperCase(), tax_id || null, address || null, req.user.id);
    const entity = db.prepare("SELECT * FROM legal_entities WHERE id=?").get(result.lastInsertRowid);
    db.prepare("INSERT INTO audit_log (username, action, doc_id, ip) VALUES (?, 'LEGAL_ENTITY_CREATED', ?, ?)")
      .run(req.user.username, String(entity.id), req.ip || "");
    res.status(201).json(entity);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// ─── Commercial documents. Values are stored as integer minor units, never REAL.
router.get("/commercial-documents", requireLevel(42), (req, res) => {
  try {
    const where = financeManager(req.user) ? "" : "WHERE d.created_by = ?";
    const docs = db.prepare(`
      SELECT d.*, e.legal_name, e.country_code AS legal_entity_country, c.name AS client_name
      FROM commercial_documents d
      JOIN legal_entities e ON e.id=d.legal_entity_id
      JOIN clients c ON c.id=d.client_id
      ${where} ORDER BY d.created_at DESC
    `).all(...(financeManager(req.user) ? [] : [req.user.id]));
    res.json(docs.map(rowWithLines));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get("/commercial-documents/:id", requireLevel(42), (req, res) => {
  try {
    const document = db.prepare(`
      SELECT d.*, e.legal_name, e.country_code AS legal_entity_country, c.name AS client_name
      FROM commercial_documents d JOIN legal_entities e ON e.id=d.legal_entity_id
      JOIN clients c ON c.id=d.client_id WHERE d.id=?
    `).get(req.params.id);
    if (!document) return res.status(404).json({ error: "Documento comercial no encontrado." });
    if (!canReadDocument(req.user, document)) return res.status(403).json({ error: "Acceso denegado." });
    return res.json(rowWithLines(document));
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

router.post("/commercial-documents", requireLevel(42), (req, res) => {
  try {
    const body = req.body || {};
    const type = String(body.document_type || "").toUpperCase();
    const language = String(body.language || "es").toLowerCase();
    const currency = String(body.currency_code || "").toUpperCase();
    if (!DOCUMENT_TYPES.has(type)) return res.status(400).json({ error: "document_type debe ser PROFORMA o COMMERCIAL_INVOICE." });
    if (!["es", "en"].includes(language)) return res.status(400).json({ error: "language debe ser es o en." });
    if (!/^[A-Z]{3}$/.test(currency)) return res.status(400).json({ error: "currency_code debe ser ISO 4217 de tres letras." });
    if (!Number.isInteger(body.legal_entity_id) || !Number.isInteger(body.client_id)) {
      return res.status(400).json({ error: "legal_entity_id y client_id son obligatorios." });
    }
    if (body.incoterm && !INCOTERMS.has(String(body.incoterm).toUpperCase())) {
      return res.status(400).json({ error: "Incoterm inválido." });
    }
    const entity = db.prepare("SELECT id FROM legal_entities WHERE id=? AND active=1").get(body.legal_entity_id);
    const client = db.prepare("SELECT id FROM clients WHERE id=? AND active=1").get(body.client_id);
    if (!entity || !client) return res.status(400).json({ error: "Entidad legal o cliente activo no encontrado." });
    if (body.operation_id) {
      const operation = db.prepare("SELECT id, client_id FROM operations WHERE id=?").get(body.operation_id);
      if (!operation || Number(operation.client_id) !== Number(body.client_id)) {
        return res.status(400).json({ error: "La operación debe existir y pertenecer al cliente seleccionado." });
      }
    }
    const lines = validateLines(body.lines);
    const freight = Number.isSafeInteger(body.freight_minor) && body.freight_minor >= 0 ? body.freight_minor : 0;
    const insurance = Number.isSafeInteger(body.insurance_minor) && body.insurance_minor >= 0 ? body.insurance_minor : 0;
    const subtotal = lines.reduce((sum, line) => sum + line.line_total_minor, 0);
    if (!Number.isSafeInteger(subtotal + freight + insurance)) throw new Error("Total fuera del rango seguro.");
    const create = db.transaction(() => {
      const documentNumber = nextDocumentNumber(type);
      const result = db.prepare(`
        INSERT INTO commercial_documents
        (document_number, document_type, legal_entity_id, client_id, operation_id, language, currency_code,
         incoterm, origin_country, destination_country, payment_terms, issue_date, due_date,
         subtotal_minor, freight_minor, insurance_minor, total_minor, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(documentNumber, type, body.legal_entity_id, body.client_id, body.operation_id || null, language, currency,
        body.incoterm ? String(body.incoterm).toUpperCase() : null, body.origin_country || null,
        body.destination_country || null, body.payment_terms || null, body.issue_date || new Date().toISOString().slice(0, 10),
        body.due_date || null, subtotal, freight, insurance, subtotal + freight + insurance, req.user.id);
      const insertLine = db.prepare(`
        INSERT INTO commercial_document_lines
        (commercial_document_id, line_no, description, quantity, unit, unit_price_minor, line_total_minor,
         hs_code, country_of_origin, packages, gross_weight_kg, net_weight_kg)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      lines.forEach((line, index) => insertLine.run(result.lastInsertRowid, index + 1, line.description.trim(), line.quantity,
        line.unit, line.unit_price_minor, line.line_total_minor, line.hs_code || null, line.country_of_origin || null,
        Number.isInteger(line.packages) ? line.packages : null, line.gross_weight_kg == null ? null : String(line.gross_weight_kg),
        line.net_weight_kg == null ? null : String(line.net_weight_kg)));
      db.prepare("INSERT INTO audit_log (username, action, doc_id, ip) VALUES (?, 'COMMERCIAL_DOCUMENT_CREATED_NON_FISCAL', ?, ?)")
        .run(req.user.username, documentNumber, req.ip || "");
      return result.lastInsertRowid;
    });
    const id = create();
    const document = db.prepare("SELECT * FROM commercial_documents WHERE id=?").get(id);
    return res.status(201).json(rowWithLines(document));
  } catch (e) {
    return res.status(400).json({ error: e.message });
  }
});

// Issuing locks commercial content. A fiscal adapter is deliberately out of scope.
router.post("/commercial-documents/:id/issue", requireLevel(60), (req, res) => {
  try {
    const issue = db.transaction(() => {
      const document = db.prepare("SELECT * FROM commercial_documents WHERE id=?").get(req.params.id);
      if (!document) throw new Error("Documento comercial no encontrado.");
      if (document.lifecycle_status !== "DRAFT") throw new Error("Solo un borrador puede emitirse.");
      const lineCount = db.prepare("SELECT COUNT(*) AS count FROM commercial_document_lines WHERE commercial_document_id=?").get(document.id).count;
      if (!lineCount) throw new Error("El documento requiere líneas antes de emitirse.");
      db.prepare(`UPDATE commercial_documents SET lifecycle_status='ISSUED', issued_by=?, issued_at=datetime('now'), updated_at=datetime('now') WHERE id=?`)
        .run(req.user.id, document.id);
      db.prepare("INSERT INTO audit_log (username, action, doc_id, ip) VALUES (?, 'COMMERCIAL_DOCUMENT_ISSUED_NON_FISCAL', ?, ?)")
        .run(req.user.username, document.document_number, req.ip || "");
      return document.id;
    });
    const id = issue();
    return res.json(rowWithLines(db.prepare("SELECT * FROM commercial_documents WHERE id=?").get(id)));
  } catch (e) {
    return res.status(400).json({ error: e.message });
  }
});

router.post("/commercial-documents/:id/cancel", requireLevel(60), (req, res) => {
  const reason = String(req.body?.reason || "").trim();
  if (!reason) return res.status(400).json({ error: "reason es obligatorio para cancelar." });
  try {
    const document = db.prepare("SELECT * FROM commercial_documents WHERE id=?").get(req.params.id);
    if (!document) return res.status(404).json({ error: "Documento comercial no encontrado." });
    if (document.lifecycle_status === "CANCELLED") return res.status(409).json({ error: "Documento ya cancelado." });
    db.prepare(`UPDATE commercial_documents SET lifecycle_status='CANCELLED', cancelled_by=?, cancelled_at=datetime('now'), cancel_reason=?, updated_at=datetime('now') WHERE id=?`)
      .run(req.user.id, reason, document.id);
    db.prepare("INSERT INTO audit_log (username, action, doc_id, ip) VALUES (?, 'COMMERCIAL_DOCUMENT_CANCELLED_NON_FISCAL', ?, ?)")
      .run(req.user.username, document.document_number, req.ip || "");
    return res.json(rowWithLines(db.prepare("SELECT * FROM commercial_documents WHERE id=?").get(document.id)));
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

// ─── GET /finance/by-country — agrupado por país destino ─────────────────────
router.get("/by-country", requireLevel(50), (req, res) => {
  try {
    const rows = db.prepare(`
      SELECT destination_country AS country,
             COUNT(*) AS operations,
             SUM(contract_value) AS total_value,
             currency
      FROM operations
      WHERE contract_value IS NOT NULL
      GROUP BY destination_country, currency
      ORDER BY total_value DESC
    `).all();
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
