const express = require("express");
const db = require("../db/database");
const { authenticate } = require("../middleware/auth");
const { requireLevel } = require("../middleware/rbac");

const router = express.Router();
router.use(authenticate);

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

    const totalDocs = docs.reduce((s, d) => s + (d.total_value || 0), 0);
    const totalOps  = ops.reduce((s, o) => s + (o.contract_value || 0), 0);

    const byType = {};
    docs.forEach(d => {
      if (!byType[d.type]) byType[d.type] = { count: 0, value: 0 };
      byType[d.type].count++;
      byType[d.type].value += d.total_value || 0;
    });

    const byStatus = {};
    ops.forEach(o => {
      if (!byStatus[o.status]) byStatus[o.status] = { count: 0, value: 0 };
      byStatus[o.status].count++;
      byStatus[o.status].value += o.contract_value || 0;
    });

    const recent = db.prepare(`
      SELECT id, type, status, total_value, client, agent, created_at
      FROM documents ORDER BY created_at DESC LIMIT 10
    `).all();

    res.json({ totalDocValue: totalDocs, totalOpValue: totalOps, byType, byStatus, recent });
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
