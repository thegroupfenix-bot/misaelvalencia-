"use strict";
// Prueba focalizada del alta de clientes. Datos ficticios, SQLite temporal, correo simulado.
const os = require("os"), path = require("path"), fs = require("fs");
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "glv-reg-"));
process.env.DB_PATH = path.join(tmp, "test.sqlite");
process.env.REGISTRATION_CODE_SECRET = "test-secret";
process.env.SMTP_USER = ""; process.env.SMTP_PASS = "";

const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const request = require("supertest");

const mailer = require("../utils/email");
const sent = []; let failNext = false;
mailer.sendVerificationCode = async (to, code) => {
  if (failNext) throw new Error("smtp down");
  sent.push({ to, code });
};
mailer.sendRegistrationConfirmation = async () => {};

const db = require("../db/database");
const app = express();
app.use(express.json());
app.use("/registration", require("../routes/registration"));

const form = { email: "Test.Cliente@example.test", empresa: "Empresa Ficticia SAS", rep: "Ana Prueba", pais: "CO", tel: "+570000000", nit: "000000000" };
const count = (sql, ...a) => db.prepare(sql).get(...a).n;

test.after(() => { db.close(); fs.rmSync(tmp, { recursive: true, force: true }); });

test("fallo de envío: error recuperable y nuevo intento posible", async () => {
  failNext = true;
  const r1 = await request(app).post("/registration/request-code").send(form);
  assert.equal(r1.status, 503);
  assert.equal(r1.body.retryable, true);
  assert.equal(count("SELECT COUNT(*) n FROM registration_codes WHERE invalidated=0"), 0);
  assert.equal(count("SELECT COUNT(*) n FROM clients"), 0);
  failNext = false;
  const r2 = await request(app).post("/registration/request-code").send(form);
  assert.equal(r2.status, 200);
  assert.equal(sent.length, 1);
});

test("verificación correcta crea un solo cliente y auditoría; reintentos no duplican", async () => {
  const wrong = await request(app).post("/registration/verify-code").send({ email: form.email, code: "000000" === sent[0].code ? "111111" : "000000" });
  assert.equal(wrong.status, 400);
  const { code } = sent[0];
  const ok = await request(app).post("/registration/verify-code").send({ email: form.email, code });
  assert.equal(ok.status, 201);
  assert.match(ok.body.glv_code, /^GLV-CL-\d{4}-\d{6}$/);
  // reintentos
  const again = await request(app).post("/registration/verify-code").send({ email: form.email, code });
  assert.notEqual(again.status, 201);
  assert.equal(count("SELECT COUNT(*) n FROM clients WHERE lower(email)=?", form.email.toLowerCase()), 1);
  assert.equal(count("SELECT COUNT(*) n FROM audit_log WHERE action='CLIENT_REGISTERED' AND doc_id=?", ok.body.glv_code), 1);
  assert.equal(count("SELECT COUNT(*) n FROM kyc_submissions WHERE glv_code=?", ok.body.glv_code), 1);
  assert.equal(count("SELECT COUNT(*) n FROM registration_codes WHERE used=1"), 1);
});
