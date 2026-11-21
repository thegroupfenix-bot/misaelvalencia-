/**
 * GET /audit — forma de respuesta paginada { rows, total, limit, offset }.
 * Run: node --test tests/audit-shape.test.js
 */
const { test, describe, before } = require("node:test");
const assert = require("node:assert/strict");

process.env.DB_PATH = ":memory:";
process.env.JWT_SECRET = "test-secret-audit-shape-01234567890abcdef";
process.env.NODE_ENV = "test";

const request = require("supertest");
const app = require("../server");

describe("GET /audit — contrato de respuesta", () => {
  let agent;
  before(async () => {
    const db = require("../db/database");
    const bcrypt = require("bcryptjs");
    db.prepare("UPDATE users SET password = ?, first_login = 0 WHERE username = ?")
      .run(bcrypt.hashSync("TestPass12345!", 10), "mvalencia");
    agent = request.agent(app);
    const login = await agent.post("/auth/login").send({ username: "mvalencia", password: "TestPass12345!" });
    assert.equal(login.status, 200);
  });

  test("devuelve objeto paginado, no una lista", async () => {
    const res = await agent.get("/audit?limit=200");
    assert.equal(res.status, 200);
    assert.equal(Array.isArray(res.body), false);
    assert.ok(Array.isArray(res.body.rows));
    assert.equal(typeof res.body.total, "number");
    assert.equal(res.body.limit, 200);
    assert.equal(res.body.offset, 0);
    assert.ok(res.body.total >= res.body.rows.length);
    assert.ok(res.body.rows.length > 0, "el login previo debe haber generado registros");
    for (const k of ["ts", "username", "action", "ip"]) assert.ok(k in res.body.rows[0], `falta ${k}`);
  });

  test("sin sesión responde 401 (la vista lo mostrará como error recuperable)", async () => {
    const res = await request(app).get("/audit");
    assert.equal(res.status, 401);
  });
});
