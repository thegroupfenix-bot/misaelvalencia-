"use strict";
const express = require("express");
const router  = express.Router();
const db      = require("../db/database");
const { authenticate }          = require("../middleware/auth");
const { requireLevel, ROLE_LEVEL } = require("../middleware/rbac");

function roleLevel(role) { return ROLE_LEVEL[role] || 0; }
router.use(authenticate);

// ── Equipment Profiles ────────────────────────────────────────────────────────
router.get("/equipment-profiles", requireLevel(20), (req, res) => {
  const rows = db.prepare(
    "SELECT * FROM cargo_equipment_profiles WHERE active=1 ORDER BY type, code"
  ).all();
  res.json(rows);
});

// ── Cargo Types ───────────────────────────────────────────────────────────────
router.get("/cargo-types", requireLevel(20), (req, res) => {
  const rows = db.prepare(
    "SELECT * FROM cargo_types WHERE active=1 ORDER BY category, code"
  ).all();
  res.json(rows);
});

// ── Calculations ──────────────────────────────────────────────────────────────
router.get("/calculations", requireLevel(20), (req, res) => {
  const user = req.user;
  const lvl  = roleLevel(user.role);
  let rows;
  if (lvl >= 40) {
    rows = db.prepare(
      "SELECT c.*, u.name AS creator_name FROM cargo_calculations c LEFT JOIN users u ON c.created_by=u.id ORDER BY c.created_at DESC"
    ).all();
  } else {
    rows = db.prepare(
      "SELECT c.*, u.name AS creator_name FROM cargo_calculations c LEFT JOIN users u ON c.created_by=u.id WHERE c.client_id=? ORDER BY c.created_at DESC"
    ).all(user.linked_client_id);
  }
  res.json(rows);
});

router.get("/calculations/:id", requireLevel(20), (req, res) => {
  const calc = db.prepare(
    "SELECT c.*, u.name AS creator_name FROM cargo_calculations c LEFT JOIN users u ON c.created_by=u.id WHERE c.id=?"
  ).get(req.params.id);
  if (!calc) return res.status(404).json({ error: "Not found" });

  const user = req.user;
  const lvl  = roleLevel(user.role);
  if (lvl < 40 && calc.client_id !== user.linked_client_id) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const lines = db.prepare(
    "SELECT l.*, t.code AS cargo_type_code, t.name AS cargo_type_name, t.category FROM cargo_lines l JOIN cargo_types t ON l.cargo_type_id=t.id WHERE l.calculation_id=? ORDER BY l.sort_order"
  ).all(calc.id);

  const placements = db.prepare(
    "SELECT p.*, ep.code AS equip_code, ep.name AS equip_name, ep.int_length_m, ep.int_width_m, ep.int_height_m FROM cargo_placements p JOIN cargo_equipment_profiles ep ON p.equipment_profile_id=ep.id WHERE p.calculation_id=?"
  ).all(calc.id);

  const showCost = lvl >= 60;
  res.json({ ...calc, lines, placements, show_cost: showCost });
});

router.post("/calculations", requireLevel(40), (req, res) => {
  const { reference, logistics_op_id, charter_fixture_id, mode, notes, client_id, lines = [] } = req.body;
  if (!reference || !mode) return res.status(400).json({ error: "reference and mode are required" });
  if (!["container","bulk"].includes(mode)) return res.status(400).json({ error: "Invalid mode" });

  const tx = db.transaction(() => {
    const result = db.prepare(
      "INSERT INTO cargo_calculations (reference,logistics_op_id,charter_fixture_id,mode,notes,created_by,client_id) VALUES (?,?,?,?,?,?,?)"
    ).run(reference, logistics_op_id || null, charter_fixture_id || null, mode, notes || null, req.user.id, client_id || null);

    const calcId = result.lastInsertRowid;

    const insLine = db.prepare(
      "INSERT INTO cargo_lines (calculation_id,cargo_type_id,description,quantity,length_m,width_m,height_m,weight_kg,stackable,sort_order) VALUES (?,?,?,?,?,?,?,?,?,?)"
    );
    lines.forEach((l, idx) => {
      insLine.run(calcId, l.cargo_type_id, l.description || null, l.quantity || 1, l.length_m, l.width_m, l.height_m, l.weight_kg, l.stackable ? 1 : 0, idx);
    });

    db.prepare(
      "INSERT INTO cargo_audit (calculation_id,action,actor_id,delta_json) VALUES (?,?,?,?)"
    ).run(calcId, "CREATED", req.user.id, JSON.stringify({ reference, mode }));

    return calcId;
  });

  const calcId = tx();
  res.status(201).json({ id: calcId });
});

router.put("/calculations/:id", requireLevel(40), (req, res) => {
  const calc = db.prepare("SELECT * FROM cargo_calculations WHERE id=?").get(req.params.id);
  if (!calc) return res.status(404).json({ error: "Not found" });
  if (calc.status !== "DRAFT") return res.status(409).json({ error: "Only DRAFT calculations can be edited" });

  const { reference, notes, lines } = req.body;
  db.prepare("UPDATE cargo_calculations SET reference=COALESCE(?,reference), notes=COALESCE(?,notes) WHERE id=?")
    .run(reference || null, notes || null, calc.id);

  if (Array.isArray(lines)) {
    db.prepare("DELETE FROM cargo_lines WHERE calculation_id=?").run(calc.id);
    const insLine = db.prepare(
      "INSERT INTO cargo_lines (calculation_id,cargo_type_id,description,quantity,length_m,width_m,height_m,weight_kg,stackable,sort_order) VALUES (?,?,?,?,?,?,?,?,?,?)"
    );
    lines.forEach((l, idx) => {
      insLine.run(calc.id, l.cargo_type_id, l.description || null, l.quantity || 1, l.length_m, l.width_m, l.height_m, l.weight_kg, l.stackable ? 1 : 0, idx);
    });
  }

  db.prepare("INSERT INTO cargo_audit (calculation_id,action,actor_id) VALUES (?,?,?)")
    .run(calc.id, "UPDATED", req.user.id);

  res.json({ ok: true });
});

// ── Compute (backend bin-packing) ─────────────────────────────────────────────
router.post("/calculations/:id/compute", requireLevel(40), (req, res) => {
  const calc = db.prepare("SELECT * FROM cargo_calculations WHERE id=?").get(req.params.id);
  if (!calc) return res.status(404).json({ error: "Not found" });
  if (calc.status !== "DRAFT") return res.status(409).json({ error: "Only DRAFT calculations can be computed" });

  const lines = db.prepare(
    "SELECT l.*, t.category FROM cargo_lines l JOIN cargo_types t ON l.cargo_type_id=t.id WHERE l.calculation_id=? ORDER BY l.sort_order"
  ).all(calc.id);

  if (!lines.length) return res.status(400).json({ error: "No cargo lines to compute" });

  let result;
  if (calc.mode === "bulk") {
    result = computeBulk(calc, lines);
  } else {
    result = computeContainers(calc, lines);
  }

  db.prepare(
    "UPDATE cargo_calculations SET total_cbm=?, total_weight_kg=?, equipment_count=?, stowage_factor=? WHERE id=?"
  ).run(result.total_cbm, result.total_weight_kg, result.equipment_count, result.stowage_factor, calc.id);

  db.prepare("DELETE FROM cargo_placements WHERE calculation_id=?").run(calc.id);
  if (result.placements.length) {
    const ins = db.prepare(
      "INSERT INTO cargo_placements (calculation_id,equipment_profile_id,equipment_index,cargo_line_id,piece_index,x_m,y_m,z_m,rotated) VALUES (?,?,?,?,?,?,?,?,?)"
    );
    result.placements.forEach(p => ins.run(
      calc.id, p.equipment_profile_id, p.equipment_index,
      p.cargo_line_id, p.piece_index, p.x_m, p.y_m, p.z_m, p.rotated ? 1 : 0
    ));
  }

  db.prepare("INSERT INTO cargo_audit (calculation_id,action,actor_id,delta_json) VALUES (?,?,?,?)")
    .run(calc.id, "COMPUTED", req.user.id, JSON.stringify({ total_cbm: result.total_cbm, equipment_count: result.equipment_count }));

  res.json(result);
});

// ── Confirm ────────────────────────────────────────────────────────────────────
router.post("/calculations/:id/confirm", requireLevel(45), (req, res) => {
  const calc = db.prepare("SELECT * FROM cargo_calculations WHERE id=?").get(req.params.id);
  if (!calc) return res.status(404).json({ error: "Not found" });
  if (calc.status !== "DRAFT") return res.status(409).json({ error: "Only DRAFT calculations can be confirmed" });
  if (!calc.total_cbm) return res.status(400).json({ error: "Run compute before confirming" });

  db.prepare("UPDATE cargo_calculations SET status='CONFIRMED', confirmed_at=datetime('now'), confirmed_by=? WHERE id=?")
    .run(req.user.id, calc.id);
  db.prepare("INSERT INTO cargo_audit (calculation_id,action,actor_id) VALUES (?,?,?)")
    .run(calc.id, "CONFIRMED", req.user.id);

  res.json({ ok: true });
});

// ── New Version ────────────────────────────────────────────────────────────────
router.post("/calculations/:id/new-version", requireLevel(40), (req, res) => {
  const calc = db.prepare("SELECT * FROM cargo_calculations WHERE id=?").get(req.params.id);
  if (!calc) return res.status(404).json({ error: "Not found" });
  if (calc.status !== "CONFIRMED") return res.status(409).json({ error: "Only CONFIRMED calculations can be versioned" });

  const lines = db.prepare("SELECT * FROM cargo_lines WHERE calculation_id=?").all(calc.id);

  const tx = db.transaction(() => {
    const newRef = `${calc.reference}-v${calc.version + 1}`;
    const result = db.prepare(
      "INSERT INTO cargo_calculations (reference,logistics_op_id,charter_fixture_id,mode,notes,created_by,client_id,version,parent_id) VALUES (?,?,?,?,?,?,?,?,?)"
    ).run(newRef, calc.logistics_op_id, calc.charter_fixture_id, calc.mode, calc.notes, req.user.id, calc.client_id, calc.version + 1, calc.id);

    const newId = result.lastInsertRowid;
    const insLine = db.prepare(
      "INSERT INTO cargo_lines (calculation_id,cargo_type_id,description,quantity,length_m,width_m,height_m,weight_kg,stackable,sort_order) VALUES (?,?,?,?,?,?,?,?,?,?)"
    );
    lines.forEach(l => insLine.run(newId, l.cargo_type_id, l.description, l.quantity, l.length_m, l.width_m, l.height_m, l.weight_kg, l.stackable, l.sort_order));

    db.prepare("UPDATE cargo_calculations SET status='SUPERSEDED' WHERE id=?").run(calc.id);
    db.prepare("INSERT INTO cargo_audit (calculation_id,action,actor_id,delta_json) VALUES (?,?,?,?)")
      .run(newId, "NEW_VERSION", req.user.id, JSON.stringify({ parent_id: calc.id }));

    return newId;
  });

  res.status(201).json({ id: tx() });
});

// ── Placements (for viz) ──────────────────────────────────────────────────────
router.get("/calculations/:id/placements", requireLevel(20), (req, res) => {
  const calc = db.prepare("SELECT * FROM cargo_calculations WHERE id=?").get(req.params.id);
  if (!calc) return res.status(404).json({ error: "Not found" });

  const user = req.user;
  if (roleLevel(user.role) < 40 && calc.client_id !== user.linked_client_id) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const placements = db.prepare(
    `SELECT p.*, ep.code AS equip_code, ep.name AS equip_name,
       ep.int_length_m, ep.int_width_m, ep.int_height_m,
       l.length_m AS cargo_l, l.width_m AS cargo_w, l.height_m AS cargo_h,
       t.name AS cargo_type_name
     FROM cargo_placements p
     JOIN cargo_equipment_profiles ep ON p.equipment_profile_id=ep.id
     JOIN cargo_lines l ON p.cargo_line_id=l.id
     JOIN cargo_types t ON l.cargo_type_id=t.id
     WHERE p.calculation_id=?
     ORDER BY p.equipment_index, p.piece_index`
  ).all(calc.id);

  res.json(placements);
});

// ── Internal: Bin-Packing Engine ──────────────────────────────────────────────

function computeContainers(calc, lines) {
  const equipProfiles = db.prepare(
    "SELECT * FROM cargo_equipment_profiles WHERE type IN ('container','truck') AND active=1 ORDER BY int_length_m DESC"
  ).all();

  const profile = equipProfiles.find(e => e.code === "40HC") || equipProfiles[0];
  if (!profile) return { total_cbm: 0, total_weight_kg: 0, equipment_count: 0, stowage_factor: null, placements: [] };

  const pieces = [];
  lines.forEach(line => {
    for (let i = 0; i < line.quantity; i++) {
      pieces.push({
        cargo_line_id: line.id,
        l: line.length_m, w: line.width_m, h: line.height_m,
        weight_kg: line.weight_kg,
        stackable: line.stackable,
      });
    }
  });

  pieces.sort((a, b) => (b.l * b.w * b.h) - (a.l * a.w * a.h));

  const containers = [];
  const allPlacements = [];

  for (const piece of pieces) {
    let placed = false;
    for (let ci = 0; ci < containers.length && !placed; ci++) {
      const c = containers[ci];
      const placement = tryFitLayer(c, piece, profile);
      if (placement) {
        c.usedWeight += piece.weight_kg;
        c.placements.push(placement);
        allPlacements.push({ ...placement, equipment_index: ci + 1, cargo_line_id: piece.cargo_line_id });
        placed = true;
      }
    }
    if (!placed) {
      const nc = { usedWeight: 0, layers: [], placements: [] };
      containers.push(nc);
      const placement = fitNewLayer(nc, piece, profile);
      nc.usedWeight += piece.weight_kg;
      nc.placements.push(placement);
      allPlacements.push({ ...placement, equipment_index: containers.length, cargo_line_id: piece.cargo_line_id });
    }
  }

  const total_cbm = pieces.reduce((s, p) => s + p.l * p.w * p.h, 0);
  const total_weight_kg = pieces.reduce((s, p) => s + p.weight_kg, 0);
  const equipment_count = containers.length;
  const containerVol = profile.int_length_m * profile.int_width_m * profile.int_height_m;
  const stowage_factor = equipment_count > 0 ? (equipment_count * containerVol) / (total_weight_kg / 1000) : null;

  return {
    total_cbm: Math.round(total_cbm * 1000) / 1000,
    total_weight_kg: Math.round(total_weight_kg * 10) / 10,
    equipment_count,
    stowage_factor: stowage_factor ? Math.round(stowage_factor * 100) / 100 : null,
    placements: allPlacements.map((p, idx) => ({
      ...p,
      equipment_profile_id: profile.id,
      piece_index: idx + 1,
    })),
  };
}

function tryFitLayer(container, piece, profile) {
  const layers = container.layers;
  let z = 0;
  for (const layer of layers) {
    const fits = piece.l <= profile.int_length_m - layer.usedX || piece.w <= profile.int_width_m - layer.usedY;
    if (fits && z + piece.h <= profile.int_height_m && container.usedWeight + piece.weight_kg <= profile.max_weight_kg) {
      const x = layer.usedX;
      const y = layer.usedY;
      layer.usedX += piece.l;
      if (piece.w > layer.maxW) layer.maxW = piece.w;
      return { x_m: x, y_m: y, z_m: z, rotated: 0 };
    }
    z += layer.h;
  }
  return null;
}

function fitNewLayer(container, piece, profile) {
  const z = container.layers.reduce((s, l) => s + l.h, 0);
  const layer = { usedX: piece.l, usedY: 0, maxW: piece.w, h: piece.h };
  container.layers.push(layer);
  return { x_m: 0, y_m: 0, z_m: z, rotated: 0 };
}

function computeBulk(calc, lines) {
  const bulkProfiles = db.prepare(
    "SELECT * FROM cargo_equipment_profiles WHERE type='bulk' AND active=1"
  ).all();

  const profile = bulkProfiles[0];
  const total_weight_kg = lines.reduce((s, l) => s + l.weight_kg * l.quantity, 0);
  const total_cbm = lines.reduce((s, l) => s + l.length_m * l.width_m * l.height_m * l.quantity, 0);

  let stowage_factor = null;
  let equipment_count = 1;
  if (profile && total_weight_kg > 0) {
    stowage_factor = (profile.int_length_m * profile.int_width_m * profile.int_height_m) / (total_weight_kg / 1000);
    equipment_count = Math.ceil(total_cbm / (profile.int_length_m * profile.int_width_m * profile.int_height_m));
  }

  return {
    total_cbm: Math.round(total_cbm * 1000) / 1000,
    total_weight_kg: Math.round(total_weight_kg * 10) / 10,
    equipment_count,
    stowage_factor: stowage_factor ? Math.round(stowage_factor * 100) / 100 : null,
    placements: profile ? lines.map((l, i) => ({
      equipment_profile_id: profile.id,
      equipment_index: 1,
      cargo_line_id: l.id,
      piece_index: i + 1,
      x_m: 0, y_m: 0, z_m: 0, rotated: 0,
    })) : [],
  };
}

module.exports = router;
