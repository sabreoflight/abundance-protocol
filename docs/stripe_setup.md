# Stripe Setup — The Abundance Protocol

For your CLI session, which has Stripe API access. **Test mode first:** run everything with a test key (`sk_test_…`), complete a test purchase, then repeat in live mode.

All copy comes from `course_copy.md` Part D. Structured values are in `course.json` → `stripe`.

---

## 1. Create the product

```bash
stripe products create \
  -d name="The Abundance Protocol — Lifetime Access" \
  -d description="Eight guided video lessons, eight worksheets, a 30-day tracker and audio versions. One payment, lifetime access." \
  -d "metadata[course_id]=abundance-protocol" \
  -d "metadata[access]=lifetime"
```

Note the returned `prod_…` id.

## 2. Create the $9 one-time price

```bash
stripe prices create \
  -d product=prod_XXXX \
  -d unit_amount=900 \
  -d currency=usd
```

Note the returned `price_…` id.

## 3. Choose how buyers pay

**Option A — Payment Link (fastest, no code):**

```bash
stripe payment_links create \
  -d "line_items[0][price]=price_XXXX" \
  -d "line_items[0][quantity]=1" \
  -d "custom_text[submit][message]=Lifetime access. You'll receive an email to set your password within a few minutes. 7-day refund, no questions asked." \
  -d "after_completion[type]=redirect" \
  -d "after_completion[redirect][url]=https://YOUR-SITE/welcome"
```

Use this when a course platform (Teachable, Thinkific or Payhip) handles logins. Connect Stripe inside that platform instead, and it creates the checkout for you.

**Option B — Checkout Sessions (your own platform):** your server creates a session per purchase, with `mode=payment`, the price above, `success_url` and `cancel_url` from `course.json`.

## 4. Account settings (Dashboard)

- **Public business name:** Mission Abundance
- **Statement descriptor:** `MISSION ABUNDANCE` (17 characters, within the 22-character limit)
- **Support email:** shown on receipts
- **Receipts:** turn on "Email customers about successful payments"
- **Branding:** dark navy `#0b1024` and gold `#f2c46d` to match the videos

## 5. Fulfillment webhooks (own platform only)

Listen for:
- `checkout.session.completed` → create the student account for `customer_details.email`, grant access, send email **C1**.
- `charge.refunded` → revoke access, send email **C7**.

Local testing:

```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
stripe trigger checkout.session.completed
```

## 6. Launch checklist

- [ ] Test purchase completes, the account is created and C1 arrives
- [ ] Test refund revokes access and C7 arrives
- [ ] Refund Policy and Terms of Access pages are live and linked at checkout
- [ ] Switch to live keys, then recreate the product, price and link in live mode
- [ ] One real $9 purchase by you, then refund it, as the final end-to-end check
