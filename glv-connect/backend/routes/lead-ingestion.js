'use strict';
const express = require('express');
const crypto  = require('crypto');
const router  = express.Router();
const db      = require('../db/database');
const { addBusinessHours }             = require('../services/businessHoursService');
const { createAndSendLeadNotification } = require('../services/leadNotificationService');
const { isCorporateEmail }             = require('../utils/emailValidator');

// In-memory rate limiter: 20 req/min per IP
const rateLimitMap = new Map();
function rateLimit(req, res, next) {
  const ip  = req.ip || (req.connection && req.connection.remoteAddress) || 'unknown';
  const now = Date.now();
  const windowMs = 60 * 1000;
  const limit = 20;
  const entry = rateLimitMap.get(ip) || { count: 0, start: now };
  if (now - entry.start > windowMs) { entry.count = 0; entry.start = now; }
  entry.count++;
  rateLimitMap.set(ip, entry);
  if (entry.count > limit) return res.status(429).json({ error: 'Too many requests' });
  next();
}

// Origin check
function originCheck(req, res, next) {
  const allowed = process.env.ALLOWED_ORIGINS;
  if (!allowed) return next(); // dev: allow all
  const origin = req.headers.origin || req.headers.referer || '';
  const origins = allowed.split(',').map(o => o.trim()).filter(Boolean);
  if (origins.length === 0 || origins.some(o => origin.startsWith(o))) return next();
  return res.status(403).json({ error: 'Origin not allowed' });
}

// HMAC verification
function verifyHmac(req, res, next) {
  const secret = process.env.LEAD_INGESTION_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      return res.status(500).json({ error: 'Ingestion secret not configured' });
    }
    return next(); // dev: skip
  }
  const sig = req.headers['x-glv-signature'] || '';
  if (!sig) return res.status(401).json({ error: 'Missing signature' });
  const rawBody = req.rawBody;
  if (!rawBody && rawBody !== '') return res.status(400).json({ error: 'Raw body unavailable' });
  const expected = 'sha256=' + crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  try {
    const sigBuf = Buffer.from(sig);
    const expBuf = Buffer.from(expected);
    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
      return res.status(401).json({ error: 'Invalid signature' });
    }
  } catch (_) {
    return res.status(401).json({ error: 'Invalid signature' });
  }
  next();
}

function generateLeadCode() {
  const year = new Date().getFullYear();
  const row  = db.prepare("SELECT COUNT(*) as cnt FROM leads WHERE strftime('%Y', created_at) = ?").get(String(year));
  const n    = (row ? row.cnt : 0) + 1;
  return `LEAD-${year}-${String(n).padStart(4, '0')}`;
}

function findPossibleDuplicates(phone, email) {
  const dups = [];
  if (phone) {
    const norm = phone.replace(/\D/g, '');
    if (norm) {
      const rows = db.prepare("SELECT id, glv_code, contact_name, status FROM leads WHERE phone_norm = ? LIMIT 3").all(norm);
      dups.push(...rows);
    }
  }
  if (email) {
    const rows = db.prepare("SELECT id, glv_code, contact_name, status FROM leads WHERE email = ? LIMIT 3").all(email);
    for (const r of rows) {
      if (!dups.find(d => d.id === r.id)) dups.push(r);
    }
  }
  return dups;
}

function getAutoAssignAgent() {
  const rule = db.prepare(`
    SELECT r.agent_username as username
    FROM lead_assignment_rules r
    JOIN users u ON u.username = r.agent_username
    WHERE r.is_active = 1 AND u.active = 1
      AND (r.origin_channel = 'EXTERNAL' OR r.origin_channel IS NULL)
    ORDER BY r.priority ASC LIMIT 1
  `).get();
  if (!rule) return null;
  const user = db.prepare("SELECT * FROM users WHERE username = ? AND active = 1").get(rule.username);
  if (!user) return null;
  try {
    if (!isCorporateEmail(user.email)) return null;
  } catch (_) { return null; }
  return user;
}

router.post('/', rateLimit, originCheck, verifyHmac, (req, res) => {
  const { source, external_submission_id, contact_name, phone, email,
          message, product_interest, country, preferred_lang } = req.body || {};

  if (!source || !external_submission_id || !contact_name) {
    return res.status(400).json({ error: 'source, external_submission_id, and contact_name are required' });
  }

  // Idempotency
  const existing = db.prepare(
    "SELECT id, glv_code, status, assigned_agent FROM leads WHERE external_source = ? AND external_submission_id = ?"
  ).get(source, external_submission_id);
  if (existing) {
    return res.status(200).json({
      id: existing.id, glv_code: existing.glv_code,
      status: existing.status, assigned_agent: existing.assigned_agent,
      idempotent: true
    });
  }

  const possible_duplicates = findPossibleDuplicates(phone, email);
  const phone_norm          = phone ? phone.replace(/\D/g, '') : null;
  const autoAgent           = getAutoAssignAgent();
  const status              = autoAgent ? 'ASSIGNED' : 'PENDING_ASSIGNMENT';
  const glv_code            = generateLeadCode();
  const firstContactDeadline = addBusinessHours(new Date(), 4);

  const insertLead = db.transaction(() => {
    const result = db.prepare(`
      INSERT INTO leads (glv_code, contact_name, phone_raw, phone_norm, email, notes, product_type,
        country_code, language, origin_channel, status, assigned_agent, first_contact_deadline,
        external_source, external_submission_id, created_at, updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,'OTHER',?,?,?,?,?,datetime('now'),datetime('now'))
    `).run(
      glv_code, contact_name, phone || null, phone_norm || null, email || null,
      message || null, product_interest || null, country || null, preferred_lang || 'ES',
      status, autoAgent ? autoAgent.username : null, firstContactDeadline,
      source, external_submission_id
    );
    const leadId = result.lastInsertRowid;

    db.prepare("INSERT INTO lead_timeline (lead_id, event_type, actor, metadata) VALUES (?,?,?,?)").run(
      leadId, 'LEAD_CREATED', 'SYSTEM', JSON.stringify({ source: 'EXTERNAL', via: source })
    );

    if (autoAgent) {
      const agentId = db.prepare("SELECT id FROM users WHERE username=?").get(autoAgent.username);
      db.prepare("INSERT INTO lead_assignment_history (lead_id, new_agent, prev_status, new_status, changed_by, reason) VALUES (?,?,?,?,?,?)").run(
        leadId, autoAgent.username, 'NEW', 'ASSIGNED', 'SYSTEM', 'Auto-assign from external ingestion'
      );
      db.prepare("INSERT INTO lead_timeline (lead_id, event_type, actor, metadata) VALUES (?,?,?,?)").run(
        leadId, 'AGENT_ASSIGNED', 'SYSTEM', JSON.stringify({ agent: autoAgent.username })
      );
      db.prepare(
        `INSERT INTO tasks (title, priority, assigned_to, deadline, lead_id, task_type) VALUES (?,?,?,?,?,?)`
      ).run(
        `Primera toma de contacto – ${glv_code}`, 'high',
        agentId ? agentId.id : null, firstContactDeadline, leadId, 'FIRST_CONTACT'
      );
    } else {
      db.prepare("INSERT INTO lead_timeline (lead_id, event_type, actor, metadata) VALUES (?,?,?,?)").run(
        leadId, 'ASSIGNMENT_FAILED', 'SYSTEM', JSON.stringify({ reason: 'No valid auto-assign rule for EXTERNAL source' })
      );
    }

    return leadId;
  });

  let leadId;
  try {
    leadId = insertLead();
  } catch (err) {
    console.error('[lead-ingestion] Insert error:', err);
    return res.status(500).json({ error: 'Failed to create lead' });
  }

  if (autoAgent) {
    setImmediate(() => {
      try {
        createAndSendLeadNotification(leadId, autoAgent.username, 'LEAD_ASSIGNED');
      } catch (e) {
        console.error('[lead-ingestion] Notification error:', e.message);
      }
    });
  }

  return res.status(201).json({
    id: leadId, glv_code, status,
    assigned_agent: autoAgent ? autoAgent.username : null,
    first_contact_deadline: firstContactDeadline,
    possible_duplicates,
    idempotent: false
  });
});

module.exports = router;
