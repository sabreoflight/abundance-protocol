// Server-rendered pages. All copy comes from docs/course_copy.md (Parts A, B, E, F).
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const config = require('./config');
const { course, lessons, hasAudio, hasWorksheet } = require('./content');

// Cache-busting: a short hash of each static file's contents, read once at startup.
// Changes only when the file's content changes, so Cloudflare/browser caches never
// serve a stale site.css or app.js after a deploy.
const assetVersion = (file) => {
  try {
    const buf = fs.readFileSync(path.join(__dirname, '..', 'public', file));
    return crypto.createHash('sha1').update(buf).digest('hex').slice(0, 10);
  } catch { return Date.now().toString(36); }
};
const CSS_V = assetVersion('site.css');
const JS_V = assetVersion('app.js');

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// Tiny inline markdown: **bold** and *italic*, applied after escaping.
const md = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\*(.+?)\*/g, '<em>$1</em>');
const fmt = (sec) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
const lessonMeta = (l) => l.meta.split(' · ').filter((p) => !p.startsWith('Episode')).join(' · ');

function layout({ title, user, body, bare = false, desc = '', og = false }) {
  const nav = user
    ? `<a href="/app">My course</a><a href="/account">Account</a><form method="post" action="/logout" class="inline"><button class="linkish" type="submit">Sign out</button></form>`
    : `<a href="/login">Sign in</a><a class="btn small navbuy" href="/#price">Begin · ${esc(config.PRICE_LABEL)}</a>`;
  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(title)}</title>
${desc ? `<meta name="description" content="${esc(desc)}">` : ''}
${og ? `<meta property="og:type" content="website"><meta property="og:title" content="The Abundance Protocol"><meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${esc(config.SITE_URL)}/"><meta property="og:image" content="${esc(config.SITE_URL)}/og.jpg"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="The Abundance Protocol"><meta name="twitter:description" content="${esc(desc)}"><meta name="twitter:image" content="${esc(config.SITE_URL)}/og.jpg">` : ''}
<meta name="theme-color" content="#0b1024">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Spectral:ital,wght@0,400;0,600;1,400&family=Karla:wght@400;500;700&display=swap">
<link rel="stylesheet" href="/site.css?v=${CSS_V}">
<script src="/app.js?v=${JS_V}" defer></script>
</head><body>
${bare ? '' : `<header class="top"><div class="wrap row"><a class="brand" href="${user ? '/app' : '/'}"><small>MISSION</small><span>Abundance</span></a><nav>${nav}</nav></div></header>`}
<main>${body}</main>
<footer class="foot"><div class="wrap">
<p class="links"><a href="/terms">Terms of Access</a><a href="/refund">Refund Policy</a><a href="/disclaimer">Disclaimer</a><span>${esc(config.SUPPORT_EMAIL)}</span></p>
<p class="small">The Abundance Protocol is a contemplative practice for attention and conduct. It is not financial, legal, medical or psychological advice and makes no guarantee of income or results. Inspired by <em>The Science of Getting Rich</em> by Wallace D. Wattles (1910, public domain).</p>
<p class="small">© ${new Date().getFullYear()} Mission Abundance</p>
</div></footer>
</body></html>`;
}

const buyForm = (label = `Begin the Protocol — ${config.PRICE_LABEL}`) =>
  `<form method="post" action="/checkout" class="buy"><button class="btn" type="submit">${esc(label)}</button>
   <p class="fine">One-time payment · Lifetime access · 14-day refund</p></form>`;

// ---------- Sales page (Part A) ----------
// Posters are applied with CSS classes (see site.css) so they resolve correctly under any base path.
// Poster paths are relative to the page so they resolve under any base path (the front proxy
// rewrites href/src/action but not poster). The CSS background is a second fallback.
const vid = (src, posterKey, extra = '', up = '') =>
  `<video src="${src}" poster="${up}posters/${posterKey}.jpg" class="vp p-${posterKey}${extra ? ` ${extra}` : ''}" controls playsinline preload="none"`;
const stepChip = (l) => (l.meta.split(' · ').find((p) => p.startsWith('Step')) || 'Overview');
const star = '<svg class="glyph" viewBox="-12 -12 24 24" aria-hidden="true"><path d="M0-11Q1-1 11 0Q1 1 0 11Q-1 1-11 0Q-1-1 0-11Z"/></svg>';

function sales({ user, canceled }) {
  const owned = Boolean(user && user.access);
  const cta = (label) => (owned ? `<a class="btn" href="/app">Go to my course</a>` : buyForm(label));
  const cards = lessons.map((l) => `<li class="lc">
      <div class="lc-img"><img src="/posters/${esc(l.poster)}" alt="" loading="lazy" width="960" height="540"><span class="chip">${esc(stepChip(l))}</span></div>
      <div class="lc-body"><span class="lc-n">Lesson ${l.n} · ${fmt(l.duration)}</span><strong>${esc(l.title)}</strong><p>${esc(l.pitch)}</p></div>
    </li>`).join('');
  const body = `
<section class="hero"><div class="wrap hero-grid">
  <div class="hero-copy">
    ${canceled ? `<p class="note">No problem. Your card was not charged. The Protocol will be here when you're ready.</p>` : ''}
    <p class="eyebrow">The Abundance Protocol · 8 lessons · 5 minutes a day</p>
    <h1>Abundance is a practice.<br><em>Here are the eight steps.</em></h1>
    <p class="lead">Calm, five-minute video lessons that quiet the constant "not enough" and train your attention toward gratitude, creating and giving. One payment. Yours for life.</p>
    <div id="hero-cta">${cta(`Begin the Protocol — ${config.PRICE_LABEL}`)}</div>
    <p class="preview-link"><a href="#preview">Or watch a full lesson free first ↓</a></p>
  </div>
  <figure class="hero-media">${vid('/media/teaser-a.mp4', 'teaser-a')} aria-label="Trailer: You were taught to compete"></video>
    <figcaption>Watch the 45-second trailer</figcaption></figure>
</div></section>

<section class="band"><div class="wrap">
  <p class="eyebrow center">Sound familiar?</p>
  <ul class="quotes">
    <li>"There's only so much to go around."</li>
    <li>"If they rise, I fall."</li>
    <li>"I'll feel abundant when I finally have more."</li>
  </ul>
  <p class="center sub mid">That's a scarcity lens. It turns money, attention and even happiness into a contest, and because it's a lens, working harder through it only shows you more scarcity. The Protocol trains a different way of seeing, five calm minutes at a time.</p>
</div></section>

<section><div class="wrap">
  <h2 class="center">What changes</h2>
  <ul class="outcomes">
    <li>${star}<strong>Calmer mornings</strong><span>A five-minute ritual before the world asks anything of you.</span></li>
    <li>${star}<strong>Less comparison</strong><span>A three-step practice for the moment the old race starts up: notice, name, bless.</span></li>
    <li>${star}<strong>A clear picture</strong><span>Know exactly what you're building, write it down, and hold it.</span></li>
    <li>${star}<strong>Gratitude first</strong><span>Feel abundant before the facts change, by noticing what's already here.</span></li>
    <li>${star}<strong>Calm action</strong><span>One complete day at a time, one task at a time, without the rush.</span></li>
    <li>${star}<strong>Generous by default</strong><span>Five ways to give that have nothing to do with money.</span></li>
  </ul>
</div></section>

<section class="band" id="preview"><div class="wrap preview">
  <div class="preview-copy">
    <p class="eyebrow">Free lesson</p>
    <h2>Try a full lesson before you decide</h2>
    <p class="sub">Lesson 2, <em>Choosing Abundance</em>, holds the heart of the Protocol: the abundance lens, the power of focus, and gratitude as the bridge from feeling lack to feeling abundant.</p>
    <p class="fine">5 minutes · Headphones recommended</p>
  </div>
  <div class="preview-media">${vid('/media/preview-lesson-2.mp4', 'choosing-abundance', 'wide')} aria-label="Free lesson: Choosing Abundance"></video></div>
</div></section>

<section id="lessons"><div class="wrap">
  <h2>Eight lessons, one for each step</h2>
  <p class="sub">The steps run Mind, then Action, then Deed. Each lesson is a calm, animated practice of about five minutes, with a one-page worksheet.</p>
  <ol class="lcards">${cards}</ol>
</div></section>

<section class="band"><div class="wrap two">
  <div>
    <h2>Everything you get</h2>
    <ul class="get">
      <li><strong>8 video lessons,</strong> one for each step, streamed in your private course area</li>
      <li><strong>8 printable worksheets:</strong> what to do, say, remember and reflect on</li>
      <li><strong>A 30-day Morning Practice tracker</strong></li>
      <li><strong>Progress tracking</strong> on any device</li>
      <li><strong>Narrated and audio-only versions</strong> added free as they're released</li>
      <li><strong>Lifetime access,</strong> including every future update to these lessons</li>
    </ul>
  </div>
  <div>
    <h2>How it works</h2>
    <ol class="how">
      <li><strong>Watch one lesson a day,</strong> or one a week, whichever suits your pace.</li>
      <li><strong>Print the worksheet</strong> and do the one small practice it asks for.</li>
      <li><strong>Make Lesson 8 your morning ritual:</strong> five minutes, before the world asks anything of you.</li>
    </ol>
    <p class="sub">No jargon and no hustle. Just a calm practice you can return to every day.</p>
  </div>
</div></section>

<section><div class="wrap two align-start">
  <div><h3>This is for you if</h3><ul class="check">
    <li>You feel a constant low hum of "not enough," even when things are fine.</li>
    <li>You catch yourself comparing, rushing, or bracing against scarcity.</li>
    <li>You want a simple daily practice, not another 40-hour course.</li>
    <li>You're drawn to timeless ideas, from <em>The Science of Getting Rich</em> to the Stoics, presented calmly and clearly.</li></ul></div>
  <div><h3>This is not for you if</h3><ul class="cross">
    <li>You want a get-rich-quick scheme. This is a practice for your attention and conduct, not a financial system.</li>
    <li>You're looking for investment, tax or financial advice.</li></ul>
    <figure class="side-trailer">${vid('/media/teaser-b.mp4', 'teaser-b', 'vertical small')} aria-label="Trailer: Notice the rush"></video></figure></div>
</div></section>

<section class="band"><div class="wrap prose center-block">
  <h2>Where it comes from</h2>
  <p>The Abundance Protocol is inspired by <em>The Science of Getting Rich</em>, written by Wallace D. Wattles in 1910. Wattles distilled his ideas to a single purpose and refused to explain the reasoning behind them. We kept his focus and his clarity, then brought in companion wisdom on gratitude, generosity, calm action and daily practice, and shaped it into eight steps you can live.</p>
</div></section>

<section id="price"><div class="wrap">
  <div class="price">
    <p class="eyebrow">The Abundance Protocol</p>
    <p class="amount">${esc(config.PRICE_LABEL)}</p>
    <p class="once">One payment · Lifetime access</p>
    <ul class="get small">
      <li>8 video lessons and 8 worksheets</li>
      <li>30-day Morning Practice tracker</li>
      <li>Narrated and audio versions, free as released</li>
      <li>All future updates</li>
    </ul>
    ${cta('Begin the Protocol')}
    <p class="fine"><em>Founding price. It will rise as the library grows.</em></p>
  </div>
  <div class="guarantee">${star}<div><h3>Try it for 14 days</h3><p>If the Protocol isn't right for you, email us within 14 days of purchase for a full refund. No questions asked.</p></div></div>
</div></section>

<section class="band"><div class="wrap faq">
  <h2>Questions</h2>
  ${[
    ['How long are the lessons?', 'About five minutes each. The Foundation is a little under eight. You can finish the whole series in under an hour, and then return to the Morning Practice every day.'],
    ['Can I try it first?', 'Yes. Lesson 2, Choosing Abundance, is free to watch on this page. If you buy and it isn’t right for you, you have 14 days for a full refund.'],
    ['Are the lessons narrated?', 'Not yet. The lessons are currently guided by on-screen words, animation and ambient music, so you can follow them with the sound on or off. Narrated versions and audio-only downloads are being recorded and will be added to your account at no extra cost.'],
    ['Do I need any experience with meditation?', 'No. Every lesson is slow and simple. If you can breathe and pay attention for five minutes, you can do this.'],
    ['Is this financial advice?', 'No. The Abundance Protocol is a contemplative practice for your attention, mindset and conduct. It makes no promise of income or results. For financial decisions, talk to a qualified professional.'],
    ['How do I access the course?', 'Right after you pay, you choose a password and you’re in. Then sign in from any device, at any time.'],
    ['Is it really lifetime access?', 'Yes. You pay once and keep access to these lessons, including updates to them.'],
    ['Can I download the videos?', 'The videos stream inside your account. The worksheets and tracker are yours to download, and so will the audio versions be when they’re released.'],
    ['Can I share my login?', "Please don't. Your access is for you. If someone you love would benefit, the price is kept low so they can join."],
  ].map(([q, a]) => `<details><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join('')}
</div></section>

<section><div class="wrap close">
  <p class="closing">Before the world asks anything of you, arrive.<br>Choose abundance, five minutes at a time.</p>
  ${cta(`Begin the Protocol — ${config.PRICE_LABEL}`)}
</div></section>
${owned ? '' : `<div class="stickybar" id="stickybar" hidden><span><strong>The Abundance Protocol</strong> · ${esc(config.PRICE_LABEL)} · lifetime</span>
  <form method="post" action="/checkout"><button class="btn small" type="submit">Begin</button></form></div>`}`;
  return layout({ title: 'The Abundance Protocol · Mission Abundance', user, body, og: true,
    desc: 'Calm, five-minute video lessons that quiet the constant "not enough" and train your attention toward gratitude, creating and giving. One payment, lifetime access.' });
}

// ---------- Auth pages (Part F) ----------
function form({ title, user, heading, sub, inner, notice, error }) {
  return layout({ title, user, body: `<section class="authwrap"><div class="card">
    <h1>${esc(heading)}</h1>${sub ? `<p class="sub">${sub}</p>` : ''}
    ${notice ? `<p class="note">${notice}</p>` : ''}${error ? `<p class="err" role="alert">${esc(error)}</p>` : ''}
    ${inner}</div></section>` });
}
const login = ({ error, next = '', email = '', notice }) => form({
  title: 'Sign in · Mission Abundance', heading: 'Welcome back.', sub: 'Your morning practice is waiting.', error, notice,
  inner: `<form method="post" action="/login" class="stack">
    <input type="hidden" name="next" value="${esc(next)}">
    <label for="email">Email</label><input id="email" name="email" type="email" autocomplete="email" required value="${esc(email)}">
    <label for="password">Password</label><input id="password" name="password" type="password" autocomplete="current-password" required>
    <button class="btn" type="submit">Sign in</button></form>
    <p class="alt"><a href="/forgot">Forgot your password?</a></p>`,
});
const forgot = ({ sent }) => form({
  title: 'Reset password · Mission Abundance', heading: 'Reset your password.',
  sub: sent ? '' : "Enter the email you used to buy. We'll send you a link to choose a new password.",
  notice: sent ? `If an account exists for that email, a reset link is on its way. It expires in 60 minutes. No email? Write to <strong>${esc(config.SUPPORT_EMAIL)}</strong>.` : '',
  inner: sent ? `<p class="alt"><a href="/login">Back to sign in</a></p>` : `<form method="post" action="/forgot" class="stack">
    <label for="email">Email</label><input id="email" name="email" type="email" autocomplete="email" required>
    <button class="btn" type="submit">Send reset link</button></form><p class="alt"><a href="/login">Back to sign in</a></p>`,
});
const setPassword = ({ token, action, heading, sub, error, email }) => form({
  title: `${heading} · Mission Abundance`, heading, sub, error,
  inner: `<form method="post" action="${action}" class="stack">
    <input type="hidden" name="token" value="${esc(token)}">
    ${email ? `<label for="login-email">Your login email</label><input id="login-email" type="email" value="${esc(email)}" readonly>` : ''}
    <label for="password">Choose a password <span class="hint">(at least 8 characters)</span></label>
    <input id="password" name="password" type="password" autocomplete="new-password" minlength="8" required>
    <label for="confirm">Confirm password</label><input id="confirm" name="confirm" type="password" autocomplete="new-password" minlength="8" required>
    <button class="btn" type="submit">Save password and begin</button></form>`,
});
const message = ({ title, heading, body, user }) => form({ title: `${title} · Mission Abundance`, heading, user, inner: body });

// ---------- Course area (Part B) ----------
function dashboard({ user, done }) {
  const completed = lessons.filter((l) => done.has(l.slug)).length;
  const next = lessons.find((l) => !done.has(l.slug));
  const first = (user.name || '').split(' ')[0];
  const greet = !done.size ? `Welcome${first ? `, ${esc(first)}` : ''}. Begin with <em>Start Here</em>.`
    : next ? `Good to see you${first ? `, ${esc(first)}` : ''}. Continue with <a href="/app/lesson/${next.slug}">${esc(next.title)}</a>.`
    : `Your daily five minutes: <a href="/app/lesson/the-morning-practice">The Morning Practice</a>.`;
  const pct = Math.round((completed / lessons.length) * 100);
  const cards = lessons.map((l) => `<a class="lcard${done.has(l.slug) ? ' done' : ''}" href="/app/lesson/${l.slug}">
      <img src="/posters/${esc(l.poster)}" alt="" loading="lazy" width="640" height="360">
      <span class="lnum">Lesson ${l.n}${done.has(l.slug) ? ' · Completed ✓' : ''}</span>
      <strong>${esc(l.title)}</strong><span class="lmeta">${esc(lessonMeta(l))}</span></a>`).join('');
  const body = `<section class="wrap app">
  <p class="greet">${greet}</p>
  <progress class="progress" value="${completed}" max="${lessons.length}" aria-label="Course progress">${pct}%</progress>
  <p class="plabel">${completed} of ${lessons.length} lessons</p>

  <h2>Start Here</h2>
  <div class="starthere">
    <details open><summary>Welcome</summary>
      <video src="/media/teaser-a.mp4" poster="posters/teaser-a.jpg" class="vp p-teaser-a vertical small" controls playsinline preload="none"></video>
      ${course.startHere.welcome.map((p) => `<p>${md(p).replace(/\n/g, '<br>')}</p>`).join('')}</details>
    <details><summary>How to use this course</summary><ul>${course.startHere.howTo.map((x) => `<li>${md(x)}</li>`).join('')}</ul></details>
    <details><summary>Your downloads</summary>${course.startHere.downloads.map((p) => `<p>${md(p).replace(/\n/g, '<br>')}</p>`).join('')}</details>
  </div>

  <h2>The Practice</h2>
  <div class="lgrid">${cards}</div>

  <h2>Your Daily Practice</h2>
  <div class="daily">
    <a class="pin" href="/app/lesson/the-morning-practice"><span class="lnum">Pinned</span><strong>The Morning Practice</strong><span>${md(course.daily.morning)}</span></a>
    <div class="aff"><span class="lnum">The Abundance Protocol affirmation</span>${course.affirmation.map((a) => `<p>${esc(a)}</p>`).join('')}</div>
    <div class="trk"><span class="lnum">Your 30-day tracker</span><p>${md(course.daily.tracker)}</p><a class="btn ghost" href="/download/worksheet_ep6_the_morning_practice.pdf">Download tracker (PDF)</a></div>
  </div>
  ${!next ? `<div class="complete">${course.completion.map((p) => `<p>${md(p)}</p>`).join('')}</div>` : ''}
</section>`;
  return layout({ title: 'My course · The Abundance Protocol', user, body });
}

function lesson({ user, l, isDone, next }) {
  const audio = hasAudio(l);
  const body = `<section class="wrap lesson">
  <p class="crumb"><a href="/app">My course</a> / Lesson ${l.n}</p>
  <h1>${esc(l.title)}</h1><p class="lmeta">${esc(lessonMeta(l))}</p>
  <div class="player"><video src="/media/lesson/${esc(l.slug)}" poster="../../posters/${esc(l.poster)}" class="vp p-${esc(l.slug)}" controls playsinline preload="metadata" controlslist="nodownload" data-protect></video></div>
  <div class="lgrid2">
    <div class="prose">
      <p class="desc">${esc(l.description)}</p>
      <h3>In this lesson</h3><ul>${l.inThisLesson.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
      <h3>Three takeaways</h3><ol>${l.takeaways.map((x) => `<li>${esc(x)}</li>`).join('')}</ol>
      <h3>Your practice</h3><p class="practice">${esc(l.practice)}</p>
    </div>
    <aside class="side">
      <h3>Downloads</h3>
      ${hasWorksheet(l) ? `<a class="btn ghost" href="/download/${esc(l.worksheet)}">Worksheet (PDF)</a>` : ''}
      ${audio ? `<a class="btn ghost" href="/audio/${esc(l.audio)}">Audio (MP3)</a>` : `<p class="fine">Narrated and audio versions are on the way, free.</p>`}
      <form method="post" action="/app/lesson/${esc(l.slug)}/complete">
        ${isDone ? `<p class="donechip">Completed ✓</p>` : `<button class="btn" type="submit">Mark as complete</button>`}
      </form>
      ${next ? `<a class="nextl" href="/app/lesson/${next.slug}">Next lesson: ${esc(next.title)} →</a>` : `<a class="nextl" href="/app">Back to my course →</a>`}
    </aside>
  </div></section>`;
  return layout({ title: `${l.title} · The Abundance Protocol`, user, body });
}

function account({ user, purchase }) {
  const body = `<section class="authwrap"><div class="card">
    <h1>Your account</h1>
    <p><strong>Email:</strong> ${esc(user.email)}</p>
    ${user.access ? `<p><strong>Your access:</strong> Lifetime · Purchased ${purchase ? new Date(purchase.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : ''}</p>
      <a class="btn" href="/app">Go to my course</a>`
    : `<p class="note">This account doesn't have course access. If you've just purchased, it can take a minute to arrive. Refresh this page, or write to <strong>${esc(config.SUPPORT_EMAIL)}</strong>.</p>${buyForm()}`}
    <p class="alt"><a href="/forgot">Change password</a></p></div></section>`;
  return layout({ title: 'Account · Mission Abundance', user, body });
}

// ---------- Legal (Part E templates) ----------
const legal = {
  refund: ['Refund Policy', `<p>You may request a full refund within 14 days of purchase for any reason. Email <strong>${esc(config.SUPPORT_EMAIL)}</strong> from the address you used to buy, and we'll refund your payment to the original card. Access to the course ends when the refund is issued. Refunds are not available after 14 days.</p>`],
  terms: ['Terms of Access', `<ul>
    <li><strong>Your license:</strong> Your purchase gives you a personal, non-transferable license to access the Abundance Protocol for your own use, for the lifetime of the course.</li>
    <li><strong>No sharing:</strong> Please don't share your login or redistribute the videos, audio or worksheets. You may print worksheets for your own use.</li>
    <li><strong>Lifetime access:</strong> "Lifetime" means for as long as Mission Abundance operates the course. If the course is ever retired, we'll give you at least 60 days' notice and a way to download your materials.</li>
    <li><strong>No advice:</strong> The content is a contemplative practice. It is not financial, legal, medical or psychological advice and makes no guarantee of income or results.</li>
    <li><strong>Payments:</strong> Payments are processed securely by Stripe. We never see or store your full card details.</li>
    <li><strong>Your data:</strong> We store your email, name, password (securely hashed), purchase record and lesson progress, only to provide the course. We never sell it.</li>
    <li><strong>Contact:</strong> ${esc(config.SUPPORT_EMAIL)}</li></ul>`],
  disclaimer: ['Disclaimer', `<p>The Abundance Protocol is a contemplative practice for attention and conduct. Nothing in this course is financial, investment, legal, medical or psychological advice, and nothing in it is a promise or guarantee of income or results. Any examples are illustrative. If you are struggling with your mental health or finances, please seek support from a qualified professional.</p>`],
};
const legalPage = (key, user) => layout({ title: `${legal[key][0]} · Mission Abundance`, user,
  body: `<section class="wrap prose legal"><h1>${legal[key][0]}</h1>${legal[key][1]}</section>` });

const welcomeDone = ({ user, email }) => message({ title: "You're in", heading: "You're in.", user,
  body: `<p>Your access is confirmed for <strong>${esc(email)}</strong>. You already have a password for this account.</p><a class="btn" href="${user ? '/app' : '/login'}">${user ? 'Go to my course' : 'Sign in'}</a>` });

const notFound = (user) => message({ title: 'Not found', heading: 'This page drifted off.', user, body: `<p><a href="/">Return home</a></p>` });
const errorPage = (user) => message({ title: 'Something went wrong', heading: "Something didn't load.", user,
  body: `<p>Refresh the page, or email <strong>${esc(config.SUPPORT_EMAIL)}</strong> and we'll sort it out.</p>` });

module.exports = { esc, sales, login, forgot, setPassword, message, dashboard, lesson, account, legalPage, welcomeDone, notFound, errorPage, fmt };
