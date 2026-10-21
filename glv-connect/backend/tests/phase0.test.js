/**
 * Phase 0 security hardening — integration test suite
 * Run: node --test tests/phase0.test.js
 * Requires supertest: npm install --save-dev supertest
 */

const { test, describe, before, after } = require("node:test");
const assert = require("node:assert/strict");

// Use an in-memory test DB to avoid touching production data
process.env.DB_PATH = ":memory:";
process.env.JWT_SECRET = "test-secret-phase0-hardening-01234567890abcdef";
process.env.NODE_ENV = "test";

const request = require("supertest");
const app     = require("../server"); // re-exports app via module.exports

// ─── Helpers ────────────────────────────────────────────────────────────────

async function loginAs(agent, { username = "mvalencia", password = null } = {}) {
  const db = require("../db/database");
  const bcrypt = require("bcryptjs");
  if (password === null) {
    // set a known password for the test user
    const hash = bcrypt.hashSync("TestPass12345!", 10);
    db.prepare("UPDATE users SET password = ?, first_login = 0 WHERE username = ?").run(hash, username);
    password = "TestPass12345!";
  }
  const res = await agent.post("/auth/login").send({ username, password });
  return res;
}

// ─── Test suite ─────────────────────────────────────────────────────────────

describe("Phase 0 — Auth", () => {
  let agent;
  before(() => {
    agent = request.agent(app);
  });

  test("login with correct credentials returns user payload and sets httpOnly cookie (no token in body)", async () => {
    const res = await loginAs(agent);
    assert.equal(res.status, 200);
    assert.ok(!res.body.token, "token must NOT be in response body — httpOnly cookie only");
    assert.ok(res.body.user, "should return user payload");
    const cookie = res.headers["set-cookie"];
    assert.ok(cookie && cookie.some(c => c.startsWith("glv_token=")), "should set glv_token cookie");
  });

  test("login with wrong password returns 401", async () => {
    const res = await agent.post("/auth/login").send({ username: "mvalencia", password: "wrongpassword" });
    assert.equal(res.status, 401);
  });

  test("login rate-limits after 5 failed attempts", async () => {
    // Use a unique user that won't interfere with other tests
    const db = require("../db/database");
    const bcrypt = require("bcryptjs");
    db.prepare("INSERT OR IGNORE INTO users (username, password, role, name, email, active) VALUES (?, ?, ?, ?, ?, 1)")
      .run("ratelimit_test", bcrypt.hashSync("TestPass12345!", 10), "AGENTE", "Rate Test", "ratelimit@test.com");

    for (let i = 0; i < 5; i++) {
      await agent.post("/auth/login").send({ username: "ratelimit_test", password: "wrongwrong" });
    }
    const res = await agent.post("/auth/login").send({ username: "ratelimit_test", password: "wrongwrong" });
    assert.equal(res.status, 429, "should be rate limited after 5 failed attempts");
  });

  test("change-password enforces minimum 12 characters", async () => {
    await loginAs(agent);
    const res = await agent.post("/auth/change-password").send({
      currentPassword: "TestPass12345!",
      newPassword: "Short1!",
    });
    assert.equal(res.status, 400, "should reject short password");
    assert.ok(res.body.error.includes("12"), "error message should mention 12 characters");
  });

  test("change-password with 12+ chars succeeds", async () => {
    await loginAs(agent);
    const res = await agent.post("/auth/change-password").send({
      currentPassword: "TestPass12345!",
      newPassword: "NewSecurePass12!",
    });
    assert.equal(res.status, 200);
    assert.ok(res.body.ok);
  });

  test("GET /auth/me returns user when authenticated via cookie", async () => {
    await loginAs(agent); // re-login with fresh password
    const res = await agent.get("/auth/me");
    assert.equal(res.status, 200);
    assert.ok(res.body.username);
  });

  test("POST /auth/logout clears cookie", async () => {
    await loginAs(agent);
    const res = await agent.post("/auth/logout");
    assert.equal(res.status, 200);
    assert.ok(res.body.ok);
    const cookie = res.headers["set-cookie"];
    assert.ok(!cookie || cookie.some(c => c.includes("glv_token=;")), "cookie should be cleared");
  });

  test("GET /auth/me returns 401 after logout", async () => {
    // fresh agent with no session
    const freshAgent = request.agent(app);
    const res = await freshAgent.get("/auth/me");
    assert.equal(res.status, 401);
  });

  test("forgot-password always returns 200 (no user enumeration)", async () => {
    const res = await agent.post("/auth/forgot-password").send({ email: "nonexistent@test.com" });
    assert.equal(res.status, 200);
    assert.ok(res.body.ok);
  });

  test("reset-password with invalid token returns 400", async () => {
    const res = await agent.post("/auth/reset-password").send({
      token: "invalid-token-abc123",
      newPassword: "NewSecurePass12!",
    });
    assert.equal(res.status, 400);
  });

  test("reset-password with short password returns 400", async () => {
    const res = await agent.post("/auth/reset-password").send({
      token: "any-token",
      newPassword: "short",
    });
    assert.equal(res.status, 400);
    assert.ok(res.body.error.includes("12"));
  });
});

describe("Phase 0 — GLV Code", () => {
  test("generateGlvCode returns correct format", () => {
    const { generateGlvCode } = require("../utils/glvCode");
    const year = new Date().getFullYear();
    const code = generateGlvCode("GLV-CO");
    assert.match(code, new RegExp(`^GLV-CO-CLI-${year}-\\d{5}$`), "code format should match GLV-CO-CLI-YYYY-NNNNN");
  });

  test("generateGlvCode increments sequentially", () => {
    const { generateGlvCode } = require("../utils/glvCode");
    const c1 = generateGlvCode("GLV-CO");
    const c2 = generateGlvCode("GLV-CO");
    const n1 = parseInt(c1.split("-").pop(), 10);
    const n2 = parseInt(c2.split("-").pop(), 10);
    assert.equal(n2 - n1, 1, "sequence should increment by 1");
  });

  test("generateGlvCode throws for unknown entity_code", () => {
    const { generateGlvCode } = require("../utils/glvCode");
    assert.throws(() => generateGlvCode("UNKNOWN"), /Unknown entity_code/);
  });
});

describe("Phase 0 — Migration Status", () => {
  test("getMigrationStatus reports all Phase 0 tables present", () => {
    const db = require("../db/database");
    const status = db.getMigrationStatus();
    assert.ok(status.login_attempts,        "login_attempts table should exist");
    assert.ok(status.password_reset_tokens, "password_reset_tokens table should exist");
    assert.ok(status.glv_code_sequences,    "glv_code_sequences table should exist");
    assert.ok(status.users_linked_client_id,     "users.linked_client_id column should exist");
    assert.ok(status.clients_glv_code_permanent, "clients.glv_code_permanent column should exist");
    assert.ok(status.clients_kyc_status,         "clients.kyc_status column should exist");
    assert.ok(status.documents_commercial_data,  "documents.commercial_data column should exist");
  });
});

describe("Phase 0 — Client Isolation", () => {
  test("unauthenticated request to /clients returns 401", async () => {
    const freshAgent = request.agent(app);
    const res = await freshAgent.get("/clients");
    assert.equal(res.status, 401);
  });
});
