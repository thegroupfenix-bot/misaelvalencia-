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
const sent = []; let failNext = false, mailDelay = 0;
mailer.sendVerificationCode = async (to, code) => {
  if (mailDelay) await new Promise(r => setTimeout(r, mailDelay));
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
  // Usuario ficticio de Compliance: los demas se desactivan para que la asignacion sea determinista.
  db.prepare("UPDATE users SET active=0 WHERE role='COMPLIANCE'").run();
  const compId = db.prepare(
    "INSERT INTO users (username, password, role, name, email, active) VALUES ('comp_ficticio', 'x', 'COMPLIANCE', 'Compliance Ficticio', 'comp.ficticio@example.test', 1)"
  ).run().lastInsertRowid;
  const ok = await request(app).post("/registration/verify-code").send({ email: form.email, code });
  assert.equal(ok.status, 201);
  assert.equal(ok.body.glv_code, `GLV-CL-${new Date().getFullYear()}-002356`);
  // reintentos
  const again = await request(app).post("/registration/verify-code").send({ email: form.email, code });
  assert.notEqual(again.status, 201);
  assert.equal(count("SELECT COUNT(*) n FROM clients WHERE lower(email)=?", form.email.toLowerCase()), 1);
  assert.equal(count("SELECT COUNT(*) n FROM audit_log WHERE action='CLIENT_REGISTERED' AND doc_id=?", ok.body.glv_code), 1);
  assert.equal(count("SELECT COUNT(*) n FROM kyc_submissions WHERE glv_code=?", ok.body.glv_code), 1);
  assert.equal(count("SELECT COUNT(*) n FROM registration_codes WHERE used=1"), 1);
  // Tarea KYC: se leen todas las tareas y se filtra en JavaScript (titulo exacto y GLV en la descripcion).
  const glv = ok.body.glv_code;
  const glvTasks = () => db.prepare("SELECT * FROM tasks").all()
    .filter(t => t.title === "KYC REVIEW \u2014 " + glv && String(t.description).includes("GLV: " + glv));
  assert.equal(glvTasks().length, 1, "una tarea KYC por numero GLV");
  assert.equal(glvTasks()[0].assigned_to, compId, "asignada al usuario de Compliance");
  assert.equal(glvTasks()[0].status, "pending");
  // Repetir la confirmacion (codigo ya usado) no crea otra tarea.
  await request(app).post("/registration/verify-code").send({ email: form.email, code });
  assert.equal(glvTasks().length, 1, "sin duplicar tras repetir la confirmacion");
  assert.equal(db.prepare("SELECT * FROM tasks").all().filter(t => String(t.title).startsWith("KYC REVIEW")).length, 1);
});

test("resend-code: fallo SMTP conserva código y contador; reenvío posterior sin duplicados", async () => {
  const f2 = { ...form, email: "reenvio.prueba@example.test", empresa: "Reenvio Ficticio SAS" };
  const em = f2.email;
  const rows = () => db.prepare("SELECT * FROM registration_codes WHERE email=? ORDER BY id").all(em);
  assert.equal((await request(app).post("/registration/request-code").send(f2)).status, 200);
  const first = sent[sent.length - 1].code;
  const before = rows();
  assert.equal(before.length, 1);

  failNext = true;
  const bad = await request(app).post("/registration/resend-code").send({ email: em });
  failNext = false;
  assert.equal(bad.status, 503);
  assert.equal(bad.body.retryable, true);
  const after = rows();
  assert.equal(after.length, 1, "no se crea código de reemplazo");
  assert.equal(after[0].invalidated, 0);
  assert.equal(after[0].resend_count, 0);
  assert.equal(after[0].code_hash, before[0].code_hash);

  // Reenvíos concurrentes: solo uno activa el reemplazo.
  mailDelay = 30;
  const [r1, r2] = await Promise.all([
    request(app).post("/registration/resend-code").send({ email: em }),
    request(app).post("/registration/resend-code").send({ email: em }),
  ]);
  mailDelay = 0;
  assert.deepEqual([r1.status, r2.status].sort(), [200, 409]);
  const fin = rows();
  assert.equal(fin.length, 2);
  assert.equal(fin.filter(r => r.invalidated === 0 && r.used === 0).length, 1);
  assert.equal(fin[1].resend_count, 1);
  const newCode = sent[sent.length - 1].code;

  // El código anterior ya no sirve; el nuevo crea un solo cliente.
  const old = await request(app).post("/registration/verify-code").send({ email: em, code: first });
  assert.equal(old.status, 400);
  const ok = await request(app).post("/registration/verify-code").send({ email: em, code: newCode });
  assert.equal(ok.status, 201);
  assert.equal(count("SELECT COUNT(*) n FROM clients WHERE lower(email)=?", em), 1);
});

test("numeración: mínimo 002356 con base vacía, previo inferior y previo superior", () => {
  const { generateGlvCode } = require("../routes/registration");
  const year = new Date().getFullYear();
  const seed = (n) => db.prepare(
    "INSERT INTO clients (type, name, glv_code, kyc_status, active) VALUES ('buyer', 'Ficticio', ?, 'PRE_REGISTRATION', 1)"
  ).run(`GLV-CL-${year}-${String(n).padStart(6, "0")}`);
  const clear = () => db.prepare("DELETE FROM clients WHERE glv_code LIKE ?").run(`GLV-CL-${year}-%`);
  db.pragma("foreign_keys = OFF");
  clear();
  assert.equal(generateGlvCode(), `GLV-CL-${year}-002356`, "base vacía");
  seed(10);
  assert.equal(generateGlvCode(), `GLV-CL-${year}-002356`, "previo inferior");
  clear(); seed(3000);
  assert.equal(generateGlvCode(), `GLV-CL-${year}-003001`, "previo superior");
  clear();
  db.pragma("foreign_keys = ON");
});
