'use strict';

const BLOCKED_PERSONAL_DOMAINS = new Set([
  'gmail.com','hotmail.com','yahoo.com','outlook.com','live.com',
  'icloud.com','protonmail.com','aol.com','mail.com','yandex.com',
  'zoho.com','gmx.com','tutanota.com','fastmail.com'
]);

const BLOCKED_ADDRESSES = new Set(['thegroupfenix@gmail.com']);

function getCorporateDomains() {
  const env = process.env.CORPORATE_EMAIL_DOMAINS;
  if (!env) return null;
  return new Set(env.split(',').map(d => d.trim().toLowerCase()).filter(Boolean));
}

function isCorporateEmail(email) {
  if (!email || typeof email !== 'string') return false;
  const lower = email.toLowerCase().trim();
  if (BLOCKED_ADDRESSES.has(lower)) return false;
  const atIndex = lower.indexOf('@');
  if (atIndex < 0) return false;
  const domain = lower.slice(atIndex + 1);
  if (!domain) return false;
  if (BLOCKED_PERSONAL_DOMAINS.has(domain)) return false;
  const allowed = getCorporateDomains();
  if (allowed === null) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('CORPORATE_EMAIL_DOMAINS must be set in production');
    }
    return true; // dev mode: block only personal domains
  }
  return allowed.has(domain);
}

module.exports = { isCorporateEmail, getCorporateDomains, BLOCKED_PERSONAL_DOMAINS };
