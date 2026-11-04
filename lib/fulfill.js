// Turning a paid Stripe Checkout Session into course access, and revoking it on refund.
// Every function here is idempotent: the webhook and the welcome page may both call it.
const db = require('./db');
const { normEmail, findUserByEmail, findUser } = require('./auth');

function grantFromSession(s) {
  const email = normEmail(s.email);
  if (!email) throw new Error('Checkout session has no email address');
  const existing = db.prepare('SELECT * FROM purchases WHERE stripe_session_id = ?').get(s.id);
  if (existing) return { user: findUser(existing.user_id), created: false };

  let user = findUserByEmail(email);
  const t = Date.now();
  if (!user) {
    db.prepare('INSERT INTO users (email, name, access, created_at, purchased_at) VALUES (?, ?, 1, ?, ?)')
      .run(email, s.name || null, t, t);
    user = findUserByEmail(email);
  } else {
    db.prepare('UPDATE users SET access = 1, purchased_at = COALESCE(purchased_at, ?), name = COALESCE(name, ?) WHERE id = ?')
      .run(t, s.name || null, user.id);
    user = findUser(user.id);
  }
  db.prepare(`INSERT INTO purchases (user_id, stripe_session_id, payment_intent, amount, currency, status, created_at)
              VALUES (?, ?, ?, ?, ?, ?, ?)`)
    .run(user.id, s.id, s.payment_intent || null, s.amount_total ?? null, s.currency || null, s.status || 'paid', t);
  return { user, created: true };
}

function revokeByPaymentIntent(paymentIntent) {
  const p = db.prepare('SELECT * FROM purchases WHERE payment_intent = ?').get(paymentIntent);
  if (!p) return null;
  db.prepare("UPDATE purchases SET status = 'refunded' WHERE id = ?").run(p.id);
  const stillPaid = db.prepare("SELECT COUNT(*) AS n FROM purchases WHERE user_id = ? AND status IN ('paid', 'gift')").get(p.user_id).n;
  if (!stillPaid) db.prepare('UPDATE users SET access = 0 WHERE id = ?').run(p.user_id);
  return { user: findUser(p.user_id), purchase: p };
}

function purchaseBySession(sessionId) {
  return db.prepare('SELECT * FROM purchases WHERE stripe_session_id = ?').get(sessionId);
}

// Normalise a Stripe Checkout Session object into the fields we store.
function fromStripeSession(cs) {
  return {
    id: cs.id,
    email: cs.customer_details?.email || cs.customer_email,
    name: cs.customer_details?.name || null,
    payment_intent: typeof cs.payment_intent === 'string' ? cs.payment_intent : cs.payment_intent?.id,
    amount_total: cs.amount_total,
    currency: cs.currency,
  };
}

module.exports = { grantFromSession, revokeByPaymentIntent, purchaseBySession, fromStripeSession };
