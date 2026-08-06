# 🪦 BLACK INDEX — THE MASTER GRAVEYARD
### Every defect found across Security · Founder · Seller · Money Engine · Copy & UI · Docs · Legal — with fixes
**Compiled 2026-08-06 · Diagnosis only — no code was modified.**
**IDs:** SEC = security · FND = founder dash · SELL = seller · MNY = money engine · CPY = copy/UI · DOC = docs/legal · INF = infra/schema.

---

# PART 1 — THE MESSAGING AUDIT ("Do visitors instantly get it?")

**Verdict: NO.** Your own test — "a visitor should instantly know what it is" — fails on the very first screen. The site is beautiful and *says almost nothing concretely*. Here's the evidence:

## 1.1 The hero fails the 5-second test
Current hero: **"Black Index — The Performance Layer for SaaS."** Sub: *"Products meet performance. Revenue follows results."*
A stranger learns: nothing. Not "affiliates", not "commissions", not "sell", not "pay only on sale", not "India/UPI". They must press "What is Black Index?" to find out what it is — i.e., the hero outsources its one job.
**Fix (rewrite pattern — the rule is: [who] [does what] [with what outcome]):**
> H1: **"Sell SaaS you didn't build. Pay only for sales that happen."**
> Sub: **"Black Index is the marketplace where SaaS founders pay commission only on real sales — and sellers earn recurring royalties every month their customers stay subscribed. Instant tracking, UPI payouts."**
> CTAs: "Earn as a Seller" / "List your product free" (two-sided CTA — your market is two audiences; today both land on the same ambiguous button).

## 1.2 Four different taglines in one product
"Performance Layer for SaaS" (hero) · "distribution layer of India" (protocol/blackindex.md) · "The Sales Network of the Internet" (email footers) · "sales layer of the World SaaS stack" (deck quote). Pick ONE sentence that survives everywhere.

## 1.3 Copy claims vs code — the dishonesty ledger
| Where | Claim | Code reality | Severity |
|---|---|---|---|
| Hero-adjacent `earnings.tsx` | "₹10,00,000+ earned by top sellers" (huge animated counter) | Hardcoded constant; platform hasn't processed that | 🔴 Fabricated |
| `leaderboard.tsx` | "Priya Sharma ₹42,850…" 7 ranked sellers | Hardcoded fake array | 🔴 Fabricated |
| `how-it-works.tsx` | "Stripe and Razorpay handle the split **automatically at checkout**" | No split at checkout exists; Route/Connect are stubs | 🔴 False mechanism |
| `how-it-works.tsx` | "We lock the Warlord to the Stripe Customer ID for **lifetime** tracking" | Recurring capped at `max_recurring_months` (default 12); Razorpay key-mismatch breaks churn | 🔴 Overclaim |
| `how-it-works.tsx` | "High-tier Warlords get exclusive access" to The Vault | No tiers; Vault open to all signups | 🟠 False |
| `protocol/page.tsx` | Metered billing: "24h later the Razorpay Mandate auto-deducts" | Engine never increments; invoice marked paid at issue; founders are never charged | 🔴 Describes vapor |
| `protocol/page.tsx` | "If the customer refunds, commission is automatically clawed back via webhook" | Zero refund handling in code | 🔴 False |
| `protocol/page.tsx` | "fuzzy email match" self-referral kill | Exact string compare only; plus-addressing sails through | 🔴 False |
| `protocol/page.tsx` | "Minimum withdrawal is ₹3,000" | Code ₹1,000 (×2 places) | 🟠 Mismatch |
| `protocol/page.tsx` | "platform fee is a flat 5% on **transaction value**" | Code: 5% of **commission**; deck says 5% of sale →  round it | 🟠 3 versions of your take rate |
| `overview.tsx` | "sales talent is rewarded **instantly**" | Credit ticks instantly, money arrives T+30 | 🟠 Half-false |
| `the-maths.tsx` | Warlord card: 40% + 20% monthly ⇒ Founder card same sale says cost "20%" | Contradictory rates on one page; doc hardcodes 15% recurring | 🟠 Incoherent |
| `the-maths.tsx` | "1,000 Warlords × 10 sales each" | Fantasy at 0 sellers; keep but visibly label as illustrative (footnote exists — make it stronger) | 🟠 Aspirational-as-data |
| `docs/integration` | "funds are automatically split … Warlords receive commissions instantly" | Pending 30d; no auto-split | 🔴 False |
| `records lib/email-templates` | "Payout Sent 💰" template | No sender wired for it (orphan); RazorpayX status unhandled | 🟠 Orphan promise |
| Payout UI(s) | "every Friday" vs "24–48 hours" vs "within minutes" | Simulated popover + unmounted real flow | 🔴 3 lies, 1 button |
| Seller modal | "Become a Seller… list your own products" | Upgrades you to FOUNDER; founders can't withdraw | 🔴 Inverted |
| Terms 4.1 | "'Forever' = lifetime of the customer subscription" | Code caps at 12 months default | 🟠 (Asterisk saves it legally; breaks trust) |
| Terms §8 | "Commission changes with 30 days notice" | Edits are instant & silent in code | 🟠 Unimplemented promise |
| Refunds page | "deactivating won't affect pending commissions" | wallet-insufficient + admin hard-delete paths contradict | 🟠 |
| Cookies page | describes cookie usage | tracking lives in localStorage; no consent banner anywhere | 🟠 |

## 1.4 Audience targeting: you're selling to the wrong person in the wrong voice
- **The blog** (`lib/blog-data.ts`, 756 lines) is 2025-dated side-hustle SEO bait: *"5 Easy Ways to Earn Passive Income (No Experience Needed)"*, *"Earn ₹50,000+/Month"*, *"Students…"*. This attracts desperate low-quality accounts — *not* the SaaS founders who control supply, nor the professional affiliates who move GMV. It reads MLM-adjacent on a platform whose pitch is anti-fraud. **Fix:** delete or re-scope 100% to B2B content: "CAC benchmarks for Indian SaaS", "Why PartnerStack doesn't work for ₹999/mo ARPU", "Recurring-commission playbooks".
- **The Maths** section (the best page) correctly courts both sides, but speaks **only** to dreamers. Add sober counterparts: realistic first-month numbers, drop-off, power-law truth ("top 5% of sellers move ~90% of GMV") — investors AND founders read over-dreaming as naïveté.
- **Voice register** swings between finance-grade ("trustless financial engine"), gaming ("Warlords", "The Vault"), and hustle-bro ("massive commissions", "sell once earn forever"). Choose: **stealth-finance for founders / arena for sellers** — companies page sells to founders, seller pages keep the gamer skin. One site, two doors is a feature — but they can't share one confused hero.
- **Two homepage components drift:** `app/page.tsx` (live: shows TheMaths) vs `app/page-main.tsx` (unused: shows hardcoded "Products/₹999/mo/30%/₹299" cards incl. **"Services ₹15,000"** — off-niche). Delete one.
- **`/early-access` is still live** with "Launching Soon — {10000−count} spots left" (goes negative at 10,001) while the main site presents as deployed — two doors saying opposite things. Sunset it (redirect to main).
- Footer: "© 2025" in 2026, "STEALTH" tag, personal Gmail on contact/refunds pages (no support@/legal@/founders@blackindex.in), no company/entity name + grievance officer (Indian IT-Act/DPDP norm), no link to contact/careers/status. Small, cheap, high-trust fixes.
- Emails: tone is good. Fix footer tagline to the one chosen; wire the "Payout Sent" template to the RazorpayX status webhook when it exists; the "Security Deposit Received" template is orphaned until deposit UI exists.
- SEO/meta: fine foundation (sitemap/robots/blog exists) but every page needs honest, keyworded copy after the rewrite above; "make money" keywords actively hurt your ICP targeting.

## 1.5 Messaging OK-list (keep)
- **The Protocol page's framing** ("not an affiliate network, the distribution layer"), two-sided anatomy, integration-tier table structure, The Maths' big-number dramatization as a *selling* device (with honest footnote), docs page structure & hard "Critical Requirement" warning, login/signup/login copy (clean), "What is Black Index?" CTA as secondary (keep — but the hero must already answer it).

---

# PART 2 — THE COMPLETE ERROR LIST (severity-ordered)

> Legend: 🔴 critical · 🟠 high · 🟡 medium. Each: problem → **fix**.

## A) SECURITY (do-first-arc)
| # | Sev | Error | Fix |
|---|---|---|---|
| SEC-1 | 🔴 | `profiles` "update own profile" RLS is row-level: any user can self-set `role`, `withdrawable_balance`, `wallet_balance`, `security_deposit_paid`… then withdraw real money | Column-restrict: move money/role/flags to a server-only `wallets`+`roles` split or `REVOKE UPDATE(col…) FROM authenticated`; all balance movement via SECURITY DEFINER RPCs only |
| SEC-2 | 🔴 | Public `products SELECT is_active=true` exposes `webhook_secret` for every active product → forge conversions → drain Tier-2 wallets | Public view `public_products` sans secret; base table founder-only; **rotate all secrets post-fix**; UI shows masked secret w/ owner-only reveal endpoint |
| SEC-3 | 🔴 | `lock_commission_funds` / `release_cleared_funds` / `process_payout` granted to `authenticated` → invent pending, release to withdrawable, withdraw | `REVOKE … FROM authenticated`, `GRANT service_role` only; add amount-vs-transactions invariant inside functions |
| SEC-4 | 🔴 | `charges` policy `FOR ALL USING(true)` = world-writable ledger | Drop policy; service-role only |
| SEC-5 | 🟠 | `POST /api/fraud-reports` unauthenticated (impersonate reporters; notify others; bounty-farm), `GET ?user_id=` leaks reports | Auth; `reporter_id = auth.uid()` server-side; GET scoped to session; rate-limit; admin approval queue |
| SEC-6 | 🟠 | `POST /api/products/upload-logo` unauthenticated, no ownership, magic-byte validation absent → deface/phish any product logo | Auth + `founder_id==user.id`; magic-byte sniff; size cap exists ✓ |
| SEC-7 | 🟠 | Admin = hardcoded Gmail in 3 files; `admin/data` returns `*` (secrets, bank fields) to browser | DB-backed roles (`user_roles` exists); explicit columns; audit-log admin reads |
| SEC-8 | 🟠 | Founder's product-update policy lets founders self-grant `is_featured`, `featured_until` (skip ₹4,999) | Column-revoke or move featured lifecycle server-side |
| SEC-9 | 🟡 | `timingSafeEqual` with attacker-length buffers → 500s instead of 401 (5 routes) | Length-gate before compare; helper `safeEqualHex(a,b)` |
| SEC-10 | 🟡 | Zero edge rate-limits (link-gen, order creation, fraud reports, PATCH profile) | Vercel/Upstash per-IP throttle + per-user daily caps |
| SEC-11 | 🟡 | `links` public SELECT leaks all sellers' ids/slugs/click counts | Redirect already server-side (admin client) — kill the public policy |

## B) MONEY ENGINE
| # | Sev | Error | Fix |
|---|---|---|---|
| MNY-1 | 🔴 | Provider-webhook path never increments `unbilled_amount` → billing cron finds no one → **founders never charged** | Collapse to wallet-first ledgerset: every founder pre-funds; sale time = wallet debit + tx `billed` (mandate later = auto top-up convenience) |
| MNY-2 | 🔴 | Escrow release requires `billed` → Tier-1 & legacy-route txns never release → **sellers never paid** | Same collapse solves it; `billed`-at-sale invariant everywhere |
| MNY-3 | 🔴 | Legacy `conversion` route forks logic: increments `charges` (unexecuted table), sets no `billing_status` | Delete/merge into shared processor (single `record_conversion()` RPC) |
| MNY-4 | 🔴 | Billing cron marks Razorpay **invoice** `paid` at issue (no mandate debit happens; no `invoice.paid` listener); blanket `unbilled=0` wipe races accruals | Charge mandate token properly or reconcile via webhook; decrement by settled amount only; send the RBI 24h pre-debit notice for real (it's a `console.log`) |
| MNY-5 | 🔴 | No refund/chargeback handling anywhere; sellers keep commission on refunded sales; T+30 < card dispute window (120–180d) | `charge.refunded`/`payment.dispute`/provider equivalents → `type='refund'` tx + clawback from pending then future earnings (negative-balance support) |
| MNY-6 | 🔴 | Stripe: `checkout.session.completed` + `invoice.paid` both processed → **double commission on month 1**; docs tell founders to enable BOTH | Subscriptions → `invoice.paid` only; one-time → session; or cross-dedupe on `payment_intent` |
| MNY-7 | 🔴 | Razorpay churn never matches: stored `external_customer_id=email` vs cancel by `customer_id` | Store provider customer_id in its own column; resolve cancels by subscription_id |
| MNY-8 | 🟠 | `wallet_insufficient`: seller gets nothing/never re-credited; pause only at zero (thanks to partial insufficiencies) | Retry on top-up; immediate pause on first insufficiency; low-balance warnings before zero; auto-unpause products after deposit |
| MNY-9 | 🟠 | Platform 5% fee computed but never received/booked anywhere | `platform_earnings` ledger + admin revenue view; Tier-2 debits book the fee to it |
| MNY-10 | 🟠 | Ledger race conditions: customers insert/billing_count read-modify-write; processor misses 23505 path | Single SQL upsert RPC doing customer+count+tx+balances atomically |
| MNY-11 | 🟠 | Payouts: no RazorpayX status webhook (bounces never restore); restore-race double-spend; no `payout_requests` audit row; float-dust amounts | Status webhook + deterministic `reference_id` reconcile; insert payout_requests; `Math.round` paise |
| MNY-12 | 🟠 | Withdraw requires `role=='warlord'` → **founders can't withdraw earned commissions** | Key off balances; allow both roles |
| MNY-13 | 🟠 | Velocity limits: commission-vs-sale unit mix, ₹50k/day cap kills good days, fail-open, phantom `velocity_logs` table, wrong `client_ip` column, unused query | Rework: same-unit limits, per-product config, alert-not-block, create table or delete file |
| MNY-14 | 🟡 | Doc/code splits: min withdrawal ₹3,000↔₹1,000; take-rate 5% of sale↔commission; ₹499 fee vs free-upgrade | One constants file + docs regenerated from it |
| MNY-15 | 🟡 | Security deposit: no enforcement, no UI to pay, refund flow absent; bounty "from deposits" unfundable | Deposit gate on product create; pay/deposit UI; refund-on-close path; cap bounty |
| MNY-16 | 🟡 | USD wallet topups booked at hardcoded ₹/$=84 | Store settled amount+currency from webhook payload; multi-currency ledger fields |
| MNY-17 | 🟡 | Idempotency: concurrent first-charges → double upfront; per-provider webhook retries | unique tx key ✓ + treat 23505 as success-idempotent; atomic RPC (MNY-10) |
| MNY-18 | 🟡 | GST invoices/TDS (194H thresholds, PAN-less 20%) absent | PAN at first withdrawal; TDS ledger columns; GST-numbered invoices; CA memo on wallet/PA status |

## C) FOUNDER DASHBOARD
| # | Sev | Error | Fix |
|---|---|---|---|
| FND-1 | 🔴 | Founders can't read `transactions` (RLS policy dropped, never recreated) → **all stats/charts/activity permanently zero** | Recreate founder SELECT policy via product ownership subquery |
| FND-2 | 🔴 | Client queries `products…webhook_secret` directly (despite opposite in-code comment) and displays it | Remove from select; masked server reveal |
| FND-3 | 🟠 | Settings "Save" is fake (setTimeout toast only) | Wire `PATCH /api/profile` like seller settings |
| FND-4 | 🟠 | "Verify webhook" compares HMAC to itself — always passes | Real signed synthetic event → end-to-end row check |
| FND-5 | 🟠 | Product creation = browser-direct INSERT: skips role check, deposit gate, review, commission bounds; paywall dead | Route via API; RLS insert additionally requires role founder/admin |
| FND-6 | 🟠 | Webhook modal shows only Razorpay URL for 5-provider product; `?secret=` missing for Gumroad/PayPal; hardcoded prod domain | Store provider on product; render provider-specific URL incl secret param; use `NEXT_PUBLIC_APP_URL` |
| FND-7 | 🟠 | Delete = rename `[DELETED]` prefix; links 404, ledger/name pollution | `deleted_at` column; cascading deactivate + seller notice |
| FND-8 | 🟠 | Featured: no renewal charged; verify lacks order↔product/user/amount re-check | Recurring/renewal flow + verify re-reads server records |
| FND-9 | 🟡 | "MRR" isn't MRR (no churn normalization); Subscribers count churned forever; Commission Paid = accrued; chart 7-day count-only; timezone-day bucketing; unbounded tx fetch (no pagination); fetch errors swallowed | Server-side stats RPC/views; pagination; error surfaces |
| FND-10 | 🟡 | Activity: no product name, no Warlord identity, no status column, 20-row slice | Joins + filters + CSV export |
| FND-11 | 🟡 | Billing tab: Route="coming soon" toast while `create-mandate` API sits dead; deposit state dead; no invoices/statements; unbilled/mandate GET unread | Wire or remove; statements view over founder_deposits/charge_schedules |
| FND-12 | 🟡 | Tour loop bug (missing `has_seen_founder_tour` column) | Migration adds column |
| FND-13 | 🟡 | `/dashboard/founder` ungated by role; badge hardcoded "Founder"; sidebar confusions | Role gate + dynamic badge |
| FND-14 | 🟡 | Commission terms editable silently post-launch | Bounds + versioning + seller notifications + ToS-notice enforcement |

## D) SELLER JOURNEY
| # | Sev | Error | Fix |
|---|---|---|---|
| SELL-1 | 🔴 | Mounted withdraw UI is a simulator toast ("Simulate API call…"); real `WithdrawFunds` **unmounted** | Mount real flow; delete simulator; single payout promise copy |
| SELL-2 | 🔴 | Tour never completes (`has_seen_seller_tour` column missing → 500 loop) | Migration |
| SELL-3 | 🟠 | Notifications written but no UI exists to read them | Bell + page + mark-read + realtime toast |
| SELL-4 | 🟠 | Vault category filters 100% dead (`category` not selected by API); modal's tagline/pricing/audience never render | Add column to select; write real columns at creation |
| SELL-5 | 🟠 | Header balances stale until reload (login-snapshot profile + "Live" pulse) | Refetch profile on realtime tx insert |
| SELL-6 | 🟠 | Stats computed from last-50 txns (conversions/week/chart undercount forever) | Server aggregates |
| SELL-7 | 🟡 | Duplicate hook instances = double fetches + realtime channels (links ×2-3, txns ×2) | Shared context provider |
| SELL-8 | 🟡 | Click increment racy (read-modify-write); `increment_clicks` RPC ignored; `unique_visitors` never written | Use RPC; fix or drop column claims |
| SELL-9 | 🟡 | Dead slugs render raw JSON; no link management UI; no campaign/sub-ids | Branded 404 page; manage-links; add `campaign` col |
| SELL-10 | 🟡 | Analytics: fake week1-3 zeros, "Click Rate" duplicates Conversion, "Avg.Order"=avg commission, all deltas hardcoded 0 | Real metrics or remove panels |
| SELL-11 | 🟡 | Seller has zero visibility into founder integration health ("sold but untracked") | Vault badge: "last tracked sale Xh ago" + per-product integration state |
| SELL-12 | 🟡 | No KYC: phone/PAN/UPI collected nowhere; RazorpayX contact with empty phone | Progressive KYC at first withdrawal |
| SELL-13 | 🟡 | Fraud-report of inactive product silently drops founder_id (RLS join blocks) | Server-side resolution in fixed endpoint |
| SELL-14 | 🟡 | Recent-activity shows raw `product_id.slice(0,8)` UUIDs; ticker ×3 duplication | Join product names; drop fake cloning |

## E) COPY/UI/UX (from Part 1)
| # | Sev | Error | Fix |
|---|---|---|---|
| CPY-1 | 🔴 | Hero doesn't say what it is (5-second test fail) | Rewrite per §1.1 pattern (two-sided CTA) |
| CPY-2 | 🔴 | `how-it-works.tsx` three cards all describe non-existent mechanics | Rewrite to true mechanism (webhook-verified sales, T+30 escrow, wallet-guaranteed payouts) |
| CPY-3 | 🔴 | Fake earnings counter (₹10L) + fake leaderboard names | Delete or wire to real data with "updated hourly" |
| CPY-4 | 🔴 | Three contradictory payout promises; inverted "Become a Seller" | One truth; rename to "Become a Founder" & explain both modes |
| CPY-5 | 🟠 | 4 taglines; blog = mispositioned hustle SEO | One line everywhere; replace blog with B2B SaaS distribution content |
| CPY-6 | 🟠 | The Maths rates contradict each other and the docs (40/20 vs 40/15; founder "20% cost") | Single canonical example set; label illustrative loudly |
| CPY-7 | 🟠 | Protocol page advertises broken features (clawback, mandate billing, fuzzy matching, ₹3,000) | Align page to reality or ship features first |
| CPY-8 | 🟡 | Two homepage files drift; `/early-access` live with negative-spots + competing claims | Delete `page-main`; sunset early-access → redirect |
| CPY-9 | 🟡 | Footer © 2025/'STEALTH', personal Gmail as support/refund/admin, no entity/grievance info | 2026, support@/founders@blackindex.in, legal entity + grievance block |
| CPY-10 | 🟡 | Cookies page vs localStorage reality; no consent banner; orphan email templates | Copy fix + set up real consent where applicable; wire/delete templates |
| CPY-11 | 🟡 | Terms: "payments monthly" vs UI "minutes"/"Friday"; 30-day change notice unimplemented; disclaimer generic | Legal-vs-code reconciliation pass |
| CPY-12 | 🟡 | Overview "rewarded instantly"; juices ("High-tier…exclusive Vault") that don't gate | Copy changes free |

## F) DOCS & LEGAL
| # | Sev | Error | Fix |
|---|---|---|---|
| DOC-1 | 🔴 | Docs' Stripe sample reads `req.cookies.ref_id` — track.js stores in **localStorage**, so the recommended integration drops attribution | Sample: `window.BlackIndex.getRefId()` → server param; tabbed per-framework examples |
| DOC-2 | 🔴 | Docs recommend the exact two Stripe events that trigger double-commission; omit `subscription.charged` for Razorpay | Fix list + add cancels/refunds once implemented |
| DOC-3 | 🟠 | Gumroad/PayPal flows: URLs missing `?secret=` and PayPal event-name mismatch | Generate provider-aware instructions from product record |
| DOC-4 | 🟠 | "Trustless" branding while codebase = trusted Postgres ledger | Say "verified/audited", not trustless |
| DOC-5 | 🟡 | Legal pages: no entity name/address, no grievance officer, no DPDP language, no GST details; refunds@ = personal Gmail | Proper legal entity block + regional annexes before raising |

## G) INFRA / SCHEMA
| # | Sev | Error | Fix |
|---|---|---|---|
| INF-1 | 🔴 | 5 conflicting SQL files (charges↔charge_schedules, billing↔charge_threshold, 2 escrow RPCs); prod behavior depends on run order | Consolidate to numbered migrations; delete strays |
| INF-2 | 🟠 | `webhook_logs.event_type` written but column absent; test-log status 'test' violates CHECK → silent log loss | Align schema; assert in CI |
| INF-3 | 🟠 | `billing_status` CHECK excludes 'wallet_insufficient' (order-dependent prod failure) | Single migration adds value |
| INF-4 | 🟡 | Hand-maintained `database.types.ts` drifts | `supabase gen types` pipeline |
| INF-5 | 🟡 | Old files/components orphaned: `page-main.tsx`, `WithdrawFunds`, create-customer/invoices libs unused, velocity file unused-ish | Delete or wire (fix-first-then-delete) |
| INF-6 | 🟡 | Env checklist (RESEND_API_KEY, CRON_SECRET, Razorpay live keys, LS store/variant IDs, METERED_PLAN_ID, RAZORPAYX_ACCOUNT_NUMBER) — your own report says pending | Config runbook + boot-time env validation (fail loudly) |
| INF-7 | 🟡 | Cron auth depends on unset CRON_SECRET → crons 401 in prod (escrow not running) | Set env; add cron health beacon in admin |

---

# PART 3 — POST-FIX MONEY MODEL (realistic)

Assumptions: take = **5% of commissions** (today's model, ≈1.5% of GMV at a 30% blended commission); sellers active-30d ≈ 10% of registered (industry norm); featured ₹4,999/mo; founder ₹499/mo re-introduced after promo (50% pay it).

## 3.1 Scenarios (steady-state, post-fix)

| Metric | Year 1 Base (mo 12) | Year 2 Base (mo 24) | Year 3 Base (mo 36) | Notes |
|---|---|---|---|---|
| Live products | 100 (60 active) | 400 (200) | 1,500 (750) | activation ≈ 50-60% |
| Registered sellers | 800 | 3,000 | 12,000 | |
| **Active sellers (30d)** | **80** | **350** | **1,500** | the only number that matters |
| GMV/active seller/mo | ₹25,000 | ₹30,000 | ₹35,000 | ~4-6 sales of ₹5k-₹8k ARPU |
| **Monthly GMV** | **₹20L** | **₹1.05Cr** | **₹5.25Cr** | |
| Commission pool (30% blend) | ₹6.0L | ₹31.5L | ₹1.58Cr | |
| **Your take (5% of comm.)** | **₹30k/mo** | **₹1.6L/mo** | **₹7.9L/mo** | ~$11.5k/mo annualized ₹95L |
| Featured (8 / 25 / 60 listings) | ₹40k | ₹1.25L | ₹3.0L | |
| Founder ₹499 (supporters) | ₹0 (promo yr) | ₹1.0L | ₹3.7L | restore post-promo |
| **Total revenue/mo** | **₹70k (~$830)** | **₹3.9L (~$4.6k)** | **₹14.6L (~$17.5k)** | Annualized: ₹8L → ₹47L → ₹1.75Cr |
| Bonus stream if take → 8% | +₹18k | +₹95k | +₹4.7L | PartnerStack charges ~$89/mo + share — you have room |

**Reality checks:** founder doc's "₹30L Year-1" requires 500 founders actually billed — realistic Y1 is **₹6–10L total revenue**, reached by hitting the active-seller metric, not registered vanity numbers. The lever isn't founders (they're free-ish to get) — it's **active sellers/product** (target ≥2) and **GMV/active seller**.

## 3.2 Unit economics per ₹10,000/mo ARPU sub (30% upfront, 15%×12 recurring)
- Warlord: ₹3,000 up + ₹1,500×11 = ₹19,500 over year 1
- Platform: ₹975 (5% of 19,500) + potential featured/subscription revenue
- Founder: keeps ~80.5% first-year net of commissions — still cheaper than ≈30% blended paid-ads CAC AND zero risk on non-sales. This is your pitch math; it works — **if** attribution never leaks (MNY fixes).

## 3.3 First $1,000 path (post-fix)
~₹84k = e.g. 12 featured listings (₹60k) + 4 paying-founder months + ₹20k fees ≈ **month 3–4 post-fix** with concierge onboarding. At ~₹48L GMV all-in via fees alone ≈ month 5–7.

---

# PART 4 — GOING GLOBAL with "Sell once, earn forever*"

You're right that nobody offers lifetime-recurring *cross-network*. (PartnerStack/Rewardful do recurring **within one program**; ClickBank one-time; FirstPromoter/Tolt recurring per-merchant.) Your defensible twist = **portable royalty across a marketplace + India/cross-border payout rails.** To take it global:

**Ledger & product (prereqs)**
1. Multi-currency: `amount_minor` + `currency` on transactions/balances; FX rate stored **at credit time**, displayed both currencies (kill `USD_TO_INR=84` hardcode; geo-aware formatting via `formatCurrency(currency)` already stubbed in `use-dashboard-data.ts`).
2. Provider adapters complete: fix Stripe (invoice-only dedupe), add **Paddle** & **Polar** (merchant-of-record = global SaaS' default), finish LemonSqueezy renewals (`subscription_payment_success`), PayPal event set — one shared processor already exists, so each adapter ~150 LOC.
3. "Forever" honesty switch: expose per-product `max_recurring_months` on the Vault card ("15% × 12 mo" or "∞ while subscribed") — trust is the asset; don't bury the cap in an asterisk.

**Payout rails by region (the actual moat)**
4. India: RazorpayX UPI (minutes) ✓ → SEA/PH/ID: **Wise Platform API** or Payoneer → US/EU: **PayPal Payouts + Wise ACH/SEPA**, or graduate to **Stripe Connect Express** (one KYC pipeline, 100+ countries) once volume justifies its fees. Min-withdraw ≈ $20 local equivalent; same T+30.

**Compliance by region (why globals pay you to exist)**
5. India: TDS 194H + PAN (as specced). US payouts: collect **W-9/W-8BEN**, 1099-K at thresholds. EU: **DAC7** reporting for platform sellers, VAT treatment of commissions (B2B reverse-charge typically). UK/EU consumers: affiliate disclosure (FTC/ASA rules) guidance for sellers. This compliance-as-features is exactly what cross-border SaaS can't find today in one tool.

**Go-to-market sequence**
6. Phase 1 (now–mo 6): **India** — prove the loop (₹1 demo video, 10 products, 100 sellers, real payout proofs public).
7. Phase 2 (mo 6–15): **Global-South English SaaS** (SEA, LATAM, E-EU) — high seller supply, underserved payouts, USD prices ≈ 2–3× GMV/sale at identical take rate.
8. Phase 3 (mo 15+): **US/EU** — highest ARPU, hardest competition; enter with "lifetime royalty + global seller bench already active" as proof.
9. Network-effect assets to build during all phases: public per-product leaderboard (real), seller reputation graph (portable across programs — your *cross-network royalty*), open Royalty API ("sell once, earn forever — as an API").

**One-line global positioning:** *"The cross-border royalty layer: SaaS founders in any country, sellers in any country, lifetime commissions paid in days, in local currency."*

*— End of master document. No code was modified.*
