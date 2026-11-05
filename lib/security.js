// Small, dependency-free security middleware.
const config = require('./config');

function parseCookies(req, _res, next) {
  req.cookies = {};
  const h = req.headers.cookie;
  if (h) for (const part of h.split(';')) {
    const i = part.indexOf('=');
    if (i > 0) {
      try { req.cookies[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim()); } catch { /* ignore bad cookie */ }
    }
  }
  next();
}

function headers(_req, res, next) {
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'same-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    'Content-Security-Policy': [
      "default-src 'self'",
      "script-src 'self' https://static.cloudflareinsights.com",
      "connect-src 'self' https://cloudflareinsights.com",
      "style-src 'self' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data:",
      "media-src 'self'",
      "frame-ancestors 'none'",
      "form-action 'self' https://checkout.stripe.com",
      "base-uri 'self'",
    ].join('; '),
  });
  if (config.SECURE_COOKIES) res.set('Strict-Transport-Security', 'max-age=31536000');
  next();
}

// Reject cross-site form posts (SameSite cookies already block most; this is a second lock).
function sameOrigin(req, res, next) {
  if (req.method !== 'POST') return next();
  const origin = req.headers.origin;
  if (!origin) return next();
  const allowed = new URL(config.SITE_URL).origin;
  const self = `${req.protocol}://${req.get('host')}`;
  if (origin === allowed || origin === self) return next();
  res.status(403).send('Forbidden');
}

// Simple fixed-window rate limiter, per IP and route.
function rateLimit({ windowMs, max }) {
  const hits = new Map();
  return (req, res, next) => {
    const key = `${req.ip}:${req.path}`;
    const t = Date.now();
    const e = hits.get(key);
    if (!e || t - e.start > windowMs) hits.set(key, { start: t, n: 1 });
    else if (++e.n > max) return res.status(429).send('Too many attempts. Please wait a few minutes and try again.');
    if (hits.size > 10000) hits.clear();
    next();
  };
}

module.exports = { parseCookies, headers, sameOrigin, rateLimit };
