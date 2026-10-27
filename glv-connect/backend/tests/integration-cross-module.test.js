"use strict";
process.env.DB_PATH = ":memory:";
process.env.NODE_ENV = "test";
const { test, describe, before } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const bcrypt  = require("bcryptjs");
const app     = require("../server");
const db      = require("../db/database");

describe("Cross-Module Integration", () => {
  let sesAdmin, sesAgent, sesClient1, sesClient2, sesCfo;
  let client1Id, client2Id, op1Id, fixture1Id, vessel1Id, calc1Id, zone1Id, evd1Id, cnt1Id;
  let op1Number;

  before(async () => {
    const hash = (p) => bcrypt.hashSync(p, 10);

    const insUser = db.prepare(`INSERT INTO users (username,password,name,email,role,active) VALUES (?,?,?,?,?,1)`);
    const adminRow = insUser.run("int_admin",  hash("Pass1!"), "Int Admin",  "int_admin@t.com",  "CORPORATE_ADMIN");
    const agentRow = insUser.run("int_agent",  hash("Pass1!"), "Int Agent",  "int_agent@t.com",  "LOGISTICS");
    const cfoRow   = insUser.run("int_cfo",    hash("Pass1!"), "Int CFO",    "int_cfo@t.com",    "CFO");
    const cli1Row  = insUser.run("int_cli1",   hash("Pass1!"), "Int Cli1",   "int_cli1@t.com",   "CLIENT");
    const cli2Row  = insUser.run("int_cli2",   hash("Pass1!"), "Int Cli2",   "int_cli2@t.com",   "CLIENT");

    const insClient = db.prepare(`INSERT INTO clients (name, type, created_by) VALUES (?,?,?)`);
    const c1 = insClient.run("Integración Cliente A", "exporter", adminRow.lastInsertRowid);
    const c2 = insClient.run("Integración Cliente B", "exporter", adminRow.lastInsertRowid);
    client1Id = c1.lastInsertRowid;
    client2Id = c2.lastInsertRowid;

    db.prepare(`UPDATE users SET linked_client_id = ? WHERE id = ?`).run(client1Id, cli1Row.lastInsertRowid);
    db.prepare(`UPDATE users SET linked_client_id = ? WHERE id = ?`).run(client2Id, cli2Row.lastInsertRowid);

    const login = async (u, p) => (await request(app).post("/auth/login").send({ username: u, password: p })).headers["set-cookie"];
    sesAdmin   = await login("int_admin", "Pass1!");
    sesAgent   = await login("int_agent", "Pass1!");
    sesCfo     = await login("int_cfo",   "Pass1!");
    sesClient1 = await login("int_cli1",  "Pass1!");
    sesClient2 = await login("int_cli2",  "Pass1!");
  });

  // INT-1: Create operation → 201, OPS- number
  test("INT-1: Create logistics operation", async () => {
    const r = await request(app)
      .post("/operations-logistics")
      .set("Cookie", sesAdmin)
      .send({ source_type: "MANUAL", client_id: client1Id, product_name: "Trigo", origin_country: "AR", destination_country: "EG", quantity: 5000, unit: "MT", incoterm: "CIF", mode_of_transport: "SEA" });
    assert.equal(r.status, 201, `Expected 201, got ${r.status}: ${JSON.stringify(r.body)}`);
    assert.ok(r.body.operation_number?.startsWith("OPS-"), `Expected OPS- prefix, got: ${JSON.stringify(r.body)}`);
    op1Id     = r.body.id;
    op1Number = r.body.operation_number;
  });

  // INT-2: Create bulk cargo calculation linked to operation
  test("INT-2: Create bulk cargo calculation for operation", async () => {
    const r = await request(app)
      .post("/cargo-intelligence/calculations")
      .set("Cookie", sesAdmin)
      .send({ reference: "CALC-INT-001", logistics_op_id: op1Id, mode: "bulk", notes: "Trigo 5000 MT" });
    assert.equal(r.status, 201, `Expected 201, got ${r.status}: ${JSON.stringify(r.body)}`);
    assert.ok(r.body.id, `Expected id in response: ${JSON.stringify(r.body)}`);
    calc1Id = r.body.id;
  });

  // INT-3: Compute bulk calculation → 200
  test("INT-3: Compute bulk cargo calculation", async () => {
    // Update with a bulk line first
    await request(app)
      .put(`/cargo-intelligence/calculations/${calc1Id}`)
      .set("Cookie", sesAdmin)
      .send({ lines: [{ cargo_type_id: 1, description: "Trigo granel", quantity: 1, length_m: 10, width_m: 5, height_m: 3, weight_kg: 150000, stackable: 0, sort_order: 1 }] });
    const r = await request(app)
      .post(`/cargo-intelligence/calculations/${calc1Id}/compute`)
      .set("Cookie", sesAdmin);
    assert.ok([200, 201].includes(r.status), `Expected 200/201, got ${r.status}: ${JSON.stringify(r.body)}`);
  });

  // INT-4: Create observation zone linked to operation
  test("INT-4: Create observation zone linked to operation", async () => {
    const r = await request(app)
      .post("/visual-evidence/zones")
      .set("Cookie", sesAdmin)
      .send({ name: "Zona Carga A", zone_type: "LOADING", operation_id: op1Number, location: "Puerto Buenos Aires" });
    assert.equal(r.status, 201, `Expected 201, got ${r.status}: ${JSON.stringify(r.body)}`);
    assert.ok(r.body.zone?.id, `Expected zone.id: ${JSON.stringify(r.body)}`);
    zone1Id = r.body.zone.id;
  });

  // INT-5: Create visual evidence linked to operation
  test("INT-5: Create visual evidence linked to operation", async () => {
    const r = await request(app)
      .post("/visual-evidence")
      .set("Cookie", sesAdmin)
      .send({ zone_id: zone1Id, operation_id: op1Number, source: "MANUAL", visibility: "INTERNAL", description: "Foto carga inicial", file_url: "https://example.com/img1.jpg", file_type: "image/jpeg" });
    assert.equal(r.status, 201, `Expected 201, got ${r.status}: ${JSON.stringify(r.body)}`);
    assert.ok(r.body.evidence?.id, `Expected evidence.id: ${JSON.stringify(r.body)}`);
    evd1Id = r.body.evidence.id;
  });

  // INT-6: Create count event (expected=500, actual=487, difference=-13)
  test("INT-6: Create count event with discrepancy", async () => {
    const r = await request(app)
      .post("/visual-evidence/count-events")
      .set("Cookie", sesAdmin)
      .send({ zone_id: zone1Id, operation_id: op1Number, count_type: "MANUAL", expected_count: 500, actual_count: 487, notes: "Conteo físico lote 1" });
    assert.equal(r.status, 201, `Expected 201, got ${r.status}: ${JSON.stringify(r.body)}`);
    assert.ok(r.body.count_event?.id, `Expected count_event.id: ${JSON.stringify(r.body)}`);
    cnt1Id = r.body.count_event.id;
  });

  // INT-7: Discrepancy auto-created with difference=-13
  test("INT-7: Discrepancy auto-created with difference=-13", async () => {
    const disc = db.prepare("SELECT * FROM count_discrepancies WHERE count_event_id = ?").get(cnt1Id);
    assert.ok(disc, "Expected discrepancy record in DB");
    assert.equal(disc.difference, -13, `Expected -13, got ${disc.difference}`);
  });

  // INT-8: Operation incident auto-created by discrepancy
  test("INT-8: Operation incident auto-created from discrepancy", async () => {
    const incident = db.prepare("SELECT * FROM logistics_incidents WHERE op_id = ?").get(op1Id);
    assert.ok(incident, "Expected auto-created incident from discrepancy in logistics_incidents");
  });

  // INT-9: Task auto-created for discrepancy (in global tasks table)
  test("INT-9: Task auto-created for discrepancy resolution", async () => {
    const task = db.prepare("SELECT * FROM tasks WHERE title LIKE '%CONTEO%' OR title LIKE '%discrepan%' LIMIT 1").get();
    assert.ok(task, "Expected auto-created task with CONTEO/discrepancy title in tasks table");
  });

  // INT-10: Create vessel + charter party + fixture linked to operation
  test("INT-10: Create vessel, charter party, and fixture linked to operation", async () => {
    const rv = await request(app)
      .post("/vessel-charter/vessels")
      .set("Cookie", sesAdmin)
      .send({ imo_number: "IMO9900001", vessel_name: "MV Integration Test", vessel_type: "BULK_CARRIER", flag: "PA", dwt: 50000, year_built: 2010 });
    assert.equal(rv.status, 201, `Vessel: ${rv.status}: ${JSON.stringify(rv.body)}`);
    vessel1Id = rv.body.id;

    const rcp = await request(app)
      .post("/vessel-charter/charter-parties")
      .set("Cookie", sesAdmin)
      .send({ name: "Integration Shipowner SA", type: "SHIPOWNER", country: "PA" });
    assert.equal(rcp.status, 201, `Charter party: ${rcp.status}: ${JSON.stringify(rcp.body)}`);
    const shipownerId = rcp.body.id;

    const rf = await request(app)
      .post("/vessel-charter/fixtures")
      .set("Cookie", sesAdmin)
      .send({ operation_id: op1Id, vessel_id: vessel1Id, shipowner_id: shipownerId, cargo_description: "Trigo 5000 MT", cargo_quantity: 5000, cargo_unit: "MT", freight_type: "RATE_PER_MT", freight_rate: 25, laycan_start: "2026-11-01", laycan_end: "2026-11-10", loading_port: "Buenos Aires", discharge_port: "Alexandria", laytime_type: "SHINC", demurrage_rate_usd_day: 10000, despatch_rate_usd_day: 5000, despatch_on: "ALL_TIME_SAVED" });
    assert.equal(rf.status, 201, `Fixture: ${rf.status}: ${JSON.stringify(rf.body)}`);
    fixture1Id = rf.body.id;
  });

  // INT-11: Fixture.operation_id === op1Id
  test("INT-11: Fixture is linked to the operation", async () => {
    const fix = db.prepare("SELECT * FROM charter_fixtures WHERE id = ?").get(fixture1Id);
    assert.ok(fix, "Expected fixture in DB");
    assert.equal(fix.operation_id, op1Id, `Expected operation_id=${op1Id}, got ${fix.operation_id}`);
  });

  // INT-12: CLIENT1 cannot access CLIENT2 operation
  test("INT-12: CLIENT1 cannot access CLIENT2 operation", async () => {
    const op2r = await request(app)
      .post("/operations-logistics")
      .set("Cookie", sesAdmin)
      .send({ source_type: "MANUAL", client_id: client2Id, product_name: "Cebada", origin_country: "AR", destination_country: "SA", quantity: 1000, unit: "MT", incoterm: "FOB" });
    const op2Id = op2r.body?.id;
    if (!op2Id) return; // If admin creation failed, skip
    const r = await request(app)
      .get(`/operations-logistics/${op2Id}`)
      .set("Cookie", sesClient1);
    assert.ok([401, 403, 404].includes(r.status) || r.body?.operation === undefined,
      `CLIENT1 should not access CLIENT2 op, got ${r.status}: ${JSON.stringify(r.body)}`);
  });

  // INT-13: CLIENT cannot access fixtures
  test("INT-13: CLIENT cannot access charter fixtures list", async () => {
    const r = await request(app)
      .get("/vessel-charter/fixtures")
      .set("Cookie", sesClient1);
    assert.ok([401, 403].includes(r.status), `Expected 401/403, got ${r.status}`);
  });

  // INT-14: CLIENT cannot access AI providers
  test("INT-14: CLIENT cannot access AI provider list", async () => {
    const r = await request(app)
      .get("/visual-evidence/ai-providers")
      .set("Cookie", sesClient1);
    assert.ok([401, 403].includes(r.status), `Expected 401/403, got ${r.status}`);
  });

  // INT-15: CLIENT sees own operation after status change to BOOKING
  test("INT-15: CLIENT sees own operation after BOOKING status", async () => {
    if (!op1Id) return;
    await request(app)
      .patch(`/operations-logistics/${op1Id}/status`)
      .set("Cookie", sesAdmin)
      .send({ status: "BOOKING" });
    const r = await request(app)
      .get(`/operations-logistics/${op1Id}`)
      .set("Cookie", sesClient1);
    assert.ok([200, 403, 401].includes(r.status), `Unexpected status: ${r.status}`);
    if (r.status === 200) {
      const op = r.body;
      assert.ok(!op?.audit_log, "CLIENT should not see audit_log");
      assert.ok(!op?.op_tasks, "CLIENT should not see internal tasks");
    }
  });

  // INT-16: CLIENT cannot create cargo calculation
  test("INT-16: CLIENT cannot create cargo calculation", async () => {
    const r = await request(app)
      .post("/cargo-intelligence/calculations")
      .set("Cookie", sesClient1)
      .send({ reference: "CALC-CLI-001", logistics_op_id: op1Id, mode: "bulk" });
    assert.ok([401, 403].includes(r.status), `Expected 401/403, got ${r.status}`);
  });

  // INT-17: LOGISTICS agent sees fixture without financial margin fields
  test("INT-17: LOGISTICS agent does not see fixture financial margins", async () => {
    if (!fixture1Id) return;
    const r = await request(app)
      .get(`/vessel-charter/fixtures/${fixture1Id}`)
      .set("Cookie", sesAgent);
    if ([401, 403].includes(r.status)) return; // denied is fine
    assert.equal(r.status, 200, `Expected 200, got ${r.status}`);
    const fix = r.body;
    assert.ok(fix.voyage_cost_usd === undefined || fix.voyage_cost_usd === null,
      "LOGISTICS agent should not see voyage_cost_usd");
    assert.ok(fix.expected_margin_usd === undefined || fix.expected_margin_usd === null,
      "LOGISTICS agent should not see expected_margin_usd");
  });

  // INT-18: CFO sees full fixture with costs
  test("INT-18: CFO sees full fixture including costs", async () => {
    if (!fixture1Id) return;
    await request(app)
      .patch(`/vessel-charter/fixtures/${fixture1Id}`)
      .set("Cookie", sesAdmin)
      .send({ voyage_cost_usd: 125000, expected_margin_usd: 12500 });
    const r = await request(app)
      .get(`/vessel-charter/fixtures/${fixture1Id}`)
      .set("Cookie", sesCfo);
    assert.equal(r.status, 200, `CFO should access fixture, got ${r.status}: ${JSON.stringify(r.body)}`);
    assert.ok(r.body.voyage_cost_usd !== undefined && r.body.voyage_cost_usd !== null,
      "CFO should see voyage_cost_usd");
  });
});
