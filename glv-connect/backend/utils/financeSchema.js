/**
 * Guarantees the columns required by the financial reporting queries.
 * CREATE TABLE IF NOT EXISTS does not evolve the persistent SQLite schema.
 */
function ensureCurrencyColumn(db, table) {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all().map(column => column.name);
  if (!columns.includes("currency")) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN currency TEXT NOT NULL DEFAULT 'USD'`);
  }
}

function ensureFinanceSchema(db) {
  db.transaction(() => {
    ensureCurrencyColumn(db, "documents");
    ensureCurrencyColumn(db, "operations");
    db.prepare("UPDATE documents SET currency = 'USD' WHERE currency IS NULL OR trim(currency) = ''").run();
    db.prepare("UPDATE operations SET currency = 'USD' WHERE currency IS NULL OR trim(currency) = ''").run();
  })();
}

module.exports = { ensureFinanceSchema };
