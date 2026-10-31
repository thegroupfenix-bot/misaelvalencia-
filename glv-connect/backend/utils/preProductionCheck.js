'use strict';

const REQUIRED_VARS = [
  'SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'MAIL_FROM',
  'APP_URL', 'CORPORATE_EMAIL_DOMAINS', 'LEAD_INGESTION_SECRET',
  'JWT_SECRET', 'ALLOWED_ORIGINS'
];

const PERSONAL_DOMAINS = ['gmail.com', 'hotmail.com', 'yahoo.com', 'outlook.com', 'live.com'];

function checkPreProductionEnv() {
  const missing = REQUIRED_VARS.filter(v => !process.env[v]);
  if (missing.length > 0) {
    console.warn('[PRE-PRODUCTION] Missing env vars:', missing.join(', '));
  }

  const appUrl = process.env.APP_URL || '';
  if (appUrl.includes('railway.app')) {
    console.warn('[PRE-PRODUCTION] WARNING: APP_URL points to Railway. Set APP_URL to your production domain.');
  }

  const mailFrom = process.env.MAIL_FROM || '';
  if (mailFrom) {
    const domain = mailFrom.split('@').pop() || '';
    if (PERSONAL_DOMAINS.includes(domain.toLowerCase())) {
      throw new Error(
        `[PRE-PRODUCTION] MAIL_FROM (${mailFrom}) uses a personal email domain. Use a corporate SMTP address.`
      );
    }
  }

  if (process.env.NODE_ENV === 'production' && missing.length > 0) {
    throw new Error(
      `[PRE-PRODUCTION] Cannot start in production with missing env vars: ${missing.join(', ')}`
    );
  }
}

module.exports = { checkPreProductionEnv };
