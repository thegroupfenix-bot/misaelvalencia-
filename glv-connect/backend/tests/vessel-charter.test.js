"use strict";

process.env.DB_PATH    = ":memory:";
process.env.JWT_SECRET = "test-vessel-charter-secret-32bytes!!";
process.env.NODE_ENV   = "test";

const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const app = require("../server");
const db  = require("../db/database");

// ── Test users ─────────────────────────────────────────────────────────────────
const ADMIN_USER  = { username: "vc_admin_test",     password: "Admin1234!" };
const CFO_USER    = { username: "vc_cfo_test",       password: "Admin1234!" };
const LOG_USER    = { username: "vc_logistics_test", password: "Admin1234!" };
const CLIENT_USER = { username: "vc_client_test",    password: "Admin1234!" };

let sesAdmin, sesCFO, sesLog, sesClient;
let vesselId, partyId, fixtureId, voyageId1, voyageId2, alertId;

function getCookies(res) {
  return (res.headers["set-cookie"] || []).join("; ");
}

async function login(username, password) {
  const r = await request(app).post("/auth/login").send({ username, password });
  assert.equal(r.status, 200, `login ${username} failed: ${JSON.stringify(r.body)}`);
  return getCookies(r);
}

before(async () => {
  const bcrypt = require("bcryptjs");
  const hash   = await bcrypt.hash("Admin1234!", 10);

  const users = [
    [ADMIN_USER.username,  hash, "vc_admin@test.com",    "SUPER_ADMIN", "VC Admin Test"],
    [CFO_USER.username,    hash, "vc_cfo@test.com",      "CFO",         "VC CFO Test"],
    [LOG_USER.username,    hash, "vc_log@test.com",      "LOGISTICS",   "VC Logistics Test"],
    [CLIENT_USER.username, hash, "vc_client@test.com",   "CLIENT",      "VC Client Test"],
  ];

  for (const [uname, h, email, role, name] of users) {
    const row = db.prepare("SELECT id FROM users WHERE username=?").get(uname);
    if (!row) {
      db.prepare("INSERT INTO users (username,password,name,email,role,active) VALUES (?,?,?,?,?,1)").run(uname,h,name,email,role);
    } else {
      db.prepare("UPDATE users SET role=?,active=1 WHERE username=?").run(role,uname);
    }
  }

  sesAdmin  = await login(ADMIN_USER.username,  ADMIN_USER.password);
  sesCFO    = await login(CFO_USER.username,    CFO_USER.password);
  sesLog    = await login(LOG_USER.username,    LOG_USER.password);
  sesClient = await login(CLIENT_USER.username, CLIENT_USER.password);
});

after(() => {
  for (const u of [ADMIN_USER.username, CFO_USER.username, LOG_USER.username, CLIENT_USER.username]) {
    try { db.prepare("DELETE FROM users WHERE username=?").run(u); } catch (_) {}
  }
});

describe("Vessel Charter & Chartering Core", () => {
  // ── Vessels ──────────────────────────────────────────────────────────────────

  it("POST /vessel-charter/vessels — creates vessel with unique IMO", async () => {
    const r = await request(app).post("/vessel-charter/vessels")
      .set("Cookie", sesLog)
      .send({
        imo_number: "IMO9876543",
        vessel_name: "MV Test Grain",
        vessel_type: "BULK_CARRIER",
        flag: "PA",
        year_built: 2010,
        dwt: 75000,
        grt: 42000,
        classification_society: "Bureau Veritas",
      });
    assert.equal(r.status, 201);
    assert.ok(r.body.id);
    vesselId = r.body.id;
  });

  it("POST /vessel-charter/vessels — 409 on duplicate IMO", async () => {
    const r = await request(app).post("/vessel-charter/vessels")
      .set("Cookie", sesLog)
      .send({ imo_number: "IMO9876543", vessel_name: "Duplicate", vessel_type: "TANKER" });
    assert.equal(r.status, 409);
  });

  it("GET /vessel-charter/vessels — lists vessels", async () => {
    const r = await request(app).get("/vessel-charter/vessels").set("Cookie", sesAdmin);
    assert.equal(r.status, 200);
    assert.ok(Array.isArray(r.body));
    assert.ok(r.body.length >= 1);
  });

  it("PATCH /vessel-charter/vessels/:id — updates vessel", async () => {
    const r = await request(app).patch(`/vessel-charter/vessels/${vesselId}`)
      .set("Cookie", sesLog).send({ flag: "LR", class_expiry: "2027-12-31" });
    assert.equal(r.status, 200);
    assert.ok(r.body.ok);
  });

  it("POST /vessel-charter/vessels/:id/documents — adds vessel document", async () => {
    const r = await request(app).post(`/vessel-charter/vessels/${vesselId}/documents`)
      .set("Cookie", sesLog)
      .send({ doc_type: "COF", doc_number: "COF-2024-001", expiry_date: "2026-06-30" });
    assert.equal(r.status, 201);
    assert.ok(r.body.id);
  });

  it("GET /vessel-charter/vessels/:id/documents — lists documents", async () => {
    const r = await request(app).get(`/vessel-charter/vessels/${vesselId}/documents`).set("Cookie", sesLog);
    assert.equal(r.status, 200);
    assert.ok(r.body.length >= 1);
  });

  // ── Charter Parties ───────────────────────────────────────────────────────────

  it("GET /vessel-charter/charter-parties — lists seeded parties", async () => {
    const r = await request(app).get("/vessel-charter/charter-parties").set("Cookie", sesLog);
    assert.equal(r.status, 200);
    assert.ok(Array.isArray(r.body));
    assert.ok(r.body.length >= 3, "Should have seeded parties");
    partyId = r.body[0].id;
  });

  it("POST /vessel-charter/charter-parties — creates new party", async () => {
    const r = await request(app).post("/vessel-charter/charter-parties")
      .set("Cookie", sesLog)
      .send({ name: "Test Grain Trader SA", type: "OPERATOR", country: "CH" });
    assert.equal(r.status, 201);
    assert.ok(r.body.id);
  });

  it("GET /vessel-charter/charter-parties — CLIENT gets 403", async () => {
    const r = await request(app).get("/vessel-charter/charter-parties").set("Cookie", sesClient);
    assert.equal(r.status, 403);
  });

  // ── Fixtures ──────────────────────────────────────────────────────────────────

  it("POST /vessel-charter/fixtures — creates fixture with FIX-YYYY-NNNN number", async () => {
    const r = await request(app).post("/vessel-charter/fixtures")
      .set("Cookie", sesAdmin)
      .send({
        vessel_id: vesselId,
        shipowner_id: partyId,
        cargo_description: "Maíz granel",
        cargo_quantity: 50000,
        cargo_unit: "MT",
        freight_type: "FLAT_RATE",
        freight_rate: 32.5,
        freight_currency: "USD",
        loading_port: "Puerto Rosario, Argentina",
        discharge_port: "Puerto Valencia, España",
        laycan_start: "2026-11-01",
        laycan_end: "2026-11-10",
        cancelling_date: "2026-11-10",
        loading_rate_mt_day: 5000,
        discharging_rate_mt_day: 4000,
        laytime_type: "SHINC",
        demurrage_rate_usd_day: 12000,
        despatch_rate_usd_day: 6000,
        despatch_on: "ALL_TIME_SAVED",
        commission_pct: 1.25,
        voyage_cost_usd: 850000,
        expected_margin_usd: 150000,
      });
    assert.equal(r.status, 201);
    assert.ok(r.body.id);
    assert.ok(/^FIX-\d{4}-\d{4}$/.test(r.body.fixture_number));
    fixtureId = r.body.id;
  });

  it("GET /vessel-charter/fixtures — lists fixtures (admin sees all fields)", async () => {
    const r = await request(app).get("/vessel-charter/fixtures").set("Cookie", sesAdmin);
    assert.equal(r.status, 200);
    assert.ok(r.body.length >= 1);
  });

  it("GET /vessel-charter/fixtures — strips cost fields from Logistics level", async () => {
    const r = await request(app).get("/vessel-charter/fixtures").set("Cookie", sesLog);
    assert.equal(r.status, 200);
    const f = r.body.find(x => x.id === fixtureId);
    assert.ok(f, "Fixture should be present");
    assert.equal(f.voyage_cost_usd, undefined, "voyage_cost_usd must be hidden from Logistics");
    assert.equal(f.expected_margin_usd, undefined, "expected_margin_usd must be hidden from Logistics");
  });

  it("GET /vessel-charter/fixtures/:id — CFO sees cost fields", async () => {
    const r = await request(app).get(`/vessel-charter/fixtures/${fixtureId}`).set("Cookie", sesCFO);
    assert.equal(r.status, 200);
    assert.ok(r.body.voyage_cost_usd !== undefined, "CFO must see voyage_cost_usd");
    assert.ok(Array.isArray(r.body.versions), "Should include versions array");
  });

  it("GET /vessel-charter/fixtures — CLIENT gets 403", async () => {
    const r = await request(app).get("/vessel-charter/fixtures").set("Cookie", sesClient);
    assert.equal(r.status, 403);
  });

  it("POST /vessel-charter/fixtures/:id/versions — saves CP version", async () => {
    const r = await request(app).post(`/vessel-charter/fixtures/${fixtureId}/versions`)
      .set("Cookie", sesCFO)
      .send({ recap_text: "REVISED RECAP V2 - conditions improved", change_note: "Demurrage rate updated" });
    assert.equal(r.status, 201);
    assert.ok(r.body.version >= 2);
  });

  it("PATCH /vessel-charter/fixtures/:id — updates fixture status", async () => {
    const r = await request(app).patch(`/vessel-charter/fixtures/${fixtureId}`)
      .set("Cookie", sesCFO).send({ status: "FIXED" });
    assert.equal(r.status, 200);
    assert.ok(r.body.ok);
  });

  // ── Voyages ───────────────────────────────────────────────────────────────────

  it("POST /vessel-charter/voyages — creates voyage 1 (used less than allowed → despatch)", async () => {
    const r = await request(app).post("/vessel-charter/voyages")
      .set("Cookie", sesLog)
      .send({ fixture_id: fixtureId, vessel_id: vesselId,
        pol_port: "Rosario", pod_port: "Valencia",
        pol_etd: "2026-11-02T00:00:00Z", pod_eta: "2026-11-25T00:00:00Z" });
    assert.equal(r.status, 201);
    assert.ok(r.body.id);
    voyageId1 = r.body.id;
  });

  it("POST /vessel-charter/voyages — creates voyage 2 (large overage → demurrage)", async () => {
    const r = await request(app).post("/vessel-charter/voyages")
      .set("Cookie", sesLog)
      .send({ fixture_id: fixtureId, vessel_id: vesselId, pol_port: "Rosario", pod_port: "Bilbao" });
    assert.equal(r.status, 201);
    assert.ok(r.body.id);
    voyageId2 = r.body.id;
  });

  it("PATCH /vessel-charter/voyages/:id — updates voyage 1 (72h used of 240 allowed → despatch)", async () => {
    // 50000 MT / 5000 MT/day * 24 = 240h allowed; 72h used; balance +168h → despatch
    const r = await request(app).patch(`/vessel-charter/voyages/${voyageId1}`)
      .set("Cookie", sesLog).send({
        nor_accepted_at:      "2026-11-02T06:00:00Z",
        completed_loading_at: "2026-11-05T06:00:00Z",  // 72h used
        bl_quantity: 50000,
      });
    assert.equal(r.status, 200);
    assert.ok(r.body.ok);
  });

  it("PATCH /vessel-charter/voyages/:id — updates voyage 2 (300h used > 240 allowed → demurrage)", async () => {
    // 300h used - 0 excluded = 300h net; 240h allowed; balance = -60h → demurrage = 2.5 * 12000 = $30000
    const r = await request(app).patch(`/vessel-charter/voyages/${voyageId2}`)
      .set("Cookie", sesLog).send({
        nor_accepted_at:      "2026-11-01T00:00:00Z",
        completed_loading_at: "2026-11-13T12:00:00Z",  // 300h used
        bl_quantity: 50000,
      });
    assert.equal(r.status, 200);
    assert.ok(r.body.ok);
  });

  // ── Laytime Events ────────────────────────────────────────────────────────────

  it("POST /vessel-charter/voyages/:id/laytime-events — adds excluded event", async () => {
    const r = await request(app).post(`/vessel-charter/voyages/${voyageId2}/laytime-events`)
      .set("Cookie", sesLog)
      .send({
        port_type: "LOADING", event_type: "RAIN_INTERRUPTION",
        event_time: "2026-11-04T08:00:00Z", duration_hours: 6,
        is_excluded: true, exclusion_reason: "Rain: SHINC exclusion",
      });
    assert.equal(r.status, 201);
  });

  it("GET /vessel-charter/voyages/:id/laytime-events — lists events", async () => {
    const r = await request(app).get(`/vessel-charter/voyages/${voyageId2}/laytime-events`).set("Cookie", sesLog);
    assert.equal(r.status, 200);
    assert.ok(r.body.length >= 1);
  });

  // ── Laytime Calculation ───────────────────────────────────────────────────────

  it("POST /voyages/:id/calculate-laytime — voyage 1 → despatch (168h saved × $6000/24)", async () => {
    const r = await request(app).post(`/vessel-charter/voyages/${voyageId1}/calculate-laytime`)
      .set("Cookie", sesLog);
    assert.equal(r.status, 200);
    assert.ok(Array.isArray(r.body));
    const c = r.body.find(x => x.port_type === "LOADING");
    assert.ok(c, "Should have LOADING calculation");
    // 240h allowed - 72h net = +168h balance → despatch = (168/24)*6000 = $42000
    assert.ok(c.balance_hours > 0, "Balance should be positive (despatch)");
    assert.ok(c.despatch_amount > 0, "Should have despatch amount");
    assert.equal(c.demurrage_amount, 0, "No demurrage for voyage 1");
  });

  it("POST /voyages/:id/calculate-laytime — voyage 2 → demurrage (300h-6h=294h net > 240h)", async () => {
    const r = await request(app).post(`/vessel-charter/voyages/${voyageId2}/calculate-laytime`)
      .set("Cookie", sesLog);
    assert.equal(r.status, 200);
    const c = r.body.find(x => x.port_type === "LOADING");
    assert.ok(c);
    // 300h used - 6h excluded = 294h net; 240h allowed; balance = -54h → demurrage
    assert.ok(c.balance_hours < 0, "Balance should be negative (demurrage)");
    assert.ok(c.demurrage_amount > 0, "Should have demurrage amount");
    assert.equal(c.despatch_amount, 0, "No despatch for voyage 2");
  });

  // ── SOF ───────────────────────────────────────────────────────────────────────

  it("POST /vessel-charter/voyages/:id/sof — creates SOF", async () => {
    const r = await request(app).post(`/vessel-charter/voyages/${voyageId1}/sof`)
      .set("Cookie", sesLog)
      .send({
        port_type: "LOADING",
        sof_text: "NOR tendered 02/11 06:00. Berthed 02/11 09:00. Commenced loading 10:00. Completed 05/11 06:00.",
        agent_name: "Puerto Rosario Agency SRL",
        signed_date: "2026-11-05",
      });
    assert.equal(r.status, 201);
    assert.ok(r.body.id);
  });

  it("GET /vessel-charter/voyages/:id/sof — retrieves SOF", async () => {
    const r = await request(app).get(`/vessel-charter/voyages/${voyageId1}/sof`).set("Cookie", sesLog);
    assert.equal(r.status, 200);
    assert.ok(r.body.length >= 1);
  });

  // ── Financials (CFO only) ──────────────────────────────────────────────────────

  it("GET /vessel-charter/fixtures/:id/financials — CFO accesses financials", async () => {
    const r = await request(app).get(`/vessel-charter/fixtures/${fixtureId}/financials`).set("Cookie", sesCFO);
    assert.equal(r.status, 200);
    assert.ok(Array.isArray(r.body));
  });

  it("POST /vessel-charter/fixtures/:id/financials — CFO adds freight income", async () => {
    const r = await request(app).post(`/vessel-charter/fixtures/${fixtureId}/financials`)
      .set("Cookie", sesCFO)
      .send({
        item_type: "FREIGHT", description: "Freight income MV Test Grain",
        amount: 1625000, currency: "USD", direction: "INCOME", due_date: "2026-12-01",
      });
    assert.equal(r.status, 201);
    assert.ok(r.body.id);
  });

  it("GET /vessel-charter/fixtures/:id/financials — Logistics gets 403", async () => {
    const r = await request(app).get(`/vessel-charter/fixtures/${fixtureId}/financials`).set("Cookie", sesLog);
    assert.equal(r.status, 403);
  });

  // ── Dashboard ─────────────────────────────────────────────────────────────────

  it("GET /vessel-charter/dashboard/summary — returns structured dashboard", async () => {
    const r = await request(app).get("/vessel-charter/dashboard/summary").set("Cookie", sesAdmin);
    assert.equal(r.status, 200);
    assert.ok(typeof r.body.active_voyages === "number");
    assert.ok(typeof r.body.active_fixtures === "number");
    assert.ok(typeof r.body.open_alerts === "number");
    assert.ok(typeof r.body.total_demurrage_usd === "number");
    assert.ok(Array.isArray(r.body.upcoming_laycan));
  });

  it("GET /vessel-charter/dashboard/summary — CLIENT gets 403", async () => {
    const r = await request(app).get("/vessel-charter/dashboard/summary").set("Cookie", sesClient);
    assert.equal(r.status, 403);
  });

  // ── Alerts ────────────────────────────────────────────────────────────────────

  it("GET /vessel-charter/alerts — lists alerts (may be 0 in test)", async () => {
    const r = await request(app).get("/vessel-charter/alerts").set("Cookie", sesAdmin);
    assert.equal(r.status, 200);
    assert.ok(Array.isArray(r.body));
    if (r.body.length > 0) alertId = r.body[0].id;
  });

  it("PATCH /vessel-charter/alerts/:id/acknowledge — acknowledges alert if any exist", async () => {
    if (!alertId) {
      // Insert a synthetic alert so we can test acknowledgement
      const ins = db.prepare(
        `INSERT INTO charter_alerts (fixture_id,alert_type,severity,message) VALUES (?,?,?,?)`
      ).run(fixtureId, "TEST_ALERT", "LOW", "Test alert for ack");
      alertId = ins.lastInsertRowid;
    }
    const r = await request(app).patch(`/vessel-charter/alerts/${alertId}/acknowledge`).set("Cookie", sesAdmin);
    assert.equal(r.status, 200);
    assert.ok(r.body.ok);
    const updated = db.prepare("SELECT acknowledged FROM charter_alerts WHERE id=?").get(alertId);
    assert.equal(updated.acknowledged, 1);
  });

  // ── Voyage Detail ─────────────────────────────────────────────────────────────

  it("GET /vessel-charter/voyages/:id — returns voyage with laytime calculations", async () => {
    const r = await request(app).get(`/vessel-charter/voyages/${voyageId1}`).set("Cookie", sesLog);
    assert.equal(r.status, 200);
    assert.ok(r.body.fixture_number);
    assert.ok(Array.isArray(r.body.laytime_calculations));
    assert.ok(Array.isArray(r.body.sof));
    assert.ok(Array.isArray(r.body.laytime_events));
  });
});
