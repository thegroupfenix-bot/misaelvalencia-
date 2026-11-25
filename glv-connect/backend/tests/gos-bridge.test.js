/**
 * Puente de PRUEBA Apps Script -> receptor KYC de GOS (POST /clients/kyc).
 * Carga el Code.gs real en `vm` con los servicios de Google simulados y reproduce lo que el puente
 * envía contra el receptor real en SQLite :memory:. Solo datos y direcciones ficticias (.invalid):
 * la identidad propietaria y la de contabilidad reales se sustituyen en el código cargado.
 *
 * Run (Node 22):
 *   node --test --experimental-test-isolation=none tests/gos-bridge.test.js
 */
"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

process.env.DB_PATH = ":memory:";
process.env.JWT_SECRET = "gos-bridge-test-secret-xyzABCDEF123456";
process.env.NODE_ENV = "test";
process.env.PII_ENCRYPTION_KEY = crypto.randomBytes(32).toString("hex");

const request = require("supertest");
const app = require("../server");
const db = require("../db/database");

const OWNER = "owner@example.invalid";
const ACCOUNTING = "accounting@example.invalid";
const TEST_ORIGIN = "https://forms.example.invalid";
const GOS_HOST = "gos-test.example.invalid";
const GOS_URL = `https://${GOS_HOST}`;
const CODE_GS = fs
  .readFileSync(path.join(__dirname, "../../../services/glv-forms/Code.gs"), "utf8")
  // Ninguna dirección real queda en el código cargado: la cuenta propietaria (gmail) y la de contabilidad
  // se sustituyen por direcciones .invalid.
  .replace(/[A-Za-z0-9._-]+@[A-Za-z0-9.-]+\.[a-z]+/g, (a) => (/@gmail\.com$/i.test(a) ? OWNER : ACCOUNTING));

const ENABLED = {
  GLV_GOS_BRIDGE: "ENABLED", GLV_MODE: "TEST", GLV_GOS_ISOLATED: "YES",
  GLV_GOS_URL: GOS_URL, GLV_GOS_ALLOWED_HOST: GOS_HOST,
};

class Sheet {
  constructor() { this.rows = [Array(15).fill("header")]; }
  getLastRow() { return this.rows.length; }
  appendRow(row) { this.rows.push([...row]); }
  getDataRange() { return { getValues: () => this.rows.map((r) => [...r]) }; }
  getRange(row, col, n = 1, width = 1) {
    const self = this;
    return {
      getValues() { return self.rows.slice(row - 1, row - 1 + n).map((r) => r.slice(col - 1, col - 1 + width)); },
      getValue() { return self.rows[row - 1][col - 1]; },
      setValue(value) { self.rows[row - 1][col - 1] = value; },
    };
  }
}

const bogotaYear = () => new Intl.DateTimeFormat("en", { year: "numeric", timeZone: "America/Bogota" }).format(new Date());

/** seq: número GLV inicial único por caso (la base :memory: del receptor es compartida). */
function fixture(seq, props, fetchImpl) {
  const sheets = Object.fromEntries(
    ["Clientes", "Proveedores", "Cotizaciones", "Registro de envíos", "Errores técnicos"].map((n) => [n, new Sheet()])
  );
  const properties = new Map(Object.entries({
    GLV_SHEET_ID: "private-test-sheet", GLV_SIGNING_SECRET: "test-only-secret", GLV_MODE: "TEST",
    GLV_TEST_ORIGIN: TEST_ORIGIN, [`SEQ_CL_${bogotaYear()}`]: String(seq - 1),
    ...props,
  }));
  for (const [k, v] of Object.entries(props)) if (v === undefined) properties.delete(k);
  const mails = [];
  const fetches = [];
  let locked = false;
  const context = {
    console, Date, JSON, Object, String, Number, Math, Error, Intl,
    Session: { getEffectiveUser: () => ({ getEmail: () => OWNER }), getActiveUser: () => ({ getEmail: () => OWNER }) },
    ContentService: { MimeType: { JSON: "application/json" }, createTextOutput: (value) => ({ value, setMimeType() { return this; } }) },
    PropertiesService: { getScriptProperties: () => ({ getProperty: (k) => properties.get(k), setProperty: (k, v) => properties.set(k, v) }) },
    SpreadsheetApp: { openById: () => ({ getSheetByName: (n) => sheets[n] }), flush() {} },
    LockService: { getScriptLock: () => ({ tryLock() { if (locked) return false; locked = true; return true; }, releaseLock() { locked = false; } }) },
    Utilities: {
      getUuid: () => crypto.randomUUID(), DigestAlgorithm: { SHA_256: "sha256" },
      computeDigest: (alg, s) => crypto.createHash(alg).update(s).digest(),
      computeHmacSha256Signature: (s, key) => crypto.createHmac("sha256", key).update(s).digest(),
      base64EncodeWebSafe: (b) => Buffer.from(b).toString("base64url"),
      formatDate: (d, tz, format) => (format === "yyyy" ? new Intl.DateTimeFormat("en", { year: "numeric", timeZone: tz }).format(d) : d.toISOString()),
    },
    MailApp: { getRemainingDailyQuota: () => 100, sendEmail: (m) => { mails.push(m); } },
    UrlFetchApp: {
      fetch(url, options) {
        fetches.push({ url, options });
        return fetchImpl ? fetchImpl(url, options, fetches.length) : { getResponseCode: () => 201 };
      },
    },
  };
  vm.createContext(context);
  vm.runInContext(CODE_GS, context);

  const schema = context.GLV_SCHEMA.client;
  const fields = {};
  schema.required.forEach((k) => (fields[k] = "Dato ficticio"));
  schema.checks.forEach((k) => (fields[k] = "true"));
  fields.k_empresa = "PRUEBA TÉCNICA Empresa Ficticia SA";
  fields.k_email = OWNER;
  fields.k_pais = "Colombia";
  fields.k_tel = "0000000";
  fields.k_nit = "000000000-0";
  const p = {
    kind: "client", source: schema.source,
    // En modo LIVE el origen de prueba no se acepta: se usa el origen público (solo una cadena, sin tráfico).
    origin: properties.get("GLV_MODE") === "LIVE" ? "https://glvservicesexp.com" : TEST_ORIGIN, retryId: crypto.randomUUID(),
    channel: crypto.randomBytes(16).toString("hex"), issued: Date.now() - 5000, website: "", fields,
  };
  p.signature = context.sign_(`${p.origin}|${p.channel}|${p.issued}`);

  const submit = (extra) => context.submitForm({ ...p, ...extra });
  /** Solicita el código y lo confirma. Devuelve la respuesta de la confirmación. */
  const confirm = () => {
    const pending = submit();
    assert.equal(pending.state, "PENDIENTE");
    const code = mails[0].body.match(/es: (\d{6})/)[1];
    return submit({ action: "verify", verificationCode: code, attemptId: crypto.randomUUID(), _code: code });
  };
  const verifyAgain = (code) => submit({ action: "verify", verificationCode: code, attemptId: crypto.randomUUID() });
  const gosLog = () => sheets["Registro de envíos"].rows.filter((r) => r[2] === "GOS");
  return { context, sheets, properties, mails, fetches, p, submit, confirm, verifyAgain, gosLog, ip: `203.0.113.${seq}` };
}

const count = (sql, ...a) => db.prepare(sql).get(...a).n;
function counts(glv) {
  return {
    clients: count("SELECT COUNT(*) n FROM clients WHERE glv_code = ?", glv),
    submissions: count("SELECT COUNT(*) n FROM kyc_submissions WHERE glv_code = ?", glv),
    tasks: count("SELECT COUNT(*) n FROM tasks WHERE title = ?", `KYC REVIEW REQUIRED — ${glv}`),
    events: count("SELECT COUNT(*) n FROM audit_log WHERE action = 'KYC_SUBMITTED' AND doc_id = ?", glv),
  };
}
const replay = (f, call) => request(app).post("/clients/kyc").set("X-Forwarded-For", f.ip).send(JSON.parse(call.options.payload));
/** Confirma el alta y reintenta con el mismo código. */
function confirmWithRetries(f, retries) {
  const first = f.confirm();
  const code = f.mails[0].body.match(/es: (\d{6})/)[1];
  const results = [first];
  for (let i = 0; i < retries; i++) results.push(f.verifyAgain(code));
  return results;
}

test("1. apagado por defecto: 10 configuraciones inseguras o incompletas no producen llamadas", () => {
  const variants = [
    {},
    { ...ENABLED, GLV_GOS_BRIDGE: "enabled" },
    { ...ENABLED, GLV_GOS_ISOLATED: "NO" },
    { ...ENABLED, GLV_MODE: "LIVE" },
    { ...ENABLED, GLV_GOS_ALLOWED_HOST: "otro.example.invalid" },
    { ...ENABLED, GLV_GOS_ALLOWED_HOST: undefined },
    { ...ENABLED, GLV_GOS_URL: "https://glvservicesexp.com", GLV_GOS_ALLOWED_HOST: "glvservicesexp.com" },
    { ...ENABLED, GLV_GOS_URL: `${GOS_URL}/clients/kyc` },
    { ...ENABLED, GLV_GOS_BRIDGE: undefined },
    { ...ENABLED, GLV_GOS_ISOLATED: undefined },
  ];
  assert.equal(variants.length, 10);
  variants.forEach((props, i) => {
    const f = fixture(10 + i, props);
    const r = f.confirm();
    assert.equal(r.ok, true, `variante ${i}`);
    assert.equal(r.state, "VERIFICADO");
    assert.equal(f.fetches.length, 0, `variante ${i} no debe llamar a GOS`);
    assert.equal(f.gosLog().length, 0);
  });
});

test("2. HTTP y esquemas no HTTPS se rechazan sin llamada; el alta se confirma", () => {
  const urls = [
    `http://${GOS_HOST}`, `HTTP://${GOS_HOST}`, `ftp://${GOS_HOST}`, `//${GOS_HOST}`, GOS_HOST,
    `https://user:pw@${GOS_HOST}`,
  ];
  urls.forEach((url, i) => {
    const f = fixture(30 + i, { ...ENABLED, GLV_GOS_URL: url });
    const r = f.confirm();
    assert.equal(r.ok, true, url);
    assert.equal(r.state, "VERIFICADO");
    assert.equal(f.fetches.length, 0, `${url} no debe producir llamada`);
  });
});

test("3. habilitado: HTTPS, sin redirecciones, mismo GLV y retry_id; reintentos = 1 cliente/expediente/tarea/evento", async () => {
  const f = fixture(41, ENABLED);
  const pending = f.submit();
  assert.equal(pending.state, "PENDIENTE");
  assert.equal(f.fetches.length, 0, "solicitar el código no llama a GOS");
  const code = f.mails[0].body.match(/es: (\d{6})/)[1];
  const done = f.submit({ action: "verify", verificationCode: code, attemptId: crypto.randomUUID() });
  assert.equal(done.ok, true);
  assert.equal(done.state, "VERIFICADO");
  f.verifyAgain(code);
  f.verifyAgain(code);
  assert.equal(f.fetches.length, 3);
  for (const c of f.fetches) {
    assert.equal(c.url, `${GOS_URL}/clients/kyc`);
    assert.equal(c.options.method, "post");
    assert.equal(c.options.followRedirects, false);
    assert.equal(c.options.payload, f.fetches[0].options.payload, "cuerpo idéntico en cada reintento");
  }
  const body = JSON.parse(f.fetches[0].options.payload);
  assert.equal(body.glv_code, done.code);
  assert.equal(body.retry_id, f.p.retryId);
  assert.ok(!JSON.stringify(body).includes(code), "no incluye el código de verificación");
  assert.equal(f.mails.length, 4, "1 código + 3 correos; los reintentos no reenvían");

  const statuses = [];
  for (const c of f.fetches) {
    const r = await replay(f, c);
    statuses.push([r.status, r.body.duplicate === true]);
  }
  assert.deepEqual(statuses, [[201, false], [200, true], [200, true]]);
  assert.deepEqual(counts(done.code), { clients: 1, submissions: 1, tasks: 1, events: 1 });
  assert.ok(f.gosLog().every((r) => r[4] === "SENT"));
});

test("4. redirecciones 301/302/307/308 quedan FAILED, no se contacta otro destino y el alta se confirma", () => {
  [301, 302, 307, 308].forEach((status, i) => {
    const f = fixture(60 + i, ENABLED, () => ({ getResponseCode: () => status }));
    const r = f.confirm();
    assert.equal(r.ok, true, `HTTP ${status}`);
    assert.equal(r.state, "VERIFICADO");
    assert.equal(f.fetches.length, 1);
    assert.ok(f.fetches[0].url.startsWith(`https://${GOS_HOST}/`));
    assert.equal(f.fetches[0].options.followRedirects, false);
    const log = f.gosLog();
    assert.equal(log.length, 1);
    assert.equal(log[0][4], "FAILED");
    assert.equal(log[0][5], `HTTP_${status}`);
  });
});

test("5. GOS 503 o excepción de UrlFetchApp: el alta se confirma, queda FAILED y el reintento deja 1/1/1/1", async () => {
  // 503 en el primer intento, 201 en el reintento.
  const f = fixture(70, ENABLED, (u, o, n) => ({ getResponseCode: () => (n === 1 ? 503 : 201) }));
  const [first, retry] = confirmWithRetries(f, 1);
  assert.equal(first.ok, true);
  assert.equal(first.state, "VERIFICADO");
  assert.equal(retry.code, first.code);
  assert.deepEqual(f.gosLog().map((r) => r[4]), ["FAILED", "SENT"]);
  assert.equal(f.gosLog()[0][5], "HTTP_503");
  // Solo el intento aceptado llega al receptor; ambos cuerpos son idénticos.
  assert.equal(f.fetches[0].options.payload, f.fetches[1].options.payload);
  const r = await replay(f, f.fetches[1]);
  assert.equal(r.status, 201);
  assert.deepEqual(counts(first.code), { clients: 1, submissions: 1, tasks: 1, events: 1 });

  // Excepción del servicio de Google: el alta no se rompe.
  const g = fixture(71, ENABLED, () => { throw new Error("Address unavailable"); });
  const out = g.confirm();
  assert.equal(out.ok, true);
  assert.equal(out.state, "VERIFICADO");
  assert.deepEqual(g.gosLog().map((r) => r[4]), ["FAILED"]);
  assert.equal(g.mails.length, 4);
});
