// Sessions, one-time tokens and password handling.
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const db = require('./db');
const config = require('./config');

const SESSION_DAYS = 60;
const COOKIE = 'ma_session';
const now = () => Date.now();
const sha = (t) => crypto.createHash('sha256').update(String(t)).digest('hex');
const randomToken = () => crypto.randomBytes(32).toString('base64url');
const normEmail = (e) => String(e || '').trim().toLowerCase();

function findUserByEmail(email) {
  return db.prepare('SELECT * FROM users WHERE email = ?').get(normEmail(email));
}
function findUser(id) {
  return db.prepare('SELECT * FROM users WHERE id = ?').get(id);
}

async function hashPassword(pw) { return bcrypt.hash(pw, 12); }
async function checkPassword(user, pw) {
  if (!user || !user.password_hash) return false;
  return bcrypt.compare(String(pw || ''), user.password_hash);
}
function validPassword(pw) { return typeof pw === 'string' && pw.length >= 8 && pw.length <= 200; }

function createSession(res, userId) {
  const token = randomToken();
  db.prepare('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)')
    .run(sha(token), userId, now() + SESSION_DAYS * 864e5);
  res.cookie(COOKIE, token, {
    httpOnly: true, sameSite: 'lax', secure: config.SECURE_COOKIES,
    maxAge: SESSION_DAYS * 864e5, path: '/',
  });
}
function destroySession(req, res) {
  const t = req.cookies[COOKIE];
  if (t) db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(sha(t));
  res.clearCookie(COOKIE, { path: '/' });
}
function destroyAllSessions(userId) {
  db.prepare('DELETE FROM sessions WHERE user_id = ?').run(userId);
}

// Attaches req.user (or null) on every request.
function loadUser(req, _res, next) {
  req.user = null;
  const t = req.cookies[COOKIE];
  if (t) {
    const row = db.prepare('SELECT user_id, expires_at FROM sessions WHERE token_hash = ?').get(sha(t));
    if (row && row.expires_at > now()) req.user = findUser(row.user_id) || null;
  }
  next();
}
function requireLogin(req, res, next) {
  if (!req.user) return res.redirect(303, `/login?next=${encodeURIComponent(req.originalUrl)}`);
  next();
}
function requireAccess(req, res, next) {
  if (!req.user) return res.redirect(303, `/login?next=${encodeURIComponent(req.originalUrl)}`);
  if (!req.user.access) return res.redirect(303, '/account');
  next();
}

// One-time tokens for "set your password" and "reset your password".
function issueToken(userId, kind, ttlMinutes) {
  const token = randomToken();
  db.prepare('INSERT INTO tokens (token_hash, user_id, kind, expires_at) VALUES (?, ?, ?, ?)')
    .run(sha(token), userId, kind, now() + ttlMinutes * 6e4);
  return token;
}
function peekToken(token, kind) {
  const row = db.prepare('SELECT * FROM tokens WHERE token_hash = ? AND kind = ?').get(sha(token), kind);
  if (!row || row.used || row.expires_at < now()) return null;
  return row;
}
function consumeToken(token, kind) {
  const row = peekToken(token, kind);
  if (!row) return null;
  db.prepare('UPDATE tokens SET used = 1 WHERE token_hash = ?').run(row.token_hash);
  return row;
}

// Housekeeping: drop expired sessions and tokens.
function cleanup() {
  db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(now());
  db.prepare('DELETE FROM tokens WHERE expires_at < ? OR used = 1').run(now() - 864e5);
}

module.exports = {
  COOKIE, normEmail, findUserByEmail, findUser, hashPassword, checkPassword, validPassword,
  createSession, destroySession, destroyAllSessions, loadUser, requireLogin, requireAccess,
  issueToken, peekToken, consumeToken, cleanup,
};
