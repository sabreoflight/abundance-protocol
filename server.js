// The Abundance Protocol — course microsite.
// Sales page, Stripe Checkout, student accounts, protected lesson player, progress and downloads.
const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const config = require('./lib/config');
const db = require('./lib/db');
const auth = require('./lib/auth');
const mail = require('./lib/mail');
const views = require('./lib/views');
const { lessons, bySlug, nextLesson, allowedDownloads, allowedAudio, CONTENT_DIR } = require('./lib/content');
const { grantFromSession, revokeByPaymentIntent, purchaseBySession, fromStripeSession } = require('./lib/fulfill');
const { parseCookies, headers, sameOrigin, rateLimit } = require('./lib/security');

const stripe = config.STRIPE_SECRET_KEY ? require('stripe')(config.STRIPE_SECRET_KEY) : null;
const app = express();
app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use(headers);

// ---------- Stripe webhook (raw body; must come before the form parser) ----------
app.post('/stripe/webhook', express.raw({ type: 'application/json', limit: '1mb' }), async (req, res) => {
  if (!stripe || !config.STRIPE_WEBHOOK_SECRET) return res.status(503).send('Stripe not configured');
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, req.headers['stripe-signature'], config.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.warn('[webhook] bad signature:', err.message);
    return res.status(400).send('Bad signature');
  }
  try {
    if (event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded') {
      const cs = event.data.object;
      if (cs.payment_status === 'paid') {
        const { user, created } = grantFromSession(fromStripeSession(cs));
        if (created) await sendAccessEmail(user);
      }
    } else if (event.type === 'charge.refunded') {
      const ch = event.data.object;
      if (ch.refunded && ch.payment_intent) {
        const r = revokeByPaymentIntent(ch.payment_intent);
        if (r && !r.user.access) {
          auth.destroyAllSessions(r.user.id);
          await mail.sendTemplate('C7', r.user, { amount: `${(ch.amount_refunded / 100).toFixed(2)} ${String(ch.currency).toUpperCase()}` });
        }
      }
    }
    res.json({ received: true });
  } catch (err) {
    console.error('[webhook] handler error:', err);
    res.status(500).send('Webhook handler error');
  }
});

app.use(express.urlencoded({ extended: false, limit: '20kb' }));
app.use(parseCookies);
app.use(sameOrigin);
app.use(auth.loadUser);
app.use(express.static(path.join(__dirname, 'public'), { maxAge: '7d', index: false }));

async function sendAccessEmail(user) {
  // If they haven't chosen a password yet, include a 7-day set-password link.
  const setPasswordUrl = user.password_hash ? null : `${config.SITE_URL}/set-password?token=${auth.issueToken(user.id, 'set', 7 * 24 * 60)}`;
  await mail.sendTemplate('C1', user, { setPasswordUrl });
  db.prepare('INSERT OR IGNORE INTO email_log (user_id, email_id, sent_at) VALUES (?, ?, ?)').run(user.id, 'C1', Date.now());
}

const safeNext = (n) => (typeof n === 'string' && n.startsWith('/app') && !n.startsWith('//') ? n : '/app');
const loginLimit = rateLimit({ windowMs: 15 * 60e3, max: 10 });

// ---------- Public ----------
app.get('/', (req, res) => res.send(views.sales({ user: req.user, canceled: req.query.canceled === '1' })));
for (const key of ['terms', 'refund', 'disclaimer']) app.get(`/${key}`, (req, res) => res.send(views.legalPage(key, req.user)));
app.get('/healthz', (_req, res) => res.json({ ok: true }));

// ---------- Checkout ----------
app.post('/checkout', async (req, res, next) => {
  try {
    if (config.DEV_FAKE_CHECKOUT) return res.redirect(303, '/dev/checkout');
    if (!stripe || !config.STRIPE_PRICE_ID) return res.status(503).send(views.errorPage(req.user));
    const params = {
      mode: 'payment',
      line_items: [{ price: config.STRIPE_PRICE_ID, quantity: 1 }],
      success_url: `${config.SITE_URL}/welcome?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${config.SITE_URL}/?canceled=1`,
      allow_promotion_codes: true,
      customer_creation: 'always',
      metadata: { course_id: 'abundance-protocol' },
      custom_text: { submit: { message: "Lifetime access. You'll set your password right after paying. 7-day refund, no questions asked." } },
    };
    if (req.user) params.customer_email = req.user.email;
    if (config.STRIPE_REQUIRE_TOS) params.consent_collection = { terms_of_service: 'required' };
    const cs = await stripe.checkout.sessions.create(params);
    res.redirect(303, cs.url);
  } catch (err) { next(err); }
});

// Development-only stand-in for Stripe Checkout (never available in production).
if (config.DEV_FAKE_CHECKOUT) {
  console.log('DEV_FAKE_CHECKOUT is on: purchases are simulated. Never enable this in production.');
  app.get('/dev/checkout', (req, res) => res.send(views.message({ title: 'Test checkout', heading: 'Test checkout', user: req.user,
    body: `<p class="note">Development mode. No card is charged.</p><form method="post" action="/dev/checkout" class="stack">
      <label for="name">Name</label><input id="name" name="name" required value="Test Buyer">
      <label for="email">Email</label><input id="email" name="email" type="email" required value="buyer@example.com">
      <button class="btn" type="submit">Complete test purchase · $9</button></form>` })));
  app.post('/dev/checkout', async (req, res) => {
    const id = `cs_dev_${crypto.randomBytes(12).toString('hex')}`;
    const { user, created } = grantFromSession({ id, email: req.body.email, name: req.body.name, payment_intent: `pi_dev_${crypto.randomBytes(8).toString('hex')}`, amount_total: 900, currency: 'usd' });
    if (created) await sendAccessEmail(user);
    res.redirect(303, `/welcome?session_id=${id}`);
  });
}

// After payment: confirm the purchase and let the buyer set a password immediately.
app.get('/welcome', async (req, res, next) => {
  try {
    const sid = String(req.query.session_id || '');
    if (!/^cs_[A-Za-z0-9_]+$/.test(sid)) return res.redirect(303, '/');
    let purchase = purchaseBySession(sid);
    if (!purchase && stripe && !sid.startsWith('cs_dev_')) {
      const cs = await stripe.checkout.sessions.retrieve(sid);
      if (cs.payment_status !== 'paid') {
        return res.send(views.message({ title: 'Almost there', heading: 'Almost there.', user: req.user,
          body: `<p>Your payment is still being confirmed. Refresh this page in a minute. If it doesn't update, write to <strong>${views.esc(config.SUPPORT_EMAIL)}</strong>.</p>` }));
      }
      const { user, created } = grantFromSession(fromStripeSession(cs));
      if (created) await sendAccessEmail(user);
      purchase = purchaseBySession(sid);
    }
    if (!purchase) return res.redirect(303, '/');
    const user = auth.findUser(purchase.user_id);
    // The session id is only a short-lived key to set a first password.
    const fresh = Date.now() - purchase.created_at < 24 * 3600e3;
    if (!user.password_hash && fresh) {
      const token = auth.issueToken(user.id, 'set', 60);
      return res.send(views.setPassword({ token, action: '/set-password', heading: "You're in.", email: user.email,
        sub: 'Choose a password to finish setting up your lifetime access. You just stepped off the race.' }));
    }
    res.send(views.welcomeDone({ user: req.user, email: user.email }));
  } catch (err) { next(err); }
});

// ---------- Passwords ----------
async function savePassword(req, res, kind) {
  const { token, password, confirm } = req.body;
  const row = auth.peekToken(String(token || ''), kind);
  const heading = kind === 'set' ? "You're in." : 'Choose a new password.';
  const action = kind === 'set' ? '/set-password' : '/reset';
  if (!row) return res.status(400).send(views.message({ title: 'Link expired', heading: 'This link has expired.', user: req.user,
    body: `<p>Request a fresh one and you'll be back in a moment.</p><a class="btn" href="/forgot">Send a new link</a>` }));
  const err = !auth.validPassword(password) ? 'Please choose a password of at least 8 characters.' : password !== confirm ? "Those passwords don't match." : null;
  if (err) return res.status(400).send(views.setPassword({ token, action, heading, error: err }));
  auth.consumeToken(token, kind);
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(await auth.hashPassword(password), row.user_id);
  auth.destroyAllSessions(row.user_id);
  auth.createSession(res, row.user_id);
  res.redirect(303, '/app');
}
app.get('/set-password', (req, res) => {
  const token = String(req.query.token || '');
  const row = auth.peekToken(token, 'set');
  if (!row) return res.redirect(303, '/forgot');
  const user = auth.findUser(row.user_id);
  if (user.password_hash) return res.redirect(303, '/login');
  res.send(views.setPassword({ token, action: '/set-password', heading: "You're in.", email: user.email, sub: 'Choose a password to finish setting up your lifetime access.' }));
});
app.post('/set-password', (req, res, next) => savePassword(req, res, 'set').catch(next));
app.get('/reset', (req, res) => {
  const token = String(req.query.token || '');
  if (!auth.peekToken(token, 'reset')) return res.redirect(303, '/forgot');
  res.send(views.setPassword({ token, action: '/reset', heading: 'Choose a new password.' }));
});
app.post('/reset', (req, res, next) => savePassword(req, res, 'reset').catch(next));

app.get('/forgot', (req, res) => res.send(views.forgot({})));
app.post('/forgot', loginLimit, async (req, res, next) => {
  try {
    const user = auth.findUserByEmail(req.body.email);
    if (user) {
      const resetUrl = `${config.SITE_URL}/reset?token=${auth.issueToken(user.id, 'reset', 60)}`;
      await mail.sendTemplate('RESET', user, { resetUrl });
    }
    res.send(views.forgot({ sent: true }));
  } catch (err) { next(err); }
});

// ---------- Sign in / out ----------
app.get('/login', (req, res) => {
  if (req.user) return res.redirect(303, safeNext(req.query.next));
  res.send(views.login({ next: req.query.next || '' }));
});
app.post('/login', loginLimit, async (req, res, next) => {
  try {
    const user = auth.findUserByEmail(req.body.email);
    if (!(await auth.checkPassword(user, req.body.password))) {
      return res.status(401).send(views.login({ error: "That email and password don't match.", next: req.body.next, email: req.body.email }));
    }
    auth.createSession(res, user.id);
    res.redirect(303, safeNext(req.body.next));
  } catch (err) { next(err); }
});
app.post('/logout', (req, res) => { auth.destroySession(req, res); res.redirect(303, '/'); });

// ---------- Course area ----------
const progressFor = (uid) => new Set(db.prepare('SELECT lesson_id FROM progress WHERE user_id = ?').all(uid).map((r) => r.lesson_id));

app.get('/account', auth.requireLogin, (req, res) => {
  const purchase = db.prepare("SELECT * FROM purchases WHERE user_id = ? AND status IN ('paid', 'gift') ORDER BY created_at LIMIT 1").get(req.user.id);
  res.send(views.account({ user: req.user, purchase }));
});
app.get('/app', auth.requireAccess, (req, res) => res.send(views.dashboard({ user: req.user, done: progressFor(req.user.id) })));
app.get('/app/lesson/:slug', auth.requireAccess, (req, res) => {
  const l = bySlug[req.params.slug];
  if (!l) return res.status(404).send(views.notFound(req.user));
  res.send(views.lesson({ user: req.user, l, isDone: progressFor(req.user.id).has(l.slug), next: nextLesson(l.slug) }));
});
app.post('/app/lesson/:slug/complete', auth.requireAccess, (req, res) => {
  const l = bySlug[req.params.slug];
  if (!l) return res.status(404).send(views.notFound(req.user));
  db.prepare('INSERT OR IGNORE INTO progress (user_id, lesson_id, completed_at) VALUES (?, ?, ?)').run(req.user.id, l.slug, Date.now());
  const n = nextLesson(l.slug);
  res.redirect(303, n ? `/app/lesson/${n.slug}` : '/app');
});

// Protected media: streamed with range support, never exposed at a public URL.
const privateFile = (res) => res.set({ 'Cache-Control': 'private, no-store', 'Content-Disposition': 'inline' });
app.get('/media/lesson/:slug', auth.requireAccess, (req, res) => {
  const l = bySlug[req.params.slug];
  if (!l) return res.status(404).end();
  privateFile(res);
  res.sendFile(path.join(CONTENT_DIR, 'media', l.video), { acceptRanges: true }, (err) => { if (err && !res.headersSent) res.status(404).end(); });
});
app.get('/download/:file', auth.requireAccess, (req, res) => {
  const f = req.params.file;
  if (!allowedDownloads.has(f)) return res.status(404).send(views.notFound(req.user));
  res.download(path.join(CONTENT_DIR, 'downloads', f), f, (err) => { if (err && !res.headersSent) res.status(404).end(); });
});
app.get('/audio/:file', auth.requireAccess, (req, res) => {
  const f = req.params.file;
  if (!allowedAudio.has(f)) return res.status(404).end();
  res.download(path.join(CONTENT_DIR, 'audio', f), f, (err) => { if (err && !res.headersSent) res.status(404).end(); });
});

// ---------- Errors ----------
app.use((req, res) => res.status(404).send(views.notFound(req.user)));
app.use((err, req, res, _next) => {
  console.error('[error]', err);
  res.status(500).send(views.errorPage(req.user));
});

// ---------- Background jobs ----------
// Onboarding emails C2–C6, sent once each, only when email is configured.
const DRIP = [['C2', 1], ['C3', 3], ['C4', 7], ['C5', 14], ['C6', 30]];
async function runDrip() {
  if (!mail.enabled()) return;
  const users = db.prepare('SELECT * FROM users WHERE access = 1 AND purchased_at IS NOT NULL').all();
  for (const u of users) {
    const days = (Date.now() - u.purchased_at) / 864e5;
    for (const [id, day] of DRIP) {
      if (days < day || days > day + 3) continue; // don't backfill old emails
      const sent = db.prepare('SELECT 1 FROM email_log WHERE user_id = ? AND email_id = ?').get(u.id, id);
      if (sent) continue;
      db.prepare('INSERT OR IGNORE INTO email_log (user_id, email_id, sent_at) VALUES (?, ?, ?)').run(u.id, id, Date.now());
      await mail.sendTemplate(id, u);
    }
  }
}
setInterval(() => { auth.cleanup(); runDrip().catch((e) => console.error('[drip]', e)); }, 60 * 60e3).unref();

// ---------- Start ----------
const missingMedia = lessons.filter((l) => !fs.existsSync(path.join(CONTENT_DIR, 'media', l.video))).map((l) => l.video);
if (missingMedia.length) console.warn(`Missing lesson videos in content/media: ${missingMedia.join(', ')}`);
if (require.main === module) {
  app.listen(config.PORT, () => {
    console.log(`The Abundance Protocol is running at ${config.SITE_URL} (port ${config.PORT})`);
    if (!stripe) console.log('Stripe is not configured: set STRIPE_SECRET_KEY, STRIPE_PRICE_ID and STRIPE_WEBHOOK_SECRET.');
    if (!mail.enabled()) console.log('Email is not configured (SMTP_URL): emails are printed here instead of sent.');
  });
}
module.exports = app;
