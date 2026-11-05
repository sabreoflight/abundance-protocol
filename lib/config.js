// Central configuration, read once from the environment (see .env.example).
const path = require('path');
const fs = require('fs');

// Minimal .env loader so the app runs with `npm start` and no extra packages.
const envFile = path.join(__dirname, '..', '.env');
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

const env = process.env;
const PROD = env.NODE_ENV === 'production';
const config = {
  PROD,
  PORT: Number(env.PORT || 3000),
  SITE_URL: (env.SITE_URL || 'http://localhost:3000').replace(/\/$/, ''),
  SESSION_SECRET: env.SESSION_SECRET || '',
  STRIPE_SECRET_KEY: env.STRIPE_SECRET_KEY || '',
  STRIPE_WEBHOOK_SECRET: env.STRIPE_WEBHOOK_SECRET || '',
  STRIPE_PRICE_ID: env.STRIPE_PRICE_ID || '',
  STRIPE_REQUIRE_TOS: env.STRIPE_REQUIRE_TOS === '1',
  PRICE_LABEL: env.PRICE_LABEL || '$9',
  SUPPORT_EMAIL: env.SUPPORT_EMAIL || 'support@example.com',
  SMTP_URL: env.SMTP_URL || '',
  MAIL_FROM: env.MAIL_FROM || 'Mission Abundance <hello@example.com>',
  DKIM_DOMAIN: env.DKIM_DOMAIN || '',
  DKIM_SELECTOR: env.DKIM_SELECTOR || 'ct',
  DKIM_PRIVATE_KEY_PATH: env.DKIM_PRIVATE_KEY_PATH || '',
  DEV_FAKE_CHECKOUT: env.DEV_FAKE_CHECKOUT === '1' && !PROD,
  DATA_DIR: env.DATA_DIR || path.join(__dirname, '..', 'data'),
  CONTENT_DIR: env.CONTENT_DIR || path.join(__dirname, '..', 'content'),
};
config.SECURE_COOKIES = config.SITE_URL.startsWith('https://');

// Refuse to start production without the essentials, so nothing ships half-configured.
if (PROD) {
  const missing = ['SITE_URL', 'SESSION_SECRET', 'STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET', 'STRIPE_PRICE_ID', 'SUPPORT_EMAIL']
    .filter((k) => !env[k]);
  if (missing.length) {
    console.error(`Missing required settings for production: ${missing.join(', ')}. See .env.example.`);
    process.exit(1);
  }
  if (config.SESSION_SECRET.length < 32) {
    console.error('SESSION_SECRET must be at least 32 characters. Generate one with: openssl rand -hex 32');
    process.exit(1);
  }
}
module.exports = config;
