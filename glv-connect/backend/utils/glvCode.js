const db = require("../db/database");

function generateGlvCode(entityCode = "GLV-CO") {
  const year = new Date().getFullYear();
  const now  = new Date().toISOString().slice(0, 19).replace("T", " ");

  const result = db.transaction(() => {
    const row = db.prepare(
      "UPDATE glv_code_sequences SET last_seq = last_seq + 1, updated_at = ? WHERE entity_code = ? RETURNING last_seq"
    ).get(now, entityCode);
    if (!row) throw new Error(`Unknown entity_code: ${entityCode}`);
    return `${entityCode}-CLI-${year}-${String(row.last_seq).padStart(5, "0")}`;
  })();

  return result;
}

module.exports = { generateGlvCode };
