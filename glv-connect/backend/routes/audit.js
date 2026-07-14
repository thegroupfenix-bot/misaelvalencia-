"use strict";
const express = require("express");
const db = require("../db/database");
const { authenticate } = require("../middleware/auth");
const { requireLevel, ROLE_LEVEL } = require("../middleware/rbac");

const router = express.Router();
// Minimum level: AUDIT (55). Covers AUDIT, COMPLIANCE, ACCOUNTING, TREASURY, CFO, directors, admins.
router.use(authenticate, requireLevel(55));

const MAX_LIMIT = 500;

router.get("/", (req, res) => {
  try {
    const rawLimit  = parseInt(req.query.limit,  10);
    const rawOffset = parseInt(req.query.offset, 10);
    const limit  = (!rawLimit  || rawLimit  < 1) ? 100 : Math.min(rawLimit,  MAX_LIMIT);
    const offset = (!rawOffset || rawOffset < 0) ? 0   : rawOffset;

    const conditions = [];
    const params     = [];

    // Optional filters — only COMPLIANCE+ (65) may filter by user/action to prevent
    // lower-level auditors from fishing through other users' activity.
    if ((ROLE_LEVEL[req.user.role] || 0) >= 65) {
      if (req.query.username) { conditions.push("username = ?");       params.push(req.query.username); }
      if (req.query.action)   { conditions.push("action LIKE ?");      params.push(`%${req.query.action}%`); }
      if (req.query.doc_id)   { conditions.push("doc_id = ?");         params.push(req.query.doc_id); }
      if (req.query.from)     { conditions.push("ts >= ?");            params.push(req.query.from); }
      if (req.query.to)       { conditions.push("ts <= ?");            params.push(req.query.to); }
    }

    const where = conditions.length ? "WHERE " + conditions.join(" AND ") : "";
    const rows  = db.prepare(
      `SELECT * FROM audit_log ${where} ORDER BY ts DESC LIMIT ? OFFSET ?`
    ).all(...params, limit, offset);

    const total = db.prepare(
      `SELECT COUNT(*) AS c FROM audit_log ${where}`
    ).get(...params).c;

    res.json({ rows, total, limit, offset });
  } catch (e) {
    console.error("[audit] error:", e.message);
    res.status(500).json({ error: "Error interno" });
  }
});

module.exports = router;
