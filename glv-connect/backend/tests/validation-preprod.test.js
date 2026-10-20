/**
 * Pre-production validation suite — Phase 0 hardening
 *
 * Covers:
 *   - Document ID year (current + injectable future year)
 *   - Client A/B isolation (record + document access)
 *   - Brute-force block + audit log entry
 *   - User creation → first_login forced change
 *   - Password recovery: one-use token + expiry
 *   - GLV code: auto-generated on KYC activation, unique, not manually editable
 *   - server.js: no duplicate imports or route mounts
 *   - Migration: all Phase 0 tables/columns present on fresh DB
 *
 * Run:
 *   node --test --experimental-test-isolation=none tests/validation-preprod.test.js
 *
 * NO real data. NO real secrets. NO emails sent. NO Railway config touched.
 */

const { test, describe, before } = require("node:test");
const assert = require("node:assert/strict");

process.env.DB_PATH     = ":memory:";
process.env.JWT_SECRET  = "validation-preprod-secret-xyzABC1234567890";
process.env.NODE_ENV    = "test";

const request = require("supertest");
const app     = require("../server");

// ─── Shared helpers ──────────────────────────────────────────────────────────

function getDb() { return require("../db/database"); }

function makeHash(plain) {
  return require("bcryptjs").hashSync(plain, 10);
}

/** Create an internal user and return their id. */
function seedUser(db, { username, password = "TestPass12345!", role = "AGENTE", firstLogin = 0, email }) {
  const res = db.prepare(`
    INSERT OR IGNORE INTO users (username, password, role, name, email, active, first_login)
    VALUES (?, ?, ?, ?, ?, 1, ?)
  `).run(username, makeHash(password), role, username, email || `${username}@test.invalid`, firstLogin);
  return res.lastInsertRowid;
}

/** Create a client and return its id. */
function seedClient(db, { name, email, kycStatus = "PRE_REGISTRATION" }) {
  const res = db.prepare(
    "INSERT INTO clients (name, company, email, kyc_status, active) VALUES (?, ?, ?, ?, 1)"
  ).run(name, name, email, kycStatus);
  return res.lastInsertRowid;
}

/** Link a user to a client via linked_client_id. */
function linkUserToClient(db, userId, clientId) {
  db.prepare("UPDATE users SET linked_client_id = ? WHERE id = ?").run(clientId, userId);
}

/** Authenticate and return a cookie-holding supertest agent. */
async function loginAgent(agentArg, username, password = "TestPass12345!") {
  return agentArg.post("/auth/login").send({ username, password });
}

// ─── 1. Document ID — year is dynamic ────────────────────────────────────────

describe("Document ID — year", () => {
  test("genId uses current year (2026)", () => {
    const db      = getDb();
    const { genId } = require("../utils/docId");
    const id = genId("SCO", db, new Date("2026-06-15T12:00:00Z"));
    assert.match(id, /^SCO-GLV-2026-\d{3}$/, "ID should contain year 2026");
  });

  test("genId uses year from injected date (2027)", () => {
    const db      = getDb();
    const { genId } = require("../utils/docId");
    const id = genId("FCO", db, new Date("2027-01-01T00:00:00Z"));
    assert.match(id, /^FCO-GLV-2027-\d{3}$/, "ID should contain year 2027");
  });

  test("genId increments counter per type", () => {
    const db      = getDb();
    const { genId } = require("../utils/docId");
    const a = genId("SPA", db, new Date("2026-03-01"));
    const b = genId("SPA", db, new Date("2026-03-01"));
    const nA = parseInt(a.split("-").pop(), 10);
    const nB = parseInt(b.split("-").pop(), 10);
    assert.ok(nB >= nA, "counter should be non-decreasing");
  });
});

// ─── 2. Client A/B isolation ──────────────────────────────────────────────────

describe("Client isolation — A cannot access B", () => {
  let agentA, agentB;
  let clientAId, clientBId;

  before(async () => {
    const db = getDb();

    clientAId = seedClient(db, { name: "Company Alpha", email: "alpha@test.invalid", kycStatus: "ACTIVE_CLIENT" });
    clientBId = seedClient(db, { name: "Company Beta",  email: "beta@test.invalid",  kycStatus: "ACTIVE_CLIENT" });

    const userAId = seedUser(db, { username: "client_alpha", email: "ua@test.invalid", role: "CLIENT" });
    const userBId = seedUser(db, { username: "client_beta",  email: "ub@test.invalid", role: "CLIENT" });
    linkUserToClient(db, userAId, clientAId);
    linkUserToClient(db, userBId, clientBId);

    agentA = request.agent(app);
    agentB = request.agent(app);
    await loginAgent(agentA, "client_alpha");
    await loginAgent(agentB, "client_beta");
  });

  test("client A login succeeds", async () => {
    const res = await loginAgent(request.agent(app), "client_alpha");
    assert.equal(res.status, 200, "client A should log in");
  });

  test("client A GET /clients returns only own record", async () => {
    const res = await agentA.get("/clients");
    assert.equal(res.status, 200);
    const ids = res.body.map(r => r.id);
    assert.ok(ids.includes(clientAId), "should include own record");
    assert.ok(!ids.includes(clientBId), "should NOT include client B record");
  });

  test("client A GET /clients/:idB returns 403", async () => {
    const res = await agentA.get(`/clients/${clientBId}`);
    assert.equal(res.status, 403, "should be forbidden from client B record");
  });

  test("client A GET /clients/:idA returns 200", async () => {
    const res = await agentA.get(`/clients/${clientAId}`);
    assert.equal(res.status, 200, "should access own client record");
    assert.equal(res.body.id, clientAId);
  });

  test("client B GET /clients/:idA returns 403", async () => {
    const res = await agentB.get(`/clients/${clientAId}`);
    assert.equal(res.status, 403, "client B should not access client A record");
  });

  test("client A GET /clients/:idA/kyc-data returns 403 (level 65 required)", async () => {
    const res = await agentA.get(`/clients/${clientAId}/kyc-data`);
    assert.equal(res.status, 403, "CLIENT role cannot access kyc-data endpoint");
  });

  test("documents list: client A only sees own documents", async () => {
    const db = getDb();
    // Insert a document belonging to client_alpha (agent field = username)
    db.prepare(`
      INSERT INTO documents (id, type, status, client, agent, date, destination, product)
      VALUES (?, 'SCO', 'Emitido', 'Company Alpha', 'client_alpha', date('now'), 'UAE', 'Live sheep')
    `).run("SCO-GLV-2026-T01");

    const res = await agentA.get("/documents");
    assert.equal(res.status, 200);
    const ids = res.body.map(d => d.id || d.agent);
    // All returned docs should be agent=client_alpha
    const foreign = res.body.filter(d => d.agent !== "client_alpha");
    assert.equal(foreign.length, 0, "client A should not see other agents' documents");
  });
});

// ─── 3. Brute-force block + audit log ────────────────────────────────────────

describe("Brute-force protection + audit log", () => {
  before(() => {
    const db = getDb();
    seedUser(db, { username: "brutetest_preprod", email: "bt@test.invalid" });
  });

  test("first 5 failed attempts return 401, not 429", async () => {
    const ag = request.agent(app);
    for (let i = 0; i < 5; i++) {
      const r = await ag.post("/auth/login").send({ username: "brutetest_preprod", password: "wrongpass!!" });
      assert.equal(r.status, 401, `attempt ${i + 1} should return 401`);
    }
  });

  test("6th attempt returns 429 (locked)", async () => {
    const ag = request.agent(app);
    const res = await ag.post("/auth/login").send({ username: "brutetest_preprod", password: "wrongpass!!" });
    assert.equal(res.status, 429, "should be locked on 6th attempt");
  });

  test("lock-out event is recorded in audit_log", async () => {
    const db = getDb();
    const entry = db.prepare(
      "SELECT * FROM audit_log WHERE username = ? AND action = ? ORDER BY id DESC LIMIT 1"
    ).get("brutetest_preprod", "LOGIN_BRUTE_FORCE_BLOCKED");
    assert.ok(entry, "LOGIN_BRUTE_FORCE_BLOCKED should appear in audit_log");
    assert.equal(entry.username, "brutetest_preprod");
  });

  test("locked user with correct password still gets 429", async () => {
    const ag = request.agent(app);
    const res = await ag.post("/auth/login").send({ username: "brutetest_preprod", password: "TestPass12345!" });
    assert.equal(res.status, 429, "even correct password should be blocked while locked");
  });
});

// ─── 4. User creation → forced first-login password change ───────────────────

describe("User creation + first-login enforcement", () => {
  let adminAgent;
  let newUserId;
  const NEW_USER = "newstaff_preprod";
  const TEMP_PASS = "TempPass12345!";
  const FINAL_PASS = "FinalPass99999!";

  before(async () => {
    const db = getDb();
    // Give mvalencia admin-level access
    db.prepare("UPDATE users SET role = 'SUPER_ADMIN', first_login = 0 WHERE username = 'mvalencia'")
      .run();
    db.prepare("UPDATE users SET password = ? WHERE username = 'mvalencia'")
      .run(makeHash("AdminPass12345!"));

    adminAgent = request.agent(app);
    await loginAgent(adminAgent, "mvalencia", "AdminPass12345!");
  });

  test("admin can create a user with first_login = 1", async () => {
    const res = await adminAgent.post("/admin/users").send({
      username:           NEW_USER,
      name:               "New Staff Member",
      email:              "newstaff@test.invalid",
      role:               "AGENTE",
      temporary_password: TEMP_PASS,
    });
    assert.equal(res.status, 201, `should create user, got: ${JSON.stringify(res.body)}`);
    assert.equal(res.body.first_login, 1, "new user should have first_login = 1");
    newUserId = res.body.id;
  });

  test("new user can log in with temp password and gets first_login flag", async () => {
    const res = await loginAgent(request.agent(app), NEW_USER, TEMP_PASS);
    assert.equal(res.status, 200, "new user should log in");
    assert.equal(res.body.user.first_login, 1, "JWT payload should include first_login = 1");
  });

  test("new user can change password without current password (first_login)", async () => {
    const ag = request.agent(app);
    await loginAgent(ag, NEW_USER, TEMP_PASS);
    const res = await ag.post("/auth/change-password").send({
      newPassword: FINAL_PASS,
    });
    assert.equal(res.status, 200, "first-login change should succeed without currentPassword");
    assert.ok(res.body.ok);
  });

  test("after password change, first_login = 0", async () => {
    const ag = request.agent(app);
    const loginRes = await loginAgent(ag, NEW_USER, FINAL_PASS);
    assert.equal(loginRes.status, 200, "should log in with new password");
    assert.equal(loginRes.body.user.first_login, 0, "first_login should be 0 after change");
  });

  test("old temp password no longer works", async () => {
    const res = await loginAgent(request.agent(app), NEW_USER, TEMP_PASS);
    assert.equal(res.status, 401, "old temp password should be invalid");
  });

  test("admin reset re-sets first_login to 1", async () => {
    const res = await adminAgent.post(`/admin/users/${newUserId}/reset-password`).send({
      temporary_password: "AnotherTemp12!",
    });
    assert.equal(res.status, 200, "admin reset should succeed");
    const db = getDb();
    const u = db.prepare("SELECT first_login FROM users WHERE id = ?").get(newUserId);
    assert.equal(u.first_login, 1, "first_login should be reset to 1");
  });
});

// ─── 5. Password recovery — one-use token + expiry ───────────────────────────

describe("Password recovery — token lifecycle", () => {
  const RECOVER_USER = "recover_preprod";
  const RECOVER_EMAIL = "recover@test.invalid";
  const NEW_PASS = "RecoveredPass12!";
  let rawToken;

  before(() => {
    const db = getDb();
    seedUser(db, { username: RECOVER_USER, email: RECOVER_EMAIL });
  });

  test("forgot-password returns 200 regardless of email existence (no enumeration)", async () => {
    const ag = request.agent(app);
    const r1 = await ag.post("/auth/forgot-password").send({ email: RECOVER_EMAIL });
    const r2 = await ag.post("/auth/forgot-password").send({ email: "ghost@test.invalid" });
    assert.equal(r1.status, 200);
    assert.equal(r2.status, 200);
  });

  test("valid email generates a token in password_reset_tokens", async () => {
    const ag = request.agent(app);
    await ag.post("/auth/forgot-password").send({ email: RECOVER_EMAIL });

    // Give the async handler time to write
    await new Promise(r => setTimeout(r, 100));

    const db = getDb();
    const user = db.prepare("SELECT id FROM users WHERE username = ?").get(RECOVER_USER);
    const row  = db.prepare(
      "SELECT * FROM password_reset_tokens WHERE user_id = ? ORDER BY id DESC LIMIT 1"
    ).get(user.id);
    assert.ok(row, "token row should exist");
    assert.ok(!row.used_at, "token should not be used yet");

    // Reconstruct rawToken from DB is impossible (hash is one-way).
    // Instead, generate one directly for the remaining tests.
    const crypto = require("crypto");
    rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 60 * 60 * 1000).toISOString().slice(0, 19).replace("T", " ");
    db.prepare(
      "INSERT INTO password_reset_tokens (token_hash, user_id, created_at, expires_at, created_from_ip) VALUES (?, ?, datetime('now'), ?, ?)"
    ).run(tokenHash, user.id, expiresAt, "127.0.0.1");
  });

  test("reset with valid token and strong password succeeds", async () => {
    const ag  = request.agent(app);
    const res = await ag.post("/auth/reset-password").send({ token: rawToken, newPassword: NEW_PASS });
    assert.equal(res.status, 200, `should succeed, got ${JSON.stringify(res.body)}`);
    assert.ok(res.body.ok);
  });

  test("reset with same token again returns 400 (already used)", async () => {
    const ag  = request.agent(app);
    const res = await ag.post("/auth/reset-password").send({ token: rawToken, newPassword: NEW_PASS });
    assert.equal(res.status, 400, "reused token should be rejected");
    assert.ok(res.body.error, "should include error message");
  });

  test("reset with expired token returns 400", async () => {
    const crypto = require("crypto");
    const db     = getDb();
    const user   = db.prepare("SELECT id FROM users WHERE username = ?").get(RECOVER_USER);
    const expiredToken = crypto.randomBytes(32).toString("hex");
    const expiredHash  = crypto.createHash("sha256").update(expiredToken).digest("hex");
    db.prepare(
      "INSERT INTO password_reset_tokens (token_hash, user_id, created_at, expires_at, created_from_ip) VALUES (?, ?, datetime('now','-2 hours'), datetime('now','-1 hour'), ?)"
    ).run(expiredHash, user.id, "127.0.0.1");

    const ag  = request.agent(app);
    const res = await ag.post("/auth/reset-password").send({ token: expiredToken, newPassword: NEW_PASS });
    assert.equal(res.status, 400, "expired token should be rejected");
  });

  test("reset with short password returns 400 (min 12 chars)", async () => {
    const ag  = request.agent(app);
    const res = await ag.post("/auth/reset-password").send({ token: "any-token", newPassword: "Short1!" });
    assert.equal(res.status, 400);
    assert.ok(res.body.error.includes("12"), "error should mention 12 characters");
  });

  test("user can log in with new password after recovery", async () => {
    const res = await loginAgent(request.agent(app), RECOVER_USER, NEW_PASS);
    assert.equal(res.status, 200, "user should log in with recovered password");
  });
});

// ─── 6. GLV Code — auto-generated, unique, not editable ──────────────────────

describe("GLV Code — activation and uniqueness", () => {
  let complianceAgent;
  let clientX_id, clientY_id;

  before(async () => {
    const db = getDb();
    // Compliance user (level 65) can perform KYC transitions
    seedUser(db, { username: "compliance_vp", email: "cv@test.invalid", role: "COMPLIANCE" });

    complianceAgent = request.agent(app);
    await loginAgent(complianceAgent, "compliance_vp");

    clientX_id = seedClient(db, { name: "Client X GLV", email: "cx@test.invalid" });
    clientY_id = seedClient(db, { name: "Client Y GLV", email: "cy@test.invalid" });
  });

  test("GLV code not set before ACTIVE_CLIENT", () => {
    const db = getDb();
    const c = db.prepare("SELECT glv_code_permanent FROM clients WHERE id = ?").get(clientX_id);
    assert.ok(!c.glv_code_permanent, "glv_code_permanent should be null before activation");
  });

  test("ACTIVE_CLIENT transition auto-generates glv_code_permanent", async () => {
    const res = await complianceAgent
      .patch(`/clients/${clientX_id}/kyc-status`)
      .send({ kyc_status: "ACTIVE_CLIENT" });
    assert.equal(res.status, 200, `transition should succeed, got: ${JSON.stringify(res.body)}`);
    assert.ok(res.body.glv_code_permanent, "glv_code_permanent should be set after activation");
    assert.match(
      res.body.glv_code_permanent,
      /^GLV-CO-CLI-\d{4}-\d{5}$/,
      "code format should be GLV-CO-CLI-YYYY-NNNNN"
    );
  });

  test("second client gets a different GLV code", async () => {
    const resX = await complianceAgent.get(`/clients/${clientX_id}`);
    const resY = await complianceAgent
      .patch(`/clients/${clientY_id}/kyc-status`)
      .send({ kyc_status: "ACTIVE_CLIENT" });
    assert.equal(resY.status, 200);
    assert.notEqual(
      resX.body.glv_code_permanent,
      resY.body.glv_code_permanent,
      "two clients must receive different GLV codes"
    );
  });

  test("re-activating does NOT overwrite existing GLV code (idempotent)", async () => {
    const before = (await complianceAgent.get(`/clients/${clientX_id}`)).body.glv_code_permanent;
    await complianceAgent.patch(`/clients/${clientX_id}/kyc-status`).send({ kyc_status: "ACTIVE_CLIENT" });
    const after  = (await complianceAgent.get(`/clients/${clientX_id}`)).body.glv_code_permanent;
    assert.equal(before, after, "GLV code must not change on re-activation");
  });

  test("PUT /clients/:id cannot overwrite glv_code_permanent", async () => {
    // The PUT route only accepts non-permanent fields; glv_code_permanent is not in its allowlist
    const db = getDb();
    seedUser(db, { username: "agent_vp", email: "av@test.invalid", role: "AGENTE" });
    const agentAgent = request.agent(app);
    await loginAgent(agentAgent, "agent_vp");

    const before = (await complianceAgent.get(`/clients/${clientX_id}`)).body.glv_code_permanent;
    await agentAgent.put(`/clients/${clientX_id}`).send({ glv_code_permanent: "FAKE-MANUAL-CODE" });
    const after  = (await complianceAgent.get(`/clients/${clientX_id}`)).body.glv_code_permanent;
    assert.equal(before, after, "manual PUT should not change glv_code_permanent");
  });

  test("GLV code is unique in DB (UNIQUE constraint)", () => {
    const db   = getDb();
    const code = "GLV-CO-CLI-2026-TEST01";
    db.prepare("INSERT INTO clients (name, email, glv_code_permanent) VALUES ('Test Unique A', 'tua@test.invalid', ?)")
      .run(code);
    assert.throws(
      () => db.prepare("INSERT INTO clients (name, email, glv_code_permanent) VALUES ('Test Unique B', 'tub@test.invalid', ?)")
             .run(code),
      /UNIQUE constraint failed/,
      "duplicate glv_code_permanent should throw UNIQUE constraint error"
    );
  });
});

// ─── 7. server.js — no duplicate route mounts ────────────────────────────────

describe("server.js — route integrity", () => {
  test("no duplicate route prefixes in server.js", () => {
    const fs      = require("fs");
    const content = fs.readFileSync(require("path").join(__dirname, "../server.js"), "utf8");
    // Extract all app.use("/prefix", ...) lines
    const mounts  = [...content.matchAll(/app\.use\(\s*["']([^"']+)["']/g)].map(m => m[1]);
    const seen    = {};
    const dupes   = [];
    for (const m of mounts) {
      if (seen[m]) dupes.push(m);
      seen[m] = true;
    }
    assert.deepEqual(dupes, [], `duplicate route mounts found: ${dupes.join(", ")}`);
  });

  test("server.js exports app (not undefined)", () => {
    const app = require("../server");
    assert.ok(app, "server.js must export app");
    assert.equal(typeof app, "function", "exported value should be an Express app (function)");
  });

  test("all 14 expected routes are mounted", () => {
    const fs      = require("fs");
    const content = fs.readFileSync(require("path").join(__dirname, "../server.js"), "utf8");
    const required = [
      "/auth", "/documents", "/audit", "/users", "/profile", "/images",
      "/admin", "/clients", "/operations", "/finance", "/tasks",
      "/price-center", "/media", "/backup",
    ];
    for (const route of required) {
      assert.ok(content.includes(`"${route}"`), `server.js should mount route ${route}`);
    }
  });
});

// ─── 8. Migrations — all Phase 0 tables/columns present ──────────────────────

describe("Migrations — Phase 0 schema completeness", () => {
  test("getMigrationStatus reports all Phase 0 tables present", () => {
    const db     = getDb();
    const status = db.getMigrationStatus();
    const checks = [
      ["login_attempts",        "login_attempts table"],
      ["password_reset_tokens", "password_reset_tokens table"],
      ["glv_code_sequences",    "glv_code_sequences table"],
      ["users_linked_client_id",     "users.linked_client_id column"],
      ["clients_glv_code_permanent", "clients.glv_code_permanent column"],
      ["clients_kyc_status",         "clients.kyc_status column"],
      ["documents_commercial_data",  "documents.commercial_data column"],
    ];
    for (const [key, label] of checks) {
      assert.ok(status[key], `${label} should exist`);
    }
  });

  test("glv_code_sequences seeded with at least GLV-CO", () => {
    const db  = getDb();
    const row = db.prepare("SELECT * FROM glv_code_sequences WHERE entity_code = 'GLV-CO'").get();
    assert.ok(row, "GLV-CO sequence should exist");
    assert.ok(row.last_seq >= 0, "last_seq should be a non-negative integer");
  });
});
