"use strict";

// Commercial Engine test suite — 8 scenarios
// node --test --experimental-test-isolation=none tests/commercial-engine.test.js

const { test, describe, before, after } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");

// ── test-only env guards ───────────────────────────────────────────────────────
process.env.DB_PATH   = ":memory:";
process.env.NODE_ENV  = "test";

const app = require("../server");
const db  = require("../db/database");

// ── helpers ────────────────────────────────────────────────────────────────────
function loginAs(username, password = "Admin1234!") {
  return request(app)
    .post("/auth/login")
    .send({ username, password })
    .then(r => {
      if (r.status !== 200) throw new Error(`Login ${username} failed: ${r.status} ${JSON.stringify(r.body)}`);
      // Cookie-only auth: return set-cookie array (no bearer token in body)
      return r.headers["set-cookie"];
    });
}

function auth(cookies) {
  return (req) => req.set("Cookie", cookies);
}

// ══════════════════════════════════════════════════════════════════════════════
// All commercial tests are wrapped in a single describe to scope before/after
// hooks and prevent root-level state pollution in combined test runs.
// ══════════════════════════════════════════════════════════════════════════════
describe("Commercial Engine", () => {

// ── fixture state ──────────────────────────────────────────────────────────────
let directorToken, agenteToken, clientToken;
let agentCommToken, managerToken, superAdminToken;
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

  // COMMERCIAL_AGENT (level 42) — new role
  db.prepare(`
    INSERT OR IGNORE INTO users (username, password, role, name, email, active, first_login, profile_completed)
    VALUES ('test_comm_agent', ?, 'COMMERCIAL_AGENT', 'Test Comm Agent', 'cagent@test.glv', 1, 0, 1)
  `).run(hash);

  // COMMERCIAL_MANAGER (level 72) — new role, can approve
  db.prepare(`
    INSERT OR IGNORE INTO users (username, password, role, name, email, active, first_login, profile_completed)
    VALUES ('test_comm_manager', ?, 'COMMERCIAL_MANAGER', 'Test Comm Manager', 'cmanager@test.glv', 1, 0, 1)
  `).run(hash);

  // SUPER_ADMIN (level 100) — can approve
  db.prepare(`
    INSERT OR IGNORE INTO users (username, password, role, name, email, active, first_login, profile_completed)
    VALUES ('test_super_adm', ?, 'SUPER_ADMIN', 'Test Super Admin', 'sadm@test.glv', 1, 0, 1)
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

  directorToken  = await loginAs("test_director");
  agenteToken    = await loginAs("test_agente");
  clientToken    = await loginAs("test_client_ext");
  agentCommToken = await loginAs("test_comm_agent");
  managerToken   = await loginAs("test_comm_manager");
  superAdminToken = await loginAs("test_super_adm");
});

after(() => {
  // Cleanup all test data (order matters for FK constraints)
  try { db.prepare("UPDATE documents SET quote_id = NULL WHERE id LIKE 'SCO-TEST-LINK-%'").run(); } catch (_) {}
  try { db.prepare("DELETE FROM documents WHERE id LIKE 'SCO-TEST-LINK-%'").run(); } catch (_) {}
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
      "total_cost_per_unit", "target_margin", "internal_notes", "min_authorized_price",
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

// ══════════════════════════════════════════════════════════════════════════════
// Suite 9 — COMMERCIAL_AGENT RBAC: can draft quotes, cannot approve or modify rules
// ══════════════════════════════════════════════════════════════════════════════
describe("Suite 9 — COMMERCIAL_AGENT: can draft, cannot approve or modify rules", () => {
  let agentDraftId;

  test("COMMERCIAL_AGENT can create a DRAFT quote", async () => {
    const r = await auth(agentCommToken)(request(app)
      .post("/commercial/quotes")
      .send({
        origin_country: "AR",
        destination_country: "SA",
        incoterm: "CIF",
        currency: "USD",
        quantity: 3000,
        unit: "kg",
      }));
    assert.strictEqual(r.status, 201, JSON.stringify(r.body));
    assert.strictEqual(r.body.status, "DRAFT");
    agentDraftId = r.body.id;
  });

  test("COMMERCIAL_AGENT can calculate a quote (level >= 40)", async () => {
    const r = await auth(agentCommToken)(request(app)
      .post(`/commercial/quotes/${agentDraftId}/calculate`));
    assert.strictEqual(r.status, 200, JSON.stringify(r.body));
    assert.ok(r.body.price_per_unit > 0, "price must be calculated");
  });

  test("COMMERCIAL_AGENT can submit a quote to PENDING_APPROVAL", async () => {
    const r = await auth(agentCommToken)(request(app)
      .post(`/commercial/quotes/${agentDraftId}/submit`));
    assert.strictEqual(r.status, 200, JSON.stringify(r.body));
    assert.strictEqual(r.body.status, "PENDING_APPROVAL");
  });

  test("COMMERCIAL_AGENT cannot approve a quote (level 42 < 70)", async () => {
    const r = await auth(agentCommToken)(request(app)
      .post(`/commercial/quotes/${agentDraftId}/approve`));
    assert.strictEqual(r.status, 403, "COMMERCIAL_AGENT must be denied approval");
  });

  test("COMMERCIAL_AGENT cannot create a price matrix entry (level 42 < 70)", async () => {
    const r = await auth(agentCommToken)(request(app)
      .post("/commercial/price-matrix")
      .send({ origin_country: "AR", destination_country: "SA", incoterm: "CIF", base_cost: 1.00 }));
    assert.strictEqual(r.status, 403, "COMMERCIAL_AGENT must not create price matrix");
  });

  test("COMMERCIAL_AGENT cannot modify commercial rules (level 42 < 70)", async () => {
    const r = await auth(agentCommToken)(request(app)
      .post("/commercial/rules")
      .send({ min_price_floor: 0.01, max_discount_pct: 0 }));
    assert.strictEqual(r.status, 403, "COMMERCIAL_AGENT must not create/modify rules");
  });

  test("COMMERCIAL_AGENT cannot patch price matrix (level 42 < 70)", async () => {
    const r = await auth(agentCommToken)(request(app)
      .patch(`/commercial/price-matrix/${matrixId}`)
      .send({ base_cost: 0.01 }));
    assert.strictEqual(r.status, 403, "COMMERCIAL_AGENT must not patch price matrix");
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Suite 10 — COMMERCIAL_MANAGER and SUPER_ADMIN can approve within their permissions
// ══════════════════════════════════════════════════════════════════════════════
describe("Suite 10 — COMMERCIAL_MANAGER and SUPER_ADMIN can approve quotes", () => {
  let managerQuoteId, superQuoteId;

  before(async () => {
    // Create + calculate + submit a quote for manager approval
    const q1 = await auth(agenteToken)(request(app)
      .post("/commercial/quotes")
      .send({ origin_country: "AR", destination_country: "SA", incoterm: "CIF", currency: "USD", quantity: 8000, unit: "kg" }));
    managerQuoteId = q1.body.id;
    await auth(agenteToken)(request(app).post(`/commercial/quotes/${managerQuoteId}/calculate`));
    await auth(agenteToken)(request(app).post(`/commercial/quotes/${managerQuoteId}/submit`));

    // Create + calculate + submit a quote for super admin approval
    const q2 = await auth(agenteToken)(request(app)
      .post("/commercial/quotes")
      .send({ origin_country: "AR", destination_country: "SA", incoterm: "CIF", currency: "USD", quantity: 9000, unit: "kg" }));
    superQuoteId = q2.body.id;
    await auth(agenteToken)(request(app).post(`/commercial/quotes/${superQuoteId}/calculate`));
    await auth(agenteToken)(request(app).post(`/commercial/quotes/${superQuoteId}/submit`));
  });

  test("COMMERCIAL_MANAGER (level 72) can approve a PENDING_APPROVAL quote", async () => {
    const r = await auth(managerToken)(request(app)
      .post(`/commercial/quotes/${managerQuoteId}/approve`));
    assert.strictEqual(r.status, 200, JSON.stringify(r.body));
    assert.strictEqual(r.body.status, "APPROVED");
    assert.strictEqual(r.body.price_locked, 1);
    assert.ok(r.body.approved_by === "test_comm_manager", "approved_by must reflect COMMERCIAL_MANAGER");
  });

  test("SUPER_ADMIN (level 100) can approve a PENDING_APPROVAL quote", async () => {
    const r = await auth(superAdminToken)(request(app)
      .post(`/commercial/quotes/${superQuoteId}/approve`));
    assert.strictEqual(r.status, 200, JSON.stringify(r.body));
    assert.strictEqual(r.body.status, "APPROVED");
    assert.strictEqual(r.body.price_locked, 1);
    assert.ok(r.body.approved_by === "test_super_adm", "approved_by must reflect SUPER_ADMIN");
  });

  test("COMMERCIAL_MANAGER can also create a price matrix entry (level 72 >= 70)", async () => {
    const r = await auth(managerToken)(request(app)
      .post("/commercial/price-matrix")
      .send({
        origin_country: "BR", destination_country: "SA",
        incoterm: "FOB", base_cost: 3.00, target_margin: 0.18, valid_from: "2026-01-01",
      }));
    assert.strictEqual(r.status, 201, JSON.stringify(r.body));
    // cleanup — remove it
    if (r.body.id) {
      db.prepare("DELETE FROM commercial_price_matrix WHERE id = ?").run(r.body.id);
    }
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Suite 11 — Expired, inactive, and out-of-volume rules do not restrict quotes
// ══════════════════════════════════════════════════════════════════════════════
describe("Suite 11 — Expired, inactive, and out-of-volume rules do not restrict quotes", () => {
  test("Expired rule (valid_until in past) does not block quote calculation", async () => {
    // Create a rule with a past valid_until and an impossibly high min_price_floor
    await auth(directorToken)(request(app)
      .post("/commercial/rules")
      .send({
        origin_country: "AR", destination_country: "SA", incoterm: "CIF",
        min_price_floor: 9999.00,
        valid_from: "2020-01-01",
        valid_until: "2020-12-31",   // expired in the past
        max_discount_pct: 0,
      }));

    const createR = await auth(agenteToken)(request(app)
      .post("/commercial/quotes")
      .send({ origin_country: "AR", destination_country: "SA", incoterm: "CIF", currency: "USD", quantity: 1000, unit: "kg" }));
    assert.strictEqual(createR.status, 201);

    const calcR = await auth(agenteToken)(request(app)
      .post(`/commercial/quotes/${createR.body.id}/calculate`));
    assert.strictEqual(calcR.status, 200,
      `Expired rule must not block calculation — got ${calcR.status}: ${JSON.stringify(calcR.body)}`);
    assert.ok(calcR.body.price_per_unit > 0, "price_per_unit must be set by matrix");
  });

  test("Inactive rule (status=INACTIVE) does not block quote calculation", async () => {
    // Create an inactive rule with impossibly high min_price_floor
    const ruleR = await auth(directorToken)(request(app)
      .post("/commercial/rules")
      .send({
        origin_country: "AR", destination_country: "SA", incoterm: "CIF",
        min_price_floor: 9999.00, max_discount_pct: 0,
        valid_from: "2026-01-01",
      }));
    assert.strictEqual(ruleR.status, 201);
    // Deactivate the rule
    await auth(directorToken)(request(app)
      .patch(`/commercial/rules/${ruleR.body.id}`)
      .send({ status: "INACTIVE" }));

    const createR = await auth(agenteToken)(request(app)
      .post("/commercial/quotes")
      .send({ origin_country: "AR", destination_country: "SA", incoterm: "CIF", currency: "USD", quantity: 1500, unit: "kg" }));
    const calcR = await auth(agenteToken)(request(app)
      .post(`/commercial/quotes/${createR.body.id}/calculate`));
    assert.strictEqual(calcR.status, 200,
      `Inactive rule must not block calculation — got ${calcR.status}: ${JSON.stringify(calcR.body)}`);
  });

  test("Out-of-volume rule (min_volume > quantity) does not restrict quote", async () => {
    // Rule only applies for orders >= 99999 kg; quote is 500 kg — rule must not apply
    await auth(directorToken)(request(app)
      .post("/commercial/rules")
      .send({
        origin_country: "AR", destination_country: "SA", incoterm: "CIF",
        min_volume: 99999, min_volume_unit: "kg",
        min_price_floor: 9999.00, max_discount_pct: 0,
        valid_from: "2026-01-01",
      }));

    const createR = await auth(agenteToken)(request(app)
      .post("/commercial/quotes")
      .send({ origin_country: "AR", destination_country: "SA", incoterm: "CIF", currency: "USD", quantity: 500, unit: "kg" }));
    assert.strictEqual(createR.status, 201);

    const calcR = await auth(agenteToken)(request(app)
      .post(`/commercial/quotes/${createR.body.id}/calculate`));
    assert.strictEqual(calcR.status, 200,
      `Out-of-volume rule must not block small-quantity quote — got ${calcR.status}: ${JSON.stringify(calcR.body)}`);
    assert.ok(calcR.body.price_per_unit > 0, "price must be calculated from matrix");
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Suite 12 — SCO/FCO/SPA existing documents receive versioned quote without duplication
// ══════════════════════════════════════════════════════════════════════════════
describe("Suite 12 — SCO/FCO/SPA linked to approved quote without duplicating documents", () => {
  let linkQuoteId, scoDocId, fcoDocId;

  before(async () => {
    const today = new Date().toISOString().slice(0, 10);
    scoDocId = `SCO-TEST-LINK-${Date.now()}`;
    fcoDocId = `FCO-TEST-LINK-${Date.now()}`;

    // Insert test documents directly (existing SCO and FCO)
    db.prepare(`
      INSERT INTO documents (id, type, status, client, agent, date, destination, product)
      VALUES (?, 'SCO', 'active', 'Link Test Client', 'test_agente', ?, 'SA', 'Beef')
    `).run(scoDocId, today);
    db.prepare(`
      INSERT INTO documents (id, type, status, client, agent, date, destination, product)
      VALUES (?, 'FCO', 'active', 'Link Test Client', 'test_agente', ?, 'SA', 'Beef')
    `).run(fcoDocId, today);

    // Create, calculate, submit, approve a quote for linking
    const qr = await auth(agenteToken)(request(app)
      .post("/commercial/quotes")
      .send({ origin_country: "AR", destination_country: "SA", incoterm: "CIF", currency: "USD", quantity: 6000, unit: "kg" }));
    linkQuoteId = qr.body.id;
    await auth(agenteToken)(request(app).post(`/commercial/quotes/${linkQuoteId}/calculate`));
    await auth(agenteToken)(request(app).post(`/commercial/quotes/${linkQuoteId}/submit`));
    await auth(directorToken)(request(app).post(`/commercial/quotes/${linkQuoteId}/approve`));
  });

  test("Approved quote can be linked to an existing SCO document", async () => {
    const r = await auth(agenteToken)(request(app)
      .post(`/commercial/quotes/${linkQuoteId}/link-document`)
      .send({ doc_id: scoDocId }));
    assert.strictEqual(r.status, 200, JSON.stringify(r.body));
    assert.strictEqual(r.body.doc_id, scoDocId, "quote.doc_id must reference the SCO");

    // Verify the document itself got quote_id set (reverse FK)
    const doc = db.prepare("SELECT quote_id FROM documents WHERE id = ?").get(scoDocId);
    assert.strictEqual(doc.quote_id, linkQuoteId, "documents.quote_id must point to the approved quote");
  });

  test("Linking does not duplicate the document — document count stays the same", async () => {
    const countBefore = db.prepare("SELECT COUNT(*) AS c FROM documents WHERE id = ?").get(scoDocId).c;
    // link again (idempotent update)
    await auth(agenteToken)(request(app)
      .post(`/commercial/quotes/${linkQuoteId}/link-document`)
      .send({ doc_id: scoDocId }));
    const countAfter = db.prepare("SELECT COUNT(*) AS c FROM documents WHERE id = ?").get(scoDocId).c;
    assert.strictEqual(countAfter, countBefore, "Document must not be duplicated on re-link");
  });

  test("Approved quote can also be linked to an FCO document", async () => {
    const r = await auth(agenteToken)(request(app)
      .post(`/commercial/quotes/${linkQuoteId}/link-document`)
      .send({ doc_id: fcoDocId }));
    assert.strictEqual(r.status, 200, JSON.stringify(r.body));
    assert.strictEqual(r.body.doc_id, fcoDocId);
  });

  test("Only SCO/FCO/SPA document types can be linked — other types are rejected at the DB level", () => {
    // The documents table CHECK constraint enforces type IN ('SCO','FCO','SPA')
    // so any attempt to insert a different type is rejected before link-document can be called
    assert.throws(
      () => db.prepare(
        "INSERT INTO documents (id, type, status, client, agent, date, destination, product) VALUES (?, 'INVOICE', 'active', 'C', 'A', '2026-01-01', 'SA', 'Beef')"
      ).run('INV-TEST-001'),
      /CHECK constraint/,
      "DB must reject non-SCO/FCO/SPA document types"
    );
  });

  test("Non-APPROVED quote cannot be linked to a document", async () => {
    const draftR = await auth(agenteToken)(request(app)
      .post("/commercial/quotes")
      .send({ origin_country: "AR", destination_country: "SA", incoterm: "CIF", currency: "USD", quantity: 200, unit: "kg" }));
    const draftId = draftR.body.id;

    const r = await auth(agenteToken)(request(app)
      .post(`/commercial/quotes/${draftId}/link-document`)
      .send({ doc_id: scoDocId }));
    assert.strictEqual(r.status, 409, "DRAFT quote must not be linkable to a document");
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Suite 13 — CLIENT response excludes total_cost_per_unit; migration status complete
// ══════════════════════════════════════════════════════════════════════════════
describe("Suite 13 — total_cost_per_unit excluded from CLIENT response; migration completeness", () => {
  test("total_cost_per_unit is absent from CLIENT-visible quote (cost data not leaked)", async () => {
    // quoteId (from Suite 4/6) was approved and linked to test_client_ext's client
    // Create a fresh quote linked to the test client and approve it
    const linkedClientId = db.prepare(
      "SELECT linked_client_id FROM users WHERE username = 'test_client_ext'"
    ).get().linked_client_id;

    const qr = await auth(agenteToken)(request(app)
      .post("/commercial/quotes")
      .send({
        origin_country: "AR", destination_country: "SA", incoterm: "CIF",
        currency: "USD", quantity: 1200, unit: "kg",
        client_id: linkedClientId,
      }));
    const tqId = qr.body.id;
    await auth(agenteToken)(request(app).post(`/commercial/quotes/${tqId}/calculate`));
    await auth(agenteToken)(request(app).post(`/commercial/quotes/${tqId}/submit`));
    await auth(directorToken)(request(app).post(`/commercial/quotes/${tqId}/approve`));

    const r = await auth(clientToken)(request(app).get(`/commercial/quotes/${tqId}`));
    assert.strictEqual(r.status, 200, JSON.stringify(r.body));
    assert.ok(!("total_cost_per_unit" in r.body),
      "CLIENT response must NOT include total_cost_per_unit — internal cost must stay hidden");
    assert.ok("price_per_unit" in r.body, "CLIENT may see price_per_unit");
    assert.ok("total_value" in r.body, "CLIENT may see total_value");
  });

  test("getMigrationStatus reports all commercial engine tables present", () => {
    const status = db.getMigrationStatus();
    assert.ok(status.commercial_price_matrix,  "commercial_price_matrix must exist");
    assert.ok(status.commercial_rules,          "commercial_rules must exist");
    assert.ok(status.commercial_quotes,         "commercial_quotes must exist");
    assert.ok(status.commercial_quote_audit,    "commercial_quote_audit must exist");
    assert.ok(status.commercial_quotes_doc_id,  "commercial_quotes.doc_id column must exist");
    assert.ok(status.documents_quote_id,        "documents.quote_id column must exist");
    assert.ok(status.doc_id_sequences_quote,    "QUOTE sequence in doc_id_sequences must exist");
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Suite 14 — Semantic rule applicability: 422 when no rule applies; rule priority
// Cases: a (expired), b (inactive), c (out-of-volume), d (general rule),
//        e (specific > general), f (wrong route), g (CLIENT fields exclusion)
// ══════════════════════════════════════════════════════════════════════════════
describe("Suite 14 — Semantic rule applicability and priority", () => {
  const s14Base = {
    base_cost: 2.00, freight_cost: 0.30, insurance_cost: 0.05,
    operational_cost: 0.15, target_margin: 0.20, valid_from: "2026-01-01",
  };

  before(async () => {
    // Isolated matrices for each test route (no pre-existing rules for any of these)
    for (const origin of ["DE", "IT", "FR", "MX", "CO", "ZZ"]) {
      await auth(directorToken)(request(app)
        .post("/commercial/price-matrix")
        .send({ ...s14Base, origin_country: origin, destination_country: "SA", incoterm: "CIF" }));
    }
  });

  // 3f — different origin/destination with no applicable rule → 422
  test("3f — ZZ→SA CIF: no rule at all → 422 COMMERCIAL_RULE_NOT_APPLICABLE", async () => {
    const cr = await auth(agenteToken)(request(app)
      .post("/commercial/quotes")
      .send({ origin_country: "ZZ", destination_country: "SA", incoterm: "CIF", currency: "USD", quantity: 500, unit: "kg" }));
    assert.strictEqual(cr.status, 201);

    const calcR = await auth(agenteToken)(request(app)
      .post(`/commercial/quotes/${cr.body.id}/calculate`));
    assert.strictEqual(calcR.status, 422,
      `Expected 422 COMMERCIAL_RULE_NOT_APPLICABLE, got ${calcR.status}: ${JSON.stringify(calcR.body)}`);
    assert.strictEqual(calcR.body.code, "COMMERCIAL_RULE_NOT_APPLICABLE");
    assert.strictEqual(calcR.body.blocked, true);
  });

  // 3a — expired rule, no alternative applicable → 422
  test("3a — DE→SA CIF: expired rule only → 422 COMMERCIAL_RULE_NOT_APPLICABLE", async () => {
    await auth(directorToken)(request(app)
      .post("/commercial/rules")
      .send({
        origin_country: "DE", destination_country: "SA", incoterm: "CIF",
        min_price_floor: 9999.00, max_discount_pct: 0,
        valid_from: "2020-01-01", valid_until: "2020-12-31",
      }));

    const cr = await auth(agenteToken)(request(app)
      .post("/commercial/quotes")
      .send({ origin_country: "DE", destination_country: "SA", incoterm: "CIF", currency: "USD", quantity: 500, unit: "kg" }));
    assert.strictEqual(cr.status, 201);

    const calcR = await auth(agenteToken)(request(app)
      .post(`/commercial/quotes/${cr.body.id}/calculate`));
    assert.strictEqual(calcR.status, 422,
      `Expected 422, got ${calcR.status}: ${JSON.stringify(calcR.body)}`);
    assert.strictEqual(calcR.body.code, "COMMERCIAL_RULE_NOT_APPLICABLE",
      "Expired rule with no active alternative must return COMMERCIAL_RULE_NOT_APPLICABLE");
  });

  // 3b — inactive rule, no alternative applicable → 422
  test("3b — IT→SA CIF: inactive rule only → 422 COMMERCIAL_RULE_NOT_APPLICABLE", async () => {
    const ruleR = await auth(directorToken)(request(app)
      .post("/commercial/rules")
      .send({
        origin_country: "IT", destination_country: "SA", incoterm: "CIF",
        min_price_floor: 9999.00, max_discount_pct: 0,
        valid_from: "2026-01-01",
      }));
    assert.strictEqual(ruleR.status, 201);
    await auth(directorToken)(request(app)
      .patch(`/commercial/rules/${ruleR.body.id}`)
      .send({ status: "INACTIVE" }));

    const cr = await auth(agenteToken)(request(app)
      .post("/commercial/quotes")
      .send({ origin_country: "IT", destination_country: "SA", incoterm: "CIF", currency: "USD", quantity: 500, unit: "kg" }));
    assert.strictEqual(cr.status, 201);

    const calcR = await auth(agenteToken)(request(app)
      .post(`/commercial/quotes/${cr.body.id}/calculate`));
    assert.strictEqual(calcR.status, 422,
      `Expected 422, got ${calcR.status}: ${JSON.stringify(calcR.body)}`);
    assert.strictEqual(calcR.body.code, "COMMERCIAL_RULE_NOT_APPLICABLE",
      "Inactive rule with no active alternative must return COMMERCIAL_RULE_NOT_APPLICABLE");
  });

  // 3c — quantity below min_volume, no alternative applicable → 422
  test("3c — FR→SA CIF: out-of-volume rule, quantity=100 < min_volume=50000 → 422 COMMERCIAL_RULE_NOT_APPLICABLE", async () => {
    await auth(directorToken)(request(app)
      .post("/commercial/rules")
      .send({
        origin_country: "FR", destination_country: "SA", incoterm: "CIF",
        min_volume: 50000, min_volume_unit: "kg",
        min_price_floor: 1.00, max_discount_pct: 5,
        valid_from: "2026-01-01",
      }));

    const cr = await auth(agenteToken)(request(app)
      .post("/commercial/quotes")
      .send({ origin_country: "FR", destination_country: "SA", incoterm: "CIF", currency: "USD", quantity: 100, unit: "kg" }));
    assert.strictEqual(cr.status, 201);

    const calcR = await auth(agenteToken)(request(app)
      .post(`/commercial/quotes/${cr.body.id}/calculate`));
    assert.strictEqual(calcR.status, 422,
      `Expected 422, got ${calcR.status}: ${JSON.stringify(calcR.body)}`);
    assert.strictEqual(calcR.body.code, "COMMERCIAL_RULE_NOT_APPLICABLE",
      "Volume below min_volume with no alternative must return COMMERCIAL_RULE_NOT_APPLICABLE");
  });

  // 3d — general rule (no product restriction) valid when no specific rule exists
  test("3d — MX→SA CIF: route-level rule (no product) satisfies requirement → 200", async () => {
    await auth(directorToken)(request(app)
      .post("/commercial/rules")
      .send({
        origin_country: "MX", destination_country: "SA", incoterm: "CIF",
        min_price_floor: 0.50, max_discount_pct: 5,
        valid_from: "2026-01-01",
      }));

    const cr = await auth(agenteToken)(request(app)
      .post("/commercial/quotes")
      .send({ origin_country: "MX", destination_country: "SA", incoterm: "CIF", currency: "USD", quantity: 1000, unit: "kg" }));
    assert.strictEqual(cr.status, 201);

    const calcR = await auth(agenteToken)(request(app)
      .post(`/commercial/quotes/${cr.body.id}/calculate`));
    // matrix sale_price ≈ (2.00+0.30+0.05+0.15)/(1-0.20) = 2.50/0.80 = 3.125; floor=0.50 → OK
    assert.strictEqual(calcR.status, 200,
      `Route-level rule must satisfy requirement when no product-specific rule exists — got ${calcR.status}: ${JSON.stringify(calcR.body)}`);
    assert.ok(calcR.body.price_per_unit > 0, "price_per_unit must be set");
  });

  // 3e — specific rule has priority over general rule
  test("3e — CO→SA CIF: route-specific rule (min_price_floor=9999) overrides global rule (min_price_floor=0.01) → 422", async () => {
    // Global rule (all-NULL route fields): would allow any route at price > 0.01
    await auth(directorToken)(request(app)
      .post("/commercial/rules")
      .send({ min_price_floor: 0.01, max_discount_pct: 0, valid_from: "2026-01-01" }));

    // Route-specific rule for CO→SA CIF: blocks with impossibly high floor
    await auth(directorToken)(request(app)
      .post("/commercial/rules")
      .send({
        origin_country: "CO", destination_country: "SA", incoterm: "CIF",
        min_price_floor: 9999.00, max_discount_pct: 0,
        valid_from: "2026-01-01",
      }));

    const cr = await auth(agenteToken)(request(app)
      .post("/commercial/quotes")
      .send({ origin_country: "CO", destination_country: "SA", incoterm: "CIF", currency: "USD", quantity: 1000, unit: "kg" }));
    assert.strictEqual(cr.status, 201);

    const calcR = await auth(agenteToken)(request(app)
      .post(`/commercial/quotes/${cr.body.id}/calculate`));
    // Route-specific rule (score=3) must be chosen over global rule (score=0)
    // Result: PRICE_BELOW_MINIMUM since 3.125 < 9999 → 422 (not 200 as global rule would allow)
    assert.strictEqual(calcR.status, 422,
      `Route-specific rule must override global rule — got ${calcR.status}: ${JSON.stringify(calcR.body)}`);
    assert.ok(calcR.body.blocked === true, "Response must indicate the quote was blocked");
    assert.ok(
      !calcR.body.code || calcR.body.code !== "COMMERCIAL_RULE_NOT_APPLICABLE",
      "Rule WAS found (route-specific), so code must not be COMMERCIAL_RULE_NOT_APPLICABLE"
    );
  });

  // 3g — CLIENT response excludes all internal cost/margin/price-floor fields
  test("3g — CLIENT response excludes base_cost, freight_cost, insurance_cost, operational_cost, total_cost_per_unit, target_margin, min_authorized_price, matrix_id, rule_id; no audit trail", async () => {
    const linkedClientId = db.prepare(
      "SELECT linked_client_id FROM users WHERE username = 'test_client_ext'"
    ).get().linked_client_id;

    const cr = await auth(agenteToken)(request(app)
      .post("/commercial/quotes")
      .send({
        origin_country: "AR", destination_country: "SA", incoterm: "CIF",
        currency: "USD", quantity: 7000, unit: "kg",
        client_id: linkedClientId,
      }));
    assert.strictEqual(cr.status, 201, JSON.stringify(cr.body));
    const gqId = cr.body.id;

    await auth(agenteToken)(request(app).post(`/commercial/quotes/${gqId}/calculate`));
    await auth(agenteToken)(request(app).post(`/commercial/quotes/${gqId}/submit`));
    await auth(directorToken)(request(app).post(`/commercial/quotes/${gqId}/approve`));

    const r = await auth(clientToken)(request(app).get(`/commercial/quotes/${gqId}`));
    assert.strictEqual(r.status, 200, JSON.stringify(r.body));

    const FORBIDDEN = [
      "base_cost", "freight_cost", "insurance_cost", "operational_cost",
      "total_cost_per_unit", "target_margin", "min_authorized_price",
      "matrix_id", "rule_id", "internal_notes",
    ];
    for (const field of FORBIDDEN) {
      assert.ok(!(field in r.body),
        `CLIENT response must NOT include internal field '${field}' — got: ${JSON.stringify(Object.keys(r.body))}`);
    }

    // Public fields must remain
    assert.ok("price_per_unit" in r.body, "CLIENT may see price_per_unit");
    assert.ok("total_value"    in r.body, "CLIENT may see total_value");
    assert.ok("status"         in r.body, "CLIENT may see status");
    assert.ok("quote_number"   in r.body, "CLIENT may see quote_number");

    // Audit trail must not be exposed to CLIENT
    assert.ok(!("audit" in r.body), "CLIENT must NOT see the audit trail");

    // doc_id (if present) must be a primitive ID, not an embedded object leaking document internals
    if ("doc_id" in r.body && r.body.doc_id !== null) {
      assert.strictEqual(typeof r.body.doc_id, "string",
        "doc_id must be a plain string ID — no embedded document object with internal fields");
    }
  });
});

}); // end describe("Commercial Engine")
