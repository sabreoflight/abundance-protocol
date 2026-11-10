#!/usr/bin/env node
// End-to-end test against a throwaway database. No network and no real Stripe account needed:
// webhooks are signed locally with a test secret, exactly as Stripe signs them.
const fs = require('fs');
const os = require('os');
const path = require('path');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ma-test-'));
Object.assign(process.env, {
  NODE_ENV: 'test', DATA_DIR: tmp, PORT: '0', SITE_URL: 'http://127.0.0.1', DEV_FAKE_CHECKOUT: '1',
  STRIPE_SECRET_KEY: 'sk_test_dummy', STRIPE_WEBHOOK_SECRET: 'whsec_test_local', STRIPE_PRICE_ID: 'price_test',
});
const app = require('../server');
const stripe = require('stripe')('sk_test_dummy');

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) { pass++; console.log('  ✓', msg); } else { fail++; console.log('  ✗', msg); } };

(async () => {
  const server = app.listen(0);
  const base = `http://127.0.0.1:${server.address().port}`;
  let cookie = '';
  const req = async (p, opts = {}) => {
    const r = await fetch(base + p, { redirect: 'manual', ...opts, headers: { ...(opts.headers || {}), ...(cookie ? { cookie } : {}) } });
    const sc = r.headers.get('set-cookie'); if (sc && sc.startsWith('ma_session=')) cookie = sc.split(';')[0];
    return r;
  };
  const form = (o) => ({ method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(o).toString() });

  console.log('Public pages');
  let r = await req('/'); let home = await r.text(); ok(r.status === 200 && home.includes('Abundance is a practice'), 'sales page renders');
  ok(home.includes('property="og:image"') && home.includes('twitter:card'), 'social share tags present');
  ok(!/poster="\//.test(home), 'video posters use base-path-safe relative URLs');
  r = await req('/media/preview-lesson-2-v2.mp4', { headers: { range: 'bytes=0-99' } }); ok(r.status === 206, 'free preview lesson is public');
  r = await req('/og.jpg'); ok(r.status === 200 && r.headers.get('content-type').includes('image'), 'share image served');
  for (const p of ['/terms', '/refund', '/disclaimer', '/login', '/forgot']) { r = await req(p); ok(r.status === 200, `${p} renders`); }
  r = await req('/app'); ok(r.status === 303 && r.headers.get('location').startsWith('/login'), 'course area requires sign-in');
  r = await req('/media/lesson/the-foundation'); ok(r.status === 303, 'lesson video is protected');
  r = await req('/download/worksheet_ep0_the_foundation.pdf'); ok(r.status === 303, 'downloads are protected');
  r = await req('/', { method: 'POST', headers: { origin: 'https://evil.example' } }); ok(r.status === 403, 'cross-site POST rejected');

  console.log('Purchase (simulated checkout)');
  r = await req('/dev/checkout', form({ name: 'Ada Lovelace', email: 'ada@example.com' }));
  const welcome = r.headers.get('location'); ok(welcome.startsWith('/welcome?session_id=cs_dev_'), 'checkout redirects to welcome');
  r = await req(welcome); let html = await r.text();
  ok(html.includes('Choose a password'), 'welcome asks for a password');
  const token = html.match(/name="token" value="([^"]+)"/)[1];
  r = await req('/set-password', form({ token, password: 'short', confirm: 'short' })); ok(r.status === 400, 'short password rejected');
  r = await req('/set-password', form({ token, password: 'abundance123', confirm: 'abundance123' }));
  ok(r.status === 303 && r.headers.get('location') === '/app' && cookie, 'password set and signed in');
  r = await req('/set-password', form({ token, password: 'abundance123', confirm: 'abundance123' })); ok(r.status === 400, 'set-password link is one-time');

  console.log('Course area');
  r = await req('/app'); html = await r.text(); ok(r.status === 200 && html.includes('0 of 8 lessons'), 'dashboard shows 8 lessons');
  r = await req('/app/lesson/the-foundation'); ok(r.status === 200 && (await r.text()).includes('Three takeaways'), 'lesson page renders');
  r = await req('/media/lesson/the-foundation', { headers: { range: 'bytes=0-1023' } }); ok(r.status === 206 && r.headers.get('content-range'), 'video streams with range requests');
  r = await req('/download/worksheet_ep0_the_foundation.pdf'); ok(r.status === 200 && r.headers.get('content-type').includes('pdf'), 'worksheet downloads');
  r = await req('/download/..%2F..%2Fdata%2Fapp.db'); ok(r.status === 404, 'path traversal blocked');
  r = await req('/app/lesson/the-foundation/complete', { method: 'POST' }); ok(r.headers.get('location') === '/app/lesson/choosing-abundance', 'mark complete moves to next lesson');
  r = await req('/app'); ok((await r.text()).includes('1 of 8 lessons'), 'progress recorded');

  console.log('Sign out and back in');
  r = await req('/logout', { method: 'POST' }); cookie = '';
  r = await req('/login', form({ email: 'ada@example.com', password: 'wrong-password' })); ok(r.status === 401, 'wrong password rejected');
  r = await req('/login', form({ email: 'ADA@example.com', password: 'abundance123', next: '/app' })); ok(r.status === 303 && cookie, 'sign in works (email case-insensitive)');

  console.log('Stripe webhooks (signed locally)');
  const send = async (event) => {
    const payload = JSON.stringify(event);
    const header = stripe.webhooks.generateTestHeaderString({ payload, secret: 'whsec_test_local' });
    return fetch(base + '/stripe/webhook', { method: 'POST', headers: { 'content-type': 'application/json', 'stripe-signature': header }, body: payload });
  };
  r = await fetch(base + '/stripe/webhook', { method: 'POST', headers: { 'content-type': 'application/json', 'stripe-signature': 't=1,v1=bad' }, body: '{}' });
  ok(r.status === 400, 'unsigned webhook rejected');
  const cs = { id: 'cs_test_webhook1', object: 'checkout.session', payment_status: 'paid', amount_total: 900, currency: 'usd', payment_intent: 'pi_test_123', customer_details: { email: 'grace@example.com', name: 'Grace Hopper' } };
  r = await send({ id: 'evt_1', type: 'checkout.session.completed', data: { object: cs } }); ok(r.status === 200, 'checkout.session.completed accepted');
  r = await send({ id: 'evt_1b', type: 'checkout.session.completed', data: { object: cs } }); ok(r.status === 200, 'duplicate webhook is harmless');
  const db = require('../lib/db');
  const g = db.prepare('SELECT * FROM users WHERE email = ?').get('grace@example.com'); ok(g && g.access === 1, 'webhook granted access');
  ok(db.prepare('SELECT COUNT(*) n FROM purchases WHERE stripe_session_id = ?').get('cs_test_webhook1').n === 1, 'only one purchase recorded');
  r = await send({ id: 'evt_2', type: 'charge.refunded', data: { object: { id: 'ch_1', object: 'charge', refunded: true, payment_intent: 'pi_test_123', amount_refunded: 900, currency: 'usd' } } });
  ok(r.status === 200 && db.prepare('SELECT access FROM users WHERE email = ?').get('grace@example.com').access === 0, 'refund revokes access');

  server.close();
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
