#!/usr/bin/env node
// Admin commands. Run with: npm run admin -- <command> [args]
//   list                     List students and their access
//   stats                    Totals: students, active, refunded, lessons completed
//   grant <email> [name]     Give lifetime access (gifts, creator review copies, support)
//   revoke <email>           Remove access and sign the student out everywhere
//   reset-link <email>       Print a 60-minute password reset link (when email isn't configured)
//   set-link <email>         Print a 7-day "set your password" link for a new student
const db = require('../lib/db');
const auth = require('../lib/auth');
const config = require('../lib/config');
const { grantFromSession } = require('../lib/fulfill');

const [cmd, email, ...rest] = process.argv.slice(2);
const need = () => { if (!email) { console.error('Please give an email address.'); process.exit(1); } };
const user = () => { need(); const u = auth.findUserByEmail(email); if (!u) { console.error(`No student with email ${email}`); process.exit(1); } return u; };

switch (cmd) {
  case 'list': {
    const rows = db.prepare(`SELECT u.email, u.name, u.access, u.password_hash IS NOT NULL AS has_pw, u.purchased_at,
      (SELECT COUNT(*) FROM progress p WHERE p.user_id = u.id) AS done FROM users u ORDER BY u.created_at DESC`).all();
    console.table(rows.map((r) => ({ email: r.email, name: r.name || '', access: r.access ? 'yes' : 'no', password: r.has_pw ? 'set' : 'not yet',
      purchased: r.purchased_at ? new Date(r.purchased_at).toISOString().slice(0, 10) : '', lessons: r.done })));
    break;
  }
  case 'stats': {
    const q = (sql) => db.prepare(sql).get().n;
    console.log({
      students: q('SELECT COUNT(*) n FROM users'),
      active: q('SELECT COUNT(*) n FROM users WHERE access = 1'),
      paidPurchases: q("SELECT COUNT(*) n FROM purchases WHERE status = 'paid'"),
      gifts: q("SELECT COUNT(*) n FROM purchases WHERE status = 'gift'"),
      revenueUSD: (db.prepare("SELECT COALESCE(SUM(amount),0) n FROM purchases WHERE status = 'paid'").get().n / 100).toFixed(2),
      refunded: q("SELECT COUNT(*) n FROM purchases WHERE status = 'refunded'"),
      lessonsCompleted: q('SELECT COUNT(*) n FROM progress'),
    });
    break;
  }
  case 'grant': {
    need();
    const { user: u } = grantFromSession({ id: `cs_manual_${Date.now()}`, email, name: rest.join(' ') || null, payment_intent: null, amount_total: 0, currency: 'usd', status: 'gift' });
    console.log(`Access granted to ${u.email}.`);
    if (!u.password_hash) console.log(`Send them this link to set a password (valid 7 days):\n${config.SITE_URL}/set-password?token=${auth.issueToken(u.id, 'set', 7 * 24 * 60)}`);
    break;
  }
  case 'revoke': {
    const u = user();
    db.prepare('UPDATE users SET access = 0 WHERE id = ?').run(u.id);
    auth.destroyAllSessions(u.id);
    console.log(`Access revoked for ${u.email}.`);
    break;
  }
  case 'reset-link': {
    const u = user();
    console.log(`${config.SITE_URL}/reset?token=${auth.issueToken(u.id, 'reset', 60)}`);
    break;
  }
  case 'set-link': {
    const u = user();
    console.log(`${config.SITE_URL}/set-password?token=${auth.issueToken(u.id, 'set', 7 * 24 * 60)}`);
    break;
  }
  default:
    console.log('Commands: list | stats | grant <email> [name] | revoke <email> | reset-link <email> | set-link <email>');
}
