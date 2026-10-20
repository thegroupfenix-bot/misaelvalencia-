/**
 * Document ID generator — injectable `now` date for testability.
 * Format: {type}-GLV-{YYYY}-{NNN}
 */
function genId(type, db, now = new Date()) {
  const year  = now.getFullYear();
  const count = db.prepare("SELECT COUNT(*) AS c FROM documents WHERE type = ?").get(type).c;
  return `${type}-GLV-${year}-${String(count + 2).padStart(3, "0")}`;
}

module.exports = { genId };
