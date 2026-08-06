# 🔍 BLACK INDEX — DEEP AUDIT: Business Model + Founder Dashboard

**Audit date:** 2026-08-06 · **Scope:** Full codebase + both business docs, with deep focus on the Founder Dashboard and every function it touches.
**Rule followed:** This report *identifies and prescribes* fixes. Nothing in the codebase was changed.

> ⚠️ Reading advice: Section 1 answers "is this a good business model?". Section 2 has the code-level catastrophes. Section 3 is the founder-dashboard deep dive you asked for. Section 5 is the prioritized fix plan.

---

# 1. IS THIS A GOOD BUSINESS MODEL?

## Verdict: **A-tier concept, F-tier execution (today).**

The *idea* is genuinely good and internationally validated — PartnerStack, Rewardful, FirstPromoter, Tolt, Push Lap Growth all prove the "affiliate network for SaaS subscriptions" model works, and none is dominant in India. The niche thesis (performance-only CAC for Indian SaaS + UPI micro-payouts) is legitimate. **However, as implemented right now, this platform cannot safely touch real money** — the ledger can be forged by any user in ~3 curl commands (see §2), and the entire founder-billing pipeline is disconnected (see §4), so the actual revenue engine produces ₹0 regardless of how good sales are.

### 1.1 What is genuinely strong about the model

| Strength | Reality check |
|---|---|
| Performance-only pricing ("pay when you win") | Real differentiator vs CPM ads. Correct thesis. |
| Recurring commissions = seller retention moat | True — this is the one structural advantage over ClickBank-style networks. |
| Network provides the *sellers*, not just tracking software | Correct wedge vs Rewardful/PartnerStack (they sell software, you sell outcomes). |
| T+30 escrow + wallet pre-funding (Tier 2) | Sound fraud design *concept*… but see the implementation holes in §2/§4. |

### 1.2 Business-model problems (with fixes)

**P-B1 — The platform never actually collects its revenue.**
Your take rate is "5% of commission." On the provider-webhook path (`lib/webhook-processor.ts`), the 5% `platform_fee` is *calculated and written to the transaction row* but is **never moved away from anyone and received by you**: for Tier 1 founders it's silently part of an "unbilled" amount that nothing ever bills (see §4.1); for Tier 2, the founder's wallet is debited the *gross* commission while the seller is credited the *net* — the 5% stays as an accounting ghost inside the founder's wallet number, not in a Black Index-owned account/balance. There is also no "platform earnings" surface anywhere (no table, no dashboard, no settlement). You literally cannot answer "how much did Black Index earn this month?" from your own DB.
**Fix:** Introduce a real platform ledger (e.g. `platform_earnings` table + a `platform` pseudo-account row), write a settlement row on every conversion, and move Tier-2 wallet debits so `gross − net = platform_fee` is booked to your account. Build an admin revenue view.

**P-B2 — Doc promises vs reality (investor-diligence landmines).** These contradictions will be found in the first 30 minutes of any technical diligence:

| Doc claims | Code reality |
|---|---|
| "₹499 founder upgrade fee — revenue stream" | `app/api/founders/upgrade/route.ts` grants founder role **free to anyone who calls POST** ("Free for 2026 promo" — commit `cd7a93c`). And because role isn't checked before product creation anyway (§2.6), the fee is bypassed twice. |
| "₹5,000 security deposit — zero-day cash flow" | The deposit is **enforceable nowhere**: nothing in product creation, listing, or withdrawal checks `security_deposit_paid`. Worse, the Billing tab has **no button to pay a deposit at all** (`isSubmittingDeposit` in `components/founder/setup-billing.tsx` is dead state — declared, never used). The API route exists and nothing calls it. |
| "T+30 escrow, then withdraw" | Only true for Tier 2 wallet founders. Tier 1 transactions are `unbilled` forever ⇒ escrow never releases (§4.2). |
| "Chargeback clawback mechanism" | **Zero refund/chargeback handling in code.** No webhook route has a `refund.*`/`charge.refunded` branch. Sellers keep commission on refunded sales. |
| "Cookie + IP tracking for self-referrals" | Neither exists. Only exact-email string compare. |
| "Rate limiting on link generation" | `app/api/links/generate/route.ts` has none. |
| Fiat numbers (8 products confirmed, projections, "8 SaaS at launch") | Landing page shows a **hardcoded fake leaderboard** (`components/sections/leaderboard.tsx` — "Priya Sharma ₹42,850" etc.). Fabricated earnings proof on a live money platform is an ASCI/consumer-law risk and reputational poison if screenshotted. |

**P-B3 — The seller payout economics are backwards (you pre-fund the money).**
Execution order per sale today: seller's balance is credited **immediately** at webhook time; the founder is charged *later* via the billing cron (which is broken — §4.1). At T+30 the seller withdraws from **your RazorpayX float**. That means Black Index advances commission cash for 30+ days on every Tier 1 sale — you are running an unsecured working-capital lending business whether you like it or not. If founders never pay (in broken code: they *can't* pay), every withdrawal is funded by you.
**Fix:** Contractually and technically, do one of: (a) Tier 2 wallet-first only until Route/mandate charging is *proven*; (b) for Tier 1, credit seller escrow only after founder settlement succeeds (flip the order), or (c) keep pre-funding but treat it as a real credit product — max per-founder exposure cap enforced in the withdrawal path, not just journaling.

**P-B4 — Commission guardrails are absent; founders can set suicidal or scammy terms.**
`upfront_pct` is accepted as any integer (negative, 500%) in both create paths (client-side insert in `new-product/page.tsx`; `POST /api/products` only checks presence). A founder can set 40% upfront + 15% recurring forever; on a churn-heavy ₹999/mo product that exceeds first-year revenue — your own doc's example is already 40% effective CAC on year one. Editable anytime (`edit-product/[id]/page.tsx`) with no seller notification → classic bait-and-switch vector against Warlords ("30% today, 5% after you've built traffic").
**Fix:** Server-side bounds (e.g. 5–60% upfront, 0–25% recurring, cap total 12-month payout ≤ 100% of first-year price), commission-lock per active link (grandfathered terms), and seller notifications on config change.

**P-B5 — Marketplace leakage is one checkbox away.**
Attribution depends on the *founder* honestly passing `ref_id` into their payment provider's notes/metadata. Any founder can stop passing it on sales they recognize ("organic") and pay nothing. There is **no reconciliation**: you can't see that a founder had `payment.captured` events without ref_id vs. their public traffic/clicks. (`app/api/webhooks/razorpay/[productId]/route.ts` logs missing-ref_id to `webhook_logs` — but nothing surfaces it or acts on it; see §3.2-D that founders can't even view those logs.)
**Fix:** Leakage analytics per founder: clicks→tracked-sales conversion %, missing-ref_count, deviation alerts to admins; make "mandatory monthly webhook health report" a product feature. Long-term: own the checkout layer (hosted payment pages / Razorpay Route actually splitting at source).

**P-B6 — Compliance claims need a lawyer pass (India specifics).**
- "Automated TDS for payouts > ₹50,000" — wrong threshold against Section 194-H (agent/commission income — historical threshold ₹15,000, raised to ₹20,000 from Apr 2025; 20% rate when PAN is missing). There is **no PAN capture, no TDS computation, no 194H booking anywhere in code.**
- You claim "we do NOT hold funds" while offering a **pre-paid wallet + 30-day escrow float** — regulators may read that as a marketplace escrow/prepaid instrument; Razorpay Route exists for exactly this reason. Get a written opinion on whether Tier-2 wallets require PA/nodal escrow structuring.
- GST on the 5% fee and on founder subscriptions (18%) is not computed/invoiced anywhere.
**Fix:** PAN+KYC at first withdrawal (RazorpayX has KYC APIs), TDS ledger columns, GST invoices via Razorpay Invoices numbering, and a CA sign-off memo in the data room — *before* the ₹1Cr ask, not after.

**P-B7 — Projections are vibes.**
2,000 active warlords in Y1 with ₹0 budget and "LinkedIn influencers" GTM is not a plan, it's a hope. Affiliate networks follow a brutal power law (≈5% of affiliates drive ~90% of GMV — and those 5% already have partner programs everywhere). Your seed-deck should instead show: tiered assumptions (products/founder, GMV/product, % sellers active>30d), cohort retention loops, and a kill-switch metric ("if top-10 sellers produce <X% of GMV by month 6, reposition"). Note your own competitive table omits the actual nearest threats (Rewardful, FirstPromoter, Tolt, Push Lap Growth) — investors will know them.

**P-B8 — Trust asymmetry in the pitch.**
"Fraud bounty ₹2,500 paid from founder deposits" appears in the seller UI and status doc — but deposits are not collected (P-B2), so bounties come out of your pocket, uncapped, while `POST /api/fraud-reports` accepts unauthenticated submissions (§2.4) that any troll can farm.

### 1.3 Business verdict summary

Keep the model (it's genuinely differentiated for India). But:
1. **Do not spend a rupee of customer money or raise on this codebase until §2 P0 items are fixed** — the ledger is forgeable.
2. Fix the revenue collection path (§4) — today the model earns ₹0 even in the success case.
3. Re-write the two docs to match code reality before any diligence, and remove fabricated social proof.

---

# 2. 🔴 CRITICAL SECURITY FINDINGS (P0/P1)

These are the "go deep" results. Severity = exploitability × damage. **All are exploitable with only the public anon key + a free account.**

## P0-1. Any user can grant themselves unlimited money (profiles self-update)
**Where:** `supabase/schema.sql` → `create policy "Users can update own profile" on profiles for update using (auth.uid() = id);` (re-created identically in `security_hardening.sql`).
**What:** Postgres RLS is *row*-level — the policy gates *which row*, not *which columns*. There is no WITH CHECK restricting columns and no column-level REVOKE. Therefore any logged-in wallet, from devtools, can:
```js
supabase.from('profiles').update({
  role: 'founder',               // free role upgrade
  withdrawable_balance: 999999900, // "money"
  pending_balance: 0,
  wallet_balance: 999999900,
  security_deposit_paid: true,
  unbilled_amount: 0
})
```
…and then call `POST /api/sellers/withdraw` — the withdraw route checks `withdrawable_balance` with an admin client and executes a **real UPI payout from your RazorpayX balance** (`app/api/sellers/withdraw/route.ts`). The codebase itself half-knows this: `app/api/user/onboarding/route.ts` comments *"users cannot update their own profile columns directly"* and uses an admin client — while the RLS policy says otherwise.
**Attack cost:** one free account, one supabase-js call. **Damage:** direct theft of your payout float + full privilege escalation.
**Fix (do not implement now, per your instruction):**
- Split money/role columns into a separate table (e.g. `wallets`, `roles`) with **no** client UPDATE policy — server/service-role only, or
- Add a strict `WITH CHECK` using a comparison subquery trick, better: revoke column privileges (`REVOKE UPDATE (withdrawable_balance, pending_balance, total_earnings, role, wallet_balance, security_deposit_paid, unbilled_amount) ON profiles FROM authenticated`) and make ALL balance movement go through `SECURITY DEFINER` RPCs only.

## P0-2. Webhook secrets of *every active product* are publicly readable
**Where:** RLS policy `"Anyone can view active products" on products for select using (is_active = true)` + no column restriction.
**What:** Anyone (even *without* an account) can fetch `https://<project>.supabase.co/rest/v1/products?select=webhook_secret&is_active=eq.true` with the public anon key and collect **all HMAC secrets** for all active products. With a product's secret one can **forge conversion webhooks** (`/api/webhooks/conversion`, `/api/webhooks/razorpay/[id]`) with a self-owned `ref_id` → commissions credited to the attacker's seller balance → where `billing_status` ends up `'billed'` (Tier-2 path in `webhook-processor.ts` deducts the founder's wallet and marks billed), the T+30 cron moves it to withdrawable → **real payouts** funded by victims' wallet deposits. Even where it stays `unbilled`, it destroys ledger integrity and triggers real emails/notifications.
Note: the founder dashboard even displays the secret in the UI (`founder/page.tsx` webhook modal) and `POST /api/products` promises "shown once only" — both promise and practice contradict; but the *fatal* leak is the RLS column exposure, not the UI.
**Fix:** `products` needs column-scoped selaect — use a view (e.g. `public_products` selecting no `webhook_secret`) as the public surface and make the base table `founder_id`-only; rotate every existing product secret after deploying the fix; never send `webhook_secret` over client queries (serve masked, with a "reveal" server action for the owner only).

## P0-3. The balance RPCs are executable by any user
**Where:** `supabase/additional-schema.sql` grants `execute on function lock_commission_funds / release_cleared_funds / process_payout to authenticated`.
**What:** Even *without* P0-1, a user can call `supabase.rpc('lock_commission_funds', {p_seller_id: me, p_amount: 10_00_00_000})` to inflate `pending_balance`, then `release_cleared_funds` to move it to `withdrawable_balance`, then withdraw. These functions exist to be called by webhooks under the service role — the `authenticated` grants defeat the entire "Vault" design.
**Fix:** `REVOKE ... FROM authenticated; GRANT ... TO service_role` only; optionally harden with internal validation (amount must equal sum of unreleased transactions, etc.).

## P1-4. Fraud reports: no authentication, anyone can impersonate/read anyone
**Where:** `app/api/fraud-reports/route.ts` — POST takes `reporter_id` from the body with `createAdminClient()` and **never calls `getUser()`**; GET takes `?user_id=` with no auth.
**What:** a) submit reports as any user (and inject notifications into their account), b) enumerate any user's fraud reports (privacy leak), c) farm the ₹2,500 bounty queue spam. (The seller UI is wired to it — `seller/page.tsx` — so the endpoint is live.)
**Fix:** authenticate, set `reporter_id = user.id` server-side, scope GET to the session user, rate-limit, and gate bounties on admin approval records.

## P1-5. Logo upload: no auth, no ownership — vandalize any product
**Where:** `app/api/products/upload-logo/route.ts`.
**What:** no `getUser()`, no `founder_id === user.id` check; POST any product_id + base64 → overwrite its public logo. Phishing/defacement vector on your marketplace's public surface.
**Fix:** require auth + ownership, validate image magic bytes (not just declared content_type), dedupe paths.

## P1-6. `charges` table is world-writable
**Where:** `migrations/003_payment_system.sql`: `create policy "Service role can manage charges" for all using (true) with check (true);`
**What:** Policies with no role qualifier apply to **all** roles including `anon`. The billing ledger table is fully CRUD-able by the public. (That table is also abandoned — §4.1 — but while it exists its data is corruptible.)
**Fix:** drop that policy; server-only (no client policies at all), like `webhook_logs`.

## P1-7. Hardcoded admin email + admin payloads leak internals
**Where:** `app/api/admin/data/route.ts`, `app/api/admin/products/route.ts` — `ADMIN_EMAILS = ["aryansharma24112003@gmail.com"]` source-visible; admin/data returns `select('*')` of **all products (incl. webhook secrets) and all profiles (incl. wallet/bank fields)** down to the browser.
**Fix:** move admin identity to DB (`user_roles` table exists already in `security_hardening.sql`!), select explicit columns, log admin reads. Also note `admin/products` delete action **hard-deletes links and transactions** — destroying the financial ledger and any seller claims (see §4.9).

## P2-8. `timingSafeEqual` crashes on attacker-controlled signature lengths
**Where:** `app/api/webhooks/conversion/route.ts`, `app/api/webhooks/razorpay/[productId]/route.ts`, `app/api/webhooks/stripe/[productId]/route.ts`, all four `*/verify/route.ts` files.
**What:** `crypto.timingSafeEqual` throws `RangeError` if buffer lengths differ. A garbage 3-char "signature" → 500 instead of 401 (DoS-log-noise; leaks framework error behavior). Trivial fix: length-check before compare, or `==` on hex then timing-safe compare — recommendations only.

## P2-9. No rate limiting/abuse controls anywhere at the edge
Webhooks rely on HMAC (good) but all auth'd APIs (link generation, fraud reports, profile PATCH, orders creation) have zero throttling; Razorpay order creation endpoints can be spammed (`/api/founders/wallet`, `/api/products/feature`, `/api/founders/security-deposit`) → order-pollution + deposit row spam. Recommend Vercel/middleware-based per-IP throttles (e.g. Upstash Ratelimit) and per-user daily caps.

## P2-10. Missing platform-level payment reconciliation (money-in silence)
All "pay to credit X" flows (wallet top-up, security deposit, featured ₹4,999, upgrade) depend on the **browser calling the verify route** after checkout. Close the tab weak-network-mid-payment → money captured, nothing credited, no support trail. There is **no Razorpay account-level webhook** (e.g. `payment.captured` on your own key → reconcile `founder_deposits`/`featured_payments` by order_id). This is the #1 cause of real-world "I paid but nothing happened" tickets. **Fix:** one platform webhook on your own Razorpay/LemonSqueezy account that marks orders paid server-side and credits idempotently; verify routes become UX sugar only. (LS platform webhook exists — `webhooks/platform/lemonsqueezy/route.ts` — good pattern; Razorpay lacks the equivalent.)

---

# 3. 🧩 FOUNDER DASHBOARD — DEEP FUNCTIONAL AUDIT

Route: `app/dashboard/founder/page.tsx` (tabs: Overview, My Products, Sales Activity, Billing, Settings) + `new-product`, `edit-product/[id]`, `components/founder/setup-billing.tsx`.

## 3.1 THE headline finding: **the dashboard shows founders nothing**

In `FounderDashboard.fetchData()` the client queries `transactions … .in('product_id', productIds)` *using the caller's RLS context*. But the transactions table has exactly one SELECT policy: **"Sellers can view own transactions"** (`security_hardening.sql` even explicitly `DROP`s the earlier "Founders can view product transactions" policy and never re-creates it — I verified no other SQL file adds it).
**Consequence:** for a founder, every transaction query returns `[]`. Overview stats, MRR, Active Subscribers, Commission Paid, the 7-day chart, the live ticker, and the entire Sales Activity tab **are permanently zero/empty — by policy, for every founder, always.** The fetch also ignores the query error (`const { data: txData } = await …` — no `error` destructured), so it fails *silently*.
**Fix:** add the founder read policy — `create policy "Founders can view product transactions" on transactions for select using (product_id in (select id from products where founder_id = auth.uid()));` — plus error handling in `fetchData`, and pagination (currently it fetches **all transactions ever** into the browser; at 50k sales this kills the tab — add server-side aggregation Views/RPCs: `founder_stats(product_id...)`, and `.limit()` pages for Activity).

## 3.2 Overview tab (`OverviewTab`)

- **A. "MRR Generated" is not MRR.** It's `Σ sale_amount` of recurring transactions in the last 30 days — it includes refunded/chargebacked sales (no refund concept exists), it isn't normalized across billing intervals (yearly plans counted whole), and it never subtracts churn (`customers.status` has 'churned'/'cancelled' but the metric reads *transactions*, not customers). Call it "Recurring revenue (30d)" or compute true MRR from `customers` with status + plan price snapshots.
- **B. "Active Subscribers" overcounts — forever.** Unique `external_customer_id`s appearing in *any* recurring transaction — ignores `customers.status`, includes cancelled/churned, and dedupes only if the provider's ID is stable (for Razorpay you store `payEntity.email || customer_id || payEntity.id` — the fallback `payEntity.id` makes the same human a new "subscriber" on every payment; see §4.6 for the matching cancellation bug).
- **C. "Commission Paid" is commission *accrued*.** Sums `commission_amount` over all sale transactions including `pending` (not yet released) and `wallet_insufficient` (literally not paid to the seller) — it will overstate outflow. Filter/status-group by `billing_status`/`status`.
- **D. Webhook observability columns exist but are unused.** `products.last_webhook_at` and `webhook_logs` (with error rows) are never surfaced — so when a founder's integration breaks, the dashboard gives them no signal and no "Last event received: …" reassurance. Also note the logging writes currently **fail silently**: `razorpay/[productId]` inserts an `event_type` column that doesn't exist in `webhook_logs` (column is only in code) and the test route logs `status: 'test'` which violates the table CHECK (`status in ('success','failed','rejected')`) — both insert calls error out and are swallowed. Fix = align schema + build an "Integration health" card from these tables.
- **E. Chart** counts sales count/day for only 7 days (no ₹ axis toggle, no 30/90d ranges) — cosmetic but founders will read it as "my business is dead" when paired with 3.1.
- **F. The live ticker** duplicates `recentSales` three times (`[...recentSales, ...recentSales, ...recentSales]`) to fake the marquee length — harmless visually, but it's fabricated motion over what is (due to 3.1) an always-empty dataset.

## 3.3 My Products tab (`ProductsTab`)

- **A. "Delete" is a fake delete by string prefix.** It renames the product to `[DELETED] <name>` and the UI then filters by `name.startsWith('[DELETED]')`. Problems: links keep existing (clicks now 404 at `/ref/[slug]` since `is_active=false`), transactions keep referencing it (ledger ok but "deleted" products still visible in seller UIs querying active=false edge cases), name collisions if re-added, and it's a fragile UI contract. **Fix:** a real `deleted_at timestamptz` column / status enum, server-side cascade: deactivate links, stop webhooks (return 410), notify sellers with pending commissions.
- **B. Toggle Active/Delete go straight from the browser into Supabase** (`supabase.from('products').update(...)`) — no audit log, no validation, no "unpause requires wallet ≥ 0" check. The wallet-check cron auto-pauses broke founders' products, but the founder can instantly re-activate with an empty wallet (nothing re-checks) → sales with `wallet_insufficient` accrue → sellers never get that commission (§4.4). Route both actions through an API that enforces wallet/active invariants and writes an audit row. Also: nothing ever *auto-unpauses* after a wallet top-up — founders must notice and manually flip every product; either auto-reactivate on deposit or at least surface "why paused."
- **C. Featured (₹4,999/mo) is three half-features:**
  1. It's a one-off 30-day grant with **no renewal/subscription** — "per month" pricing with no recurring charge (revenue cliff + founders surprised when the star expires).
  2. `feature/verify` doesn't cross-check that the Razorpay order was created *for this product/user* (only by checkout-session linkage in memory) and doesn't verify amount server-side; order↔product/user binding should be re-read from your `featured_payments` row at verify time.
  3. Tab-close race (§2-10) applies here too.
  Also: **`is_featured`/`featured_until` are columns on `products`, which the founder can update directly per P0-1-style policy** ("Founders can update own products") → a founder can self-grant featured placement free — restrict those columns server-side (API-only) as part of the same fix.
- **D. Webhook modal is the riskiest UI in the product:**
  1. It **displays `webhook_secret` client-side**, fetched by the page's own select — the select list literally contains `webhook_secret` *under a comment claiming the opposite*: `// SECURITY: Only select non-sensitive fields - webhook_secret must NEVER be returned to client`. The comment is aspirational; the code violates it. (Fix = mask server-side; reveal-once for the owner via API.)
  2. **"Verify / Test" is theater** — `webhooks/test/[productId]`'s signature check compares an HMAC **to itself** (`timingSafeEqual(Buffer.from(expectedSig), Buffer.from(expectedSig))` → always true) and never sends a test event through the real pipeline; UI celebrates "Integration looks good!" for a check that cannot fail. Replace with a real synthetic event: create a test transaction row end-to-end (signed with the product secret, provider=`custom`, `test` flag) and confirm it lands — that's what founders think the button does.
  3. Only the **Razorpay URL** is shown — but the app supports 5 providers and `new-product` lets you pick any of 5; a Stripe/Gumroad founder copying this modal pastes the wrong endpoint. Emit the URL per the product's chosen provider (store the provider on the product at creation).
  4. Hardcodes `https://blackindex.in` (use `NEXT_PUBLIC_APP_URL`; breaks staging/preview).
  5. Gumroad/PayPal routes require `?secret=…` **in the URL**, but neither the modal nor `new-product` instructions include it → those two integrations 401 out of the box; and the PayPal setup text says listen for `PAYMENT.SALE.COMPLETED` while the code only processes `PAYMENT.CAPTURE.COMPLETED` → events accepted-and-skipped silently.

## 3.4 Sales Activity tab (`ActivityTab`)

- Shows at most `slice(0, 20)` of the (already empty under 3.1) full unbounded fetch — no pagination, no filters, no export (founders + their CAs will demand CSV for reconciliation/TDS).
- **Missing the two columns founders actually ask about:** which *product* produced the sale (no join to product name) and which *Warlord* referred the customer (`seller_id` exists but is never displayed — so founders can't identify top affiliates to build relationships with, the entire point of a *network*).
- No status column (pending/cleared/withheld(`wallet_insufficient`) invisible → founders think they've paid sellers when they haven't).
- Date grouping uses `toDateString()` — client-timezone day boundaries; harmless at MVP, wrong at scale (aggregate UTC `created_at::date` server-side).

## 3.5 Billing tab (`components/founder/setup-billing.tsx`)

- **A. "Tier 1: Connect Razorpay Route" is a stub** — button shows a "coming soon" toast. But `app/api/founders/billing/create-mandate/route.ts` (Razorpay subscription mandate) exists, fully implemented and **unreachable from any UI** — dead code path. Either ship the mandate flow button (and `GET` mandate-status into a billing status card: `hasMandate`, `unbilledAmount`, `billingThreshold` are already queryable) or remove the dead UI.
- **B. Security deposit — no UI exists.** Dead `isSubmittingDeposit` state; founders *cannot pay* the ₹5,000 anywhere, and nothing requires it. If deposits are core to your anti-fraud story (bounties "paid from deposits" — seller UI literally says that), wire: deposit pay button → on paid, unlock product creation (server-side check in `POST /api/products`… and in RLS since creation currently bypasses the API — §3.6-A), plus a refund/on-closure flow (deposit types table supports 'refund', no code path creates one).
- **C. Wallet tiers are FX-fuzzy.** Founder pays $120 via Lemon Squeezy but the ledger (and the wallet-display math) treats balance as INR paise with a hardcoded `USD_TO_INR = 84`. FX drift = silent creator of either free money or disputes. Store a currency per deposit row and credit the INR amount *actually settled* (from the LS/Razorpay webhook payload), not a forecasted conversion.
- **D. No billing history, invoices, or statements.** `founder_deposits`, `charges`/`charge_schedules` rows exist but have no UI. For a platform handling money movement + TDS, founders need a downloadable statement (also required for their books/GST).
- **E. `wallet_balance` display division:** `(walletBalance / 100)` assumes paise—ok—but the same component divides again for USD by `100 * 84`; after (C) this must render from stored currency amounts instead.

## 3.6 New Product flow (`dashboard/founder/new-product/page.tsx`)

- **A. Product creation bypasses your own API and your own business rules.** It inserts into `products` **directly from the browser** — so:
  - the `POST /api/products` role check ("founders only") is skipped; RLS only enforces `founder_id = auth.uid()`, so **any warlord can list products — the founder tier/paywall is meaningless**;
  - `security_deposit_paid` and mandate-setup aren't checked (§1 P-B2);
  - `commission_config` bounds aren't enforced (§1 P-B4);
  - the server-side 64-hex secret generation is bypassed by design: founders **must paste their own `webhook_secret`** (required field). For Razorpay that's fine (you set it in their dashboard), for Stripe it's a chicken-and-egg (Stripe issues `whsec_…` *after* you create the endpoint) — instructions don't explain this and will generate tickets. Offer "generate for me" (Razorpay/manual) vs "paste provider secret" (Stripe) per provider.
  **Fix:** route creation through the API (server validates role + deposit + bounds + generates/stores secret by provider), and lock RLS INSERT to match `role in ('founder','admin')` via the `user_roles`/profiles check.
- **B. `is_active: true` at creation** — products go live to all sellers instantly with no admin review. For a marketplace whose entire pitch is fraud control, there must be an `under_review → approved` moderation gate (admin UI exists and already toggles products).
- **C. Logo upload fires to an unauthenticated endpoint** (§2-5) *before* ownership could even be verified by the API.
- **D. Form data mashed into `description`** (`"Category: ai_saas\nPricing: …"` strings) even though `category` is a real column from migration 004 — use the column (the seller Vault UI filters need it).

## 3.7 Edit Product (`edit-product/[id]/page.tsx`)

- Same client-direct update pattern (no server validation, no audit).
- **Commission terms are silently mutable post-launch** — sellers get no notification and no grandfathering (reputational dynamite; see §1 P-B4 fix).
- Its own fetch list omits `webhook_secret` (good) — again proving the dashboard's main select shouldn't have it either.

## 3.8 Settings tab (`SettingsTab`)

- **The Save button is fake.** `handleSave` only shows "Saved Successfully" for 2s; **nothing calls `PATCH /api/profile`.** Founders editing Display Name/Username lose their edits silently. The seller dashboard *does* call the PATCH route — port that. (This is the kind of bug that generates "your product is broken" screenshots on Twitter.)
- No avatar upload, no password change pointer, no email change, no danger zone (account closure → deposit refund flow (§3.5-B)), no GST/PAN fields (required for §1 P-B6).
- Sidebar shows a hardcoded `Founder` badge regardless of actual `profile.role` (and `/dashboard/founder` itself has **no role gate** — any logged-in user can open it; which today doesn't matter, ironically, because of §3.1 it renders only zeros).

---

# 4. 💸 CORE MONEY ENGINE — THE DISCONNECTED PIPES

This is the "all functionalities" layer under the dashboard. The doc's "Metered Financial Engine" exists **three times, and none is connected end-to-end:**

## 4.1 The metered billing engine never charges anyone
- `lib/webhook-processor.ts` (used by **all five** provider webhooks: razorpay/stripe/gumroad/lemonsqueezy/paypal) marks Tier-1 transactions `billing_status='unbilled'` — but **never increments `profiles.unbilled_amount`**. Verify: there is no `unbilled_amount` update in that file.
- The billing cron (`app/api/cron/billing/route.ts`) Phase 1 selects founders `gt('unbilled_amount', 0)`. Result set: **empty, forever.** No charge is ever scheduled. **Founders are never charged a rupee** via the primary integration path. (Verified by grep: the only writers to `unbilled_amount` are the legacy `webhooks/conversion` route and the cron's own reset-to-0.)
- The legacy `/api/webhooks/conversion` route *does* increment `unbilled_amount` and schedules into a table literally named **`charges`** — but the cron reads a **different table `charge_schedules`** (`advanced_billing.sql`). Two tables, one executor reading the empty one.
- Column-name fork: cron reads `profiles.charge_threshold` (from `advanced_billing.sql`), while the mandate API and the conversion route use `profiles.billing_threshold` (from `003_payment_system.sql`). Whichever SQL didn't get run in prod yields a select error → cron/endpoint 500s.
**Fixes:** one ledger script — increment `unbilled_amount` atomically (RPC exists: `increment_unbilled`) **inside `webhook-processor.ts`** for Tier 1; drop one table; standardize on one threshold column; delete or unify the conversion route.

## 4.2 The escrow release deadlocks with it
The release cron (`cron/release-escrow`) only releases transactions with `billing_status='billed'`. Tier-1 txs stay `unbilled` (4.1) ⇒ **seller funds never unlock** ⇒ Warlords never get paid ⇒ the marketplace's core promise dies quietly in a month. The legacy conversion route doesn't even set `billing_status` (default `unbilled`) — same deadlock. **This is your "sellers riot on LinkedIn" scenario.**
**Fix:** define the invariant explicitly — seller escrow releases when (a) T+30 passed AND (b) founder-side settlement succeeded; implement (b) as either wallet-debit-committed (Tier 2) or charge-paid (Tier 1, post 4.1/4.3 fixes), and surface "settlement risk" to sellers *before* they promote.

## 4.3 The invoice flow records money that was never collected
Billing cron Phase 2, for founders *with* a `razorpay_customer_id`: creates a Razorpay **invoice**, then `status='paid'` with comment "Invoice sent, considered 'charged'", zeroes `unbilled_amount` and marks transactions `billed`. **Issuing an invoice does not debit a mandate.** Money is not collected; the books say it was; escrow then releases real payouts from your float. Also unhandled: the 24h notification window — sales accrued *after* scheduling but before execution are wiped by the blanket `unbilled_amount = 0` reset (collected twice/never, depending on order).
**Fixes:** (a) charge the mandate properly (Razorpay Subscriptions tokenized charge / `payments/create` with `recurring=true` + mandate token), or (b) fall back to invoice-as-payment-request but reconcile `invoice.paid` webhooks and only zero/settle on actual payment; reset the meter by the *amount actually settled* (`unbilled = unbilled - charge.amount`), never to zero blanket. TODO in code even admits: "Send notification email" — the RBI-required 24h pre-debit notice is literally a `console.log`; not sending it risks failed charges + compliance complaints.

## 4.4 `wallet_insufficient` purgatory
Tier 2, wallet shortfall (`webhook-processor.ts` step 7): transaction recorded, `billing_status='wallet_insufficient'`, **seller gets ₹0** for a sale that actually happened, founder dashboard *still counts* commission in "Commission Paid," and there is no re-credit retry after top-up. The daily wallet-cron pauses products only at `wallet ≤ 0` — partial-insufficiency products keep selling. **Fixes:** re-attempt on deposit (verify route → attempt settlement of flagged txs), pause immediately at first insufficiency (not at zero), warn at low balance (email exists — `walletLowEmail` — only sent after pause), and show the flagged count on the founder Billing tab.

## 4.5 Refunds/chargebacks: nothing
No provider refund events handled anywhere ⇒ sellers keep commissions on refunded/reversed sales; founders eat double losses; `transactions` has `type='refund'` in the CHECK constraint but no code path ever writes one. T+30 doesn't fully cover card chargeback windows (typically 120–180d) — so even a correct T+30 clawback would still leak; plan a *negative-balance* mechanism (clawback from future earnings; terms-of-service support).
**Fixes:** `charge.refunded` (Stripe), `payment.dispute.created`/`refund.processed`-style events (Razorpay), and per-provider equivalents → insert `type='refund'` tx + claw back from pending (or future) balances + notify founder; admin dashboard shows open disputes.

## 4.6 Razorpay churn tracking can't ever match
Processor keys `customers.external_customer_id` with `payEntity.email || subEntity?.customer_id`; the cancel handler (`razorpay/[productId]`, `subscription.cancelled/halted`) looks up by `subEntity.customer_id`. When the original row was stored by **email**, the cancel lookup finds nothing ⇒ cancelled subscriptions keep generating (and paying) recurring commissions. **Fix:** store both keys (separate columns or canonical `customers (product_id, provider_customer_id)` + email field), and resolve cancel by subscription_id primarily (payload has it; you can map it at first charge).

## 4.7 Stripe first-payment double commission
On a subscription's first payment Stripe emits **both** `invoice.paid` and `checkout.session.completed`. Code processes both with *different* idempotency keys (`invoice.id` vs `payment_intent`). Order-dependent outcome: `checkout.session.completed` arrives second → customer already exists → pays `recurring_pct` **on top of** the upfront already paid on the same money (double commission on month 1). **Fix:** for subscriptions, ignore `checkout.session.completed` (only subscribe to `invoice.paid`), or dedupe by `payment_intent`→`invoice.payment_intent` cross-map + subscription metadata carry-over (set `ref_id` once on the subscription, not per-session).

## 4.8 Idempotency-but-racy ledger
- `customers` lookup+insert is read-then-write: two concurrent first-charge events (retry) both see "new customer" → double upfront (the legacy route catches `23505`, the shared processor does **not**).
- `billing_count` increment is read-then-write → concurrent renewals miscount → early cutoff or overpay.
- tx idempotency relies on the `external_transaction_id` UNIQUE — good — but the insert's 23505 path isn't treated as success-with-existing-id (minor 500 noise under retries).
**Fix:** single SQL upsert (`insert … on conflict do update returning`) or RPC `record_conversion(...)` doing customer-upsert + count-increment + tx-insert in one transaction.

## 4.9 Ledger-destructive admin delete
`POST /api/admin/products` `delete` action runs `DELETE` on `links`, `transactions`, then the product — wiping the financial history and any seller claims (and `customers` cascade-delete via FK). Affiliate platforms must be append-only for money events. **Fix:** archive (`deleted_at`) + FK actions to `set null`; exports remain intact.

## 4.10 Payouts: no status webhooks, races, doc/code mismatch
- Min withdrawal: code `₹1,000` (`sellers/withdraw`), docs say `₹3,000` — pick one, change the other.
- No RazorpayX payout-status webhook consumer (`payout.processed/reversed/rejected`) ⇒ a bounced UPI payout never restores the balance; seller's money vanishes from their POV and your support DMs. Add the handler restoring `withdrawable_balance` on `reversed`/`rejected`.
- Failure race: payout created upstream but response lost → catch-path **restores balance while the payout exists** (double-spend). Make restore conditional on a confirmed-not-created state (query Razorpay by reference_id first — you already pass a deterministic-ish reference; make it fully deterministic and idempotent-key it).
- `process_payout` RPC exists (row-locked, good) — but also see P0-3: it's granted to `authenticated`.
- No `payout_requests` rows written (table + RLS exist unused) → no audit trail of *who requested what when*.
- RazorpayX contact created with `contact: ''` — collect phone at KYC step (also needed for TDS/KYC §1 P-B6).

## 4.11 Velocity limits: broken math & fail-open
`lib/velocity-limits.ts`:
- Compares `founderDayTotal` (a sum of **commission_amounts**) to the raw **sale** `amount`, then to `DAILY_FOUNDER_LIMIT = ₹50,000` — units mix apples with oranges; a healthy product doing ₹1.3L/day GMV at 40% trips the cap and **legit conversions get rejected on the success path**.
- Limits (₹10k/day/seller, ₹5k/hour/product) are below the intended scale of "viral" campaigns — the engine punishes exactly the event you market for (product-hunt spike).
- First query (`founderDailyTxns`) selects the platform's whole day's pending transactions and is *unused* — wasteful scan per webhook.
- `webhook_logs` is queried by `client_ip`, but the column is `ip_address` → that check never matches; and `velocity_logs` table isn't created in any SQL file; and the caller **swallows all velocity errors and proceeds** (`catch { continue }`).
**Fix:** decide fail-closed vs fail-open per check, store velocity hits (create the table), compute limits on the same units (₹ sale amount), make thresholds per-product configurable, and **alert-not-block** for spikes (queue review) instead of dropping revenue.

## 4.12 Schema drift (5 overlapping SQL files, order-dependent prod)
`charges` vs `charge_schedules`; `billing_threshold` vs `charge_threshold`; `charge_id` vs `charge_schedule_id` on transactions (both columns may exist); two duplicate escrow functions (`release_cleared_funds` vs `release_escrow`); `webhook_logs.event_type` absent but written; test-status 'test' violates CHECK; `billing_status` CHECK ('unbilled','scheduled','billed') from `advanced_billing.sql` would **reject `'wallet_insufficient'` if applied** (depends on file run order — i.e., prod and a fresh deploy behave differently). **Fix:** consolidate to numbered `supabase/migrations`, delete the four stray root-level SQL files, and generate `database.types.ts` from the DB (`supabase gen types`) instead of hand-maintaining.

---

# 5. 📋 PRIORITIZED FIX ROADMAP (prescriptions only)

### P0 — Before ANY real user touches this (days, solo)
1. `REVOKE` client write on money/role columns (or split wallets/roles tables); revoke `authenticated` EXECUTE on the three balance RPCs (§2 P0-1/3).
2. Remove public column exposure of `products.webhook_secret` (view-based public surface); **rotate all existing secrets** (§2 P0-2).
3. Authenticate + scope `fraud-reports` and `upload-logo`; fix `charges` policy (§2 P1-4/5/6).
4. Add founder SELECT policy on transactions (§3.1) so the dashboard shows data.
5. Wire `unbilled_amount` increments into the shared webhook processor; unify charges tables + threshold columns (§4.1).

### P1 — This month (business-critical)
6. Billing cron: real mandate charging or invoice `paid` webhook reconciliation; fix the reset-to-zero race (§4.3). Send the RBI 24h pre-debit notice for real (email/SMS), keeping `charge_schedules` audit.
7. Refund/chargeback handlers + negative-balance clawback policy (§4.5). Fix Stripe double-commission + Razorpay churn key mismatch + atomic conversion RPC (§4.6–4.8).
8. Platform-level Razorpay payment webhook for deposits/featured/wallet (§2-10); auto-unpause or visible "paused: wallet empty" states (§3.3-B, §4.4).
9. Founder dashboard correctness pass: mask secret, real test-webhook, per-provider URLs, role gate, real Settings save, product-name + seller columns + pagination in Activity, delete = `deleted_at`, commission-change notifications + bounds (§3.2–3.7).
10. Route product creation/toggles through APIs enforcing role + deposit + review gate (§3.6).
11. Admin: move role to DB, explicit column selects, archive-not-delete (§2-7, §4.9).

### P2 — Before the seed-ask (trust + compliance)
12. GST/TDS design: PAN capture at first withdrawal, TDS ledger, GST invoices, CA memo on wallet/escrow structure (§1 P-B6).
13. Real revenue observability: platform ledger + admin revenue dashboard (§1 P-B1).
14. Remove fake leaderboard & reconcile all doc-vs-code claims (§1 P-B2): enforce deposit, reconcile min-withdrawal ₹1,000 vs ₹3,000, pick one plan for the ₹499 fee vs "free promo" window (and time-box the promo in code if kept).
15. Rate limiting + webhook signature robustness (§2-8/9); payout status webhooks + deterministic references (§4.10).
16. Migration consolidation + generated types (§4.12); then wire `/docs/integration` to generated product/provider config.

---

# 6. ONE-PARAGRAPH ANSWER TO YOUR QUESTION

The model is real and fundable — performance-based SaaS distribution for India is a legitimate, validated wedge. But the current implementation is a security incident waiting to happen and, worse, structurally cannot collect revenue: the ledger is forgeable by any signed-up user (P0-1/2/3), the metered engine that is supposed to charge founders was never connected to the webhooks (§4.1), escrow release deadlocks on that same break (§4.2), and the money that *does* flow is funded out of your own payout float (§4.3, P-B3). Fix P0 before continuing to demo it as "live"; fix §4 before accepting one more founder; then the founder dashboard (§3) becomes the product's actual selling surface instead of a demo shell full of zeros, theater-buttons, and fake saves.

*— End of report. No code was modified.*
