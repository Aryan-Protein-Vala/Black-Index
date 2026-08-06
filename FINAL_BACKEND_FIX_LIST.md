# FINAL BACKEND FIX LIST — Black Index

**Date:** 2026-08-06 · **Scope:** Backend only. NO UI fixes here (dashboard, copy, forms, pages = later batch). Two data-write one-liners that happen to live in UI files are included and marked ◈.
**Sources:** AUDIT_FOUNDER_DASH_AND_BUSINESS_MODEL.md, AUDIT_SELLER_JOURNEY.md, MASTER_GRAVEYARD.md, AUDIT_PRODUCT_FORM_AND_ATTRIBUTION.md — IDs preserved. New items: TOOL-*, ATTR-*, FRM-* backend halves.

---

# 🛠️ PART A — Your two new ideas, designed properly

## TOOL-1: `npx @blackindex/init` (founder installer CLI) — ✅ YES, build it (as Phase-2 sugar)

**Verdict: build it — but build the site-scan verifier first, because the CLI only serves dev-founders.**

### What it does (spec)
```bash
npx @blackindex/init --product prod_xxx --token bi_install_xxx
```
1. **Auth via per-product install token** (NOT the webhook secret): scoped to `/api/install/*`, revocable, shown in founder dashboard.
2. **Framework detect:** Next.js app router (`app/layout.tsx`) / pages router (`pages/_document.tsx`) / Vite+React (`index.html`) / plain HTML dir scan. Falls back to "paste this snippet" instructions for unknown stacks.
3. **Inject** `<script src="https://blackindex.in/track.js" data-product="ID"></script>` into the right layout. Git-aware: refuses dirty tree unless `--force`, prints diff, `--commit` opt-in.
4. **Checkout-pattern scan (the part that makes it better than a snippet):**
   - finds `new Razorpay(` client-side → ✅ confirms track.js auto-injects notes;
   - finds `razorpay.subscriptions.create` server-side → ⚠️ emits patch: thread `ref_id` → `notes` at subscription creation (writes `BLACKINDEX_TODO.md` with exact diff if it can't patch safely);
   - finds `stripe.checkout.sessions.create` → ⚠️ emits patch: `client_reference_id` + `subscription_data.metadata.ref_id`;
   - finds nothing → hosted-checkout path (LS/Gumroad): prints URL-append instructions.
5. **Self-verify:** calls `POST /api/install/verify { token }` → our server fetches `product.website_url`, scans the HTML for the script tag + matching `data-product` (Google Analytics verification pattern). Works **also** for no-code founders (Framer/Carrd/Webflow paste-snippet users) — that's why the scan endpoint is the real product and the CLI is sugar.

### New endpoints required
| Endpoint | Auth | Purpose |
|---|---|---|
| `POST /api/install/token` | founder session | mint/revoke per-product install token (`install_tokens` table: product_id, token_hash, created_at, revoked_at) |
| `POST /api/install/verify` | install token | server-side fetch of website_url → script-tag detection → writes `products.script_detected_at` |
| `GET /api/install/status/[productId]` | owner session | dashboard polling: script? handshake? synthetic? certified? |

**Effort:** endpoints M (1 day). CLI package: M–L (~300 LOC Node CLI, zero-dep prompts, npm publish). Do CLI after certification API exists.

---

## TOOL-2: REAL test/certification — "The Gauntlet" — ✅ YES, and make it the Vault GATE

**Today's test route is a fraud** (`app/api/webhooks/test/[productId]/route.ts` ~L118–127):
```ts
const isValidSignature = crypto.timingSafeEqual(
    Buffer.from(expectedSig),
    Buffer.from(expectedSig) // ← compares a buffer to ITSELF. Always passes.
)
```
Keep its pre-flight checks (secret set / product active / link exists), **delete the tautology**, replace with three real levels:

| Level | Name | How | Proves | Gate |
|---|---|---|---|---|
| **L0** | Handshake | Founder clicks "Send test webhook" in Razorpay dashboard (native feature) → we poll `webhook_logs` (needs INF-4 column fix) for last event in 5 min → report `reachable` + `signature_valid` (real route already returns 401 on bad HMAC) | URL correct, **secrets actually paired** | required |
| **L1** | Synthetic sale | `POST /api/products/[id]/simulate-sale` (owner-only, 3/hr rate-limit): builds exact provider-shaped payload, `external_transaction_id='sim_<uuid>'`, ₹1, runs the REAL `processConversion` path (flag: skip self-referral + velocity), asserts each DB effect (customer row, tx row, wallet debit, escrow credit, notification), then **reverses everything**, marks tx `status='test'` excluded from stats/escrow cron | dominoes 5–8 without money | required |
| **L2** | Real ₹1 certification | `products.verified_at` set by the first **genuine provider-signed** webhook that converts with a valid ref_id (Razorpay test-mode keys work — webhooks fire there too; or live ₹1) | the true pipe, signed by the provider | **product cannot appear in the Vault without `verified_at`** — new query filter in `GET /api/products` |

**L2 is the moat.** "Every product on BlackIndex has a verified money pipe" becomes a provable marketing claim, and no seller ever wastes a post on a broken integration again. Schema: `products.verified_at timestamptz`, `products.script_detected_at timestamptz`, `product_verifications` table (level, passed, detail jsonb, created_at).

**Effort:** M (1–1.5 days) after Phase-1 atomic RPC exists (L1 asserts its side effects).

---

# 📋 PART B — THE LIST

Effort: **S** <2h · **M** ≤1d · **L** 2–3d. "Done when" = acceptance test.

## PHASE 0 — SECURITY LOCKDOWN (nothing ships to prod before this is green)

| # | ID | File(s) | Fix | Effort | Done when |
|---|---|---|---|---|---|
| 0.1 | SEC-1 | new migration | Lock `profiles` columns: `REVOKE UPDATE ON profiles FROM authenticated; GRANT UPDATE (full_name, avatar_url, upi_id, phone)…` — **deny** role, wallet_balance, pending_balance, withdrawable_balance, total_earnings, security_deposit_paid, stripe_connect_id, razorpay_account_id. All money/role mutations go through service-role APIs only | M | `update profiles set role='founder'` as anon user → error |
| 0.2 | SEC-2 | new migration + `app/api/products/route.ts` | `public_products` view (safe columns incl. `category`) for public reads; `products` direct SELECT restricted to owner+admin; **rotate every existing webhook_secret**; secrets only ever written server-side (see 0.7) | M | anon `select webhook_secret from products` → permission denied; old secrets dead |
| 0.3 | SEC-3 | new migration | `REVOKE EXECUTE` on `lock_commission_funds`, `release_cleared_funds`, `process_payout` from `authenticated/anon` (service_role keeps) | S | RPC call from user session → error |
| 0.4 | SEC-4 | new migration | `charges` table: replace `FOR ALL USING(true)` policy with service-role-only — **or just DROP the table** (see 1.2 — it's getting deleted anyway) | S | anon insert into charges → denied |
| 0.5 | SEC-5 | `app/api/fraud-reports/route.ts` | POST: require session, force `reporter_id = auth.uid()` (ignore body field); GET: return only caller's own reports (admin sees all) | S | unauth POST → 401; user B can't read user A's reports |
| 0.6 | SEC-6 | `app/api/products/upload-logo/route.ts` | Require session + product ownership; server-side MIME sniff (magic bytes, not client-provided `content_type`) + 2MB enforce; path `logos/{founder_id}/{product_id}.{ext}` | S | stranger uploads to your product → 403 |
| 0.7 | SEC-1b | new migration (trigger) | `BEFORE INSERT OR UPDATE ON products`: when `auth.role() <> 'service_role'`, force `webhook_secret := OLD.webhook_secret` / on insert `:= gen_random_hex(32)`; and force `is_featured/is_founders_choice/featured_until/founder_id := OLD/defaults`. Server-generated secrets everywhere; form stops being a secret-writing path (kills FRM-4 backend half) | M | browser-direct insert cannot set secret or featured flags |
| 0.8 | SEC-7 | `app/api/admin/data/route.ts`, `app/api/admin/products/route.ts`, `app/api/webhooks/*` (hardcoded admin), `middleware.ts` | Kill hardcoded `aryansharma24112003@gmail.com` → `ADMIN_EMAILS` env + use existing `is_admin()` SQL fn; `admin/data` stops `select('*')` → column allowlist (no secrets, no full bank/UPI, masked emails) | M | admin endpoints work for env-listed admin, leak nothing sensitive |
| 0.9 | SEC-8 | all 6 webhook routes | `timingSafeEqual` length guard: `if (a.length !== b.length) return 401` before compare | S | curl with 3-char sig → 401 not 500 |
| 0.10 | SEC-9 | new migration | `links` public SELECT policy → owner-only (+ service role; `/ref/[slug]` already uses admin client so redirects keep working) | S | anon can't dump all sellers' links/clicks |
| 0.11 | SEC-11 | new migration | Recreate founder SELECT policy on `transactions`: `founder_id-of-product = auth.uid() OR seller_id = auth.uid()`. (This is the FND-1 "founder dashboard shows permanent zeros" backend half) | S | founder sees own product txs, not others' |
| 0.12 | INF-4a | new migration | `webhook_logs`: add `event_type text` column; relax `status` CHECK to include `'test'`/'skipped' (or drop CHECK). Founders are currently blind to webhook failures because the log inserts fail | S | webhook logs actually accumulate rows |
| 0.13 | SEC-NEW | `app/api/webhooks/conversion/route.ts` (legacy) | Delete it (or hard-require platform secret + rate limit). It's an unsigned conversion entry point parallel to provider routes | S | route gone, 410 |

## PHASE 1 — MONEY LOOP TRUTH (one atomic path in, one path out)

| # | ID | File(s) | Fix | Effort | Done when |
|---|---|---|---|---|---|
| 1.1 | MNY-CORE | new migration: `record_conversion()` RPC | **Single atomic SQL function replacing webhook-processor Steps 5–9:** advisory lock on (product_id, external_customer_id) → upsert customer (+billing_count) → idempotent tx insert (`ON CONFLICT (external_transaction_id) DO NOTHING`) → wallet check+debit (conditional) → seller pending credit → all in ONE tx. Kill JS-side partial-failure states (today: wallet debited but tx insert fails = money lost) | L | kill -9 mid-webhook → no half-applied state, ever |
| 1.2 | MNY-1..5 | `app/api/cron/billing/route.ts`, `app/api/founders/billing/*` mandate APIs, `supabase/advanced_billing.sql`, `supabase/migrations/003_payment_system.sql`, `vercel.json` | **Your wallet-only decision executed as a DELETE:** remove Tier-1 metering entirely — billing cron (Phase-1 `.gt('unbilled_amount',0)` never matches anyway = dead code running daily), `charges`/`charge_schedules` fork, mandate create API, `unbilled_amount` usage, RBI-24h `console.log` TODO. Removes ~5 graveyard entries by deletion, not patching | M | `grep -rn "unbilled_amount\|charges\|charge_schedules"` → only migration history |
| 1.3 | MNY-8 | `lib/wallet.ts` (new), `app/api/cron/wallet-check/route.ts`, wallet top-up route | Close the dead zone: (a) on `wallet_insufficient` at sale → tx queued, product keeps selling but founder notified (in-app + email, digest rate-limited); (b) `settle_queued_conversions(founder_id)` runs **on every wallet top-up** → retro-debits wallet, retro-credits seller escrow, marks txs billed; (c) wallet-check cron: warn at ₹2,000, auto-pause when balance < average commission, **auto-unpause on top-up** | L | founder tops up ₹5k → 3 queued sellers get their commissions, product relists itself, sellers notified |
| 1.4 | MNY-6 | `lib/webhook-processor.ts`, provider routes | Refunds: handle `refund.processed`(RZP), `charge.refunded`(Stripe), `order_refunded`/`subscription_refunded`(LS) → `type='refund'` negative tx → clawback from seller **pending** first (escrow still locked = safe), overflow tracked as negative pending against future earnings; founder wallet re-credited | M | refund a certified test sale → seller pending decreases, wallet refunded, ledger balances |
| 1.5 | MNY-11 | new migration + `record_conversion()` | `platform_revenue` ledger (tx_id, amount, currency, created_at) written at sale time; admin totals read from it. Today the 5% vanishes from wallet into nothing | S | every sale row has a matching fee row; sums reconcile |
| 1.6 | SELL-2 | `app/api/sellers/withdraw/route.ts` | Remove `role==='warlord'` hard gate → any user with `withdrawable >= MINIMUM`; add **idempotency key** (client sends UUID, store, reject dupes) + 1/min rate limit; on RazorpayX payout failure (see 1.7) auto-refund balance | M | founder-with-earnings can withdraw; double-click = one payout |
| 1.7 | MNY-PO | new route `app/api/webhooks/payouts/razorpayx/route.ts` | RazorpayX payout webhook (`payout.failed`/`payout.reversed`) → refund `withdrawable_balance`, notify seller. Today a failed payout = deducted forever, discovered never | M | force-fail a test payout → balance restored + notification |
| 1.8 | MNY-ID | `lib/webhook-processor.ts` + migration | Fix async identity: store provider customer id (`subEntity.customer_id`, `stripe customer`) in `customers.external_customer_id` when present (fallback email); UNIQUE(product_id, external_customer_id). Then `subscription.cancelled` matching actually finds rows → cancelled subs stop earning (MNY-9) | M | cancel a sub in sandbox → next renewal attempt finds status |
| 1.9 | MNY-CUR | provider routes + `record_conversion()` | Store `currency` + `amount_minor` (+`fx_rate`) on every tx; convert at the provider-route edge: LS/Stripe/PayPal amounts are USD cents — currently treated as INR paise (~84× wrong on every international sale); kill all `×84` constants | M | $10 LS sale → ₹-denominated tx with fx_rate stored |
| 1.10 | SELL-CONST | `lib/constants.ts` | One source: `MINIMUM_WITHDRAWAL` stays ₹1,000 (docs fix is UI-batch); add `WITHDRAWAL_IDEMP_TTL`, `LOW_BALANCE_THRESHOLD=₹2,000` | S | one place |
| 1.11 | EMAIL-1 | `app/api/sellers/withdraw/route.ts`, deposit/topup routes | Wire the orphaned templates: "Payout Sent 💰" on payout creation, "Security Deposit Received ✅" on deposit, payout-failed email, low-balance email (1.3) | S | inboxes receive them |

## PHASE 2 — ATTRIBUTION & PROVIDER CORRECTNESS (sales land once, every time, from every provider)

| # | ID | File(s) | Fix | Effort | Done when |
|---|---|---|---|---|---|
| 2.1 | ATTR-1 | `app/api/webhooks/razorpay/[productId]/route.ts` + siblings | Missing `ref_id` → **HTTP 200 `status:'skipped_no_ref'`** (never 400 — Razorpay retries non-2xx and auto-disables endpoints; one organic sale can currently kill all tracking) + log + founder "unattributed sale" digest notification | S | organic test payment → 200, log row, no retry storm |
| 2.2 | ATTR-STRIPE | `app/api/webhooks/stripe/[productId]/route.ts` | Event split: subscriptions = `invoice.paid` + `customer.subscription.deleted` ONLY; one-time = `payment_intent.succeeded` ONLY; **delete `checkout.session.completed` handling** (it's what causes the double/triple: session id vs invoice id both pass idempotency) | M | one Stripe sub charge → exactly one tx |
| 2.3 | ATTR-LS | `app/api/webhooks/lemonsqueezy/[productId]/route.ts` | Handle `subscription_payment_success` → recurring conversion (key on LS subscription id); `order_refunded`/`subscription_payment_refunded` → 1.4 path; `subscription_cancelled` → churn | M | LS renewal webhook → month-2 commission lands |
| 2.4 | ATTR-PP | `app/api/webhooks/paypal/[productId]/route.ts` | Accept `PAYMENT.SALE.COMPLETED` **and** `PAYMENT.CAPTURE.COMPLETED` (one line) | S | PayPal sandbox sale → tx |
| 2.5 | ATTR-GR | `app/api/webhooks/gumroad/[productId]/route.ts` | Verify ping field mapping live (does `url_params[ref_id]` echo? test with real ping); document `?secret=` param usage; add sandbox test | S | gumroad test purchase attributes |
| 2.6 | ATTR-RZP | razorpay route | Persist `subEntity.customer_id` into customers row at first conversion (feeds 1.8); add `payment.failed`/`subscription.halted` → founder notification (P2 optional) | S | churn lookup works |
| 2.7 | SEC-2b | `app/api/products/route.ts` + migration | `POST /api/products/[id]/rotate-secret` (owner) → new `crypto.randomBytes(32).toString('hex')`, return once | S | rotate works, old sigs 401 |
| 2.8 | TOOL-2 | new routes (see Part A) | The Gauntlet: L0 handshake poll + L1 `simulate-sale` w/ full reversal + L2 `verified_at` gate; `GET /api/products` Vault query adds `verified_at IS NOT NULL` filter ◈(display is UI) | M | unverified product can't be listed; L1 reverses cleanly |
| 2.9 | TOOL-1 | `app/api/install/*` (new) | install token mint/verify + site-scan `verify` endpoint + `status` endpoint (Part A table) | M | scan detects snippet on a real page |
| 2.10 | TRACK | `public/track.js` (public asset — not dashboard UI) | Add first-load beacon: `fetch('/api/install/ping?product=X')` → `products.script_detected_at`; keeps `getRefId` API; document that Razorpay **Subscriptions** need server-side notes | S | install-status flips "script detected" from a real page load |
| 2.11 | ATTR-IDEM | migration | `UNIQUE(transactions.external_transaction_id)` + `UNIQUE(customers(product_id, external_customer_id))` — kills concurrent-webhook double-insert races that `.single()` checks can't catch | S | two parallel identical webhooks → one tx |
| 2.12 | ◈FRM-2 | `app/api/products/route.ts` (+ one-line in the form later) | API accepts/persists `category` (validate against the 6-value CHECK), `price_inr` numeric, `billing_type one-time|subscription`; GET returns `category` → Vault filters wake up | S | category filter returns rows |

## PHASE 3 — CRONS & OPS (make prod actually run the code)

| # | ID | File(s) | Fix | Effort | Done when |
|---|---|---|---|---|---|
| 3.1 | INF-1 | env | Set `CRON_SECRET`; verify `authorization: Bearer <CRON_SECRET>` in all surviving crons (release-escrow, wallet-check — billing cron is deleted in 1.2) | S | unauthenticated curl to cron → 401 |
| 3.2 | INF-2 | env + `lib/email.ts` | Set `RESEND_API_KEY`; log email failures to a table (or ≥ console + retry-once) instead of silent swallow | S | sale → seller email delivered |
| 3.3 | INF-3 | Supabase dashboard | Make `product-logos` bucket public-read (or switch to signed URLs) → logos render | S | vault shows logos |
| 3.4 | INF-5 | env + code | `LEMONSQUEEZY_WEBHOOK_SECRET` (platform deposits route 500s without it), live Razorpay key_id/secret, RazorpayX creds, `NEXT_PUBLIC_APP_URL` everywhere — delete every `|| 'https://blackindex.in'` fallback (`links/generate`, `new-product`◈, test route) | S | staging works without hardcodes |
| 3.5 | INF-4b | migration | `profiles.has_seen_founder_tour`, `has_seen_seller_tour` columns → `/api/user/onboarding` stops 500ing (UI batch consumes later) | S | endpoint 200s |
| 3.6 | MNY-RECON | new cron `app/api/cron/reconcile/route.ts` | Nightly: Σ wallet debits vs tx ledger; Σ pending vs locked escrow; Σ platform fees. Alert (email admin) on drift > ₹1. This is how you sleep at night with a money ledger | M | seeded ₹100 drift → alert fires |
| 3.7 | INF-6 | `vercel.json` | Remove `/api/cron/billing`; keep escrow/wallet-check; add reconcile | S | deploy config clean |
| 3.8 | INF-7 | `middleware.ts` / routes | Rate limiting (Upstash Ratelimit or DB sliding-window): auth endpoints, withdraw, fraud-reports, upload-logo, links/generate, simulate-sale, webhooks (generous per-IP) | M | 20 req/s burst → 429s |
| 3.9 | INF-8 | runbooks | Apply migrations to prod in order; **diff prod schema vs repo** (which of 8 SQL files actually ran?) — record the truth before Phase 4 | S | schema map doc exists |

## PHASE 4 — SCHEMA CONSOLIDATION & DEEP HARDENING (after 0–3 are live)

| # | ID | Fix | Effort |
|---|---|---|---|
| 4.1 | SQL-CLEAN | Squash 8 SQL files → linear `migrations/`; drop dead: `charges`, `charge_schedules`, `billing_threshold`/`charge_threshold` fork, unused escrow RPC dupes; regen `lib/database.types.ts` from prod (`supabase gen types`) | L |
| 4.2 | MNY-10 | Rewrite `lib/velocity-limits.ts`: same-unit math (tx counts + commission sums, not sale-vs-commission mix), create `velocity_logs` table (or stop logging to the phantom), fix `client_ip` column name, scale caps with founder history; fail-open→fail-logged | M |
| 4.3 | INDEX-DB | Indexes: `transactions(seller_id, payout_due_date)`, `transactions(external_transaction_id)` (unique covers), `notifications(user_id, read)`, `links(slug)` confirm unique | S |
| 4.4 | COMPLY | KYC tables (pan/full_name on payout identity, bank or UPI verified), W-9/W-8BEN later for US sellers, TDS 194H ledger column on payouts | L |
| 4.5 | OBSERVE | Sentry + webhook-failure alerting (founder digest + admin); structured logs with `product_id` on every webhook line | M |
| 4.6 | FEATURED | Featured-slot purchase path (₹4,999/30d): payment → `is_featured` set server-side only (0.7 trigger enforces), expiry cron auto-unfeatures; founders can never self-grant | M |

---

## Sequencing & effort math

| Phase | Items | Total effort (1 dev) | Gate |
|---|---|---|---|
| 0 — Security | 13 | ~5–6 days | 🚫 nothing public before this |
| 1 — Money loop | 11 | ~5–6 days | sellers can't be paid right until this |
| 2 — Attribution | 12 | ~5–6 days | founders can't onboard honestly until this |
| 3 — Ops | 9 | ~2 days (mostly elbow grease) | prod stays broken until this |
| 4 — Hardening | 6 | ~4 days (background) | post-launch |

**≈3 focused weeks for Phases 0–3.** Then: UI batch (dashboard truth, copy honesty, forms, certification UX) — and only then sellers in the wild.

Standing orders while executing: every fix gets its "Done when" test; money paths only in SQL transactions; secrets only server-side; every provider webhook returns 200 unless the signature is bad.
