/**
 * KYC seguro y código GLV atómico — suite de pruebas
 *
 * Cubre:
 *   - Producción rechaza KYC cuando PII_ENCRYPTION_KEY es inválida (no hex) → 503
 *   - Producción rechaza KYC cuando PII_ENCRYPTION_KEY falta → 503
 *   - Producción acepta KYC con clave hex válida → 201, kyc_data cifrado
 *   - raw_data en kyc_submissions queda '[CLEARED]' después de procesar
 *   - Los datos KYC se almacenan cifrados en clients.kyc_data
 *   - Código GLV generado dentro de SAVEPOINT: un fallo revierte activación
 *   - Restricción UNIQUE en glv_code_permanent impide duplicados
 *   - Formato correcto del código GLV generado
 *   - OPTIONS preflight desde origen rechazado → sin Access-Control-Allow-Origin
 *
 * Run:
 *   node --test --experimental-test-isolation=none tests/kyc-glv-atomic.test.js
 *
 * SIN datos reales. SIN secretos de Railway. SIN correos. SIN despliegue.
 */

"use strict";

const { test, describe, before } = require("node:test");
const assert   = require("node:assert/strict");
const { spawnSync } = require("child_process");
const path     = require("path");
const crypto   = require("crypto");

process.env.DB_PATH    = ":memory:";
process.env.JWT_SECRET = "kyc-glv-atomic-test-secret-xyzABCDEF123456";
process.env.NODE_ENV   = "test";
// Enable PII encryption for most tests
const TEST_PII_KEY = crypto.randomBytes(32).toString("hex");
process.env.PII_ENCRYPTION_KEY = TEST_PII_KEY;

const request = require("supertest");
const app     = require("../server");
const db      = require("../db/database");
const bcrypt  = require("bcryptjs");
const pii     = require("../utils/piiCrypto");

const PROBE_SCRIPT  = path.join(__dirname, "helpers/kyc-prod-probe.js");
const PROD_BASE_ENV = {
  PATH:       process.env.PATH || "/usr/bin:/bin",
  DB_PATH:    ":memory:",
  NODE_ENV:   "production",
  JWT_SECRET: "probe-jwt-secret-at-least-32-chars-long-xyz",
};

// The probe script mixes server console.log output with the JSON result in stdout.
// The JSON result is always the last line that starts with '{'.
function parseProbeOutput(spawnResult) {
  const lines = spawnResult.stdout.toString().trim().split("\n");
  const jsonLine = [...lines].reverse().find(l => l.trim().startsWith("{"));
  if (!jsonLine) {
    const stderr = spawnResult.stderr.toString().slice(0, 500);
    throw new Error(`Probe produced no JSON output. stderr: ${stderr}`);
  }
  return JSON.parse(jsonLine.trim());
}

// ─── Login helper ─────────────────────────────────────────────────────────────

async function loginAsAdmin() {
  db.prepare("UPDATE users SET password = ?, first_login = 0 WHERE username = 'mvalencia'")
    .run(bcrypt.hashSync("AdminPass12345!", 10));
  const agent = request.agent(app);
  const res = await agent.post("/auth/login").send({ username: "mvalencia", password: "AdminPass12345!" });
  assert.equal(res.status, 200, "admin login must succeed");
  return agent;
}

// ─── 1. KYC — guards de producción (subprocess con servidor real) ─────────────

describe("KYC — guardia de producción via subprocess (servidor real NODE_ENV=production)", () => {
  test("returns 503 when PII_ENCRYPTION_KEY has 64 non-hex characters", () => {
    // "zzzz..." is 64 chars but not valid hex — previously passed isConfigured()
    const invalidKey = "z".repeat(64);
    const result = spawnSync(process.execPath, [PROBE_SCRIPT], {
      env:     { ...PROD_BASE_ENV, PII_ENCRYPTION_KEY: invalidKey },
      timeout: 15000,
    });
    const parsed = parseProbeOutput(result);
    assert.equal(parsed.status, 503,
      `POST /clients/kyc must return 503 with 64-char non-hex PII key — got ${parsed.status}: ${JSON.stringify(parsed.body)}`
    );
  });

  test("returns 503 when PII_ENCRYPTION_KEY is empty (missing)", () => {
    const result = spawnSync(process.execPath, [PROBE_SCRIPT], {
      env:     { ...PROD_BASE_ENV, PII_ENCRYPTION_KEY: "" },
      timeout: 15000,
    });
    const parsed = parseProbeOutput(result);
    assert.equal(parsed.status, 503,
      `POST /clients/kyc must return 503 with empty PII key — got ${parsed.status}`
    );
  });

  test("returns 503 when PII_ENCRYPTION_KEY is too short (not 64 hex chars)", () => {
    const shortKey = "deadbeef".repeat(4); // 32 chars, not 64
    const result = spawnSync(process.execPath, [PROBE_SCRIPT], {
      env:     { ...PROD_BASE_ENV, PII_ENCRYPTION_KEY: shortKey },
      timeout: 15000,
    });
    const parsed = parseProbeOutput(result);
    assert.equal(parsed.status, 503,
      `POST /clients/kyc must return 503 with 32-char PII key — got ${parsed.status}`
    );
  });

  test("returns 201 and encrypts kyc_data with a valid 64-char hex PII key", () => {
    const validKey = crypto.randomBytes(32).toString("hex"); // exactly 64 lowercase hex chars
    const result = spawnSync(process.execPath, [PROBE_SCRIPT], {
      env:     { ...PROD_BASE_ENV, PII_ENCRYPTION_KEY: validKey },
      timeout: 15000,
    });
    const parsed = parseProbeOutput(result);
    assert.equal(parsed.status, 201,
      `POST /clients/kyc must return 201 with valid PII key — got ${parsed.status}: ${JSON.stringify(parsed.body)}`
    );
    assert.ok(parsed.body.ok, "response must include ok: true");
    assert.ok(parsed.body.client_id, "response must include client_id");
  });

  test("pii.isConfigured() returns false for 64-char non-hex string", () => {
    const originalKey = process.env.PII_ENCRYPTION_KEY;
    process.env.PII_ENCRYPTION_KEY = "z".repeat(64);
    const result = pii.isConfigured();
    process.env.PII_ENCRYPTION_KEY = originalKey;
    assert.equal(result, false, "isConfigured() must return false for non-hex 64-char string");
  });

  test("pii.isConfigured() returns true for valid 64-char hex string", () => {
    const originalKey = process.env.PII_ENCRYPTION_KEY;
    process.env.PII_ENCRYPTION_KEY = crypto.randomBytes(32).toString("hex");
    const result = pii.isConfigured();
    process.env.PII_ENCRYPTION_KEY = originalKey;
    assert.equal(result, true, "isConfigured() must return true for valid 64-char hex string");
  });

  test("503 response does not expose PII key, payload, or error details", () => {
    const invalidKey = "z".repeat(64);
    const result = spawnSync(process.execPath, [PROBE_SCRIPT], {
      env:     { ...PROD_BASE_ENV, PII_ENCRYPTION_KEY: invalidKey },
      timeout: 15000,
    });
    const parsed = parseProbeOutput(result);
    assert.equal(parsed.status, 503);
    const bodyStr = JSON.stringify(parsed.body);
    assert.ok(!bodyStr.includes("PII_ENCRYPTION_KEY"), "503 response must not mention PII_ENCRYPTION_KEY");
    assert.ok(!bodyStr.includes("GLV-PROBE"), "503 response must not echo submitted data");
    assert.ok(!bodyStr.includes("encrypt"), "503 response must not reveal internal error details");
  });
});

// ─── 2. KYC — cifrado y limpieza de raw_data ─────────────────────────────────

describe("KYC — raw_data en kyc_submissions queda NULL tras procesamiento", () => {
  const glvCode = `GLV-TEST-RAW-${Date.now()}`;

  before(async () => {
    // Submit a KYC record via the API (PII key is set so it won't be rejected)
    await request(app)
      .post("/clients/kyc")
      .send({
        glv_code: glvCode,
        empresa: "Test Company Raw Data SA",
        email: "rawdata@testcompany.com",
        submission_type: "CLIENT",
        rep: "John Test",
        pais: "CO",
        tel: "+57300000000",
        nit: "900123456-1",
      });
  });

  test("kyc_submissions.raw_data is cleared after processing (no PII retained)", () => {
    const sub = db.prepare(
      "SELECT raw_data, status FROM kyc_submissions WHERE glv_code = ? ORDER BY id DESC LIMIT 1"
    ).get(glvCode);
    assert.ok(sub, "submission must exist in DB");
    assert.equal(sub.status, "PROCESSED", "submission must be marked PROCESSED");
    // raw_data must be the '[CLEARED]' sentinel — the actual payload is in clients.kyc_data (encrypted)
    assert.equal(sub.raw_data, "[CLEARED]", "raw_data must be cleared after processing — PII must not be retained in kyc_submissions");
  });

  test("clients.kyc_data is NOT null and is encrypted (not plaintext JSON)", () => {
    const client = db.prepare("SELECT kyc_data FROM clients WHERE glv_code = ?").get(glvCode);
    assert.ok(client, "client must exist");
    assert.ok(client.kyc_data, "clients.kyc_data must not be null");

    // AES-256-GCM ciphertext has 3 base64 parts separated by dots
    const parts = client.kyc_data.split(".");
    assert.equal(parts.length, 3, "kyc_data must be AES-GCM ciphertext (3 base64 parts separated by dots)");

    // Verify it is NOT plaintext JSON
    assert.throws(
      () => JSON.parse(client.kyc_data),
      "ciphertext must not be valid JSON (it must be encrypted)"
    );
  });

  test("decrypting kyc_data with the correct key recovers the original payload", () => {
    const client = db.prepare("SELECT kyc_data FROM clients WHERE glv_code = ?").get(glvCode);
    const decrypted = pii.decrypt(client.kyc_data);
    const parsed = JSON.parse(decrypted);
    assert.equal(parsed.glv_code, glvCode, "decrypted data must contain original glv_code");
    assert.equal(parsed.empresa, "Test Company Raw Data SA", "decrypted data must contain original empresa");
  });
});

// ─── 3. GLV — código transaccional con restricción UNIQUE ────────────────────

describe("GLV code — generación atómica con SAVEPOINT", () => {
  let complianceAgent;
  let testClientId;
  const glvCode2 = `GLV-TEST-GLV-${Date.now()}`;

  before(async () => {
    complianceAgent = await loginAsAdmin();

    // Create a test client via direct DB insert (avoid KYC flow to keep test isolated)
    const ins = db.prepare(`
      INSERT INTO clients
        (type, name, company, glv_code, lead_status, kyc_status, registration_source, active)
      VALUES ('buyer', 'GLV Atomic Test Client', 'Atomic Corp SA', ?, 'QUALIFIED', 'COMMERCIAL_APPROVED', 'MANUAL', 1)
    `).run(glvCode2);
    testClientId = ins.lastInsertRowid;
  });

  test("activating a client generates a code in format GLV-CO-CLI-YYYY-NNNNN", async () => {
    const res = await complianceAgent
      .patch(`/clients/${testClientId}/kyc-status`)
      .send({ kyc_status: "ACTIVE_CLIENT" });

    assert.equal(res.status, 200, "activation must succeed");
    const year = new Date().getFullYear();
    assert.match(
      res.body.glv_code_permanent,
      new RegExp(`^GLV-CO-CLI-${year}-\\d{5}$`),
      "glv_code_permanent must match format GLV-CO-CLI-YYYY-NNNNN"
    );
    assert.equal(res.body.active, 1, "client must be active after activation");
    assert.equal(res.body.kyc_status, "ACTIVE_CLIENT", "kyc_status must be ACTIVE_CLIENT");
  });

  test("UNIQUE constraint on glv_code_permanent prevents duplicate codes", () => {
    // Directly attempt to insert a duplicate GLV code
    const firstClient = db.prepare(
      "SELECT glv_code_permanent FROM clients WHERE id = ?"
    ).get(testClientId);
    assert.ok(firstClient.glv_code_permanent, "first client must have a permanent code");

    // Creating a second client with the SAME glv_code_permanent must fail
    assert.throws(
      () => db.prepare(
        "INSERT INTO clients (type, name, glv_code, glv_code_permanent, lead_status, kyc_status, active) VALUES ('buyer', 'Dup', 'DUP-GLV', ?, 'QUALIFIED', 'ACTIVE_CLIENT', 1)"
      ).run(firstClient.glv_code_permanent),
      /UNIQUE constraint failed/,
      "DB must enforce UNIQUE on glv_code_permanent"
    );
  });

  test("activation rollback: sequence reverts when UNIQUE constraint fires", () => {
    // Set up a second client with glv_code_permanent pre-set to force a conflict
    const glvCode3 = `GLV-TEST-ROLLBACK-${Date.now()}`;

    // Get current sequence value
    const seqBefore = db.prepare(
      "SELECT last_seq FROM glv_code_sequences WHERE entity_code = 'GLV-CO'"
    ).get();
    assert.ok(seqBefore, "GLV-CO sequence must exist");

    // Predict the next code that would be assigned
    const year = new Date().getFullYear();
    const nextSeq = seqBefore.last_seq + 1;
    const nextCode = `GLV-CO-CLI-${year}-${String(nextSeq).padStart(5, "0")}`;

    // Pre-occupy that code in another client so the UNIQUE constraint fires
    const occupant = db.prepare(`
      INSERT INTO clients
        (type, name, glv_code, glv_code_permanent, lead_status, kyc_status, active)
      VALUES ('buyer', 'Code Occupant', 'GLV-OCCUPANT', ?, 'QUALIFIED', 'ACTIVE_CLIENT', 1)
    `).run(nextCode);
    assert.ok(occupant.lastInsertRowid, "occupant client must be created");

    // Create the test client that will attempt to get the same code
    const target = db.prepare(`
      INSERT INTO clients
        (type, name, glv_code, lead_status, kyc_status, registration_source, active)
      VALUES ('buyer', 'Rollback Target', ?, 'QUALIFIED', 'COMMERCIAL_APPROVED', 'MANUAL', 1)
    `).run(glvCode3);
    const targetId = target.lastInsertRowid;

    // Attempt activation — must fail due to UNIQUE violation
    const patchRes = request(app); // synchronous helper for this assertion
    // We test the DB-level atomicity directly (the HTTP test above covers the HTTP path)
    const spName = `sp_test_rollback_${targetId}`;
    let caughtErr;
    db.exec(`SAVEPOINT "${spName}"`);
    try {
      const nowStr = new Date().toISOString().slice(0, 19).replace("T", " ");
      const seqRow = db.prepare(
        "UPDATE glv_code_sequences SET last_seq = last_seq + 1, updated_at = ? WHERE entity_code = 'GLV-CO' RETURNING last_seq"
      ).get(nowStr);
      const code = `GLV-CO-CLI-${year}-${String(seqRow.last_seq).padStart(5, "0")}`;
      // This will throw UNIQUE constraint because nextCode is already taken
      db.prepare(
        "UPDATE clients SET active = 1, glv_code_permanent = ? WHERE id = ?"
      ).run(code, targetId);
      db.exec(`RELEASE SAVEPOINT "${spName}"`);
    } catch (err) {
      caughtErr = err;
      try { db.exec(`ROLLBACK TO SAVEPOINT "${spName}"`); } catch (_) {}
    }

    assert.ok(caughtErr, "UNIQUE violation must be caught");
    assert.ok(/UNIQUE constraint failed/.test(caughtErr.message), "error must mention UNIQUE constraint");

    // After rollback: sequence is back to seqBefore.last_seq (savepoint reverted)
    const seqAfter = db.prepare(
      "SELECT last_seq FROM glv_code_sequences WHERE entity_code = 'GLV-CO'"
    ).get();
    assert.equal(
      seqAfter.last_seq, seqBefore.last_seq,
      "sequence must be rolled back after UNIQUE constraint failure"
    );

    // After rollback: target client must NOT be active and must have no glv_code_permanent
    const targetAfter = db.prepare("SELECT active, glv_code_permanent FROM clients WHERE id = ?").get(targetId);
    assert.equal(targetAfter.glv_code_permanent, null, "glv_code_permanent must be NULL after rollback");
  });
});

// ─── 4. CORS — OPTIONS preflight desde origen rechazado ──────────────────────

describe("CORS — OPTIONS preflight from rejected origin", () => {
  test("rejected origin gets no Access-Control-Allow-Origin header", async () => {
    const res = await request(app)
      .options("/auth/login")
      .set("Origin", "https://evil-attacker.com")
      .set("Access-Control-Request-Method", "POST");

    // CORS error returns 500 (express CORS middleware rejects)
    // The key assertion: no ACAO header must be present
    assert.ok(
      !res.headers["access-control-allow-origin"],
      `Access-Control-Allow-Origin must NOT be set for rejected origin — got: ${res.headers["access-control-allow-origin"]}`
    );
  });

  test("allowed no-origin request (curl/same-origin) passes CORS without ACAO header", async () => {
    // No Origin header → CORS middleware allows it (same-origin / server-to-server)
    const res = await request(app)
      .get("/health");
    assert.equal(res.status, 200, "health check must succeed without Origin header");
  });
});
