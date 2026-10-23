"use strict";

// Commercial Engine test suite — 8 scenarios
// node --test --experimental-test-isolation=none tests/commercial-engine.test.js

const { test, describe, before, after } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");

// ── test-only env guards ───────────────────────────────────────────────────────
process.env.NODE_ENV  = "test";
process.env.JWT_SECRET = "commercialtestsecret1234567890abcdef";

const app = require("../server");
const db  = require("../db/database");

// ── helpers ────────────────────────────────────────────────────────────────────
function loginAs(username, password = "Admin1234!") {
  return request(app)
    .post("/auth/login")
    .send({ username, password })
    .then(r => {
      if (r.status !== 200) throw new Error(`Login ${username} failed: ${r.status} ${JSON.stringify(r.body)}`);
      return r.body.token || r.headers["set-cookie"];
    });
}

function auth(token) {
  if (Array.isArray(token)) return (req) => req.set("Cookie", token);
  return (req) => req.set("Authorization", `Bearer ${token}`);
}

// ── fixture setup ──────────────────────────────────────────────────────────────
let directorToken, agenteToken, clientToken;
let matrixId, ruleId, quoteId;

before(async () => {
  // Ensure users exist for tests
  const bcrypt = require("bcryptjs");
  const hash = bcrypt.hashSync("Admin1234!", 10);

  // COMMERCIAL_DIRECTOR (level 70)
  db.prepare(`
    INSERT OR IGNORE INTO users (username, password, role, name, email, active, first_login, profile_completed)
    VALUES ('test_director', ?, 'COMMERCIAL_DIRECTOR', 'Test Director', 'director@test.glv', 1, 0, 1)
  `).run(hash);

  // AGENTE (level 40)
  db.prepare(`
    INSERT OR IGNORE INTO users (username, password, role, name, email, active, first_login, profile_completed)
    VALUES ('test_agente', ?, 'AGENTE', 'Test Agente', 'agente@test.glv', 1, 0, 1)
  `).run(hash);

  // CLIENT (level 20) with linked client
  const clientRow = db.prepare(
    "INSERT OR IGNORE INTO clients (type, name, country, active) VALUES ('buyer', 'GLV-TEST-CLIENT-001', 'SA', 1)"
  ).run();
  const linkedClientId = clientRow.changes ? clientRow.lastInsertRowid :
    db.prepare("SELECT id FROM clients WHERE name = 'GLV-TEST-CLIENT-001'").get().id;

  db.prepare(`
    INSERT OR IGNORE INTO users (username, password, role, name, email, active, first_login, profile_completed, linked_client_id)
    VALUES ('test_client_ext', ?, 'CLIENT', 'Test Client External', 'client@test.glv', 1, 0, 1, ?)
  `).run(hash, linkedClientId);

  directorToken = await loginAs("test_director");
  agenteToken   = await loginAs("test_agente");
  clientToken   = await loginAs("test_client_ext");
});

after(() => {
  // Cleanup all test data (order matters for FK constraints)
  try { db.prepare("DELETE FROM commercial_quote_audit WHERE actor LIKE 'test_%'").run(); } catch (_) {}
  try { db.prepare("DELETE FROM commercial_quotes WHERE created_by LIKE 'test_%'").run(); } catch (_) {}
  try { db.prepare("DELETE FROM commercial_rules WHERE created_by LIKE 'test_%'").run(); } catch (_) {}
  try { db.prepare("DELETE FROM commercial_price_matrix WHERE created_by LIKE 'test_%'").run(); } catch (_) {}
  try { db.prepare("DELETE FROM users WHERE username LIKE 'test_%'").run(); } catch (_) {}
  try { db.prepare("DELETE FROM clients WHERE name = 'GLV-TEST-CLIENT-001'").run(); } catch (_) {}
});

// ══════════════════════════════════════════════════════════════════════════════
// Suite 1 — RBAC: external client cannot access internal endpoints
// ══════════════════════════════════════════════════════════════════════════════
describe("Suite 1 — RBAC: external CLIENT denied from internal endpoints", () => {
  test("CLIENT cannot GET /commercial/price-matrix", async () => {
    const r = await auth(clientToken)(request(app).get("/commercial/price-matrix"));
    assert.strictEqual(r.status, 403);
    assert.ok(r.body.error, "should return error message");
  });

  test("CLIENT cannot GET /commercial/rules", async () => {
    const r = await auth(clientToken)(request(app).get("/commercial/rules"));
    assert.strictEqual(r.status, 403);
  });

  test("CLIENT cannot POST /commercial/quotes (create draft)", async () => {
    const r = await auth(clientToken)(request(app)
      .post("/commercial/quotes")
      .send({ origin_country: "AR", destination_country: "SA", quantity: 1000, incoterm: "CIF" }));
    assert.strictEqual(r.status, 403);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Suite 2 — Price matrix: COMMERCIAL_DIRECTOR creates matrix entry
// ══════════════════════════════════════════════════════════════════════════════
describe("Suite 2 — Price matrix creation (COMMERCIAL_DIRECTOR)", () => {
  test("COMMERCIAL_DIRECTOR can create a price matrix entry", async () => {
    const r = await auth(directorToken)(request(app)
      .post("/commercial/price-matrix")
      .send({
        origin_country: "AR",
        destination_country: "SA",
        incoterm: "CIF",
        currency: "USD",
        unit: "kg",
        base_cost: 2.50,
        freight_cost: 0.40,
        insurance_cost: 0.10,
        operational_cost: 0.20,
        target_margin: 0.20,
        valid_from: "2026-01-01",
      }));
    assert.strictEqual(r.status, 201, JSON.stringify(r.body));
    assert.ok(r.body.id);
    assert.ok(r.body.sale_price > 0, "backend calculates sale_price");
    assert.ok(r.body.min_authorized_price > 0, "backend calculates min_authorized_price");
    // sale_price = (2.50 + 0.40 + 0.10 + 0.20) / (1 - 0.20) = 3.20 / 0.80 = 4.00
    assert.ok(Math.abs(r.body.sale_price - 4.00) < 0.01, `Expected sale_price ~4.00, got ${r.body.sale_price}`);
    matrixId = r.body.id;
  });

  test("AGENTE cannot create price matrix entry (level < 70)", async () => {
    const r = await auth(agenteToken)(request(app)
      .post("/commercial/price-matrix")
      .send({
        origin_country: "AR",
        destination_country: "SA",
        incoterm: "CIF",
        base_cost: 2.50,
      }));
    assert.strictEqual(r.status, 403);
  });

  test("Invalid incoterm is rejected", async () => {
    const r = await auth(directorToken)(request(app)
      .post("/commercial/price-matrix")
      .send({ origin_country: "AR", destination_country: "SA", incoterm: "INVALID", base_cost: 2.50 }));
    assert.strictEqual(r.status, 400);
    assert.ok(r.body.error.includes("Incoterm"));
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Suite 3 — Commercial rules
// ══════════════════════════════════════════════════════════════════════════════
describe("Suite 3 — Commercial rules", () => {
  test("COMMERCIAL_DIRECTOR can create a rule with min_price_floor", async () => {
    const r = await auth(directorToken)(request(app)
      .post("/commercial/rules")
      .send({
        origin_country: "AR",
        destination_country: "SA",
        incoterm: "CIF",
        min_volume: 5000,
        min_volume_unit: "kg",
        min_price_floor: 3.80,
        max_discount_pct: 5,
        valid_from: "2026-01-01",
      }));
    assert.strictEqual(r.status, 201, JSON.stringify(r.body));
    assert.ok(r.body.id);
    ruleId = r.body.id;
  });

  test("Rule with invalid max_discount_pct is rejected", async () => {
    const r = await auth(directorToken)(request(app)
      .post("/commercial/rules")
      .send({ max_discount_pct: 150 }));
    assert.strictEqual(r.status, 400);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Suite 4 — Quote creation (AGENTE drafts, backend calculates)
// ══════════════════════════════════════════════════════════════════════════════
describe("Suite 4 — Quote creation and backend-only calculation", () => {
  test("AGENTE can create a DRAFT quote", async () => {
    const r = await auth(agenteToken)(request(app)
      .post("/commercial/quotes")
      .send({
        origin_country: "AR",
        destination_country: "SA",
        incoterm: "CIF",
        currency: "USD",
        quantity: 10000,
        unit: "kg",
        payment_conditions: "30% advance, 70% CAD",
        validity_days: 15,
      }));
    assert.strictEqual(r.status, 201, JSON.stringify(r.body));
    assert.strictEqual(r.body.status, "DRAFT");
    assert.ok(r.body.quote_number.startsWith("GLV-Q-"));
    assert.ok(!r.body.price_per_unit, "price not set until calculate is called");
    quoteId = r.body.id;
  });

  test("CRITICAL: calculate endpoint ignores browser-submitted price, uses matrix only", async () => {
    // Even if attacker sends a crafted price in the body, backend MUST ignore it
    const r = await auth(agenteToken)(request(app)
      .post(`/commercial/quotes/${quoteId}/calculate`)
      .send({
        // ATTACK: try to inject a lower price
        price_per_unit: 0.01,
        sale_price: 0.01,
        base_cost: 0.01,
        total_value: 0.01,
      }));
    assert.strictEqual(r.status, 200, JSON.stringify(r.body));
    // Backend should use the matrix's calculated sale_price (~4.00), not 0.01
    assert.ok(r.body.price_per_unit >= 3.00, `price_per_unit should be from matrix (~4.00), got ${r.body.price_per_unit}`);
    assert.ok(r.body.matrix_id, "matrix_id must be set after calculation");
  });

  test("Calculated quote has correct total_value = price_per_unit × quantity", async () => {
    const q = db.prepare("SELECT * FROM commercial_quotes WHERE id = ?").get(quoteId);
    assert.ok(q.price_per_unit > 0);
    assert.ok(q.total_value > 0);
    const expected = parseFloat((q.price_per_unit * q.quantity).toFixed(4));
    assert.ok(Math.abs(q.total_value - expected) < 0.01,
      `total_value ${q.total_value} should be ~${expected}`);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Suite 5 — Price floor protection
// ══════════════════════════════════════════════════════════════════════════════
describe("Suite 5 — Price below minimum is blocked", () => {
  test("Quote is blocked when matrix sale_price < rule min_price_floor", async () => {
    // First update the rule so its min_price_floor is higher than the matrix sale_price
    await auth(directorToken)(request(app)
      .patch(`/commercial/rules/${ruleId}`)
      .send({ min_price_floor: 999.00 }));

    // Create a new quote and try to calculate — should be blocked
    const createR = await auth(agenteToken)(request(app)
      .post("/commercial/quotes")
      .send({
        origin_country: "AR",
        destination_country: "SA",
        incoterm: "CIF",
        currency: "USD",
        quantity: 5000,
        unit: "kg",
      }));
    assert.strictEqual(createR.status, 201);
    const blockedQuoteId = createR.body.id;

    const calcR = await auth(agenteToken)(request(app)
      .post(`/commercial/quotes/${blockedQuoteId}/calculate`));
    assert.strictEqual(calcR.status, 422, JSON.stringify(calcR.body));
    assert.strictEqual(calcR.body.blocked, true);
    assert.ok(calcR.body.error, "should include error message");

    // Restore rule floor
    await auth(directorToken)(request(app)
      .patch(`/commercial/rules/${ruleId}`)
      .send({ min_price_floor: 3.80 }));
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Suite 6 — Full approval flow
// ══════════════════════════════════════════════════════════════════════════════
describe("Suite 6 — Full approval flow: DRAFT → PENDING_APPROVAL → APPROVED", () => {
  test("AGENTE submits quote to PENDING_APPROVAL", async () => {
    const r = await auth(agenteToken)(request(app)
      .post(`/commercial/quotes/${quoteId}/submit`));
    assert.strictEqual(r.status, 200, JSON.stringify(r.body));
    assert.strictEqual(r.body.status, "PENDING_APPROVAL");
  });

  test("AGENTE cannot approve quote (level < 70)", async () => {
    const r = await auth(agenteToken)(request(app)
      .post(`/commercial/quotes/${quoteId}/approve`));
    assert.strictEqual(r.status, 403);
  });

  test("COMMERCIAL_DIRECTOR can approve quote", async () => {
    const r = await auth(directorToken)(request(app)
      .post(`/commercial/quotes/${quoteId}/approve`));
    assert.strictEqual(r.status, 200, JSON.stringify(r.body));
    assert.strictEqual(r.body.status, "APPROVED");
    assert.strictEqual(r.body.price_locked, 1);
    assert.ok(r.body.approved_by, "approved_by must be set");
  });

  test("Approved quote cannot be recalculated (price_locked)", async () => {
    const r = await auth(directorToken)(request(app)
      .post(`/commercial/quotes/${quoteId}/calculate`));
    assert.strictEqual(r.status, 409);
    assert.ok(r.body.error.includes("aprobada") || r.body.error.includes("bloqueado") || r.body.error.includes("locked"));
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Suite 7 — Audit trail (ISO traceability)
// ══════════════════════════════════════════════════════════════════════════════
describe("Suite 7 — ISO audit trail: every action is logged", () => {
  test("Audit trail for the approved quote has QUOTE_CREATED, CALCULATED, SUBMITTED, APPROVED entries", async () => {
    const r = await auth(directorToken)(request(app)
      .get(`/commercial/quotes/${quoteId}`));
    assert.strictEqual(r.status, 200);
    assert.ok(Array.isArray(r.body.audit), "audit array must be present for internal users");

    const actions = r.body.audit.map(a => a.action);
    assert.ok(actions.includes("QUOTE_CREATED"), `Expected QUOTE_CREATED in ${actions}`);
    assert.ok(actions.includes("CALCULATED"), `Expected CALCULATED in ${actions}`);
    assert.ok(actions.includes("SUBMITTED"), `Expected SUBMITTED in ${actions}`);
    assert.ok(actions.includes("APPROVED"), `Expected APPROVED in ${actions}`);
  });

  test("Audit entries contain before_json / after_json for state changes", async () => {
    const entries = db.prepare(
      "SELECT * FROM commercial_quote_audit WHERE quote_id = ? AND action = 'APPROVED'"
    ).all(quoteId);
    assert.ok(entries.length > 0, "APPROVED entry must exist");
    const e = entries[0];
    assert.ok(e.before_json, "before_json required");
    assert.ok(e.after_json, "after_json required");
    const before = JSON.parse(e.before_json);
    const after  = JSON.parse(e.after_json);
    assert.strictEqual(before.status, "PENDING_APPROVAL");
    assert.strictEqual(after.status, "APPROVED");
    assert.strictEqual(after.price_locked, 1);
  });

  test("Audit entries contain no PII or secrets", () => {
    const entries = db.prepare(
      "SELECT * FROM commercial_quote_audit WHERE quote_id = ?"
    ).all(quoteId);
    for (const e of entries) {
      const allText = [e.before_json, e.after_json, e.detail].filter(Boolean).join(" ");
      assert.ok(!allText.includes("password"), "audit must not contain password");
      assert.ok(!allText.includes("jwt"), "audit must not contain jwt");
      assert.ok(!allText.includes("secret"), "audit must not contain secret");
    }
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Suite 8 — CLIENT portal: filtered read-only (no internal fields)
// ══════════════════════════════════════════════════════════════════════════════
describe("Suite 8 — CLIENT portal: filtered read-only, no internal data", () => {
  test("CLIENT cannot see quotes from other clients", async () => {
    // quoteId was created by test_agente, not linked to test_client_ext
    const r = await auth(clientToken)(request(app)
      .get(`/commercial/quotes/${quoteId}`));
    assert.ok(r.status === 403 || r.status === 404, `Expected 403/404, got ${r.status}`);
  });

  test("CLIENT GET /commercial/quotes returns only APPROVED quotes for their client_id", async () => {
    const r = await auth(clientToken)(request(app).get("/commercial/quotes"));
    assert.strictEqual(r.status, 200);
    assert.ok(Array.isArray(r.body));
    // All returned quotes must be APPROVED
    for (const q of r.body) {
      assert.strictEqual(q.status, "APPROVED", `CLIENT should only see APPROVED quotes, got ${q.status}`);
    }
  });

  test("CLIENT-visible quote fields exclude internal cost/margin data", async () => {
    // Create, calculate, and approve a quote specifically linked to the test client
    const linkedClientId = db.prepare(
      "SELECT linked_client_id FROM users WHERE username = 'test_client_ext'"
    ).get().linked_client_id;

    const createR = await auth(agenteToken)(request(app)
      .post("/commercial/quotes")
      .send({
        origin_country: "AR",
        destination_country: "SA",
        incoterm: "CIF",
        currency: "USD",
        quantity: 2000,
        unit: "kg",
        client_id: linkedClientId,
      }));
    assert.strictEqual(createR.status, 201, JSON.stringify(createR.body));
    const testQuoteId = createR.body.id;

    await auth(agenteToken)(request(app).post(`/commercial/quotes/${testQuoteId}/calculate`));
    await auth(agenteToken)(request(app).post(`/commercial/quotes/${testQuoteId}/submit`));
    await auth(directorToken)(request(app).post(`/commercial/quotes/${testQuoteId}/approve`));

    const r = await auth(clientToken)(request(app)
      .get(`/commercial/quotes/${testQuoteId}`));
    assert.strictEqual(r.status, 200, JSON.stringify(r.body));

    const FORBIDDEN_FIELDS = [
      "base_cost", "freight_cost", "insurance_cost", "operational_cost",
      "target_margin", "internal_notes", "min_authorized_price",
      "matrix_id", "rule_id",
    ];
    for (const field of FORBIDDEN_FIELDS) {
      assert.ok(!(field in r.body), `CLIENT response must NOT include field "${field}"`);
    }
    // Public fields must still be present
    assert.ok("quote_number" in r.body, "quote_number must be visible to CLIENT");
    assert.ok("price_per_unit" in r.body, "price_per_unit must be visible to CLIENT");
    assert.ok("total_value" in r.body, "total_value must be visible to CLIENT");
    // audit trail must NOT be present for CLIENT
    assert.ok(!("audit" in r.body), "CLIENT must not see audit trail");
  });
});
