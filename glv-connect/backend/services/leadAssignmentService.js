"use strict";
const db = require("../db/database");
const { addBusinessHours } = require("./businessHoursService");

function normalisePhone(raw) {
  if (!raw) return null;
  const digits = raw.replace(/[^\d+]/g, "");
  if (!digits) return null;
  return digits.startsWith("+") ? digits : `+${digits}`;
}

function generateLeadCode() {
  const year = new Date().getFullYear();
  const row = db.prepare(
    `SELECT MAX(CAST(SUBSTR(glv_code, -4) AS INTEGER)) AS max_n FROM leads WHERE glv_code LIKE ?`
  ).get(`LEAD-${year}-%`);
  const next = (row?.max_n || 0) + 1;
  return `LEAD-${year}-${String(next).padStart(4, "0")}`;
}

function findRule(lead) {
  const today = new Date().toISOString().slice(0, 10);
  const rules = db.prepare(`
    SELECT * FROM lead_assignment_rules
    WHERE is_active=1
      AND (valid_from IS NULL OR valid_from <= ?)
      AND (valid_until IS NULL OR valid_until >= ?)
    ORDER BY priority DESC
  `).all(today, today);

  for (const r of rules) {
    if (r.country_code   && r.country_code   !== lead.country_code)    continue;
    if (r.zone           && r.zone           !== lead.zone)             continue;
    if (r.product_type   && r.product_type   !== lead.product_type)     continue;
    if (r.origin_channel && r.origin_channel !== lead.origin_channel)   continue;
    if (r.language       && r.language       !== lead.language)         continue;
    return r;
  }
  return null;
}

function autoAssign(leadId, leadData) {
  const rule = findRule(leadData);
  if (!rule) return { agent: null, ruleId: null };

  const deadline = addBusinessHours(new Date(), 4);
  db.prepare(`
    UPDATE leads SET assigned_agent=?, assignment_rule_id=?, status='ASSIGNED',
      assigned_at=datetime('now'), first_contact_deadline=?, updated_at=datetime('now')
    WHERE id=?
  `).run(rule.agent_username, rule.id, deadline, leadId);

  return { agent: rule.agent_username, ruleId: rule.id };
}

function findDuplicates(phoneNorm, email, companyName) {
  const dupes = [];
  if (phoneNorm) {
    db.prepare(`SELECT id FROM leads WHERE phone_norm=? AND status != 'CLOSED'`)
      .all(phoneNorm).forEach(x => dupes.push(x.id));
  }
  if (email) {
    db.prepare(`SELECT id FROM leads WHERE email=? AND status != 'CLOSED'`)
      .all(email).forEach(x => { if (!dupes.includes(x.id)) dupes.push(x.id); });
  }
  if (companyName) {
    db.prepare(`SELECT id FROM leads WHERE company_name=? AND status != 'CLOSED'`)
      .all(companyName).forEach(x => { if (!dupes.includes(x.id)) dupes.push(x.id); });
  }
  return dupes;
}

module.exports = { normalisePhone, generateLeadCode, findRule, autoAssign, findDuplicates };
