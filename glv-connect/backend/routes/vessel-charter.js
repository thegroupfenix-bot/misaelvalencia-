"use strict";
const express = require("express");
const router  = express.Router();
const db      = require("../db/database");
const { authenticate } = require("../middleware/auth");
const { requireLevel, ROLE_LEVEL } = require("../middleware/rbac");

function roleLevel(role) { return ROLE_LEVEL[role] || 0; }

router.use(authenticate);

// ── helpers ───────────────────────────────────────────────────────────────────

function charterAudit(fixtureId, voyageId, action, actor, role, before, after, detail) {
  db.prepare(
    `INSERT INTO charter_audit (fixture_id,voyage_id,action,actor,role,before_state,after_state,detail)
     VALUES (?,?,?,?,?,?,?,?)`
  ).run(
    fixtureId || null, voyageId || null, action, actor, role,
    before ? JSON.stringify(before) : null,
    after  ? JSON.stringify(after)  : null,
    detail || null
  );
}

function nextFixtureNumber() {
  const year = new Date().getFullYear();
  const last = db.prepare(
    `SELECT fixture_number FROM charter_fixtures WHERE fixture_number LIKE ? ORDER BY id DESC LIMIT 1`
  ).get(`FIX-${year}-%`);
  if (!last) return `FIX-${year}-0001`;
  const seq = parseInt(last.fixture_number.split("-")[2], 10) + 1;
  return `FIX-${year}-${String(seq).padStart(4, "0")}`;
}

function sanitizeFixture(f, level) {
  if (level >= 60) return f;
  const out = { ...f };
  delete out.voyage_cost_usd;
  delete out.expected_margin_usd;
  delete out.actual_margin_usd;
  return out;
}

function autoAlert(fixtureId, voyageId, vesselId, type, severity, message) {
  try {
    db.prepare(
      `INSERT INTO charter_alerts (fixture_id,voyage_id,vessel_id,alert_type,severity,message)
       VALUES (?,?,?,?,?,?)`
    ).run(fixtureId || null, voyageId || null, vesselId || null, type, severity, message);
  } catch (_) {}
}

function calculateLaytime(voyageId) {
  const voyage = db.prepare(
    `SELECT vv.*, cf.loading_rate_mt_day, cf.discharging_rate_mt_day,
      cf.laytime_type, cf.demurrage_rate_usd_day, cf.despatch_rate_usd_day, cf.despatch_on,
      cf.cargo_quantity
     FROM vessel_voyages vv
     JOIN charter_fixtures cf ON cf.id = vv.fixture_id
     WHERE vv.id = ?`
  ).get(voyageId);
  if (!voyage) return [];

  const quantity = voyage.bl_quantity || voyage.cargo_quantity || 0;
  const results  = [];

  for (const portType of ["LOADING", "DISCHARGE"]) {
    const rate = portType === "LOADING"
      ? voyage.loading_rate_mt_day
      : voyage.discharging_rate_mt_day;
    if (!rate || rate <= 0) continue;

    const allowedHours = (quantity / rate) * 24;

    const events = db.prepare(
      `SELECT * FROM laytime_events WHERE voyage_id=? AND port_type=? ORDER BY event_time`
    ).all(voyageId, portType);
    const excludedHours = events
      .filter(e => e.is_excluded)
      .reduce((s, e) => s + (e.duration_hours || 0), 0);

    let usedHours = 0;
    const startEvent = portType === "LOADING"
      ? (voyage.nor_accepted_at || voyage.berthed_at)
      : (voyage.nor_discharge_tendered_at || voyage.berthed_discharge_at);
    const endEvent = portType === "LOADING"
      ? voyage.completed_loading_at
      : voyage.completed_discharge_at;

    if (startEvent && endEvent) {
      usedHours = (new Date(endEvent) - new Date(startEvent)) / 3_600_000;
    }

    const netHours     = Math.max(0, usedHours - excludedHours);
    const balanceHours = allowedHours - netHours;

    let demurrageAmount = 0;
    let despatchAmount  = 0;

    if (balanceHours < 0) {
      demurrageAmount = (Math.abs(balanceHours) / 24) * (voyage.demurrage_rate_usd_day || 0);
    } else if (balanceHours > 0 && voyage.despatch_rate_usd_day) {
      const despatchHours = voyage.despatch_on === "WORKING_TIME_SAVED"
        ? balanceHours * 0.5
        : balanceHours;
      despatchAmount = (despatchHours / 24) * voyage.despatch_rate_usd_day;
    }

    const existing = db.prepare(
      `SELECT id FROM laytime_calculations WHERE voyage_id=? AND port_type=?`
    ).get(voyageId, portType);

    if (existing) {
      db.prepare(
        `UPDATE laytime_calculations
         SET allowed_hours=?,used_hours=?,excluded_hours=?,net_hours=?,balance_hours=?,
             demurrage_amount=?,despatch_amount=?,calculation_date=datetime('now')
         WHERE id=?`
      ).run(allowedHours, usedHours, excludedHours, netHours, balanceHours,
            demurrageAmount, despatchAmount, existing.id);
    } else {
      db.prepare(
        `INSERT INTO laytime_calculations
         (voyage_id,port_type,allowed_hours,used_hours,excluded_hours,net_hours,
          balance_hours,demurrage_amount,despatch_amount)
         VALUES (?,?,?,?,?,?,?,?,?)`
      ).run(voyageId, portType, allowedHours, usedHours, excludedHours, netHours,
            balanceHours, demurrageAmount, despatchAmount);
    }

    results.push({ port_type: portType, allowed_hours: allowedHours, used_hours: usedHours,
      excluded_hours: excludedHours, net_hours: netHours, balance_hours: balanceHours,
      demurrage_amount: demurrageAmount, despatch_amount: despatchAmount });
  }

  return db.prepare(`SELECT * FROM laytime_calculations WHERE voyage_id=?`).all(voyageId);
}

// ── Vessels ───────────────────────────────────────────────────────────────────

router.get("/vessels", requireLevel(20), (req, res) => {
  const { type, status } = req.query;
  let q = `SELECT * FROM vessels WHERE 1=1`;
  const p = [];
  if (type)   { q += ` AND vessel_type=?`; p.push(type); }
  if (status) { q += ` AND status=?`;      p.push(status); }
  q += ` ORDER BY vessel_name`;
  res.json(db.prepare(q).all(...p));
});

router.get("/vessels/:id", requireLevel(20), (req, res) => {
  const v = db.prepare(`SELECT * FROM vessels WHERE id=?`).get(req.params.id);
  if (!v) return res.status(404).json({ error: "Buque no encontrado" });
  res.json(v);
});

router.post("/vessels", requireLevel(45), (req, res) => {
  const u = req.user;
  if (roleLevel(u.role) < 45) return res.status(403).json({ error: "Acceso denegado" });
  const { imo_number, vessel_name, vessel_type, flag, year_built, dwt, grt, nrt, loa, beam,
    draft_max, holds_count, hatches_count, grain_capacity, bale_capacity, teu_capacity,
    classification_society, class_expiry, p_and_i_club, p_and_i_expiry, notes } = req.body;
  if (!imo_number || !vessel_name || !vessel_type)
    return res.status(400).json({ error: "imo_number, vessel_name y vessel_type son obligatorios" });
  try {
    const r = db.prepare(
      `INSERT INTO vessels (imo_number,vessel_name,vessel_type,flag,year_built,dwt,grt,nrt,loa,beam,
       draft_max,holds_count,hatches_count,grain_capacity,bale_capacity,teu_capacity,
       classification_society,class_expiry,p_and_i_club,p_and_i_expiry,notes,created_by)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
    ).run(imo_number,vessel_name,vessel_type,flag||null,year_built||null,dwt||null,grt||null,
      nrt||null,loa||null,beam||null,draft_max||null,holds_count||null,hatches_count||null,
      grain_capacity||null,bale_capacity||null,teu_capacity||null,classification_society||null,
      class_expiry||null,p_and_i_club||null,p_and_i_expiry||null,notes||null,u.username);
    res.status(201).json({ id: r.lastInsertRowid });
  } catch (e) {
    if (e.message && e.message.includes("UNIQUE")) {
      return res.status(409).json({ error: `El número IMO ${imo_number} ya existe` });
    }
    throw e;
  }
});

router.patch("/vessels/:id", requireLevel(45), (req, res) => {
  const allowed = ["vessel_name","flag","year_built","dwt","grt","classification_society",
    "class_expiry","p_and_i_club","p_and_i_expiry","notes","status"];
  const fields = []; const vals = [];
  for (const k of allowed) {
    if (req.body[k] !== undefined) { fields.push(`${k}=?`); vals.push(req.body[k]); }
  }
  if (!fields.length) return res.status(400).json({ error: "Nada que actualizar" });
  fields.push("updated_at=datetime('now')");
  db.prepare(`UPDATE vessels SET ${fields.join(",")} WHERE id=?`).run(...vals, req.params.id);
  res.json({ ok: true });
});

router.get("/vessels/:id/documents", requireLevel(45), (req, res) => {
  res.json(db.prepare(`SELECT * FROM vessel_documents WHERE vessel_id=? ORDER BY id DESC`).all(req.params.id));
});

router.post("/vessels/:id/documents", requireLevel(45), (req, res) => {
  const { doc_type, doc_number, issued_date, expiry_date, issuing_authority, file_ref } = req.body;
  if (!doc_type) return res.status(400).json({ error: "doc_type es obligatorio" });
  const r = db.prepare(
    `INSERT INTO vessel_documents (vessel_id,doc_type,doc_number,issued_date,expiry_date,issuing_authority,file_ref)
     VALUES (?,?,?,?,?,?,?)`
  ).run(req.params.id,doc_type,doc_number||null,issued_date||null,expiry_date||null,issuing_authority||null,file_ref||null);
  res.status(201).json({ id: r.lastInsertRowid });
});

// ── Charter Parties ───────────────────────────────────────────────────────────

router.get("/charter-parties", requireLevel(40), (req, res) => {
  const { type } = req.query;
  let q = `SELECT * FROM charter_parties WHERE 1=1`;
  const p = [];
  if (type) { q += ` AND type=?`; p.push(type); }
  q += ` ORDER BY name`;
  res.json(db.prepare(q).all(...p));
});

router.post("/charter-parties", requireLevel(45), (req, res) => {
  const { name, type, country, contact_name, contact_email, contact_phone, address } = req.body;
  if (!name || !type) return res.status(400).json({ error: "name y type son obligatorios" });
  const r = db.prepare(
    `INSERT INTO charter_parties (name,type,country,contact_name,contact_email,contact_phone,address)
     VALUES (?,?,?,?,?,?,?)`
  ).run(name,type,country||null,contact_name||null,contact_email||null,contact_phone||null,address||null);
  res.status(201).json({ id: r.lastInsertRowid });
});

router.patch("/charter-parties/:id", requireLevel(45), (req, res) => {
  const allowed = ["name","status","contact_name","contact_email","contact_phone","address"];
  const fields = []; const vals = [];
  for (const k of allowed) {
    if (req.body[k] !== undefined) { fields.push(`${k}=?`); vals.push(req.body[k]); }
  }
  if (!fields.length) return res.status(400).json({ error: "Nada que actualizar" });
  fields.push("updated_at=datetime('now')");
  db.prepare(`UPDATE charter_parties SET ${fields.join(",")} WHERE id=?`).run(...vals, req.params.id);
  res.json({ ok: true });
});

// ── Fixtures ──────────────────────────────────────────────────────────────────

router.get("/fixtures", requireLevel(40), (req, res) => {
  const u   = req.user;
  const lvl = roleLevel(u.role);
  if (lvl < 40) return res.status(403).json({ error: "Acceso denegado" });
  const { status } = req.query;
  let q = `SELECT cf.*, v.vessel_name, v.imo_number FROM charter_fixtures cf
           LEFT JOIN vessels v ON v.id=cf.vessel_id WHERE 1=1`;
  const p = [];
  if (status) { q += ` AND cf.status=?`; p.push(status); }
  q += ` ORDER BY cf.id DESC LIMIT 200`;
  const rows = db.prepare(q).all(...p);
  res.json(rows.map(f => sanitizeFixture(f, lvl)));
});

router.get("/fixtures/:id", requireLevel(40), (req, res) => {
  const u   = req.user;
  const lvl = roleLevel(u.role);
  if (lvl < 40) return res.status(403).json({ error: "Acceso denegado" });
  const f = db.prepare(
    `SELECT cf.*, v.vessel_name, v.imo_number FROM charter_fixtures cf
     LEFT JOIN vessels v ON v.id=cf.vessel_id WHERE cf.id=?`
  ).get(req.params.id);
  if (!f) return res.status(404).json({ error: "Fixture no encontrado" });
  const versions = db.prepare(`SELECT * FROM charter_fixture_versions WHERE fixture_id=? ORDER BY version DESC`).all(f.id);
  res.json({ ...sanitizeFixture(f, lvl), versions });
});

router.post("/fixtures", requireLevel(70), (req, res) => {
  const u = req.user;
  const {
    vessel_id, shipowner_id, operator_id, broker_id, operation_id,
    cargo_description, cargo_quantity, cargo_unit, cargo_tolerance_pct,
    freight_type, freight_rate, freight_currency, lumpsum_amount,
    commission_pct, address_commission_pct,
    laycan_start, laycan_end, cancelling_date, loading_port, discharge_port,
    loading_rate_mt_day, discharging_rate_mt_day, laytime_type,
    demurrage_rate_usd_day, despatch_rate_usd_day, despatch_on,
    recap_text, cp_form, cp_signed_date,
    voyage_cost_usd, expected_margin_usd,
  } = req.body;

  const fixNum = nextFixtureNumber();
  const r = db.prepare(
    `INSERT INTO charter_fixtures
     (fixture_number,operation_id,vessel_id,shipowner_id,operator_id,broker_id,
      cargo_description,cargo_quantity,cargo_unit,cargo_tolerance_pct,
      freight_type,freight_rate,freight_currency,lumpsum_amount,
      commission_pct,address_commission_pct,
      laycan_start,laycan_end,cancelling_date,loading_port,discharge_port,
      loading_rate_mt_day,discharging_rate_mt_day,laytime_type,
      demurrage_rate_usd_day,despatch_rate_usd_day,despatch_on,
      recap_text,cp_form,cp_signed_date,voyage_cost_usd,expected_margin_usd,
      created_by)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
  ).run(fixNum,operation_id||null,vessel_id||null,shipowner_id||null,operator_id||null,broker_id||null,
    cargo_description||null,cargo_quantity||null,cargo_unit||null,cargo_tolerance_pct||null,
    freight_type||null,freight_rate||null,freight_currency||"USD",lumpsum_amount||null,
    commission_pct||null,address_commission_pct||null,
    laycan_start||null,laycan_end||null,cancelling_date||null,loading_port||null,discharge_port||null,
    loading_rate_mt_day||null,discharging_rate_mt_day||null,laytime_type||null,
    demurrage_rate_usd_day||null,despatch_rate_usd_day||null,despatch_on||null,
    recap_text||null,cp_form||null,cp_signed_date||null,voyage_cost_usd||null,expected_margin_usd||null,
    u.username);

  const fixId = r.lastInsertRowid;
  charterAudit(fixId, null, "FIXTURE_CREATED", u.username, u.role, null, { fixture_number: fixNum }, null);

  // Auto-alert if laycan within 7 days
  if (laycan_start) {
    const daysToLaycan = (new Date(laycan_start) - new Date()) / 86_400_000;
    if (daysToLaycan <= 7 && daysToLaycan >= 0) {
      autoAlert(fixId, null, vessel_id, "LAYCAN_APPROACHING", "HIGH",
        `Laycan de ${fixNum} comienza en ${Math.ceil(daysToLaycan)} días (${laycan_start})`);
    }
  }

  res.status(201).json({ id: fixId, fixture_number: fixNum });
});

router.patch("/fixtures/:id", requireLevel(60), (req, res) => {
  const u = req.user;
  const f = db.prepare(`SELECT * FROM charter_fixtures WHERE id=?`).get(req.params.id);
  if (!f) return res.status(404).json({ error: "Fixture no encontrado" });

  const allowed = ["status","recap_text","cp_signed_date","cp_form","actual_margin_usd",
    "voyage_cost_usd","cancelling_date","laycan_start","laycan_end"];
  const fields = []; const vals = [];
  for (const k of allowed) {
    if (req.body[k] !== undefined) { fields.push(`${k}=?`); vals.push(req.body[k]); }
  }
  if (!fields.length) return res.status(400).json({ error: "Nada que actualizar" });
  fields.push("updated_at=datetime('now')");
  db.prepare(`UPDATE charter_fixtures SET ${fields.join(",")} WHERE id=?`).run(...vals, f.id);
  charterAudit(f.id, null, "FIXTURE_UPDATED", u.username, u.role, null, req.body, null);
  res.json({ ok: true });
});

router.post("/fixtures/:id/versions", requireLevel(60), (req, res) => {
  const u = req.user;
  const f = db.prepare(`SELECT * FROM charter_fixtures WHERE id=?`).get(req.params.id);
  if (!f) return res.status(404).json({ error: "Fixture no encontrado" });
  const { recap_text, change_note } = req.body;
  const newVersion = (f.cp_version || 1) + 1;
  db.prepare(`INSERT INTO charter_fixture_versions (fixture_id,version,recap_text,changed_by,change_note)
    VALUES (?,?,?,?,?)`).run(f.id, newVersion, recap_text || f.recap_text, u.username, change_note || null);
  if (recap_text) {
    db.prepare(`UPDATE charter_fixtures SET recap_text=?,cp_version=?,updated_at=datetime('now') WHERE id=?`)
      .run(recap_text, newVersion, f.id);
  }
  charterAudit(f.id, null, "CP_VERSION_SAVED", u.username, u.role, null, { version: newVersion }, change_note || null);
  res.status(201).json({ ok: true, version: newVersion });
});

// ── Financials ────────────────────────────────────────────────────────────────

router.get("/fixtures/:id/financials", requireLevel(60), (req, res) => {
  res.json(db.prepare(
    `SELECT vf.*, cp.name as counterparty_name FROM voyage_financials vf
     LEFT JOIN charter_parties cp ON cp.id=vf.counterparty_id
     WHERE vf.fixture_id=? ORDER BY vf.created_at DESC`
  ).all(req.params.id));
});

router.post("/fixtures/:id/financials", requireLevel(60), (req, res) => {
  const u = req.user;
  const { item_type, description, amount, currency, direction, due_date, voyage_id, counterparty_id, status } = req.body;
  if (!item_type) return res.status(400).json({ error: "item_type es obligatorio" });
  const r = db.prepare(
    `INSERT INTO voyage_financials (fixture_id,voyage_id,item_type,description,amount,currency,direction,due_date,counterparty_id,status,created_by)
     VALUES (?,?,?,?,?,?,?,?,?,?,?)`
  ).run(req.params.id,voyage_id||null,item_type,description||null,amount||null,currency||"USD",direction||null,due_date||null,counterparty_id||null,status||"PENDING",u.username);
  res.status(201).json({ id: r.lastInsertRowid });
});

// ── Voyages ───────────────────────────────────────────────────────────────────

router.get("/voyages", requireLevel(20), (req, res) => {
  const u   = req.user;
  const lvl = roleLevel(u.role);
  const { status, fixture_id } = req.query;
  let q = `SELECT vv.*, cf.fixture_number, cf.loading_port, cf.discharge_port,
    v.vessel_name, v.imo_number
    FROM vessel_voyages vv
    JOIN charter_fixtures cf ON cf.id=vv.fixture_id
    JOIN vessels v ON v.id=vv.vessel_id
    WHERE 1=1`;
  const p = [];
  // CLIENT sees nothing here — they shouldn't call /voyages
  if (lvl < 40) return res.status(403).json({ error: "Acceso denegado" });
  if (status)     { q += ` AND vv.status=?`;     p.push(status); }
  if (fixture_id) { q += ` AND vv.fixture_id=?`; p.push(fixture_id); }
  q += ` ORDER BY vv.id DESC LIMIT 200`;
  res.json(db.prepare(q).all(...p));
});

router.get("/voyages/:id", requireLevel(20), (req, res) => {
  const u   = req.user;
  const lvl = roleLevel(u.role);
  const vv = db.prepare(
    `SELECT vv.*, cf.fixture_number, cf.demurrage_rate_usd_day, cf.despatch_rate_usd_day,
      cf.loading_rate_mt_day, cf.discharging_rate_mt_day, cf.laytime_type,
      v.vessel_name, v.imo_number
     FROM vessel_voyages vv
     JOIN charter_fixtures cf ON cf.id=vv.fixture_id
     JOIN vessels v ON v.id=vv.vessel_id
     WHERE vv.id=?`
  ).get(req.params.id);
  if (!vv) return res.status(404).json({ error: "Viaje no encontrado" });

  const sof      = db.prepare(`SELECT * FROM statements_of_facts WHERE voyage_id=? ORDER BY id`).all(vv.id);
  const events   = db.prepare(`SELECT * FROM laytime_events WHERE voyage_id=? ORDER BY event_time`).all(vv.id);
  const calcs    = db.prepare(`SELECT * FROM laytime_calculations WHERE voyage_id=?`).all(vv.id);
  const audit    = lvl >= 45 ? db.prepare(`SELECT * FROM charter_audit WHERE voyage_id=? ORDER BY created_at DESC`).all(vv.id) : [];

  // CLIENT: strip internal fields
  if (lvl < 40) return res.status(403).json({ error: "Acceso denegado" });

  res.json({ ...vv, sof, laytime_events: events, laytime_calculations: calcs, audit });
});

router.post("/voyages", requireLevel(45), (req, res) => {
  const u = req.user;
  const { fixture_id, operation_id, vessel_id, pol_port, pod_port, pol_etd, pod_eta } = req.body;
  if (!fixture_id || !vessel_id)
    return res.status(400).json({ error: "fixture_id y vessel_id son obligatorios" });
  const r = db.prepare(
    `INSERT INTO vessel_voyages (fixture_id,operation_id,vessel_id,pol_port,pod_port,pol_etd,pod_eta)
     VALUES (?,?,?,?,?,?,?)`
  ).run(fixture_id,operation_id||null,vessel_id,pol_port||null,pod_port||null,pol_etd||null,pod_eta||null);
  const voyId = r.lastInsertRowid;
  charterAudit(fixture_id, voyId, "VOYAGE_CREATED", u.username, u.role, null, { pol_port, pod_port, pol_etd, pod_eta }, null);
  res.status(201).json({ id: voyId });
});

router.patch("/voyages/:id", requireLevel(42), (req, res) => {
  const u = req.user;
  const vv = db.prepare(`SELECT * FROM vessel_voyages WHERE id=?`).get(req.params.id);
  if (!vv) return res.status(404).json({ error: "Viaje no encontrado" });

  const allowed = ["pol_etd","pol_atd","pod_eta","pod_ata","nor_tendered_at","nor_accepted_at",
    "berthed_at","commenced_loading_at","completed_loading_at","sailed_at",
    "nor_discharge_tendered_at","berthed_discharge_at","commenced_discharge_at",
    "completed_discharge_at","draft_survey_loading","draft_survey_discharge",
    "bl_date","bl_quantity","master_name","status"];
  const fields = []; const vals = [];
  for (const k of allowed) {
    if (req.body[k] !== undefined) { fields.push(`${k}=?`); vals.push(req.body[k]); }
  }
  if (!fields.length) return res.status(400).json({ error: "Nada que actualizar" });
  fields.push("updated_at=datetime('now')");
  db.prepare(`UPDATE vessel_voyages SET ${fields.join(",")} WHERE id=?`).run(...vals, vv.id);
  charterAudit(vv.fixture_id, vv.id, "VOYAGE_UPDATED", u.username, u.role, null, req.body, null);

  // ETA overdue alert
  if (req.body.pod_eta) {
    const today = new Date().toISOString().split("T")[0];
    if (req.body.pod_eta < today && req.body.status && !["COMPLETED","CANCELLED"].includes(req.body.status)) {
      autoAlert(vv.fixture_id, vv.id, null, "ETA_DELAY", "HIGH",
        `ETA ${req.body.pod_eta} superada para viaje ID ${vv.id}`);
    }
  }

  res.json({ ok: true });
});

// ── SOF ───────────────────────────────────────────────────────────────────────

router.post("/voyages/:id/sof", requireLevel(42), (req, res) => {
  const u = req.user;
  const { port_type, sof_text, agent_name, signed_by, signed_date } = req.body;
  if (!port_type) return res.status(400).json({ error: "port_type es obligatorio" });
  const r = db.prepare(
    `INSERT INTO statements_of_facts (voyage_id,port_type,sof_text,agent_name,signed_by,signed_date,created_by)
     VALUES (?,?,?,?,?,?,?)`
  ).run(req.params.id,port_type,sof_text||null,agent_name||null,signed_by||null,signed_date||null,u.username);
  res.status(201).json({ id: r.lastInsertRowid });
});

router.get("/voyages/:id/sof", requireLevel(20), (req, res) => {
  res.json(db.prepare(`SELECT * FROM statements_of_facts WHERE voyage_id=? ORDER BY id`).all(req.params.id));
});

// ── Laytime ───────────────────────────────────────────────────────────────────

router.post("/voyages/:id/laytime-events", requireLevel(42), (req, res) => {
  const u = req.user;
  const { port_type, event_type, event_time, duration_hours, is_excluded, exclusion_reason, notes } = req.body;
  if (!port_type || !event_type || !event_time)
    return res.status(400).json({ error: "port_type, event_type y event_time son obligatorios" });
  const r = db.prepare(
    `INSERT INTO laytime_events (voyage_id,port_type,event_type,event_time,duration_hours,is_excluded,exclusion_reason,notes,created_by)
     VALUES (?,?,?,?,?,?,?,?,?)`
  ).run(req.params.id,port_type,event_type,event_time,duration_hours||null,is_excluded?1:0,exclusion_reason||null,notes||null,u.username);
  res.status(201).json({ id: r.lastInsertRowid });
});

router.get("/voyages/:id/laytime-events", requireLevel(42), (req, res) => {
  res.json(db.prepare(`SELECT * FROM laytime_events WHERE voyage_id=? ORDER BY event_time`).all(req.params.id));
});

router.post("/voyages/:id/calculate-laytime", requireLevel(42), (req, res) => {
  const u = req.user;
  const vv = db.prepare(`SELECT * FROM vessel_voyages WHERE id=?`).get(req.params.id);
  if (!vv) return res.status(404).json({ error: "Viaje no encontrado" });
  const results = calculateLaytime(parseInt(req.params.id, 10));
  charterAudit(vv.fixture_id, vv.id, "LAYTIME_CALCULATED", u.username, u.role, null,
    results.map(r => ({ port_type: r.port_type, balance_hours: r.balance_hours,
      demurrage_amount: r.demurrage_amount, despatch_amount: r.despatch_amount })), null);
  res.json(results);
});

// ── Alerts ────────────────────────────────────────────────────────────────────

router.get("/alerts", requireLevel(40), (req, res) => {
  const { acknowledged } = req.query;
  let q = `SELECT ca.*, cf.fixture_number FROM charter_alerts ca
    LEFT JOIN charter_fixtures cf ON cf.id=ca.fixture_id WHERE 1=1`;
  const p = [];
  if (acknowledged !== undefined) { q += ` AND ca.acknowledged=?`; p.push(acknowledged === "true" ? 1 : 0); }
  q += ` ORDER BY ca.created_at DESC LIMIT 100`;
  res.json(db.prepare(q).all(...p));
});

router.patch("/alerts/:id/acknowledge", requireLevel(40), (req, res) => {
  const u = req.user;
  db.prepare(
    `UPDATE charter_alerts SET acknowledged=1,acknowledged_by=?,acknowledged_at=datetime('now') WHERE id=?`
  ).run(u.username, req.params.id);
  res.json({ ok: true });
});

// ── Dashboard ─────────────────────────────────────────────────────────────────

router.get("/dashboard/summary", requireLevel(40), (req, res) => {
  const u   = req.user;
  const lvl = roleLevel(u.role);
  if (u.role === "CLIENT" || u.role === "SUPPLIER")
    return res.status(403).json({ error: "Acceso denegado" });

  const today = new Date().toISOString().split("T")[0];
  const ACTIVE = ["PENDING","AT_LOAD_PORT","LOADING","LADEN","AT_DISCHARGE_PORT","DISCHARGING"];
  const placeholders = ACTIVE.map(() => "?").join(",");

  const activeVoyages    = db.prepare(`SELECT COUNT(*) AS n FROM vessel_voyages WHERE status IN (${placeholders})`).get(...ACTIVE);
  const atLoadPort       = db.prepare(`SELECT COUNT(*) AS n FROM vessel_voyages WHERE status IN ('AT_LOAD_PORT','LOADING')`).get();
  const ladenInTransit   = db.prepare(`SELECT COUNT(*) AS n FROM vessel_voyages WHERE status='LADEN'`).get();
  const atDischarge      = db.prepare(`SELECT COUNT(*) AS n FROM vessel_voyages WHERE status IN ('AT_DISCHARGE_PORT','DISCHARGING')`).get();
  const etaOverdue       = db.prepare(`SELECT COUNT(*) AS n FROM vessel_voyages WHERE pod_eta < ? AND status NOT IN ('COMPLETED','CANCELLED')`).get(today);
  const activeFixtures   = db.prepare(`SELECT COUNT(*) AS n FROM charter_fixtures WHERE status='FIXED'`).get();
  const openAlerts       = db.prepare(`SELECT COUNT(*) AS n FROM charter_alerts WHERE acknowledged=0`).get();
  const totalDemurrage   = db.prepare(
    `SELECT COALESCE(SUM(lc.demurrage_amount),0) AS total FROM laytime_calculations lc
     JOIN vessel_voyages vv ON vv.id=lc.voyage_id
     WHERE vv.status IN (${placeholders})`
  ).get(...ACTIVE);
  const upcomingLaycan = db.prepare(
    `SELECT fixture_number,laycan_start,laycan_end,loading_port FROM charter_fixtures
     WHERE laycan_start BETWEEN ? AND date(?,'+14 days') AND status NOT IN ('CANCELLED','COMPLETED')
     ORDER BY laycan_start LIMIT 10`
  ).all(today, today);

  res.json({
    active_voyages:      activeVoyages.n,
    at_load_port:        atLoadPort.n,
    laden_in_transit:    ladenInTransit.n,
    at_discharge_port:   atDischarge.n,
    eta_overdue:         etaOverdue.n,
    active_fixtures:     activeFixtures.n,
    open_alerts:         openAlerts.n,
    total_demurrage_usd: totalDemurrage.total,
    upcoming_laycan:     upcomingLaycan,
  });
});

module.exports = router;
