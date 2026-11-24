/**
 * Idempotencia del receptor KYC web (POST /clients/kyc) — SQLite :memory:, datos ficticios.
 *
 * Run:
 *   node --test --experimental-test-isolation=none tests/kyc-idempotency.test.js
 */
"use strict";

const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("crypto");

process.env.DB_PATH = ":memory:";
process.env.JWT_SECRET = "kyc-idempotency-test-secret-xyzABCDEF123456";
process.env.NODE_ENV = "test";
process.env.PII_ENCRYPTION_KEY = crypto.randomBytes(32).toString("hex");

const request = require("supertest");
const app = require("../server");
const db = require("../db/database");
const pii = require("../utils/piiCrypto");

// El receptor limita 10 solicitudes por IP (trust proxy = 1): cada caso usa una IP de documentación
// distinta (X-Forwarded-For) para no depender del límite compartido.
const post = (body) => {
  const n = Number(body.glv_code.slice(-1));
  return request(app).post("/clients/kyc").set("X-Forwarded-For", `203.0.113.${n}`).send(body);
};
const count = (sql, ...p) => db.prepare(sql).get(...p).n;
const title = (glv) => `KYC REVIEW REQUIRED — ${glv}`;

function counts(glv) {
  return {
    clients: count("SELECT COUNT(*) n FROM clients WHERE glv_code = ?", glv),
    submissions: count("SELECT COUNT(*) n FROM kyc_submissions WHERE glv_code = ?", glv),
    tasks: count("SELECT COUNT(*) n FROM tasks WHERE title = ?", title(glv)),
    events: count("SELECT COUNT(*) n FROM audit_log WHERE action = 'KYC_SUBMITTED' AND doc_id = ?", glv),
  };
}

const base = (glv) => ({
  glv_code: glv, empresa: "Empresa Ficticia SA", email: "ficticio@example.invalid",
  pais: "Colombia", submission_type: "CLIENT",
});

describe("POST /clients/kyc — idempotencia", () => {
  test("entrega + 3 reenvíos idénticos → 1 cliente, 1 expediente, 1 tarea, 1 evento", async () => {
    const glv = "GLV-CL-TEST-IDEM1";
    const first = await post(base(glv));
    assert.equal(first.status, 201);
    for (let i = 0; i < 3; i++) {
      const r = await post(base(glv));
      assert.equal(r.status, 200);
      assert.equal(r.body.duplicate, true);
      assert.equal(r.body.client_id, first.body.client_id);
    }
    assert.deepEqual(counts(glv), { clients: 1, submissions: 1, tasks: 1, events: 1 });
  });

  test("actualización legítima conserva su tratamiento y no se duplica al reenviarla", async () => {
    const glv = "GLV-CL-TEST-IDEM2";
    await post(base(glv));
    const upd = { ...base(glv), pais: "Perú" };
    const r = await post(upd);
    assert.equal(r.status, 201);
    assert.notEqual(r.body.duplicate, true);
    assert.deepEqual(counts(glv), { clients: 1, submissions: 2, tasks: 2, events: 2 });
    const row = db.prepare("SELECT country, kyc_data FROM clients WHERE glv_code = ?").get(glv);
    assert.equal(row.country, "Perú");
    assert.equal(JSON.parse(pii.decrypt(row.kyc_data)).pais, "Perú");
    const again = await post(upd);
    assert.equal(again.status, 200);
    assert.deepEqual(counts(glv), { clients: 1, submissions: 2, tasks: 2, events: 2 });
  });

  test("reentrega idéntica sin tarea la recrea una sola vez", async () => {
    const glv = "GLV-CL-TEST-IDEM3";
    await post(base(glv));
    db.prepare("DELETE FROM tasks WHERE title = ?").run(title(glv));
    assert.equal(counts(glv).tasks, 0);
    assert.equal((await post(base(glv))).status, 200);
    assert.equal((await post(base(glv))).status, 200);
    assert.deepEqual(counts(glv), { clients: 1, submissions: 1, tasks: 1, events: 1 });
  });

  test("dos reintentos simultáneos sin tarea crean una sola tarea", async () => {
    const glv = "GLV-CL-TEST-IDEM4";
    await post(base(glv));
    db.prepare("DELETE FROM tasks WHERE title = ?").run(title(glv));
    const [a, b] = await Promise.all([post(base(glv)), post(base(glv))]);
    assert.equal(a.status, 200);
    assert.equal(b.status, 200);
    assert.deepEqual(counts(glv), { clients: 1, submissions: 1, tasks: 1, events: 1 });
  });

  test("dos reintentos simultáneos con tarea existente no añaden nada; la actualización simultánea sí cuenta una vez", async () => {
    const glv = "GLV-CL-TEST-IDEM5";
    await post(base(glv));
    const [a, b] = await Promise.all([post(base(glv)), post(base(glv))]);
    assert.deepEqual([a.status, b.status], [200, 200]);
    assert.deepEqual(counts(glv), { clients: 1, submissions: 1, tasks: 1, events: 1 });

    const upd = { ...base(glv), pais: "Chile" };
    const [c, d] = await Promise.all([post(upd), post(upd)]);
    assert.deepEqual([c.status, d.status].sort(), [200, 201]);
    assert.deepEqual(counts(glv), { clients: 1, submissions: 2, tasks: 2, events: 2 });
  });
});
