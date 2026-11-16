"use strict";
process.env.DB_PATH  = ":memory:";
process.env.NODE_ENV = "test";
const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const app  = require("../server");
const db   = require("../db/database");
const bcrypt = require("bcryptjs");

let adminCookie, logisticsCookie, clientCookie;
let calcId, confirmedCalcId;
let cargoTypeId, equipProfileId;

before(async () => {
  // Clean any stale test data in FK-safe order
  try { db.prepare("DELETE FROM cargo_audit").run(); } catch(_) {}
  try { db.prepare("DELETE FROM cargo_placements").run(); } catch(_) {}
  try { db.prepare("DELETE FROM cargo_lines").run(); } catch(_) {}
  try { db.prepare("DELETE FROM cargo_calculations").run(); } catch(_) {}
  try { db.prepare("DELETE FROM users WHERE username IN ('cargo_logistics_test','cargo_client_test')").run(); } catch(_) {}
  try { db.prepare("DELETE FROM clients WHERE name='Cargo Test Client'").run(); } catch(_) {}
  try { db.prepare("DELETE FROM users WHERE username='cargo_admin_test'").run(); } catch(_) {}

  const hash = await bcrypt.hash("Admin1234!", 10);

  db.prepare("INSERT INTO users (username,password,name,email,role,active) VALUES (?,?,?,?,?,1)")
    .run("cargo_admin_test", hash, "Cargo Admin", "cargo_admin@test.com", "SUPER_ADMIN");

  const adminUser = db.prepare("SELECT id FROM users WHERE username='cargo_admin_test'").get();
  const clientRow = db.prepare("INSERT INTO clients (name, type, created_by) VALUES (?,?,?)").run("Cargo Test Client","exporter",adminUser.id);
  const clientId  = clientRow.lastInsertRowid;

  db.prepare("INSERT INTO users (username,password,name,email,role,active) VALUES (?,?,?,?,?,1)")
    .run("cargo_logistics_test", hash, "Cargo Logistics", "cargo_log@test.com", "LOGISTICS");
  db.prepare("INSERT INTO users (username,password,name,email,role,linked_client_id,active) VALUES (?,?,?,?,?,?,1)")
    .run("cargo_client_test", hash, "Cargo Client", "cargo_cli@test.com", "CLIENT", clientId);

  const r1 = await request(app).post("/auth/login").send({ username:"cargo_admin_test",    password:"Admin1234!" });
  const r2 = await request(app).post("/auth/login").send({ username:"cargo_logistics_test",password:"Admin1234!" });
  const r3 = await request(app).post("/auth/login").send({ username:"cargo_client_test",   password:"Admin1234!" });

  assert.equal(r1.status, 200, "admin login");
  assert.equal(r2.status, 200, "logistics login");
  assert.equal(r3.status, 200, "client login");

  adminCookie     = (r1.headers["set-cookie"] || []).join("; ");
  logisticsCookie = (r2.headers["set-cookie"] || []).join("; ");
  clientCookie    = (r3.headers["set-cookie"] || []).join("; ");
});

after(() => {
  // cargo_audit → cargo_placements → cargo_lines → cargo_calculations
  // then users with linked_client_id first, then client, then admin user (FK order)
  try { db.prepare("DELETE FROM cargo_audit").run(); } catch(_) {}
  try { db.prepare("DELETE FROM cargo_placements").run(); } catch(_) {}
  try { db.prepare("DELETE FROM cargo_lines").run(); } catch(_) {}
  try { db.prepare("DELETE FROM cargo_calculations").run(); } catch(_) {}
  // cargo_client_test has linked_client_id → client, delete user first
  try { db.prepare("DELETE FROM users WHERE username IN ('cargo_logistics_test','cargo_client_test')").run(); } catch(_) {}
  // now no users reference the client via linked_client_id
  try { db.prepare("DELETE FROM clients WHERE name='Cargo Test Client'").run(); } catch(_) {}
  // now no clients reference cargo_admin_test via created_by
  try { db.prepare("DELETE FROM users WHERE username='cargo_admin_test'").run(); } catch(_) {}
});

// ── 1. Equipment Profiles ─────────────────────────────────────────────────────
describe("Cargo Intelligence - Equipment Profiles", () => {
  it("GET /cargo-intelligence/equipment-profiles → 200 with seeded profiles", async () => {
    const res = await request(app).get("/cargo-intelligence/equipment-profiles").set("Cookie", adminCookie);
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body));
    assert.ok(res.body.length >= 11);
    const codes = res.body.map(p => p.code);
    assert.ok(codes.includes("20GP"));
    assert.ok(codes.includes("40HC"));
    assert.ok(codes.includes("BULK_HOLD"));
    equipProfileId = res.body.find(p => p.code === "40HC").id;
  });

  it("GET /cargo-intelligence/equipment-profiles → 401 without auth", async () => {
    const res = await request(app).get("/cargo-intelligence/equipment-profiles");
    assert.equal(res.status, 401);
  });
});

// ── 2. Cargo Types ────────────────────────────────────────────────────────────
describe("Cargo Intelligence - Cargo Types", () => {
  it("GET /cargo-intelligence/cargo-types → 200 with seeded types", async () => {
    const res = await request(app).get("/cargo-intelligence/cargo-types").set("Cookie", adminCookie);
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body));
    assert.ok(res.body.length >= 12);
    const codes = res.body.map(t => t.code);
    assert.ok(codes.includes("PALLET"));
    assert.ok(codes.includes("BULK_GRAIN"));
    cargoTypeId = res.body.find(t => t.code === "PALLET").id;
  });
});

// ── 3. Create Calculation ─────────────────────────────────────────────────────
describe("Cargo Intelligence - Create Calculation", () => {
  it("POST /cargo-intelligence/calculations → 201 with valid data", async () => {
    const body = {
      reference: "TEST-CARGO-001",
      mode: "container",
      notes: "Integration test calculation",
      lines: [
        { cargo_type_id: cargoTypeId, description: "Test pallet", quantity: 10, length_m: 1.2, width_m: 0.8, height_m: 1.2, weight_kg: 500, stackable: false },
        { cargo_type_id: cargoTypeId, description: "Small box",   quantity: 20, length_m: 0.6, width_m: 0.4, height_m: 0.4, weight_kg: 50,  stackable: true },
      ],
    };
    const res = await request(app).post("/cargo-intelligence/calculations").set("Cookie", logisticsCookie).send(body);
    assert.equal(res.status, 201);
    assert.ok(res.body.id);
    calcId = res.body.id;
  });

  it("POST /cargo-intelligence/calculations → 400 missing reference", async () => {
    const res = await request(app).post("/cargo-intelligence/calculations").set("Cookie", logisticsCookie)
      .send({ mode:"container", lines:[] });
    assert.equal(res.status, 400);
  });

  it("POST /cargo-intelligence/calculations → 403 for CLIENT role", async () => {
    const res = await request(app).post("/cargo-intelligence/calculations").set("Cookie", clientCookie)
      .send({ reference:"TEST-CARGO-CLIENT", mode:"container", lines:[] });
    assert.equal(res.status, 403);
  });
});

// ── 4. Get Calculations ───────────────────────────────────────────────────────
describe("Cargo Intelligence - Get Calculations", () => {
  it("GET /cargo-intelligence/calculations → 200 list for logistics", async () => {
    const res = await request(app).get("/cargo-intelligence/calculations").set("Cookie", logisticsCookie);
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body));
    assert.ok(res.body.some(c => c.id === calcId));
  });

  it("GET /cargo-intelligence/calculations/:id → 200 with lines and placements", async () => {
    const res = await request(app).get(`/cargo-intelligence/calculations/${calcId}`).set("Cookie", logisticsCookie);
    assert.equal(res.status, 200);
    assert.equal(res.body.id, calcId);
    assert.ok(Array.isArray(res.body.lines));
    assert.equal(res.body.lines.length, 2);
    assert.equal(res.body.status, "DRAFT");
  });

  it("GET /cargo-intelligence/calculations/:id → 404 for non-existent id", async () => {
    const res = await request(app).get("/cargo-intelligence/calculations/999999").set("Cookie", adminCookie);
    assert.equal(res.status, 404);
  });
});

// ── 5. Compute ────────────────────────────────────────────────────────────────
describe("Cargo Intelligence - Compute", () => {
  it("POST /calculations/:id/compute → 200 with placement data", async () => {
    const res = await request(app).post(`/cargo-intelligence/calculations/${calcId}/compute`).set("Cookie", logisticsCookie);
    assert.equal(res.status, 200);
    assert.ok(typeof res.body.total_cbm === "number", "total_cbm should be number");
    assert.ok(res.body.total_cbm > 0, "total_cbm > 0");
    assert.ok(typeof res.body.total_weight_kg === "number");
    assert.ok(typeof res.body.equipment_count === "number");
    assert.ok(res.body.equipment_count >= 1);
    assert.ok(Array.isArray(res.body.placements));
  });

  it("GET /calculations/:id after compute → total_cbm populated", async () => {
    const res = await request(app).get(`/cargo-intelligence/calculations/${calcId}`).set("Cookie", logisticsCookie);
    assert.equal(res.status, 200);
    assert.ok(res.body.total_cbm > 0);
  });

  it("GET /calculations/:id/placements → placements array", async () => {
    const res = await request(app).get(`/cargo-intelligence/calculations/${calcId}/placements`).set("Cookie", logisticsCookie);
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body));
    assert.ok(res.body.length > 0);
    const p = res.body[0];
    assert.ok("x_m" in p && "y_m" in p && "z_m" in p);
  });
});

// ── 6. Confirm ────────────────────────────────────────────────────────────────
describe("Cargo Intelligence - Confirm", () => {
  it("POST /calculations/:id/confirm → 403 for CLIENT", async () => {
    const res = await request(app).post(`/cargo-intelligence/calculations/${calcId}/confirm`).set("Cookie", clientCookie);
    assert.equal(res.status, 403);
  });

  it("POST /calculations/:id/confirm → 200 for LOGISTICS", async () => {
    const res = await request(app).post(`/cargo-intelligence/calculations/${calcId}/confirm`).set("Cookie", logisticsCookie);
    assert.equal(res.status, 200);
    assert.ok(res.body.ok);
    confirmedCalcId = calcId;
  });

  it("GET /calculations/:id after confirm → status CONFIRMED", async () => {
    const res = await request(app).get(`/cargo-intelligence/calculations/${confirmedCalcId}`).set("Cookie", logisticsCookie);
    assert.equal(res.status, 200);
    assert.equal(res.body.status, "CONFIRMED");
  });

  it("POST /calculations/:id/confirm → 409 for already CONFIRMED", async () => {
    const res = await request(app).post(`/cargo-intelligence/calculations/${confirmedCalcId}/confirm`).set("Cookie", logisticsCookie);
    assert.equal(res.status, 409);
  });
});

// ── 7. New Version ────────────────────────────────────────────────────────────
describe("Cargo Intelligence - New Version", () => {
  it("POST /calculations/:id/new-version → 201 with new id", async () => {
    const res = await request(app).post(`/cargo-intelligence/calculations/${confirmedCalcId}/new-version`).set("Cookie", logisticsCookie);
    assert.equal(res.status, 201);
    assert.ok(res.body.id);
    assert.ok(res.body.id !== confirmedCalcId);
  });

  it("Original calculation → status SUPERSEDED", async () => {
    const res = await request(app).get(`/cargo-intelligence/calculations/${confirmedCalcId}`).set("Cookie", logisticsCookie);
    assert.equal(res.status, 200);
    assert.equal(res.body.status, "SUPERSEDED");
  });
});

// ── 8. Bulk Mode ──────────────────────────────────────────────────────────────
describe("Cargo Intelligence - Bulk Mode", () => {
  let bulkCalcId;

  it("POST /calculations bulk mode → 201", async () => {
    const grainType = db.prepare("SELECT id FROM cargo_types WHERE code='BULK_GRAIN'").get();
    const res = await request(app).post("/cargo-intelligence/calculations").set("Cookie", logisticsCookie)
      .send({
        reference: "TEST-CARGO-BULK-001",
        mode: "bulk",
        lines: [{ cargo_type_id: grainType.id, description:"Wheat", quantity:1, length_m:5, width_m:5, height_m:2, weight_kg:50000, stackable:false }],
      });
    assert.equal(res.status, 201);
    bulkCalcId = res.body.id;
  });

  it("POST /calculations/bulk/compute → 200 stowage_factor computed", async () => {
    const res = await request(app).post(`/cargo-intelligence/calculations/${bulkCalcId}/compute`).set("Cookie", logisticsCookie);
    assert.equal(res.status, 200);
    assert.ok(res.body.total_weight_kg > 0);
    assert.equal(res.body.equipment_count, 1);
  });
});
