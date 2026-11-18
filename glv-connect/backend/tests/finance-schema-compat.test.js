/**
 * Finance schema regression tests.
 *
 * Verifies a Railway-style legacy database starts cleanly when the historical
 * documents and operations tables predate their currency columns.
 */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { mkdtempSync, rmSync } = require("node:fs");
const { tmpdir } = require("node:os");
const { join } = require("node:path");
const { spawnSync } = require("node:child_process");
const Database = require("better-sqlite3");

test("legacy finance tables gain currency and retain historical values", () => {
  const folder = mkdtempSync(join(tmpdir(), "gos-finance-legacy-"));
  const dbPath = join(folder, "legacy.db");
  const legacy = new Database(dbPath);
  legacy.exec(`
    CREATE TABLE documents (
      id TEXT PRIMARY KEY, type TEXT NOT NULL, status TEXT NOT NULL,
      client TEXT NOT NULL, agent TEXT NOT NULL, date TEXT NOT NULL,
      destination TEXT NOT NULL, product TEXT NOT NULL,
      total_value REAL, created_at TEXT NOT NULL
    );
    CREATE TABLE operations (
      id TEXT PRIMARY KEY, status TEXT NOT NULL,
      contract_value REAL, destination_country TEXT, created_at TEXT NOT NULL
    );
  `);
  legacy.prepare("INSERT INTO documents VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
    .run("SCO-LEGACY", "SCO", "Emitido", "Cliente", "agente", "2026-01-01", "CO", "Producto", 1250, "2026-01-01 12:00:00");
  legacy.prepare("INSERT INTO operations VALUES (?, ?, ?, ?, ?)")
    .run("OP-LEGACY", "active", 2200, "CO", "2026-01-01 12:00:00");
  legacy.close();

  const probe = `
    const db = require('./db/database');
    require('./routes/finance');
    const document = db.prepare('SELECT currency, total_value FROM documents WHERE id = ?').get('SCO-LEGACY');
    const operation = db.prepare('SELECT currency, contract_value FROM operations WHERE id = ?').get('OP-LEGACY');
    db.prepare('SELECT type, status, total_value, currency FROM documents').all();
    db.prepare('SELECT status, contract_value, currency FROM operations').all();
    process.stdout.write(JSON.stringify({ document, operation }));
  `;
  const result = spawnSync(process.execPath, ["-e", probe], {
    cwd: join(__dirname, ".."),
    env: {
      ...process.env,
      DB_PATH: dbPath,
      NODE_ENV: "test",
      JWT_SECRET: "finance-schema-test-secret-0123456789",
      SEED_ADMIN_PASSWORD: "FinanceSchemaTest123!",
    },
    encoding: "utf8",
  });

  try {
    assert.equal(result.status, 0, result.stderr);
    const output = JSON.parse(result.stdout.trim().split("\n").pop());
    assert.deepEqual(output.document, { currency: "USD", total_value: 1250 });
    assert.deepEqual(output.operation, { currency: "USD", contract_value: 2200 });
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
});
