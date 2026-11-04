// Email: sends through SMTP when SMTP_URL is set; otherwise logs to the console
// so the site still works end to end (the welcome page lets buyers set a password directly).
const nodemailer = require('nodemailer');
const config = require('./config');

const transport = config.SMTP_URL ? nodemailer.createTransport(config.SMTP_URL) : null;
const enabled = () => Boolean(transport);

async function send(to, subject, text) {
  if (!transport) {
    console.log(`[mail disabled] To: ${to}\nSubject: ${subject}\n${text}\n`);
    return false;
  }
  try {
    await transport.sendMail({ from: config.MAIL_FROM, to, subject, text });
    return true;
  } catch (err) {
    console.error('[mail error]', err.message);
    return false;
  }
}

const first = (u) => (u.name || '').split(' ')[0] || 'there';
const url = (p) => `${config.SITE_URL}${p}`;
const sig = '\n\nMission Abundance';

// Copy from course_copy.md, Part C.
const templates = {
  C1: (u, { setPasswordUrl }) => ({
    subject: 'Your Abundance Protocol access is ready',
    text: `Hi ${first(u)},\n\nThank you for joining the Abundance Protocol. Your lifetime access is ready.\n\n` +
      (setPasswordUrl ? `Set your password and sign in:\n${setPasswordUrl}\n\n` : `Sign in:\n${url('/login')}\n\n`) +
      `Your login email: ${u.email}\n\nStart with Start Here, then Lesson 1, The Foundation. It takes under eight minutes.\n\n` +
      `One small suggestion: watch your first lesson somewhere quiet, with headphones if you can.\n\nWelcome,\nMission Abundance\n\n` +
      `Receipt: your Stripe receipt arrives separately. You have 14 days for a full refund. Just reply to this email.`,
  }),
  C2: (u) => ({
    subject: 'The first five minutes',
    text: `Hi ${first(u)},\n\nIf you haven't started yet, today is a good day. Lesson 1, The Foundation, takes less than eight minutes.\n\n` +
      `Here's the only thing to remember from it: you don't take value from others. You bring new value into existence.\n\n` +
      `Watch it, print the worksheet, and read the affirmation tomorrow morning.\n\n${url('/app')}${sig}`,
  }),
  C3: (u) => ({
    subject: "Feeling abundant doesn't wait for more",
    text: `Hi ${first(u)},\n\nLesson 2, Choosing Abundance, holds the heart of the whole Protocol: gratitude is the bridge from lack to abundance, even before the facts change.\n\n` +
      `Try this before you open anything else tomorrow: name three things you already have. Then give thanks for one more thing that's on its way.\n\n` +
      `That's it. Five seconds. It changes the whole room.\n\n${url('/app')}${sig}`,
  }),
  C4: (u) => ({
    subject: 'Notice. Name. Bless.',
    text: `Hi ${first(u)},\n\nBy now you may have reached Lesson 4, Release the Contest, or you may not have. Both are fine. There is no race here.\n\n` +
      `If comparison crept in this week, here's the three-step practice from Lesson 4: notice the comparison, name it gently, and bless that person silently and sincerely. Then watch what happens to your own light.\n\n` +
      `Keep going at your pace:\n${url('/app')}${sig}`,
  }),
  C5: (u) => ({
    subject: 'Your five minutes, every morning',
    text: `Hi ${first(u)},\n\nEverything in the Protocol comes together in Lesson 8, The Morning Practice: five minutes, seven movements, one for each step.\n\n` +
      `This is the part that changes things: not watching once, but returning every morning.\n\n` +
      `Print your 30-day tracker, put it where you'll see it, and mark each morning you show up. Missed a day? Begin again. There's no streak to protect.\n\n${url('/app')}${sig}`,
  }),
  C6: (u) => ({
    subject: 'Thirty mornings',
    text: `Hi ${first(u)},\n\nIt's been about a month since you began. We'd love to know one thing: what's different?\n\n` +
      `Just reply with a sentence. We read every one. With your permission, we may share a few words (first name only) to help others find the Protocol.\n\nChoose abundance,\nMission Abundance`,
  }),
  C7: (u, { amount }) => ({
    subject: 'Your refund is on its way',
    text: `Hi ${first(u)},\n\nYour refund of ${amount} has been issued and should appear within 5–10 business days, depending on your bank. Your course access has been closed.\n\n` +
      `Thank you for trying the Protocol. We wish you well.${sig}`,
  }),
  RESET: (u, { resetUrl }) => ({
    subject: 'Reset your Abundance Protocol password',
    text: `Hi ${first(u)},\n\nUse this link to choose a new password:\n${resetUrl}\n\nIt expires in 60 minutes. If you didn't ask for this, you can ignore this email.${sig}`,
  }),
};

async function sendTemplate(id, user, data = {}) {
  const t = templates[id](user, data);
  return send(user.email, t.subject, t.text);
}

module.exports = { enabled, send, sendTemplate, templates };
