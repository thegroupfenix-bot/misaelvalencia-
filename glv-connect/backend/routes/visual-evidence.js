"use strict";
const express = require("express");
const router  = express.Router();
const db      = require("../db/database");
const { authenticate }         = require("../middleware/auth");
const { requireLevel, ROLE_LEVEL: _RL } = require("../middleware/rbac");

router.use(authenticate);

const ROLE_LEVEL = {
  SUPER_ADMIN:100,CORPORATE_ADMIN:90,CFO:80,DIRECTOR:75,DIRECTIVO:75,
  COMMERCIAL_MANAGER:72,COMMERCIAL_DIRECTOR:70,COMPLIANCE:65,ACCOUNTING:60,
  TREASURY:60,AUDIT:55,TAX_REVIEWER:50,COUNTRY_ACCOUNTANT:50,LOGISTICS:45,
  COMMERCIAL_AGENT:42,AGENTE:40,MEDIA_MANAGER:35,CLIENT:20,SUPPLIER:20
};
const rl = (role) => ROLE_LEVEL[role] || 0;

function nextEvdNumber() {
  const year = new Date().getFullYear();
  const last = db.prepare(
    `SELECT evidence_number FROM visual_evidence WHERE evidence_number LIKE 'EVD-${year}-%' ORDER BY id DESC LIMIT 1`
  ).get();
  if (!last) return `EVD-${year}-0001`;
  const seq = parseInt(last.evidence_number.split("-")[2]) + 1;
  return `EVD-${year}-${String(seq).padStart(4, "0")}`;
}

function nextCntNumber() {
  const year = new Date().getFullYear();
  const last = db.prepare(
    `SELECT event_number FROM count_events WHERE event_number LIKE 'CNT-${year}-%' ORDER BY id DESC LIMIT 1`
  ).get();
  if (!last) return `CNT-${year}-0001`;
  const seq = parseInt(last.event_number.split("-")[2]) + 1;
  return `CNT-${year}-${String(seq).padStart(4, "0")}`;
}

function handleDiscrepancy(countEventId, operationId, difference, responsibleUsername, actorUsername) {
  if (!difference || Math.abs(difference) === 0) return;
  const severity = Math.abs(difference) >= 10 ? "HIGH" : Math.abs(difference) >= 3 ? "MEDIUM" : "LOW";
  db.prepare(
    `INSERT INTO count_discrepancies (count_event_id,operation_id,difference,severity) VALUES (?,?,?,?)`
  ).run(countEventId, operationId || null, difference, severity);

  if (operationId) {
    try {
      const lop = db.prepare(`SELECT id FROM logistics_ops WHERE operation_number=?`).get(operationId);
      if (lop) {
        db.prepare(
          `INSERT INTO logistics_incidents (op_id,type,severity,description,reported_by) VALUES (?,?,?,?,?)`
        ).run(lop.id, "OTHER", severity, `Discrepancia en conteo visual CNT-${countEventId}: diferencia=${difference}`, actorUsername);
      }
    } catch (_) {}
  }

  try {
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 1);
    db.prepare(
      `INSERT INTO tasks (title,description,status,priority,deadline,assigned_to,created_by) VALUES (?,?,?,?,?,?,?)`
    ).run(
      `[CONTEO] Revisar discrepancia en evento de conteo`,
      `Diferencia de ${difference} unidades detectada. Requiere explicación y evidencia.`,
      "pending", "high", dueDate.toISOString().split("T")[0],
      null, null
    );
  } catch (_) {}

  db.prepare(`UPDATE count_events SET requires_review=1 WHERE id=?`).run(countEventId);
}

function veAudit(evidenceId, countEventId, action, actor, role, detail) {
  db.prepare(
    `INSERT INTO ve_audit (evidence_id,count_event_id,action,actor,role,detail) VALUES (?,?,?,?,?,?)`
  ).run(evidenceId || null, countEventId || null, action, actor, role || null, detail || null);
}

// ─── Observation Zones ────────────────────────────────────────────────────────

router.get("/zones", (req, res) => {
  const user = req.user;
  const level = rl(user.role);
  let zones;
  if (level < 40 || user.role === "CLIENT" || user.role === "SUPPLIER") {
    const { operation_id } = req.query;
    if (!operation_id) {
      zones = db.prepare(`SELECT * FROM observation_zones WHERE status='ACTIVE' ORDER BY id DESC`).all();
    } else {
      zones = db.prepare(`SELECT * FROM observation_zones WHERE operation_id=? AND status='ACTIVE' ORDER BY id DESC`).all(operation_id);
    }
  } else {
    const { operation_id, status } = req.query;
    let q = `SELECT * FROM observation_zones WHERE 1=1`;
    const params = [];
    if (operation_id) { q += ` AND operation_id=?`; params.push(operation_id); }
    if (status)       { q += ` AND status=?`;       params.push(status); }
    q += ` ORDER BY id DESC`;
    zones = db.prepare(q).all(...params);
  }
  res.json({ zones });
});

router.post("/zones", requireLevel(40), (req, res) => {
  const user = req.user;
  if (user.role === "CLIENT" || user.role === "SUPPLIER") return res.status(403).json({ error: "Forbidden" });
  const { name, description, location, operation_id, zone_type } = req.body;
  if (!name) return res.status(400).json({ error: "name required" });
  const result = db.prepare(
    `INSERT INTO observation_zones (name,description,location,operation_id,zone_type,created_by) VALUES (?,?,?,?,?,?)`
  ).run(name, description || null, location || null, operation_id || null, zone_type || "GENERAL", user.username);
  const zone = db.prepare(`SELECT * FROM observation_zones WHERE id=?`).get(result.lastInsertRowid);
  res.status(201).json({ zone });
});

router.patch("/zones/:id", requireLevel(40), (req, res) => {
  const user = req.user;
  if (user.role === "CLIENT" || user.role === "SUPPLIER") return res.status(403).json({ error: "Forbidden" });
  const zone = db.prepare(`SELECT * FROM observation_zones WHERE id=?`).get(req.params.id);
  if (!zone) return res.status(404).json({ error: "Zone not found" });
  const { name, description, location, status, zone_type } = req.body;
  db.prepare(
    `UPDATE observation_zones SET name=COALESCE(?,name), description=COALESCE(?,description), location=COALESCE(?,location), status=COALESCE(?,status), zone_type=COALESCE(?,zone_type), updated_at=datetime('now') WHERE id=?`
  ).run(name || null, description || null, location || null, status || null, zone_type || null, zone.id);
  res.json({ zone: db.prepare(`SELECT * FROM observation_zones WHERE id=?`).get(zone.id) });
});

// ─── Visual Evidence ──────────────────────────────────────────────────────────

router.get("/", (req, res) => {
  const user = req.user;
  const level = rl(user.role);
  const { operation_id, status, visibility } = req.query;

  if (user.role === "CLIENT" || user.role === "SUPPLIER") {
    const clientId = user.linked_client_id;
    if (!clientId) return res.json({ evidence: [] });
    let q = `SELECT * FROM visual_evidence WHERE client_id=? AND visibility='CLIENT_VISIBLE'`;
    const params = [clientId];
    if (operation_id) { q += ` AND operation_id=?`; params.push(operation_id); }
    if (status)       { q += ` AND status=?`;       params.push(status); }
    q += ` ORDER BY id DESC`;
    return res.json({ evidence: db.prepare(q).all(...params) });
  }

  let q = `SELECT * FROM visual_evidence WHERE 1=1`;
  const params = [];
  if (operation_id) { q += ` AND operation_id=?`; params.push(operation_id); }
  if (status)       { q += ` AND status=?`;       params.push(status); }
  if (visibility)   { q += ` AND visibility=?`;   params.push(visibility); }
  q += ` ORDER BY id DESC`;
  res.json({ evidence: db.prepare(q).all(...params) });
});

router.post("/", requireLevel(40), (req, res) => {
  const user = req.user;
  if (user.role === "CLIENT" || user.role === "SUPPLIER") return res.status(403).json({ error: "Forbidden" });
  const { zone_id, operation_id, client_id, source, visibility, description, file_url, file_type, metadata_json } = req.body;
  const evdNumber = nextEvdNumber();
  const result = db.prepare(
    `INSERT INTO visual_evidence (evidence_number,zone_id,operation_id,client_id,source,visibility,description,file_url,file_type,metadata_json,submitted_by) VALUES (?,?,?,?,?,?,?,?,?,?,?)`
  ).run(
    evdNumber, zone_id || null, operation_id || null, client_id || null,
    source || "MANUAL", visibility || "INTERNAL",
    description || null, file_url || null, file_type || null,
    metadata_json || "{}", user.username
  );
  const ev = db.prepare(`SELECT * FROM visual_evidence WHERE id=?`).get(result.lastInsertRowid);
  veAudit(ev.id, null, "CREATE", user.username, user.role, `Evidence ${evdNumber} created`);
  res.status(201).json({ evidence: ev });
});

router.patch("/:id/review", requireLevel(55), (req, res) => {
  const user  = req.user;
  const level = rl(user.role);
  const ev    = db.prepare(`SELECT * FROM visual_evidence WHERE id=?`).get(req.params.id);
  if (!ev) return res.status(404).json({ error: "Evidence not found" });

  const { status, review_notes } = req.body;
  const allowed = ["REVIEWED", "APPROVED", "REJECTED", "ARCHIVED"];
  if (!status || !allowed.includes(status)) return res.status(400).json({ error: `status must be one of: ${allowed.join(",")}` });
  if (status === "APPROVED" && level < 65) return res.status(403).json({ error: "Requires COMPLIANCE level or higher to approve" });
  if (ev.source === "AI_DETECTOR" && status === "APPROVED" && level < 65) {
    return res.status(403).json({ error: "AI evidence requires human review at COMPLIANCE level" });
  }

  db.prepare(
    `UPDATE visual_evidence SET status=?,reviewed_by=?,reviewed_at=datetime('now'),review_notes=?,updated_at=datetime('now') WHERE id=?`
  ).run(status, user.username, review_notes || null, ev.id);
  veAudit(ev.id, null, `REVIEW:${status}`, user.username, user.role, review_notes || null);
  res.json({ evidence: db.prepare(`SELECT * FROM visual_evidence WHERE id=?`).get(ev.id) });
});

// ─── Count Events ─────────────────────────────────────────────────────────────

router.get("/count-events", (req, res) => {
  const user  = req.user;
  const { operation_id, status } = req.query;

  if (user.role === "CLIENT" || user.role === "SUPPLIER") {
    const clientId = user.linked_client_id;
    if (!clientId) return res.json({ count_events: [] });
    let q = `SELECT * FROM count_events WHERE client_id=?`;
    const params = [clientId];
    if (operation_id) { q += ` AND operation_id=?`; params.push(operation_id); }
    if (status)       { q += ` AND status=?`;       params.push(status); }
    q += ` ORDER BY id DESC`;
    return res.json({ count_events: db.prepare(q).all(...params) });
  }

  let q = `SELECT * FROM count_events WHERE 1=1`;
  const params = [];
  if (operation_id) { q += ` AND operation_id=?`; params.push(operation_id); }
  if (status)       { q += ` AND status=?`;       params.push(status); }
  q += ` ORDER BY id DESC`;
  res.json({ count_events: db.prepare(q).all(...params) });
});

router.post("/count-events", requireLevel(40), (req, res) => {
  const user = req.user;
  if (user.role === "CLIENT" || user.role === "SUPPLIER") return res.status(403).json({ error: "Forbidden" });
  const { zone_id, operation_id, client_id, count_type, expected_count, actual_count, responsible_username, notes } = req.body;
  if (actual_count === undefined || actual_count === null) return res.status(400).json({ error: "actual_count required" });

  const evtNumber = nextCntNumber();
  const result = db.prepare(
    `INSERT INTO count_events (event_number,zone_id,operation_id,client_id,count_type,expected_count,actual_count,responsible_username,notes,created_by) VALUES (?,?,?,?,?,?,?,?,?,?)`
  ).run(
    evtNumber, zone_id || null, operation_id || null, client_id || null,
    count_type || "MANUAL",
    expected_count !== undefined ? expected_count : null,
    actual_count,
    responsible_username || null, notes || null, user.username
  );
  const evt = db.prepare(`SELECT * FROM count_events WHERE id=?`).get(result.lastInsertRowid);

  const diff = (expected_count !== null && expected_count !== undefined)
    ? (actual_count - expected_count)
    : 0;
  if (diff !== 0) {
    handleDiscrepancy(evt.id, operation_id || null, diff, responsible_username || user.username, user.username);
  }

  veAudit(null, evt.id, "CREATE", user.username, user.role, `Count event ${evtNumber} created`);
  const updated = db.prepare(`SELECT * FROM count_events WHERE id=?`).get(evt.id);
  res.status(201).json({ count_event: updated });
});

router.get("/count-events/:id", (req, res) => {
  const user  = req.user;
  const evt   = db.prepare(`SELECT * FROM count_events WHERE id=?`).get(req.params.id);
  if (!evt) return res.status(404).json({ error: "Count event not found" });

  if (user.role === "CLIENT" || user.role === "SUPPLIER") {
    const clientId = user.linked_client_id;
    if (!clientId || evt.client_id !== clientId) return res.status(403).json({ error: "Forbidden" });
  }

  const links = db.prepare(
    `SELECT cel.*, ve.evidence_number, ve.source, ve.visibility, ve.status AS ev_status
     FROM count_evidence_links cel
     JOIN visual_evidence ve ON ve.id = cel.evidence_id
     WHERE cel.count_event_id=?`
  ).all(evt.id);
  const discrepancies = db.prepare(`SELECT * FROM count_discrepancies WHERE count_event_id=?`).all(evt.id);
  res.json({ count_event: evt, linked_evidence: links, discrepancies });
});

router.post("/count-events/:id/review", requireLevel(55), (req, res) => {
  const user  = req.user;
  const level = rl(user.role);
  const evt   = db.prepare(`SELECT * FROM count_events WHERE id=?`).get(req.params.id);
  if (!evt) return res.status(404).json({ error: "Count event not found" });

  const { explanation, approved } = req.body;
  if (!explanation || !explanation.trim()) return res.status(400).json({ error: "explanation required" });

  if (approved && level < 65) {
    return res.status(403).json({ error: "Requires COMPLIANCE level (65+) to approve" });
  }

  db.prepare(
    `UPDATE count_events SET reviewed_by=?,reviewed_at=datetime('now'),review_notes=?,approved=?,approved_by=?,approved_at=?,status=?,updated_at=datetime('now') WHERE id=?`
  ).run(
    user.username, explanation,
    approved ? 1 : 0,
    approved ? user.username : null,
    approved ? new Date().toISOString() : null,
    approved ? "CLOSED" : "REVIEWED",
    evt.id
  );
  veAudit(null, evt.id, approved ? "APPROVE" : "REVIEW", user.username, user.role, explanation);
  res.json({ count_event: db.prepare(`SELECT * FROM count_events WHERE id=?`).get(evt.id) });
});

router.post("/count-events/:id/link-evidence", requireLevel(40), (req, res) => {
  const user = req.user;
  if (user.role === "CLIENT" || user.role === "SUPPLIER") return res.status(403).json({ error: "Forbidden" });
  const evt = db.prepare(`SELECT * FROM count_events WHERE id=?`).get(req.params.id);
  if (!evt) return res.status(404).json({ error: "Count event not found" });
  const { evidence_id } = req.body;
  if (!evidence_id) return res.status(400).json({ error: "evidence_id required" });
  const ev = db.prepare(`SELECT * FROM visual_evidence WHERE id=?`).get(evidence_id);
  if (!ev) return res.status(404).json({ error: "Evidence not found" });
  try {
    db.prepare(
      `INSERT INTO count_evidence_links (count_event_id,evidence_id,linked_by) VALUES (?,?,?)`
    ).run(evt.id, ev.id, user.username);
  } catch (e) {
    if (e.message.includes("UNIQUE")) return res.status(409).json({ error: "Already linked" });
    throw e;
  }
  res.status(201).json({ message: "Linked" });
});

// ─── Discrepancies ────────────────────────────────────────────────────────────

router.get("/discrepancies", requireLevel(40), (req, res) => {
  const user = req.user;
  if (user.role === "CLIENT" || user.role === "SUPPLIER") return res.status(403).json({ error: "Forbidden" });
  const { status, operation_id } = req.query;
  let q = `SELECT cd.*, ce.event_number FROM count_discrepancies cd JOIN count_events ce ON ce.id=cd.count_event_id WHERE 1=1`;
  const params = [];
  if (status)       { q += ` AND cd.status=?`;       params.push(status); }
  if (operation_id) { q += ` AND cd.operation_id=?`; params.push(operation_id); }
  q += ` ORDER BY cd.id DESC`;
  res.json({ discrepancies: db.prepare(q).all(...params) });
});

router.patch("/discrepancies/:id/resolve", requireLevel(55), (req, res) => {
  const user = req.user;
  if (user.role === "CLIENT" || user.role === "SUPPLIER") return res.status(403).json({ error: "Forbidden" });
  const disc = db.prepare(`SELECT * FROM count_discrepancies WHERE id=?`).get(req.params.id);
  if (!disc) return res.status(404).json({ error: "Discrepancy not found" });
  const { resolution, status } = req.body;
  if (!resolution) return res.status(400).json({ error: "resolution required" });
  const newStatus = status || "RESOLVED";
  db.prepare(
    `UPDATE count_discrepancies SET status=?,resolution=?,resolved_by=?,resolved_at=datetime('now') WHERE id=?`
  ).run(newStatus, resolution, user.username, disc.id);
  res.json({ discrepancy: db.prepare(`SELECT * FROM count_discrepancies WHERE id=?`).get(disc.id) });
});

// ─── AI Providers ─────────────────────────────────────────────────────────────

router.get("/ai-providers", requireLevel(80), (req, res) => {
  const providers = db.prepare(`SELECT * FROM ve_ai_providers ORDER BY id ASC`).all();
  res.json({ providers });
});

// ─── Dashboard ────────────────────────────────────────────────────────────────

router.get("/dashboard/summary", (req, res) => {
  const user  = req.user;
  const level = rl(user.role);

  const evidenceStats = db.prepare(
    `SELECT status, COUNT(*) AS count FROM visual_evidence GROUP BY status`
  ).all();
  const countStats = db.prepare(
    `SELECT status, COUNT(*) AS count FROM count_events GROUP BY status`
  ).all();
  const openDisc = db.prepare(
    `SELECT COUNT(*) AS count FROM count_discrepancies WHERE status='OPEN'`
  ).get();
  const zonesActive = db.prepare(
    `SELECT COUNT(*) AS count FROM observation_zones WHERE status='ACTIVE'`
  ).get();

  res.json({
    evidence_by_status: evidenceStats,
    count_events_by_status: countStats,
    open_discrepancies: openDisc.count,
    active_zones: zonesActive.count,
  });
});

// ─── Single evidence by numeric id — MUST be last ─────────────────────────────

router.get("/:id(\\d+)", (req, res) => {
  const user  = req.user;
  const ev    = db.prepare(`SELECT * FROM visual_evidence WHERE id=?`).get(req.params.id);
  if (!ev) return res.status(404).json({ error: "Evidence not found" });

  if (user.role === "CLIENT" || user.role === "SUPPLIER") {
    const clientId = user.linked_client_id;
    if (!clientId || ev.client_id !== clientId || ev.visibility !== "CLIENT_VISIBLE") {
      return res.status(403).json({ error: "Forbidden" });
    }
  }
  res.json({ evidence: ev });
});

module.exports = router;
