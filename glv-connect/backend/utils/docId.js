/**
 * Document ID generator — atomic SQLite sequence, injectable date for tests.
 * Format: {type}-GLV-{YYYY}-{NNN}
 *
 * Uses doc_id_sequences table to guarantee uniqueness under concurrent writes.
 * COUNT(*)+N is not safe: concurrent transactions can read the same count.
 */
function genId(type, db, now = new Date()) {
  const year = now.getFullYear();

  const result = db.transaction(() => {
    const row = db.prepare(
      "UPDATE doc_id_sequences SET last_seq = last_seq + 1 WHERE type = ? RETURNING last_seq"
    ).get(type);
    if (!row) throw new Error(`Unknown document type for sequence: ${type}. Expected SCO, FCO or SPA.`);
    return `${type}-GLV-${year}-${String(row.last_seq).padStart(3, "0")}`;
  })();

  return result;
}

module.exports = { genId };
