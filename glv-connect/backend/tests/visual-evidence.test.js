"use strict";
const { test, before, after, describe } = require("node:test");
const assert   = require("node:assert/strict");
const request  = require("supertest");
const bcrypt   = require("bcryptjs");
const app      = require("../server");
const db       = require("../db/database");

// ─── Test users ───────────────────────────────────────────────────────────────
const USERS = {
  ve_admin: { username: "ve_admin",  password: "Test1234!", role: "CORPORATE_ADMIN", name: "VE Admin",  email: "ve_admin@test.com" },
  ve_audit: { username: "ve_audit",  password: "Test1234!", role: "AUDIT",           name: "VE Audit",  email: "ve_audit@test.com" },
  ve_logi:  { username: "ve_logi",   password: "Test1234!", role: "LOGISTICS",       name: "VE Logi",   email: "ve_logi@test.com" },
  ve_comp:  { username: "ve_comp",   password: "Test1234!", role: "COMPLIANCE",      name: "VE Comp",   email: "ve_comp@test.com" },
  ve_cli1:  { username: "ve_cli1",   password: "Test1234!", role: "CLIENT",          name: "VE Client1",email: "ve_cli1@test.com" },
  ve_cli2:  { username: "ve_cli2",   password: "Test1234!", role: "CLIENT",          name: "VE Client2",email: "ve_cli2@test.com" },
};

const cookies = {};
let zoneId, evidenceId, evidenceClientId, countEventId, countEventDiscId, discrepancyId, client1Id, client2Id;

function login(username, password) {
  return request(app).post("/auth/login").send({ username, password });
}
function getCookie(res) {
  const h = res.headers["set-cookie"];
  if (!h) return "";
  return (Array.isArray(h) ? h : [h]).map(c => c.split(";")[0]).join("; ");
}

before(async () => {
  // Ensure primary_contact_username column exists
  const cols = db.prepare("PRAGMA table_info(clients)").all().map(c => c.name);
  if (!cols.includes("primary_contact_username")) {
    db.exec("ALTER TABLE clients ADD COLUMN primary_contact_username TEXT");
  }

  // Create test clients
  const r1 = db.prepare("INSERT INTO clients (name,type,active) VALUES (?,?,?)").run("VE Test Client1","buyer",1);
  client1Id = r1.lastInsertRowid;
  const r2 = db.prepare("INSERT INTO clients (name,type,active) VALUES (?,?,?)").run("VE Test Client2","buyer",1);
  client2Id = r2.lastInsertRowid;

  // Create test users
  const hash = bcrypt.hashSync("Test1234!", 10);
  for (const [key, u] of Object.entries(USERS)) {
    db.prepare(
      "INSERT OR IGNORE INTO users (username,password,role,name,email,active,first_login,profile_completed,password_changed) VALUES (?,?,?,?,?,1,0,1,1)"
    ).run(u.username, hash, u.role, u.name, u.email);
  }
  // Link clients
  db.prepare("UPDATE users SET linked_client_id=? WHERE username=?").run(client1Id, "ve_cli1");
  db.prepare("UPDATE users SET linked_client_id=? WHERE username=?").run(client2Id, "ve_cli2");

  // Login all
  for (const [key, u] of Object.entries(USERS)) {
    const res = await login(u.username, u.password);
    cookies[key] = getCookie(res);
  }
});

after(() => {
  // Cleanup
  const usernames = Object.keys(USERS);
  const placeholders = usernames.map(() => "?").join(",");
  try { db.prepare(`DELETE FROM users WHERE username IN (${placeholders})`).run(...usernames); } catch (_) {}
  try { db.prepare("DELETE FROM clients WHERE id IN (?,?)").run(client1Id, client2Id); } catch (_) {}
});

// ─── Zones ────────────────────────────────────────────────────────────────────
describe("Visual Evidence — Zones", () => {
  test("1. LOGISTICS can create a zone", async () => {
    const res = await request(app)
      .post("/visual-evidence/zones")
      .set("Cookie", cookies.ve_logi)
      .send({ name: "Zona Test A", zone_type: "INSPECTION", location: "Puerto Buenaventura" });
    assert.equal(res.status, 201);
    assert.ok(res.body.zone?.id);
    zoneId = res.body.zone.id;
  });

  test("2. CLIENT cannot create zone", async () => {
    const res = await request(app)
      .post("/visual-evidence/zones")
      .set("Cookie", cookies.ve_cli1)
      .send({ name: "Zona Cliente", zone_type: "GENERAL" });
    assert.equal(res.status, 403);
  });

  test("3. GET zones returns list", async () => {
    const res = await request(app)
      .get("/visual-evidence/zones")
      .set("Cookie", cookies.ve_admin);
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body.zones));
    assert.ok(res.body.zones.length > 0);
  });
});

// ─── Evidence ─────────────────────────────────────────────────────────────────
describe("Visual Evidence — Evidence CRUD", () => {
  test("4. Create INTERNAL evidence (admin)", async () => {
    const res = await request(app)
      .post("/visual-evidence")
      .set("Cookie", cookies.ve_admin)
      .send({ description: "Prueba interna", visibility: "INTERNAL", source: "MANUAL", zone_id: zoneId });
    assert.equal(res.status, 201);
    assert.match(res.body.evidence?.evidence_number, /^EVD-\d{4}-\d{4}$/);
    evidenceId = res.body.evidence.id;
  });

  test("5. Create CLIENT_VISIBLE evidence linked to client1", async () => {
    const res = await request(app)
      .post("/visual-evidence")
      .set("Cookie", cookies.ve_admin)
      .send({ description: "Evidencia para cliente", visibility: "CLIENT_VISIBLE", source: "CAMERA", client_id: client1Id });
    assert.equal(res.status, 201);
    assert.equal(res.body.evidence.visibility, "CLIENT_VISIBLE");
    evidenceClientId = res.body.evidence.id;
  });

  test("6. CLIENT1 can see CLIENT_VISIBLE evidence for their client_id", async () => {
    const res = await request(app)
      .get("/visual-evidence")
      .set("Cookie", cookies.ve_cli1);
    assert.equal(res.status, 200);
    const ids = res.body.evidence.map(e => e.id);
    assert.ok(ids.includes(evidenceClientId));
  });

  test("7. CLIENT1 cannot access INTERNAL evidence directly", async () => {
    const res = await request(app)
      .get(`/visual-evidence/${evidenceId}`)
      .set("Cookie", cookies.ve_cli1);
    assert.equal(res.status, 403);
  });

  test("8. CLIENT2 cannot see CLIENT1's evidence", async () => {
    const res = await request(app)
      .get("/visual-evidence")
      .set("Cookie", cookies.ve_cli2);
    assert.equal(res.status, 200);
    const ids = res.body.evidence.map(e => e.id);
    assert.ok(!ids.includes(evidenceClientId));
  });

  test("9. Level < 55 cannot review evidence", async () => {
    const res = await request(app)
      .patch(`/visual-evidence/${evidenceId}/review`)
      .set("Cookie", cookies.ve_logi)
      .send({ status: "REVIEWED", review_notes: "ok" });
    assert.equal(res.status, 403);
  });

  test("10. AUDIT (55) can review evidence", async () => {
    const res = await request(app)
      .patch(`/visual-evidence/${evidenceId}/review`)
      .set("Cookie", cookies.ve_audit)
      .send({ status: "REVIEWED", review_notes: "Revisado por auditoría" });
    assert.equal(res.status, 200);
    assert.equal(res.body.evidence.status, "REVIEWED");
  });

  test("11. Evidence has audit trail", async () => {
    const trail = db.prepare("SELECT * FROM ve_audit WHERE evidence_id=? ORDER BY id ASC").all(evidenceId);
    assert.ok(trail.length >= 2);
    assert.ok(trail.some(r => r.action === "CREATE"));
    assert.ok(trail.some(r => r.action === "REVIEW:REVIEWED"));
  });
});

// ─── Count Events ─────────────────────────────────────────────────────────────
describe("Visual Evidence — Count Events", () => {
  test("12. Count event with difference=0 → 201, no discrepancy", async () => {
    const res = await request(app)
      .post("/visual-evidence/count-events")
      .set("Cookie", cookies.ve_logi)
      .send({ expected_count: 100, actual_count: 100, count_type: "MANUAL", notes: "Todo OK" });
    assert.equal(res.status, 201);
    assert.match(res.body.count_event?.event_number, /^CNT-\d{4}-\d{4}$/);
    countEventId = res.body.count_event.id;
  });

  test("13. No discrepancy created when difference=0", async () => {
    const disc = db.prepare("SELECT * FROM count_discrepancies WHERE count_event_id=?").all(countEventId);
    assert.equal(disc.length, 0);
  });

  test("14. Count event with difference=-8 → 201", async () => {
    const res = await request(app)
      .post("/visual-evidence/count-events")
      .set("Cookie", cookies.ve_logi)
      .send({ expected_count: 100, actual_count: 92, count_type: "MANUAL", notes: "Faltan 8" });
    assert.equal(res.status, 201);
    countEventDiscId = res.body.count_event.id;
  });

  test("15. Discrepancy auto-created and requires_review=1", async () => {
    const disc = db.prepare("SELECT * FROM count_discrepancies WHERE count_event_id=?").all(countEventDiscId);
    assert.ok(disc.length > 0);
    discrepancyId = disc[0].id;
    const evt = db.prepare("SELECT requires_review FROM count_events WHERE id=?").get(countEventDiscId);
    assert.equal(evt.requires_review, 1);
    assert.equal(disc[0].severity, "MEDIUM");
  });

  test("16. Discrepancy difference stored correctly", async () => {
    const disc = db.prepare("SELECT * FROM count_discrepancies WHERE id=?").get(discrepancyId);
    assert.equal(disc.difference, -8);
  });

  test("17. Level < 55 cannot review count event", async () => {
    const res = await request(app)
      .post(`/visual-evidence/count-events/${countEventDiscId}/review`)
      .set("Cookie", cookies.ve_logi)
      .send({ explanation: "Revisé yo mismo" });
    assert.equal(res.status, 403);
  });

  test("18. AUDIT (55) cannot APPROVE count event (needs 65+)", async () => {
    const res = await request(app)
      .post(`/visual-evidence/count-events/${countEventDiscId}/review`)
      .set("Cookie", cookies.ve_audit)
      .send({ explanation: "Revisado", approved: true });
    assert.equal(res.status, 403);
  });

  test("19. COMPLIANCE (65) can approve count event", async () => {
    const res = await request(app)
      .post(`/visual-evidence/count-events/${countEventDiscId}/review`)
      .set("Cookie", cookies.ve_comp)
      .send({ explanation: "Aprobado por compliance tras revisión", approved: true });
    assert.equal(res.status, 200);
    assert.equal(res.body.count_event.approved, 1);
    assert.equal(res.body.count_event.status, "CLOSED");
  });

  test("20. Empty explanation → 400; valid explanation → accepted", async () => {
    const res = await request(app)
      .post(`/visual-evidence/count-events/${countEventId}/review`)
      .set("Cookie", cookies.ve_comp)
      .send({ explanation: "" });
    assert.equal(res.status, 400);
    const res2 = await request(app)
      .post(`/visual-evidence/count-events/${countEventId}/review`)
      .set("Cookie", cookies.ve_comp)
      .send({ explanation: "Todo correcto", approved: false });
    assert.equal(res2.status, 200);
  });
});

// ─── AI Providers ─────────────────────────────────────────────────────────────
describe("Visual Evidence — AI Providers", () => {
  test("21. LOGISTICS (45) cannot access AI providers", async () => {
    const res = await request(app)
      .get("/visual-evidence/ai-providers")
      .set("Cookie", cookies.ve_logi);
    assert.equal(res.status, 403);
  });

  test("22. ADMIN sees AI providers and all are disabled (enabled=0)", async () => {
    const res = await request(app)
      .get("/visual-evidence/ai-providers")
      .set("Cookie", cookies.ve_admin);
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body.providers));
    assert.ok(res.body.providers.length > 0);
    assert.ok(res.body.providers.every(p => p.enabled === 0));
  });
});

// ─── Dashboard ────────────────────────────────────────────────────────────────
describe("Visual Evidence — Dashboard", () => {
  test("23. Dashboard returns correct structure", async () => {
    const res = await request(app)
      .get("/visual-evidence/dashboard/summary")
      .set("Cookie", cookies.ve_admin);
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body.evidence_by_status));
    assert.ok(Array.isArray(res.body.count_events_by_status));
    assert.ok(typeof res.body.open_discrepancies === "number");
    assert.ok(typeof res.body.active_zones === "number");
  });
});

// ─── CLIENT isolation for count events ───────────────────────────────────────
describe("Visual Evidence — CLIENT isolation", () => {
  test("24. CLIENT2 cannot see CLIENT1 count events", async () => {
    // Create a count event for client1
    await request(app)
      .post("/visual-evidence/count-events")
      .set("Cookie", cookies.ve_admin)
      .send({ expected_count: 50, actual_count: 50, client_id: client1Id });

    const res = await request(app)
      .get("/visual-evidence/count-events")
      .set("Cookie", cookies.ve_cli2);
    assert.equal(res.status, 200);
    const ids = res.body.count_events.map(e => e.client_id);
    assert.ok(!ids.includes(client1Id));
  });

  test("25. CLIENT1 can see their own count events", async () => {
    const res = await request(app)
      .get("/visual-evidence/count-events")
      .set("Cookie", cookies.ve_cli1);
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body.count_events));
    const ids = res.body.count_events.map(e => e.client_id);
    assert.ok(ids.includes(client1Id));
  });
});
