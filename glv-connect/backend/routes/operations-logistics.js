"use strict";
const express = require("express");
const router  = express.Router();
const db      = require("../db/database");
const { authenticate } = require("../middleware/auth");
const { requireLevel, ROLE_LEVEL } = require("../middleware/rbac");

function roleLevel(role) { return ROLE_LEVEL[role] || 0; }

router.use(authenticate);

// ── helpers ──────────────────────────────────────────────────────────────────

function opAudit(opId, action, actor, role, before, after, detail) {
  db.prepare(
    `INSERT INTO logistics_audit (op_id,action,actor,role,before_state,after_state,detail)
     VALUES (?,?,?,?,?,?,?)`
  ).run(
    opId, action, actor, role,
    before ? JSON.stringify(before) : null,
    after  ? JSON.stringify(after)  : null,
    detail || null
  );
}

function nextOpNumber() {
  const year = new Date().getFullYear();
  const last = db.prepare(
    `SELECT operation_number FROM logistics_ops WHERE operation_number LIKE ? ORDER BY id DESC LIMIT 1`
  ).get(`OPS-${year}-%`);
  if (!last) return `OPS-${year}-0001`;
  const seq = parseInt(last.operation_number.split("-")[2], 10) + 1;
  return `OPS-${year}-${String(seq).padStart(4, "0")}`;
}

function autoCreateTasks(opId, newStatus, username) {
  const templates = db.prepare(
    `SELECT * FROM logistics_task_templates WHERE trigger_status=? AND active=1`
  ).all(newStatus);
  for (const t of templates) {
    const due = new Date();
    due.setDate(due.getDate() + (t.default_due_days || 3));
    const taskRow = db.prepare(
      `INSERT INTO tasks (title, description, status, priority, deadline, created_by, logistics_op_id)
       VALUES (?,?,?,?,?,?,?)`
    ).run(
      `[OPS] ${t.title}`,
      t.description || "",
      "pending",
      "high",
      due.toISOString().split("T")[0],
      username,
      opId
    );
    db.prepare(
      `INSERT INTO logistics_op_tasks (op_id, task_id, template_id) VALUES (?,?,?)`
    ).run(opId, taskRow.lastInsertRowid, t.id);
  }
}

// ── PROVIDERS ────────────────────────────────────────────────────────────────

router.get("/providers", requireLevel(20), (req, res) => {
  const { type, status } = req.query;
  const p = [];
  let q = "SELECT * FROM logistics_providers WHERE 1=1";
  if (type)   { q += " AND type=?";   p.push(type); }
  if (status) { q += " AND status=?"; p.push(status); }
  q += " ORDER BY name";
  res.json(db.prepare(q).all(...p));
});

router.post("/providers", requireLevel(45), (req, res) => {
  const { name, type, country, contact_name, contact_email, contact_phone, scac_code, notes } = req.body;
  if (!name || !type) return res.status(400).json({ error: "name y type son obligatorios" });
  const r = db.prepare(
    `INSERT INTO logistics_providers (name,type,country,contact_name,contact_email,contact_phone,scac_code,notes)
     VALUES (?,?,?,?,?,?,?,?)`
  ).run(name, type, country||null, contact_name||null, contact_email||null, contact_phone||null, scac_code||null, notes||null);
  res.status(201).json({ id: r.lastInsertRowid });
});

router.patch("/providers/:id", requireLevel(45), (req, res) => {
  const allowed = ["name","status","contact_name","contact_email","contact_phone","notes"];
  const fields = []; const vals = [];
  for (const k of allowed) {
    if (req.body[k] !== undefined) { fields.push(`${k}=?`); vals.push(req.body[k]); }
  }
  if (!fields.length) return res.status(400).json({ error: "Nada que actualizar" });
  fields.push("updated_at=datetime('now')");
  db.prepare(`UPDATE logistics_providers SET ${fields.join(",")} WHERE id=?`).run(...vals, req.params.id);
  res.json({ ok: true });
});

// ── PORTS ────────────────────────────────────────────────────────────────────

router.get("/ports", requireLevel(20), (_req, res) => {
  res.json(db.prepare("SELECT * FROM op_ports WHERE status='ACTIVE' ORDER BY name").all());
});

// ── DASHBOARD SUMMARY ────────────────────────────────────────────────────────

router.get("/dashboard/summary", requireLevel(40), (req, res) => {
  if (req.user.role === "CLIENT" || req.user.role === "SUPPLIER")
    return res.status(403).json({ error: "Acceso denegado" });

  const ACTIVE = ["PREPARACION","DOCUMENTOS","BOOKING","CARGA","EN_TRANSITO","ARRIBO","NACIONALIZACION","ENTREGA"];
  const ph = ACTIVE.map(() => "?").join(",");
  const today = new Date().toISOString().split("T")[0];

  const active = db.prepare(`SELECT COUNT(*) n FROM logistics_ops WHERE status IN (${ph})`).get(...ACTIVE);
  const delayed = db.prepare(
    `SELECT COUNT(*) n FROM logistics_voyages WHERE eta IS NOT NULL AND eta < ?
     AND op_id IN (SELECT id FROM logistics_ops WHERE status IN ('EN_TRANSITO','ARRIBO'))`
  ).get(today);
  const containers = db.prepare(
    `SELECT COUNT(*) n FROM logistics_containers c
     JOIN logistics_ops o ON o.id=c.op_id WHERE o.status IN (${ph})`
  ).get(...ACTIVE);
  const upcoming_etd = db.prepare(
    `SELECT o.operation_number, v.vessel_name, v.etd FROM logistics_ops o
     JOIN logistics_voyages v ON v.op_id=o.id
     WHERE v.etd >= ? AND o.status IN ('BOOKING','CARGA') ORDER BY v.etd LIMIT 5`
  ).all(today);
  const upcoming_eta = db.prepare(
    `SELECT o.operation_number, v.vessel_name, v.eta FROM logistics_ops o
     JOIN logistics_voyages v ON v.op_id=o.id
     WHERE v.eta >= ? AND o.status IN ('EN_TRANSITO','ARRIBO') ORDER BY v.eta LIMIT 5`
  ).all(today);
  const overdue_tasks = db.prepare(
    `SELECT COUNT(*) n FROM tasks t JOIN logistics_op_tasks lot ON lot.task_id=t.id
     WHERE t.status='pending' AND t.deadline < ?`
  ).get(today);
  const open_incidents = db.prepare(
    `SELECT COUNT(*) n FROM logistics_incidents WHERE status IN ('OPEN','IN_PROGRESS') AND severity IN ('HIGH','CRITICAL')`
  ).get();

  res.json({
    active_operations:       active.n,
    delayed_shipments:       delayed.n,
    active_containers:       containers.n,
    upcoming_etd,
    upcoming_eta,
    overdue_tasks:           overdue_tasks.n,
    open_critical_incidents: open_incidents.n,
  });
});

// ── OPERATIONS LIST ───────────────────────────────────────────────────────────

router.get("/", requireLevel(20), (req, res) => {
  const u   = req.user;
  const lvl = roleLevel(u.role);
  const { status, client_id, responsible } = req.query;

  let q = `SELECT o.*, c.name as client_name
           FROM logistics_ops o LEFT JOIN clients c ON c.id=o.client_id WHERE 1=1`;
  const p = [];

  if (lvl < 40) {
    // CLIENT: only own operations visible after DOCUMENTOS
    const userRow = db.prepare("SELECT linked_client_id FROM users WHERE username=?").get(u.username);
    if (!userRow?.linked_client_id) return res.json([]);
    q += " AND o.client_id=? AND o.status NOT IN ('PREPARACION','DOCUMENTOS')";
    p.push(userRow.linked_client_id);
  } else if (u.role === "LOGISTICS") {
    q += " AND o.responsible_username=?";
    p.push(u.username);
  }

  if (status)                        { q += " AND o.status=?";               p.push(status); }
  if (client_id  && lvl >= 45)       { q += " AND o.client_id=?";            p.push(client_id); }
  if (responsible && lvl >= 45)      { q += " AND o.responsible_username=?"; p.push(responsible); }
  q += " ORDER BY o.id DESC LIMIT 200";
  res.json(db.prepare(q).all(...p));
});

// ── OPERATION DETAIL ──────────────────────────────────────────────────────────

router.get("/:id", requireLevel(20), (req, res) => {
  const u   = req.user;
  const lvl = roleLevel(u.role);
  const op  = db.prepare(
    `SELECT o.*, c.name as client_name FROM logistics_ops o
     LEFT JOIN clients c ON c.id=o.client_id WHERE o.id=?`
  ).get(req.params.id);
  if (!op) return res.status(404).json({ error: "Operación no encontrada" });

  if (lvl < 40) {
    const userRow = db.prepare("SELECT linked_client_id FROM users WHERE username=?").get(u.username);
    if (!userRow?.linked_client_id || userRow.linked_client_id !== op.client_id)
      return res.status(403).json({ error: "Acceso denegado" });
    if (["PREPARACION","DOCUMENTOS"].includes(op.status))
      return res.status(403).json({ error: "Acceso denegado" });
  }

  const voyage = db.prepare(
    `SELECT v.*, p1.name pol_name, p2.name pod_name
     FROM logistics_voyages v
     LEFT JOIN op_ports p1 ON p1.id=v.pol_port_id
     LEFT JOIN op_ports p2 ON p2.id=v.pod_port_id
     WHERE v.op_id=?`
  ).get(op.id);
  const containers  = db.prepare("SELECT * FROM logistics_containers  WHERE op_id=? ORDER BY id").all(op.id);
  const milestones  = db.prepare("SELECT * FROM logistics_milestones  WHERE op_id=? ORDER BY id").all(op.id);
  const incidents   = db.prepare("SELECT * FROM logistics_incidents   WHERE op_id=? ORDER BY reported_at DESC").all(op.id);
  const assignments = db.prepare(
    `SELECT a.*, p.name provider_name, p.type provider_type
     FROM logistics_assignments a JOIN logistics_providers p ON p.id=a.provider_id WHERE a.op_id=?`
  ).all(op.id);
  const tasks = lvl >= 40
    ? db.prepare("SELECT t.* FROM tasks t JOIN logistics_op_tasks lot ON lot.task_id=t.id WHERE lot.op_id=?").all(op.id)
    : [];
  const audit = lvl >= 45
    ? db.prepare("SELECT * FROM logistics_audit WHERE op_id=? ORDER BY created_at DESC").all(op.id)
    : [];

  if (lvl < 40) {
    return res.json({
      id: op.id, operation_number: op.operation_number, status: op.status,
      product_name: op.product_name, quantity: op.quantity, unit: op.unit,
      incoterm: op.incoterm, origin_country: op.origin_country, destination_country: op.destination_country,
      estimated_delivery_date: op.estimated_delivery_date, actual_delivery_date: op.actual_delivery_date,
      voyage: voyage ? {
        vessel_name: voyage.vessel_name, etd: voyage.etd, eta: voyage.eta, ata: voyage.ata,
        pol_name: voyage.pol_name, pod_name: voyage.pod_name, bl_number: voyage.bl_number,
      } : null,
      containers: containers.map(c => ({
        container_number: c.container_number, container_type: c.container_type, gross_weight_kg: c.gross_weight_kg,
      })),
      milestones: milestones.filter(m => m.status === "COMPLETED").map(m => ({
        milestone_label: m.milestone_label, actual_date: m.actual_date,
      })),
      incidents: incidents.filter(i => i.severity !== "LOW").map(i => ({
        type: i.type, description: i.description, status: i.status, reported_at: i.reported_at,
      })),
    });
  }

  res.json({ ...op, voyage, containers, milestones, incidents, assignments, tasks, audit });
});

// ── CREATE OPERATION ──────────────────────────────────────────────────────────

router.post("/", requireLevel(40), (req, res) => {
  const u = req.user;
  if (u.role === "CLIENT" || u.role === "SUPPLIER")
    return res.status(403).json({ error: "Acceso denegado" });

  const {
    quote_id, doc_id, source_type, client_id, product_code, product_name,
    quantity, unit, incoterm, origin_country, destination_country, currency,
    responsible_username, estimated_start_date,
  } = req.body;

  if (!source_type)                          return res.status(400).json({ error: "source_type es obligatorio" });
  if (!origin_country || !destination_country) return res.status(400).json({ error: "origen y destino son obligatorios" });

  const opNumber = nextOpNumber();
  const r = db.prepare(
    `INSERT INTO logistics_ops
     (operation_number,status,quote_id,doc_id,source_type,client_id,product_code,product_name,
      quantity,unit,incoterm,origin_country,destination_country,currency,responsible_username,
      estimated_start_date,created_by)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
  ).run(
    opNumber,"PREPARACION",quote_id||null,doc_id||null,source_type,client_id||null,
    product_code||null,product_name||null,quantity||null,unit||null,incoterm||null,
    origin_country,destination_country,currency||"USD",
    responsible_username||u.username,estimated_start_date||null,u.username
  );

  const opId = r.lastInsertRowid;
  opAudit(opId,"CREATED",u.username,u.role,null,{ status:"PREPARACION",operation_number:opNumber },"Operación creada");
  res.status(201).json({ id: opId, operation_number: opNumber });
});

// ── CHANGE STATUS ─────────────────────────────────────────────────────────────

router.patch("/:id/status", requireLevel(42), (req, res) => {
  const u  = req.user;
  if (u.role === "CLIENT" || u.role === "SUPPLIER")
    return res.status(403).json({ error: "Acceso denegado" });

  const op = db.prepare("SELECT * FROM logistics_ops WHERE id=?").get(req.params.id);
  if (!op) return res.status(404).json({ error: "Operación no encontrada" });

  const { status, reason } = req.body;
  const VALID = ["PREPARACION","DOCUMENTOS","BOOKING","CARGA","EN_TRANSITO","ARRIBO","NACIONALIZACION","ENTREGA","CERRADA","CANCELADA"];
  if (!VALID.includes(status)) return res.status(400).json({ error: "Estado inválido" });

  const extra = [];
  const eVals = [];
  if (status === "CERRADA")   { extra.push("closed_at=?");    eVals.push(new Date().toISOString()); }
  if (status === "CANCELADA") { extra.push("cancelled_at=?","cancellation_reason=?"); eVals.push(new Date().toISOString(), reason||null); }

  const setStr = ["status=?","updated_at=datetime('now')", ...extra].join(",");
  db.prepare(`UPDATE logistics_ops SET ${setStr} WHERE id=?`).run(status, ...eVals, op.id);

  opAudit(op.id,"STATUS_CHANGED",u.username,u.role,{ status:op.status },{ status },reason||null);

  try { autoCreateTasks(op.id, status, u.username); } catch(_) {}

  res.json({ ok: true, status });
});

// ── UPDATE FIELDS ─────────────────────────────────────────────────────────────

router.patch("/:id", requireLevel(42), (req, res) => {
  const u = req.user;
  if (u.role === "CLIENT" || u.role === "SUPPLIER")
    return res.status(403).json({ error: "Acceso denegado" });
  const op = db.prepare("SELECT * FROM logistics_ops WHERE id=?").get(req.params.id);
  if (!op) return res.status(404).json({ error: "Operación no encontrada" });

  const ALLOWED = ["responsible_username","estimated_start_date","estimated_delivery_date","actual_delivery_date","product_name","product_code","quantity","unit"];
  const fields = []; const vals = [];
  for (const k of ALLOWED) {
    if (req.body[k] !== undefined) { fields.push(`${k}=?`); vals.push(req.body[k]); }
  }
  if (!fields.length) return res.status(400).json({ error: "Nada que actualizar" });
  fields.push("updated_at=datetime('now')");
  db.prepare(`UPDATE logistics_ops SET ${fields.join(",")} WHERE id=?`).run(...vals, op.id);
  opAudit(op.id,"UPDATED",u.username,u.role,null,req.body,null);
  res.json({ ok: true });
});

// ── VOYAGE ────────────────────────────────────────────────────────────────────

router.post("/:id/voyage", requireLevel(42), (req, res) => {
  const u  = req.user;
  const op = db.prepare("SELECT id FROM logistics_ops WHERE id=?").get(req.params.id);
  if (!op) return res.status(404).json({ error: "Operación no encontrada" });

  const {
    naviera_id, vessel_name, imo_number, voyage_number, booking_number, booking_date,
    pol_port_id, pod_port_id, etd, eta, bl_number, bl_type, bl_date,
    freight_agent_id, port_agent_id, notes,
  } = req.body;

  const existing = db.prepare("SELECT id FROM logistics_voyages WHERE op_id=?").get(op.id);
  let voyageId;
  if (existing) {
    db.prepare(
      `UPDATE logistics_voyages SET naviera_id=?,vessel_name=?,imo_number=?,voyage_number=?,
       booking_number=?,booking_date=?,pol_port_id=?,pod_port_id=?,etd=?,eta=?,
       bl_number=?,bl_type=?,bl_date=?,freight_agent_id=?,port_agent_id=?,notes=?,
       updated_at=datetime('now') WHERE id=?`
    ).run(
      naviera_id||null,vessel_name||null,imo_number||null,voyage_number||null,
      booking_number||null,booking_date||null,pol_port_id||null,pod_port_id||null,
      etd||null,eta||null,bl_number||null,bl_type||null,bl_date||null,
      freight_agent_id||null,port_agent_id||null,notes||null,existing.id
    );
    voyageId = existing.id;
  } else {
    const r = db.prepare(
      `INSERT INTO logistics_voyages
       (op_id,naviera_id,vessel_name,imo_number,voyage_number,booking_number,booking_date,
        pol_port_id,pod_port_id,etd,eta,bl_number,bl_type,bl_date,freight_agent_id,port_agent_id,notes,created_by)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
    ).run(
      op.id,naviera_id||null,vessel_name||null,imo_number||null,voyage_number||null,
      booking_number||null,booking_date||null,pol_port_id||null,pod_port_id||null,
      etd||null,eta||null,bl_number||null,bl_type||null,bl_date||null,
      freight_agent_id||null,port_agent_id||null,notes||null,u.username
    );
    voyageId = r.lastInsertRowid;
  }
  opAudit(op.id,"VOYAGE_UPDATED",u.username,u.role,null,{ booking_number,etd,eta,bl_number },null);
  res.json({ ok: true, voyage_id: voyageId });
});

// ── CONTAINERS ────────────────────────────────────────────────────────────────

router.post("/:id/containers", requireLevel(42), (req, res) => {
  const u  = req.user;
  const op = db.prepare("SELECT id FROM logistics_ops WHERE id=?").get(req.params.id);
  if (!op) return res.status(404).json({ error: "Operación no encontrada" });
  const { container_number, container_type, seal_number, gross_weight_kg, vgm_kg, vgm_date, vgm_method, voyage_id, notes } = req.body;
  if (!container_number) return res.status(400).json({ error: "container_number es obligatorio" });
  const r = db.prepare(
    `INSERT INTO logistics_containers
     (op_id,voyage_id,container_number,container_type,seal_number,gross_weight_kg,vgm_kg,vgm_date,vgm_method,notes)
     VALUES (?,?,?,?,?,?,?,?,?,?)`
  ).run(op.id,voyage_id||null,container_number,container_type||null,seal_number||null,gross_weight_kg||null,vgm_kg||null,vgm_date||null,vgm_method||null,notes||null);
  opAudit(op.id,"CONTAINER_ADDED",u.username,u.role,null,{ container_number,container_type },null);
  res.status(201).json({ id: r.lastInsertRowid });
});

router.patch("/:id/containers/:cid", requireLevel(42), (req, res) => {
  const u = req.user;
  const { seal_number, gross_weight_kg, vgm_kg, vgm_date, vgm_method, inspection_required, inspection_date, inspection_result, inspection_agency } = req.body;
  db.prepare(
    `UPDATE logistics_containers SET
     seal_number=COALESCE(?,seal_number), gross_weight_kg=COALESCE(?,gross_weight_kg),
     vgm_kg=COALESCE(?,vgm_kg), vgm_date=COALESCE(?,vgm_date), vgm_method=COALESCE(?,vgm_method),
     inspection_required=COALESCE(?,inspection_required), inspection_date=COALESCE(?,inspection_date),
     inspection_result=COALESCE(?,inspection_result), inspection_agency=COALESCE(?,inspection_agency)
     WHERE id=? AND op_id=?`
  ).run(seal_number,gross_weight_kg,vgm_kg,vgm_date,vgm_method,inspection_required,inspection_date,inspection_result,inspection_agency,req.params.cid,req.params.id);
  opAudit(parseInt(req.params.id,10),"CONTAINER_UPDATED",u.username,u.role,null,req.body,null);
  res.json({ ok: true });
});

// ── MILESTONES ────────────────────────────────────────────────────────────────

router.post("/:id/milestones", requireLevel(42), (req, res) => {
  const u  = req.user;
  const op = db.prepare("SELECT id FROM logistics_ops WHERE id=?").get(req.params.id);
  if (!op) return res.status(404).json({ error: "Operación no encontrada" });
  const { milestone_key, milestone_label, planned_date, actual_date, responsible_username, evidence_note, status } = req.body;
  if (!milestone_key || !milestone_label) return res.status(400).json({ error: "milestone_key y milestone_label son obligatorios" });
  const r = db.prepare(
    `INSERT INTO logistics_milestones
     (op_id,milestone_key,milestone_label,planned_date,actual_date,responsible_username,evidence_note,status)
     VALUES (?,?,?,?,?,?,?,?)`
  ).run(op.id,milestone_key,milestone_label,planned_date||null,actual_date||null,responsible_username||u.username,evidence_note||null,status||"PENDING");
  opAudit(op.id,"MILESTONE_ADDED",u.username,u.role,null,{ milestone_key,milestone_label,planned_date },null);
  res.status(201).json({ id: r.lastInsertRowid });
});

router.patch("/:id/milestones/:mid", requireLevel(42), (req, res) => {
  const u = req.user;
  const { actual_date, status, evidence_note, delay_days } = req.body;
  db.prepare(
    `UPDATE logistics_milestones SET
     actual_date=COALESCE(?,actual_date), status=COALESCE(?,status),
     evidence_note=COALESCE(?,evidence_note), delay_days=COALESCE(?,delay_days),
     updated_at=datetime('now') WHERE id=? AND op_id=?`
  ).run(actual_date,status,evidence_note,delay_days,req.params.mid,req.params.id);
  opAudit(parseInt(req.params.id,10),"MILESTONE_UPDATED",u.username,u.role,null,{ status,actual_date },null);
  res.json({ ok: true });
});

// ── INCIDENTS ─────────────────────────────────────────────────────────────────

router.post("/:id/incidents", requireLevel(40), (req, res) => {
  const u = req.user;
  if (u.role === "CLIENT" || u.role === "SUPPLIER")
    return res.status(403).json({ error: "Acceso denegado" });
  const op = db.prepare("SELECT id FROM logistics_ops WHERE id=?").get(req.params.id);
  if (!op) return res.status(404).json({ error: "Operación no encontrada" });
  const { type, severity, description } = req.body;
  if (!type || !description) return res.status(400).json({ error: "type y description son obligatorios" });
  const r = db.prepare(
    `INSERT INTO logistics_incidents (op_id,type,severity,description,reported_by) VALUES (?,?,?,?,?)`
  ).run(op.id,type,severity||"MEDIUM",description,u.username);
  opAudit(op.id,"INCIDENT_REPORTED",u.username,u.role,null,{ type,severity,description },null);
  res.status(201).json({ id: r.lastInsertRowid });
});

router.patch("/:id/incidents/:iid", requireLevel(42), (req, res) => {
  const u = req.user;
  const { status, resolution } = req.body;
  const resolved_at = (status === "RESOLVED" || status === "CLOSED") ? new Date().toISOString() : null;
  db.prepare(
    `UPDATE logistics_incidents SET status=COALESCE(?,status),resolution=COALESCE(?,resolution),
     resolved_at=COALESCE(?,resolved_at) WHERE id=? AND op_id=?`
  ).run(status,resolution,resolved_at,req.params.iid,req.params.id);
  opAudit(parseInt(req.params.id,10),"INCIDENT_UPDATED",u.username,u.role,null,{ status,resolution },null);
  res.json({ ok: true });
});

// ── ASSIGNMENTS ───────────────────────────────────────────────────────────────

router.post("/:id/assignments", requireLevel(45), (req, res) => {
  const u  = req.user;
  const op = db.prepare("SELECT id FROM logistics_ops WHERE id=?").get(req.params.id);
  if (!op) return res.status(404).json({ error: "Operación no encontrada" });
  const { provider_id, role, notes } = req.body;
  if (!provider_id || !role) return res.status(400).json({ error: "provider_id y role son obligatorios" });
  const r = db.prepare(
    `INSERT INTO logistics_assignments (op_id,provider_id,role,assigned_by,notes) VALUES (?,?,?,?,?)`
  ).run(op.id,provider_id,role,u.username,notes||null);
  opAudit(op.id,"PROVIDER_ASSIGNED",u.username,u.role,null,{ provider_id,role },null);
  res.status(201).json({ id: r.lastInsertRowid });
});

module.exports = router;
