/**
 * AuditLog — normalización de respuesta y recuperación de la vista (lógica pura, sin BD).
 * Run: node --test tests/audit-view-recovery.test.js
 */
const { test, describe, before } = require("node:test");
const assert = require("node:assert/strict");

describe("AuditLog — normalización y recuperación (frontend)", () => {
  let mod;
  before(async () => {
    mod = await import("../../frontend/src/utils/auditResponse.js");
  });

  test("acepta { rows, total }", () => {
    assert.deepEqual(mod.normalizeAuditResponse({ rows: [{ a: 1 }], total: 40 }), { rows: [{ a: 1 }], total: 40 });
  });

  test("acepta lista antigua", () => {
    assert.deepEqual(mod.normalizeAuditResponse([{ a: 1 }, { a: 2 }]), { rows: [{ a: 1 }, { a: 2 }], total: 2 });
  });

  test("total ausente usa rows.length", () => {
    assert.equal(mod.normalizeAuditResponse({ rows: [] }).total, 0);
  });

  for (const bad of [null, undefined, {}, { rows: "x" }, "texto", 42, { error: "x" }]) {
    test(`respuesta inválida ${JSON.stringify(bad)} lanza error`, () => {
      assert.throws(() => mod.normalizeAuditResponse(bad), /no válida/);
    });
  }

  test("loadAuditState: respuesta válida sin error", async () => {
    const s = await mod.loadAuditState(async () => ({ rows: [{ ts: "t" }], total: 1 }));
    assert.equal(s.error, "");
    assert.equal(s.logs.length, 1);
  });

  test("loadAuditState: respuesta inválida produce error visible y no lanza", async () => {
    const s = await mod.loadAuditState(async () => ({ foo: 1 }));
    assert.ok(s.error.length > 0);
    assert.deepEqual(s.logs, []);
    assert.equal(s.total, 0);
  });

  test("loadAuditState: fallo de red produce error y el reintento se recupera", async () => {
    let calls = 0;
    const fetchAudit = async () => { if (++calls === 1) throw new Error("Error de red"); return { rows: [{ ts: "t" }], total: 1 }; };
    const first = await mod.loadAuditState(fetchAudit);
    assert.ok(first.error);
    const retry = await mod.loadAuditState(fetchAudit);
    assert.equal(retry.error, "");
    assert.equal(retry.logs.length, 1);
  });
});
