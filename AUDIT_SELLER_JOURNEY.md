# 🔍 BLACK INDEX — SELLER JOURNEY STRESS-TRACE (Every mistake, in order)

**Audit date:** 2026-08-06 · **Scope:** The complete Warlord lifecycle: signup → tour → browse Vault → get link → promote → sale → escrow → withdrawal, plus every UI/API/table it touches.
**Rule followed:** No code was changed. This is diagnosis + prescriptions only.

---

# 0. TL;DR — The Verdict On The Seller's Journey

> **A seller can do everything right — sign up, get a link, drive a real paying customer — and end up with a fake success toast and ₹0.** The final step of the journey (withdrawing money) is the *only* part that matters, and it's simulated. Meanwhile every intermediate step has at least one defect, and three steps have security holes.

Journey health score, stage by stage:

| Stage | Status | One-line verdict |
|---|---|---|
| 1. Signup & auth | 🟡 Works, rough edges | Email verify flow OK; no KYC/phone/PAN captured anywhere |
| 2. Onboarding tour | 🔴 Broken | Completion flag column doesn't exist → API 500s → tour loops forever |
| 3. "Become a Seller" upgrade | 🟡 Works but mislabeled | Button sells "Become a Seller", actually upgrades you to Founder; founders then BANNED from withdrawing |
| 4. The Vault (browse products) | 🔴 Half-decorative | Category filters 100% dead; product detail modal half-empty; commission shown is correct |
| 5. Link generation | 🟢 Works | Races on click counter; `unique_visitors` dead; no link management (delete/rename) UI |
| 6. Buyer clicks `/ref/slug` | 🟢 Works | 307 redirect + ref_id param intact; click increment racy |
| 7. Attribution survives to checkout | 🟠 Fragile | Entirely depends on founder installing track.js correctly; invisible to the seller |
| 8. Sale → seller notified & credited | 🟡 Core works | Realtime feed + RPC credit work; in-app notification written but **invisible (no UI)**; email dead without RESEND key; header balances stale |
| 9. T+30 escrow release | 🔴 Half dead | Releases ONLY Tier-2 `billed` transactions; Tier-1 and legacy-route sales never unlock |
| 10. **Withdrawal** | 🔴 **THE TRAP** | Only mounted UI is a `setTimeout` simulator ("Simulate API call...") — the REAL API route is unmounted; founders permanently blocked; no payout status webhook; 3 contradictory payout promises in one product |
| 11. Analytics | 🟠 Decorative | Fake 4-week chart, duplicated metric, mislabeled averages, conversions capped at last-50 txns |
| 12. Settings | 🟢 The one honest tab | PATCH actually saves |

---

# 1. STAGE-BY-STAGE TRACE

## Stage 1 — Signup (`/signup`, `/login`, `auth-provider.tsx`)

**Flow:** email+password signup → Supabase auth → `handle_new_user` trigger creates `profiles` row (role `warlord`) → email verification → login → `/dashboard` → redirects everyone to `/dashboard/seller`.

✅ What works: trigger, verification email copy ("Check your inbox to verify"), middleware protects `/dashboard/*` with server-verified `getUser()` (correct — `getSession` would be spoofable), login redirects away when authed.

🔴/🟡 Mistakes:
- **S1.1** No profile data collected at signup beyond full name. No phone (needed by RazorpayX contact — currently sent as empty string `contact: ''`), no PAN (needed for TDS 194H on commissions), no UPI (needed for payout). First withdrawal will force a silent failure or a bare-bones RazorpayX "vendor" with wrong data. **Fix:** progressive KYC — require phone+PAN+UPI at first withdrawal attempt, before calling RazorpayX.
- **S1.2** `fetchProfile()` fallback on *any* failure returns `{ role: 'warlord' }` — masks real errors (RLS outage, table missing) as "you're a seller". Every role-dependent UI (sidebar swap, founder pages) can silently downgrade. **Fix:** return `null` + error state UI; never invent a role.
- **S1.3** `signUp` sets `emailRedirectTo: window.location.origin + '/dashboard'` — on email-confirm landing, middleware sends to `/dashboard` → `/dashboard/seller`. Fine — but if Supabase's allowed redirect URLs aren't updated per environment, confirmation 404s. Env checklist item.

## Stage 2 — Onboarding tour (`product-tour.tsx` + `/api/user/onboarding`)

🔴 **S2.1 — Tour never completes, forever.** On finish, the tour `POST`s `{tourType:'seller'}` to `/api/user/onboarding`, which updates `profiles.has_seen_seller_tour`. **That column exists in NO migration/schema file** (verified: zero occurrences of `has_seen` across all 8 SQL files). Postgres returns "column not found" → route 500 ("Database error") → flag never stored → `run={!has_seen_seller_tour}` stays true → **joyride replays on every dashboard visit, plus console errors**. Same for `has_seen_founder_tour` on the founder side.
**Fix:** migration adding both boolean columns (default false). One line each. Highest annoyance-to-effort ratio bug in the app.
- **S2.2** Tour step copy oversells: "projected monthly income... in real-time" (projections are a naive last-30d sum — see Stage 11), "hand-picked, high-converting products" (no review gate exists; anything is listed instantly).
- ✅ Step targets (`#tour-vault-tab`, `#tour-links-tab`, `#tour-become-founder`, `#tour-overview`) all exist. Targets are fine; persistence is what's broken.

## Stage 3 — "Become a Seller/Founder" (`become-seller-modal.tsx`, sidebar)

🟡 **S3.1 — The labels are inverted everywhere.** A logged-in WARLORD sees sidebar button **"Become a Seller"** → opens `BecomeSellerModal` titled "Become a Seller. Unlock the power to list your own products" → on click calls `/api/founders/upgrade` → role becomes **'founder'**. So: component name=seller, button=seller, ambition=founder, action=founder. The founder dashboard's twin button is correctly named ("Seller View"), which makes this one look like a find-replace accident. The tour step next to it targets `#tour-become-founder` with founder copy — the codebase disagrees with itself. Also the modal's feature list ("List unlimited products… Real-time sales dashboard") promises a dashboard whose Overview is all zeros due to the RLS bug (see founder report §3.1).
- **S3.2 — THE UPGRADE PERMANENTLY JAILS YOUR EARNINGS.** `POST /api/sellers/withdraw` hard-requires `role === 'warlord'` (`if (profileData.role !== 'warlord') return 403`). A seller who upgrades to founder keeps their links, keeps earning commissions — and can **never withdraw again**. No warning anywhere. **Fix:** allow both roles (withdrawal should key off `withdrawable_balance`, not role).
- **S3.3** "Free for 2026… Access ends Dec 31, 2026" — fear-of-missing-out copy every year? There's no expiry code; the promise is decorative. Also conflicts with the ₹499 fee in the business doc.
- **S3.4** After upgrade: `window.location.reload()` (crude but effective); `onSuccess` ignores failures to refresh `has_seen` states.

## Stage 4 — The Vault (`seller/page.tsx` VaultTab + `GET /api/products`)

🔴 **S4.1 — Category filters are 100% dead.** `VaultTab` filters on `(product as any).category`, but `GET /api/products`'s select list **does not include the `category` column** (verified) → every product reads `undefined → 'other'` → clicking "🤖 AI SaaS / B2B / DevTools / Marketing / Creator Tools" yields **empty grids**. Meanwhile new-product form stuffs category/pricing/tagline into the *description string* ("Category: ai_saas") instead of the real columns added by migration 004. Two build attempts that never met.
**Fix:** add `category` (and rename/repair data) to the products GET select; populate real columns on creation.
🔴 **S4.2 — Product detail modal is a skeleton.** It renders `selectedProduct.tagline`, `.pricing`, `.target_audience` — **none of these are columns or selected fields**; they're buried inside `description` text. So the modal's tagline/pricing/audience blocks never render. Sellers evaluate products blind.
- **S4.3** 🟠 Commission shown = only `upfront_pct` in the card; recurring % only in modal. No earnings estimate ("~₹X per sale"), no price point shown → sellers can't compute whether promotion is worth it. Your best affiliates decide on ₹/click; give them the math.
- **S4.4** `is_active` badge shows "Active/Inactive" but Vault only ever fetches active (`?active=true`) — dead code, harmless noise.
- **S4.5** Featured ordering: featured products are styled (gold glow) but not sorted first and the filter category "featured" just filters; `is_founders_choice` has a glow border identical-ish to featured → visual clutter reduces trust in the ⭐ you sell for ₹4,999.
- **S4.6** Two `useLinks()` instances (VaultTab + LinksTab + UnifiedDashboard) = duplicate link fetches/channels per page load; same for `useTransactions()` (once directly, once inside `useDashboardStats()`), plus each creates a Supabase realtime channel. Won't show until you have traffic, then it doubles connection counts (Supabase realtime concurrent-connection limits).

## Stage 5 — Link generation (`/api/links/generate`, `links` table)

🟢 Works: dedupe per (seller, product) returns existing link, slug uniqueness retry, GET returns joined product data.
Mistakes:
- **S5.1** 🟠 No rate limiting — contradicts your own fraud-prevention doc ("rate limiting on link generation"). Spam links cost little but pollute attribution + support.
- **S5.2** "Anyone can view any link" (RLS `using (true)`) — any user can enumerate other sellers' links, slugs, seller_ids, click counts. Needed for public redirect, but don't return `seller_id`/clicks publicly; move redirect lookup server-side (it already is: `ref/[slug]` uses admin client — so the public SELECT policy can go).
- **S5.3** No link management: can't delete/rename/see per-link conversions (policy exists for delete; no UI/API). Power sellers will demand sub-IDs/campaign tags ("?campaign=youtube") — the schema has no campaign column; plan it.
- **S5.4** Links are creatable against *any* active product regardless of seller eligibility — today fine, but Tier-2 vs Tier-1 sink risk (§Stage 9) means links should be markable "guaranteed payout" vs "at risk".

## Stage 6 — Click through `/ref/[slug]`

🟢 Core works: lookup → active check → 307 to founder URL + `?ref_id=<uuid>`.
Mistakes:
- **S6.1** Click increment is read-modify-write fire-and-forget (`clicks+1`) → **concurrent clicks lose counts** (10 simultaneous = +1). There IS an atomic `increment_clicks` RPC in `advanced_billing.sql` — unused. Use it (or `clicks = clicks + 1` raw SQL... via RPC).
- **S6.2** `unique_visitors` column: never written anywhere (verified). Dead metrics claim on every seller's mind per docs.
- **S6.3** No 404-page UX: bad slug / paused product returns raw JSON `{"error": ...}` in the browser. Sellers will share broken links after product pauses — a branded "this offer ended" page preserves seller trust (and their audience).
- **S6.4** No click fraud hygiene: bots/crawlers inflate clicks; since click counts drive seller-visible conversion rates, dirty data erodes trust. (Later-stage fix: user-agent filtering / count daily unique-ish via IP+UA hash.)

## Stage 7 — Attribution (founder's site)

🟠 Covered in the founder trace — from the SELLER's side the key failure is *opacity*: sellers have zero visibility into whether a founder's integration is healthy. Clicks happen, sales silently don't. **Fix (seller-facing):** expose per-product integration health in the Vault ("✅ Last sale tracked 2h ago" from `last_webhook_at`, "⚠️ Integration unverified"), and show seller-side "click → tracked sale" drop alerts. Otherwise your best Warlords quit when a broken founder integration makes them look unlucky.
Also: self-referral protection = exact-email match only; `a+1@gmail.com` sails past it, and the docs' promised cookie/IP checks don't exist.

## Stage 8 — The sale lands (webhook-processor → seller UI)

✅ What genuinely works and is <1s fast:
- `lock_commission_funds` RPC increments `pending_balance` + `total_earnings` atomically.
- `transactions` insert → Supabase realtime INSERT event → seller's dashboard list updates **live** (channel keyed to `seller_id` with RLS-backed filter; publication includes the table). The dopamine moment works — *when the product's integration works*.
- Email + notification row inserted.

🔴/🟡 Mistakes:
- **S8.1 — Notifications are written to a void.** `notifications` rows accumulate on every sale ("New sale: ₹X earned!") — **there is no notification UI anywhere** (no bell, no page; verified: no dashboard component references the table). Orphan feature. Users are promised notification-fed UX ("You will be notified") and get nothing.
- **S8.2 — Emails silently skip.** `sendEmail` (Resend) throws on missing `RESEND_API_KEY`; the processor `catch`es and continues. Your own `business_report_and_status.md` lists the key as still-not-configured. So the seller's "New sale!" email never exists until you fix envs — test before claiming.
- **S8.3 — Header balances are stale by design.** `PayoutPopover` shows `stats.withdrawableBalance` from the profile fetched **once at login**; realtime only patches the transactions list. A seller watches a sale arrive in the feed while "Withdraw ₹" stays frozen at the old number until manual reload. The "Live" pulse is therefore half-theater.
- **S8.4 — Stats caps:** `useTransactions` initial fetch `limit(50)` — "Conversions", "This Week", chart, subscriptions count are all computed from the last 50 rows only. Any working seller blows past 50 in a month and their public stats become lies (systematically undercounted).
- **S8.5** `billing_status='wallet_insufficient'` sales: the seller gets **no transaction, no notification, no compensation** — invisible theft-by-misconfiguration (even though the founder sold a real product). Seller trust dies here (see founder report §4.4). At minimum: insert the transaction with a withheld status + notify the seller "founder wallet insufficiency — under review", and auto-settle when the wallet refills.

## Stage 9 — T+30 escrow (`cron/release-escrow`)

🔴 Only transactions with `status='pending'` AND `billing_status='billed'` clear. Reality:
- Tier-1 (provider webhooks): `unbilled` forever → **never release**.
- Legacy `/api/webhooks/conversion`: sets no `billing_status` → default `unbilled` → **never release**.
- Refunds: not handled at all — so instead of "30 days to protect against refunds," the code gives "30 days during which nothing is checked, and cleared money is never reversed after."
**Fix:** (as founder's report §4.1–4.5) wallet-first single ledger so everything is `billed` at sale time; refund webhook handlers with clawback-from-pending (then from future earnings via negative balance).
Also note crons exist in `vercel.json` ✔️, but: `CRON_SECRET` must be set in Vercel env (your own status doc says pending) → currently every cron returns 401. If it's not set, escrow release is literally not running in production — verify now: `curl -H "Authorization: Bearer $CRON_SECRET" https://blackindex.in/api/cron/release-escrow`.

## Stage 10 — Withdrawal (the trap stage)

🔴 **S10.1 — The mounted UI is a simulator.** The dashboard header's "Withdraw funds" opens `PayoutPopover`, whose `handleWithdraw` is:
```ts
// Simulate API call for now until backend is wired
setTimeout(() => { ...; toast.success("Withdrawal request submitted! It will be reviewed and processed within 24-48 hours.") }, 1500)
```
No fetch, no API. The seller leaves believing money is coming Friday. **This is the worst dark pattern in the codebase** — worse than fake because it *thinks* it's temporary.
🔴 **S10.2 — The real API is unreachable.** `WithdrawFunds` correctly calls `GET/POST /api/sellers/withdraw`… and is imported **nowhere** (verified: zero usages of `WithdrawFunds` outside its own file). The real route is dead code behind an unmounted component. Wire it into a Payout tab/popover.
🔴 **S10.3 — Founders can never withdraw** (S3.2).
🔴 **S10.4 — Three contradictory payout promises:** PayoutPopover footer "processed every Friday", its toast "reviewed within 24–48 hours", WithdrawFunds "arrive within minutes (RazorpayX)". Pick one truth (instant via RazorpayX) and delete the other two.
🟠 **S10.5 — Min-withdrawal mismatch:** docs say ₹3,000 ("serious player threshold"), API+UI say ₹1,000.
🟠 **S10.6 — No payout status webhook** (RazorpayX `payout.processed/reversed/rejected`) → bounces never restore balances; plus the restore-on-failure race (payout created upstream, response lost → balance restored + real payout = double spend; fix with deterministic `reference_id` reconciliation).
🟠 **S10.7 — No `payout_requests` rows recorded** (table + RLS exist, unused) → zero audit trail for support disputes.
🟠 **S10.8 — Float dust:** client sends `parseFloat(amount) * 100` paise floats (₹1000.29 → rounding dust) into Razorpay (expects integer paise). Parse then `Math.round`.
🟠 **S10.9 — The payout-security killer (from the security audit):** until RLS/RPC grants are fixed, the withdraw route's `withdrawable_balance` check is against a number the user can edit from their own browser. Withdrawal must verify `withdrawable_balance == Σ cleared txns − Σ payouts` before paying, payout-Webhook reconciled.

## Stage 11 — Analytics tab

🟠 Mostly decorative:
- **S11.1** "Monthly Performance" chart: hardcoded `Week 1-3 = 0` + Week 4 = only this-week earnings. Admitted in a code comment. Sellers screenshot this.
- **S11.2** "Click Rate" stat duplicates the Conversion value (same variable) — wrong metric; there's no click rate metric (clicks/day?) — just remove one.
- **S11.3** "Avg. Order" = `totalEarnings / conversions` — that's **average commission per sale**, not order value (which would need `Σ sale_amount / count`).
- **S11.4** All changes ("+0.0%") hardcoded zeros; "Revenue" = totalEarnings (commission, mislabeled as revenue).
- **S11.5** Conversions/conversionRate suffer the 50-row cap (S8.4) and `useDashboardStats` counts payouts? No — filters type==='sale' ✓. Fine otherwise.
✅ Top-products-by-clicks panel works from real link data (modulo S6.1/S6.2 click-data quality).

## Stage 12 — Seller Settings

🟢 Actually saves via `PATCH /api/profile` (whitelisted full_name/username — good pattern, use same approach server-side elsewhere).
- **S12.1** "Role" shows "Warlord (Seller)" unless founder — after S3.1's confusion this confirms a founding user sees… "Founder". OK once S3.1 fixed.
- **S12.2** No payout identity fields (UPI/phone/PAN avatar/email-change) — see S1.1 KYC plan. No delete-account / data-export (DPDP Act expectation).

---

# 2. CROSS-CUTTING SECURITY NOTES RE-EXPOSED BY THIS TRACE

1. **P0 (repeat from security audit):** profile self-update lets a seller set `withdrawable_balance` & withdraw; balance RPCs executable by `authenticated`. The seller journey ends at a withdraw API that trusts an editable number. *Fix these first — they invalidate every other effort.*
2. `links` public read leaks all sellers' performance (S5.2); `fraud-reports` unauthenticated (seller submits via user-supplied `reporter_id`); product logo rewritable by anyone.
3. Realtime channel per hook instance × duplicated hooks → connection exhaustion under load (S4.6).
4. The fraud-bounty promise ("₹2,500 from founder deposits") is unfundable: deposits aren't collectable/checked anywhere in the flow.

---

# 3. THE MINIMUM SELLER-SIDE PATCH ORDER (prescriptions only)

1. **P0 day 1:** mount the real `WithdrawFunds` (or rebuild PayoutPopover to call the API); delete the simulator toast; single payout promise copy. Until then the product is a fiction to sellers.
2. **P0 week 1:** RLS money-column lockdown + RPC grants (security audit P0-1/2/3).
3. Migration: `has_seen_seller_tour`, `has_seen_founder_tour` columns (kills infinite tour loop).
4. Allow withdrawal for `role IN ('warlord','founder')`.
5. Founder-transaction RLS policy (seller stats depend on founders seeing truth too).
6. Wallet-first (Tier-2-only) settlement so escrow always releases at T+30 (see founder report §4 for the design); re-credit path for `wallet_insufficient` + seller notification of withheld sales.
7. Add `category` to products GET + write real columns on create; finish Vault modal data; remove dead filters until real.
8. Notification bell + page (reads `notifications`); mark-read on open; toast on realtime insert.
9. RazorpayX payout-status webhook + deterministic reference ids; payout_requests audit rows; reconcile bounced payouts.
10. Live-refresh profile balances on realtime INSERT (or drop the "Live" pulse); raise/remove the 50-transaction cap with pagination; use a single shared hook instance (React context) for links/transactions.
11. Atomic click increment (use `increment_clicks` RPC); 404 branded page for dead slugs; link management UI.
12. Remove/define: ADV copy conflicts (₹3,000 vs ₹1,000), fake weekly chart, mislabeled analytics, "Become a Seller" label vs founder action, contradictory claim list in the two business docs.

---

# 4. WHAT "GOOD" LOOKS LIKE AFTER THIS (the trustworthy Warlord journey)

Sign up (phone+UPI later at first withdrawal) → tour that completes → curated Vault where every product shows price, commission ₹-value, integration health ("last sale tracked 12m ago") and a 🛡 Guaranteed badge (= pre-funded wallet) → one-click link → honest click tracking → **buyer pays → seller's dashboard ticks in realtime, notification bell rings, email lands** → T+30 badge countdown on every transaction → Day 30: automatic move to withdrawable + email → seller hits Withdraw → **real RazorpayX payout in minutes** with a status timeline (requested → processed, or reversed+restored) → analytics that compute from ALL their data with per-link and per-product truth.

That journey sells itself. The current one sells a toast.

*— End of seller trace. No code was modified.*
