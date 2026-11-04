# The Abundance Protocol — Course Microsite

A complete, self-contained course site for **Mission Abundance**:

- **Sales page** with both trailers, the eight steps, pricing, guarantee and FAQ
- **Stripe Checkout** for a one-time $9 purchase (promotion codes enabled)
- **Instant access:** buyers choose their password right after paying, with no email required
- **Student accounts:** sign in, sign out, password reset, account page
- **Protected lesson player:** 8 lessons streamed only to paying students (no public video URLs)
- **Progress tracking**, downloads (worksheets, 30-day tracker, optional audio), and "next lesson" flow
- **Stripe webhooks:** grant access on payment and revoke it on refund (idempotent)
- **Onboarding emails** (day 1, 3, 7, 14, 30) when SMTP is configured
- **Admin tools:** list students, grant gift access, revoke, generate reset links
- **Voice-over pipeline:** one command mixes your recordings into the videos and exports MP3s
- No database server and no native modules. It uses Node's built-in SQLite.

Everything is in this folder: code, the eight lesson videos, worksheets, trailers, posters, the course copy and the voice-over scripts.

---

## 1. Run it locally (5 minutes)

Requires **Node.js 22.13 or newer**.

```bash
npm install
npm run dev
```

Open http://localhost:3000. In dev mode, purchases are simulated (`DEV_FAKE_CHECKOUT=1`), so you can click **Begin the Protocol**, "buy", set a password and walk through every lesson without Stripe.

Run the automated end-to-end test (30 checks, including signed Stripe webhooks):

```bash
npm run smoke
```

## 2. Set up Stripe

Full commands and copy are in `docs/stripe_setup.md`. In short, with the Stripe CLI (test mode first):

```bash
stripe products create -d name="The Abundance Protocol — Lifetime Access" -d description="Eight guided video lessons, eight worksheets, a 30-day tracker and audio versions. One payment, lifetime access."
stripe prices create -d product=prod_XXXX -d unit_amount=900 -d currency=usd
```

Then create a webhook endpoint pointing to `https://YOUR-SITE/stripe/webhook` with these events:

- `checkout.session.completed`
- `checkout.session.async_payment_succeeded`
- `charge.refunded`

```bash
stripe webhook_endpoints create -d url="https://YOUR-SITE/stripe/webhook" \
  -d "enabled_events[]=checkout.session.completed" \
  -d "enabled_events[]=checkout.session.async_payment_succeeded" \
  -d "enabled_events[]=charge.refunded"
```

Copy the endpoint's signing secret (`whsec_…`) into `STRIPE_WEBHOOK_SECRET`.

To test webhooks locally:

```bash
stripe listen --forward-to localhost:3000/stripe/webhook
```

## 3. Configure

```bash
cp .env.example .env
```

Fill in `SITE_URL`, `SESSION_SECRET` (`openssl rand -hex 32`), the three Stripe values and `SUPPORT_EMAIL`. In production the app refuses to start if any of these are missing.

**Email is optional.** Without `SMTP_URL`, buyers still set their password on the page right after checkout, and emails are printed to the server log. With it, buyers also get the access email, password resets and the onboarding sequence. Any SMTP provider works, for example `smtp://USER:PASS@smtp.resend.com:587`.

## 4. Deploy

The site is one Node process plus one folder that must persist (`DATA_DIR`, the SQLite database). Videos ship inside the app (about 270 MB).

**Option A: Docker on any server**

```bash
docker compose up -d --build
```

Put HTTPS in front. With Caddy, a two-line `Caddyfile` does it:

```
missionabundance.com {
  reverse_proxy localhost:3000
}
```

**Option B: a platform that runs Dockerfiles** (Fly.io, Render, Railway, DigitalOcean App Platform). Deploy this folder, set the environment variables from `.env.example`, attach a persistent volume at `/data`, and point your domain at it. The health check is at `/healthz`.

**Option C: plain Node** on a VPS: `npm ci --omit=dev && NODE_ENV=production npm start` behind a reverse proxy, with `DATA_DIR` on persistent disk. Use a process manager such as systemd or pm2.

**Back up `DATA_DIR`.** It holds every student account and purchase. A daily copy of `app.db` is enough.

## 5. Go-live checklist

- [ ] Test-mode purchase: checkout, set password, dashboard, a lesson plays
- [ ] Test refund in the Stripe Dashboard: access is revoked
- [ ] `/terms`, `/refund`, `/disclaimer` reviewed for your country (they are plain-language templates)
- [ ] Switch to live keys, create the live product, price and webhook, and update `.env`
- [ ] One real $9 purchase by you, then refund it
- [ ] Optional: add your Terms URL in Stripe Dashboard → Settings → Public details, then set `STRIPE_REQUIRE_TOS=1`

## 6. Operate

```bash
npm run admin -- list                      # students, access, progress
npm run admin -- stats                     # totals
npm run admin -- grant friend@example.com "Their Name"   # gift access (e.g. creator review copies)
npm run admin -- revoke someone@example.com
npm run admin -- reset-link someone@example.com          # when email isn't configured
```

In Docker: `docker compose exec site node --no-warnings tools/admin.js list`

Promotion codes: create coupons in Stripe (for example 100% off for creators). Checkout already shows the "Add promotion code" field.

## 7. Add your voice-over

1. Record each script block from `docs/voiceover-scripts/`.
2. Name each file by the block's timecode, for example `voice/the-foundation/0-14.wav` for the block at 0:14. Alternatively, record one continuous file per lesson: `voice/the-foundation.wav`.
3. Run:

```bash
tools/mix_voiceover.sh            # every lesson with recordings
tools/mix_voiceover.sh unhurried  # just one
```

The script keeps the music-only originals in `content/media-original/`, ducks the music under your voice, writes the new videos into `content/media/`, and exports `content/audio/<lesson>.mp3`. The site shows the audio download automatically once the file exists. It needs `ffmpeg`.

Lesson slugs: `the-foundation`, `choosing-abundance`, `the-clear-vision`, `release-the-contest`, `the-daily-work`, `give-first`, `unhurried`, `the-morning-practice`.

## 8. Edit the copy

All words come from `docs/course_copy.md`. Lesson text is generated into `content/course.json`:

```bash
python3 tools/build_content.py
```

Sales page, legal pages and emails live in `lib/views.js` and `lib/mail.js`, using the same copy.

---

## Project map

```
server.js            routes: sales, checkout, welcome, auth, course, media, webhooks
lib/                 config, database, auth, fulfillment, email, security, views
public/              styles, posters, public trailers, favicon
content/media/       lesson videos (served only to students)
content/downloads/   worksheets and tracker (students only)
content/audio/       audio versions (created by the voice-over pipeline)
content/course.json  lesson data (generated from docs/course_copy.md)
docs/                course copy, Stripe setup, voice-over scripts
tools/               admin, smoke test, voice-over mixer, content builder
data/                SQLite database (keep on a persistent volume, back it up)
```

## Security notes

- Passwords are hashed with bcrypt. Session and one-time tokens are stored only as SHA-256 hashes.
- Cookies are HttpOnly and SameSite=Lax, and Secure when `SITE_URL` is https. Cross-site form posts are rejected.
- A strict Content-Security-Policy is applied. Sign-in and reset are rate limited.
- Media and downloads are served only to signed-in students with access, and only for files listed in `course.json`.
- Webhooks are verified with Stripe's signature. Fulfillment is idempotent.
- Video "protection" is deterrence. Anyone who can watch a stream can record it. At this price, that is an accepted trade-off.

---

## Also in this repository

- `production/`: sources for every video, worksheet and the project hub (see `production/README.md`)
- `marketing/`: sample vertical social clips and the Abundance Protocol draft
- `docs/voiceover-scripts/`: the eight narration scripts, timed to each lesson
