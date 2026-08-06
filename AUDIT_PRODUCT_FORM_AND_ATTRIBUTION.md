# AUDIT 4 — Product Onboarding Form + "Will Sales Actually Land?" Cross-Check

**Date:** 2026-08-06 · **Scope:** `app/dashboard/founder/new-product/page.tsx` (full read), `edit-product/[id]/page.tsx`, `app/api/products/route.ts`, `lib/webhook-processor.ts` (full read), `app/api/webhooks/*/[productId]/route.ts` (all 5), `public/track.js` (full read), `app/ref/[slug]/route.ts`, `app/api/links/generate/route.ts`, SQL constraints.

This answers your four points with fresh line-level evidence. IDs cross-reference MASTER_GRAVEYARD (SEC/MNY/FND/SELL/CPY); new items discovered in this pass are tagged **FRM-*** (form) and **ATTR-*** (attribution).

---

## 0. Your 4 reasons the idea works — verified against reality

| Your reason | True in code? | Note |
|---|---|---|
| 1. Recurring revenue | ✅ Structurally yes — `billing_count` + `max_recurring_months` enforced in `webhook-processor.ts` Step 5 | Works only when renewals attribute correctly (see §5 — for Razorpay renewals that needs **server-side notes**; for Lemon Squeezy renewals it's **completely unhandled**) |
| 2. Two-sided marketplace | ✅ Data model supports it | But **sellers currently see a fake withdraw button** (SELL-1) and **founders see permanent zeros** (FND-1) — both sides look broken on arrival |
| 3. Kill creator hustle | ✅ The Vault list exists | Category filter is dead because the onboarding form **never writes the category column** (FRM-2) — the exact feature your pitch depends on |
| 4. No earning cap for normal people | ✅ **Correct — no cap per seller.** Unlimited products, unlimited sales, % of every sale | Two things that look like caps but aren't: (a) recurring commission stops at `max_recurring_months` (default 12) **per customer**, set by the founder; (b) T+30 escrow is a delay, not a cap |

**Verdict: the idea survives the audit. It's the wiring that doesn't (yet).**

---

## 1. Tier decision (wallet-only, Auto-Split = "Coming Soon") — ✅ APPROVED, with a numbering correction

**Your intent is right and — good news — the code already behaves that way.** The tier check is not a setting anyone chooses; it's inferred at sale time (`lib/webhook-processor.ts` ~L295):

```ts
const isTier2 = typedFounder && !typedFounder.stripe_connect_id && !typedFounder.razorpay_account_id
```

= **founder with no connected payout account → prepaid-wallet founder → wallet deducted, `billing_status='billed'` → escrow releases at T+30.** Since there is no working UI to connect Stripe/Razorpay Route (`setup-billing.tsx` "Connect" is a toast stub), every founder alive today is already a wallet founder.

⚠️ **Numbering correction:** in the CODE the tiers are the opposite of what you wrote — `components/founder/setup-billing.tsx` L148–175 says **"Tier 1: Auto-Split"** (the Routes/Connect mechanism) and **"Tier 2: Pre-Paid Wallet"**; the wallet-check cron repeats "Tier 2 = wallet". So "keep wallet, mark the other one not-available" means, in code-speak: **keep Tier 2 live, mark Tier 1 Coming Soon.** Recommend killing "Tier 1/Tier 2" language in UI entirely and using **"Prepaid Wallet (default)" / "Auto-Split at Checkout (Coming soon)"** — nobody outside this repo will ever understand the numbering.

**Exact gating map (no money-logic changes needed):**

| # | Place | Current state | Action for your decision |
|---|---|---|---|
| 1 | `components/founder/setup-billing.tsx` L148–170 (Tier 1 card) | Card looks live; button = toast stub | Disable + "Coming soon" badge |
| 2 | `components/sections/how-it-works.tsx` | "auto-splits at checkout" marketing card | Rewrite to wallet story or badge (CPY-3) |
| 3 | `app/protocol/page.tsx` L327–350 "Integration Tiers" table | Both tiers presented as live | Tier 1 → "Coming soon" |
| 4 | Founder dashboard setup checklist / `SetupBilling` | Pushes "Connect Razorpay Route" | Push wallet top-up instead |
| 5 | **SEC-1 (CRITICAL multiplier)** | `profiles` self-update RLS lets any user set their own `stripe_connect_id='x'` | Fixing SEC-1 is what *enforces* your wallet-only decision — otherwise anyone can self-promote to "Auto-Split", their products are never charged, sellers' escrow never releases, and the marketplace silently burns trust |

Also: `settlement_mode` ('escrow'|'webhook') is written by the form (`new-product/page.tsx` L120) but **read by nothing** — don't build logic on it.

**One wallet-model gap to close regardless:** the dead zone `0 < wallet < commission` → sale records as `wallet_insufficient` → seller earns ₹0, founder not charged, **nobody is notified** (MNY-8). Wallet-check cron only pauses at exactly zero. Fix: low-balance warning email (₹2,000 threshold), auto-pause when balance < configured commission of an average sale, and a `retry` on wallet top-up.

---

## 2. Commissions: who sets them, and can they be 15–100%?

**Correction of terminology:** commissions are set by the **founder** (per product, at onboarding + editable later). Sellers choose which products to promote. That's the right design — keep it.

**Current reality — verified: there are NO bounds anywhere. Not in the form, not in the API, not in the DB.**

| Layer | File | What it does today |
|---|---|---|
| Form | `new-product/page.tsx` L96–100 | `parseInt(upfrontPct) \|\| 30` — typing **0 becomes 30**; typing **999 passes**; negative accepted; recurring `0` passes |
| API | `app/api/products/route.ts` L113–118 | Only checks presence: `!commission_config.upfront_pct` — this accidentally **rejects a legit 0%** but **accepts 900%** |
| Dashboard create path | `new-product/page.tsx` L111 | Bypasses the API entirely (browser-direct INSERT) — so even the API's weak checks don't apply |
| DB | all 8 SQL files | `commission_config` is JSONB with **zero CHECK constraints** |

**So yes — a founder can dare 100%. They can also accidentally set 900% or −50%.**

**The 100% trap you need to decide on (fee-truth):** platform fee is `Math.floor(commission*5/100)` deducted **from the seller's side** (`commission_amount = net`, webhook-processor L270–272). So a "100% commission" campaign actually pays the seller 95% while the founder is charged 100% — and the 5% is booked nowhere (MNY-11: it vanishes from the founder's wallet without ever reaching a platform ledger). If you want to market *"we will give 100% on BlackIndex"*, move the fee to the founder side (founder pays gross+5%, seller receives exactly 100%) or keep seller-side and forbid "100%" marketing copy. Pick one; both can't be true.

**Recommended bounds (validate in form AND API AND a DB CHECK on the jsonb):**

| Field | Bound | Why |
|---|---|---|
| `upfront_pct` | **5–100** | <5% = sellers ignore you; >100% = founder pays people to buy (fraud magnet) |
| `recurring_pct` | **0–100**, and warn if recurring > upfront | Perpetual 60%+ payouts destroy founder unit economics |
| `max_recurring_months` | **1–36** | 12 default stays; 0/negative currently silently becomes 12 |
| `max_cac_limit` | optional, ₹10–₹1,00,000 | Form already converts ₹→paise correctly (×100, L118) |
| Confirm modal at upfront ≥ 50% | "🔥 aggressive — you're giving up half your revenue" | Protect founders from themselves |

**Versioning gap (new finding FRM-7):** `edit-product/[id]/page.tsx` lets founders change commission anytime, instantly, silently — sellers who promoted at 40% wake up earning 15% (bait-and-switch = marketplace-trust killer). Fix: snapshot `commission_config` onto the **link** at generation time (or at least onto the transaction at click time is enough — today it's read live from product at sale time) and notify affected sellers on change.

---

## 3. Product onboarding form — field-by-field verdict

Source: `app/dashboard/founder/new-product/page.tsx` (2-step wizard) + sibling `edit-product/[id]/page.tsx`.

### 3.1 Fields that exist today

| # | Field (form label) | Verdict | Evidence & fix |
|---|---|---|---|
| 1 | **Product Name** * | 🟢 Keep | No trim/length validation — add max 60 chars |
| 2 | **Product Logo** (2MB client-side) | 🟡 Keep, harden | Client-only size check; **upload endpoint `/api/products/upload-logo` requires NO auth and NO ownership** (SEC-6) — server-side type/size/ownership enforcement needed. Today any stranger can overwrite any product's logo |
| 3 | **Website URL** * | 🟠 Keep, broken validation | No URL validation at all — any string accepted ("hello"). This URL is the redirect target of every seller's link (`app/ref/[slug]/route.ts` L65–86 — it does add `https://` if missing, small mercy). Fix: `new URL()` parse, https-only, optional reachability ping |
| 4 | **Description** * | 🟠 Keep, bug | Marked required (`*`) but the submit button doesn't check it: `disabled={!name \|\| !websiteUrl \|\| !providedWebhookSecret}` (L~353) — **FRM-1**. Pick: enforce, or drop the asterisk |
| 5 | **Tagline** | 🟠 Keep, but needs a column | No `tagline` column exists. It's squashed into the description string (`extendedDesc`, L102–108) → product modals can never render it properly |
| 6 | **Category** (5 options) | 🔴 Keep, currently writes to the void | **FRM-2 — the column `products.category` EXISTS** (004_saas_pivot.sql L26, with CHECK `b2b/ai_saas/devtools/marketing/creator_tools/other`) **but the form never writes it** — it stuffs `Category: x` into the description text instead. Direct consequence: **GET /api/products doesn't select `category` → Vault category filters are 100% dead** (SELL-6) → your pitch #3 ("pick a product aligned with your niche") is non-functional. One-line insert fix + add 'other' option. Highest-value-per-character fix in the whole repo |
| 7 | **Pricing Info** (free text) | 🟠 Rename + retype | Free text ("₹999/month or 🦆 anything") squashed into description. Make it a **structured numeric `price_inr`** field → then seller cards can auto-compute **"You earn ₹X per sale"** — the single most persuasive number in the Vault |
| 8 | **Webhook Signing Secret** * | 🔴🔴 **This field is the biggest problem in the form — redesign, don't keep** | See 3.2 below |
| 9 | **Target Audience** | 🟡 Keep | Same squash-into-description problem; useful for sellers — makes product modal honest. Low priority |
| 10 | **Upfront %** (default 30) | 🟡 Keep + bounds (§2) | `parseInt \|\| 30` silently rewrites 0 → 30 (FRM-3) |
| 11 | **Recurring %** (default 15) | 🟡 Keep + bounds | Default 15% fine |
| 12 | **Max Recurring Months** (default 12) | 🟢 Keep | Add bounds 1–36 |
| 13 | **Max CAC ₹** (optional) | 🟢 Keep | Correctly converted to paise. Enforced at sale time (webhook-processor L268) ✅ |
| — | `settlement_mode: "webhook"` (hardcoded, hidden) | 🔴 Remove | Written at L120, read by nothing. Dead weight |
| — | `type: "hybrid"` (hardcoded, hidden) | 🟠 Surface it | Every product is forced "hybrid" even one-time products — see missing field #1 below |

### 3.2 The Webhook Secret field — inverted, paradoxical, and dangerous (FRM-4)

What the form does: asks the founder to **invent and paste a secret at Step 1** ("Paste your Stripe/Razorpay webhook secret here"), stores it on the product, then Step 2 says *"You configured this secret during product creation. Use it in your provider dashboard."* The copy contradicts itself (paste from provider → vs → create it here and give it to provider). Three concrete failures:

1. **Razorpay: works by accident.** Razorpay lets you set any secret string on the webhook, so "invent here, paste there" functions — but nothing tells the founder the two strings must be identical, and there is no verification step. Mismatch = every webhook 401s forever, and the founder has **no health indicator** to notice (webhook_logs inserts currently fail on the missing `event_type` column — FND-9 — so even the debugging trail is broken).
2. **Stripe: temporally impossible.** Stripe **generates** the signing secret (`whsec_…`) when you create the endpoint — but the endpoint needs the BlackIndex URL, which contains the product ID, which doesn't exist until the product is created. The founder literally cannot know the secret at form time. Correct Stripe flow = create product → get URL → create endpoint in Stripe → come back and paste `whsec_…` → but `edit-product/[id]/page.tsx` has **no secret field at all** (its state list L27–34 has no `webhook_secret`; L42 even comments that the secret must never be returned — true for reads, but there must be a write/rotate path).
3. **Security: user-chosen secrets + public column.** Founders will type `123456`. And `products.webhook_secret` is publicly readable via the "anyone can view active products" SELECT policy (**SEC-2**) — so HMAC verification today protects against nothing; anyone can forge perfect signatures for any product.

**Redesign prescription:** BlackIndex **generates** the secret server-side (`POST /api/products` already does exactly this — `crypto.randomBytes(32)`, L123 — the form bypasses it). Step 1: no secret input at all. Step 2: show generated secret once with copy button + per-provider instructions. Add "Rotate secret" to edit-product (write-only). For Stripe add the explicit two-phase step ("create endpoint first, then paste whsec_ here"). Then fix SEC-2 so secrets leave the public read path.

### 3.3 Missing fields you should ADD (ranked)

1. 🔴 **"How does billing work?" — one-time vs subscription.** Everything is hardcoded `type:"hybrid"`. A one-time Gumroad ebook shouldn't carry a recurring %. This single select also drives which provider events matter (and prevents the Stripe double-fire class of bug in instructions).
2. 🔴 **"Install tracking on your site" — Step 3 of the wizard (doesn't exist anywhere).** The single most important integration step — `<script src="https://blackindex.in/track.js" data-product="ID"></script>` + "if you use Razorpay **Subscriptions**, you must also pass `ref_id` into the subscription notes server-side on month 0" — is absent from onboarding entirely. Without it the webhook receives money events but cannot attribute them (§5, Domino 3). Onboarding currently ends at webhook URL setup and declares victory two dominoes early.
3. 🟠 **Structured price (`price_inr`, number)** — powers "earn ₹X per sale" for sellers.
4. 🟠 **Free-trial length (days)** — so ₹0 trial events/subscription.activated noise is expected, not alarming; also prevents sellers thinking a trial signup = sale.
5. 🟠 **Legal checkbox** — "I own this product / am authorized to run affiliate payouts for it; I agree to pre-fund commissions and to the refund policy." Cheap, saves you later.
6. 🟡 **Refund policy selector** (founder eats clawbacks vs shared) — you have zero refund code anywhere (MNY-6); at minimum record the intent now.
7. 🟡 **Country/currency** — needed the moment you go global (today everything silently assumes INR/paise; `USD_TO_INR=84` hardcoded in `setup-billing.tsx`).
8. 🟡 (P2) Seller resources: swipe copy, creatives, guidelines — marketplaces live or die on this.

**Remove list:** the user-supplied webhook-secret input (replace with generated), the hidden `settlement_mode` write, the "required" asterisk on Description (or enforce it). Nothing else needs removal — the form is actually decent; two of its fields just write to nowhere and one field breaks security.

**New-product form defects log (new this pass):** FRM-1 description-star not enforced · FRM-2 category never written to its column (kills Vault filters) · FRM-3 `parseInt||default` silent rewrites (0→30, 0→12) · FRM-4 user-supplied secret (inverted flow, Stripe-paradox, weak secrets, publicly readable) · FRM-5 hidden dead writes (`settlement_mode`, `type:"hybrid"`) · FRM-6 no track.js/network-install step in wizard · FRM-7 commission edits apply instantly & silently (no snapshot/notify) · FRM-8 (edit-product) no secret rotation field, no bounds either.

---

## 4. THE MAIN QUESTION — will a purchase on the founder's site trigger the webhook and update Black Index?

**Short answer: The webhook fires for EVERY payment on the founder's account — even organic ones with no seller involved. ✅ That part works. But between "webhook fired" and "seller's balance increased" there are 8 dominoes, and today 4 of them are broken by design or by bug. In the freshly-onboarded state (no track.js instruction, no secret verification), the most likely real-world outcome is: clicks count, money moves at Razorpay, and nothing updates on Black Index — silently.**

### The 8 dominoes (fresh end-to-end trace)

| # | Domino | File | Status |
|---|---|---|---|
| 1 | Buyer clicks seller's link `blackindex.in/ref/{slug}` → lookup → clicks++ → 307 to `website_url?ref_id={link.id}` | `app/ref/[slug]/route.ts` L36–90 | ✅ **Works.** Clicks increment is read-modify-write (lost updates under parallel clicks — minor) |
| 2 | On the founder's site, `?ref_id` must be captured & persisted | `public/track.js` L34–45 (URL) → L41–54 (localStorage `bi_ref_id`, 30d) | ⚠️ **Only if track.js is installed** — and onboarding never tells anyone to install it (FRM-6). No track.js = ref_id evaporates on landing |
| 3 | At checkout, ref_id must ride *into the payment object* | `track.js` L140–151 auto-injects `options.notes.ref_id` for client-side Razorpay Standard Checkout; L92–100 sets Stripe `clientReferenceId` (only for legacy `redirectToCheckout` + lineItems); L162–177 hides a `ref_id` input in every form (works only if the founder's backend forwards it); Gumroad: link-param rewrite only (unverified echo in ping) | 🔴 **The weakest link.** Server-side checkouts, Payment Links, app-store billing, and **Razorpay Subscriptions** (renewal attribution needs `subscription.notes.ref_id` set by the founder's server on month 0 — track.js physically cannot do that) all attribute **nothing** unless the founder wires it manually — and the docs' sample reads `req.cookies.ref_id`, a cookie track.js never sets (DOC-4; it uses localStorage first) |
| 4 | Provider fires webhook → `POST /api/webhooks/{provider}/{productId}` → HMAC against `products.webhook_secret` | razorpay route L37–66 | ⚠️ Works **iff** the secret in the provider dashboard == secret in DB. Onboarding never verifies this pairing and uses founder-typed secrets (FRM-4). Mismatch = 401 forever, zero visibility. Also `timingSafeEqual` 500-crashes on wrong-length signatures instead of 401 (SEC-8) |
| 5 | Extract ref_id from payload | razorpay L88–91 & L116–124 (checks subscription.notes → payment.notes → order.notes → description regex — genuinely thorough ✅) | 🔴 If missing: returns **HTTP 400** (L141–158). Non-2xx makes Razorpay **retry**, and repeated failures get your endpoint **auto-disabled** in the Razorpay dashboard → **one organic sale can kill all future tracking for that product** (ATTR-1). Note the route already knows the right pattern — for `processConversion` failures it deliberately returns 200 "to prevent Razorpay from retrying" (L173–179) — it just doesn't apply it here. Fix: return 200 + `status:'skipped_no_ref'` + fire a founder-facing "unattributed sale" notification (that notification is actually a recruiting asset: "₹4k sold with no seller — want that?") |
| 6 | `processConversion` gates: product active → link exists & matches product → not self-referral → velocity limits | `webhook-processor.ts` L53–145 | ✅ Sound. (Velocity limits themselves are unit-mixed/fail-open/kill-good-days — MNY-10 — but they rarely block) |
| 7 | New-vs-recurring + commission math | L186–246: customers keyed by `(product_id, external_customer_id)`; for Razorpay **`externalCustomerId = payEntity.email`** (L95) | ⚠️ Email-keyed identity = fragile recurrence (alias/change ⇒ fresh upfront commission; also the `subscription.cancelled` handler matches on `customer_id` which was never stored ⇒ cancelled subs keep earning — MNY-9). Math otherwise correct incl. CAC cap. **5% fee is booked nowhere** (MNY-11) |
| 8 | Money lands: wallet founder → `wallet_balance -= commission`, `billing_status='billed'` → seller `pending_balance += net` (escrow) → T+30 release cron (requires exactly `billing_status='billed'`) | L281–380 + `cron/release-escrow` | ⚠️ **Works while the wallet is funded.** Dead zone: balance < commission ⇒ `wallet_insufficient` ⇒ seller silently earns ₹0, product stays listed, no notification, no retry, and the product only auto-pauses when the wallet hits **exactly ₹0** (MNY-8). Escrow release itself works for the wallet path ✅ |

### Provider truth table — "if a founder follows your onboarding instructions exactly, what happens?"

| Provider | Events the onboarding (new-product Step 2) tells them to enable | What the code handles | Following your own docs, a sale results in… |
|---|---|---|---|
| Razorpay | `subscription.charged` + `payment.captured` ✅ | both correctly, plus `order.paid`, cancel/halted | ✅ One commission per payment — **the one provider where your instructions and code agree**. Renewals attribute only if month-0 subscription notes carried ref_id (Domino 3) |
| Stripe | `checkout.session.completed` **and** `invoice.paid` | both, **plus `payment_intent.succeeded`** | 🔴🔴 **DOUBLE-OR-TRIPLE COMMISSION ON EVERY PAYMENT.** All three events fire per subscription charge; each uses a different `external_transaction_id` (session/payment_intent id vs invoice id) so idempotency passes for each (stripe route L106–128). Your onboarding doc makes every Stripe founder auto-double-pay their affiliates and drain their wallet twice as fast (extends MNY-2). Fix: handle `invoice.paid` (+ `customer.subscription.deleted`) only for subs, `payment_intent.succeeded`-only for one-time, and rewrite the instruction card |
| Lemon Squeezy | `order_created` | `order_created` **only** | 🔴 First sale counts, **every renewal is silently ignored** (no `subscription_payment_success` handler — MNY-12). For a SaaS-recurring platform this is a lie of omission; LS products are effectively one-time |
| Gumroad | "paste the URL, pings on every sale" | ping handled, no event field | ⚠️ One-time sales work if ref_id survives the ping (track.js link-rewrite echo — **unverified, test before launch**; also Gumroad pings can't HMAC a per-product secret ⇒ the `?secret=` fallback exists in code but the onboarding never mentions it — DOC-3) |
| PayPal | `PAYMENT.SALE.COMPLETED` | **`PAYMENT.CAPTURE.COMPLETED` only** | 🔴 **NOTHING. EVER.** Event-name mismatch (confirmed again at new-product L~452 vs paypal route) → every PayPal webhook hits the `else` branch → "Event ignored" (FND-8/DOC-3). One-word fix in the instruction card, or accept both events in code |

### The definitive answer, in one breath

> **Razorpay + track.js installed + client-side Standard Checkout + same secret both sides + funded wallet = the full chain genuinely works end-to-end today: click counts, webhook fires, HMAC verifies, seller's pending balance rises, and T+30 auto-releases.** Every other provider/config combination currently fails at exactly one domino — four of them hard-fail (PayPal instructions, Stripe double-pay, LS renewals, organic-sale 400-retry-storm), and one is a human gap you can fix with a single paragraph in the wizard (track.js install step + "set subscription notes server-side" for Razorpay Subscriptions founders).

### Certification protocol (₹1 test — do this before ANY seller is allowed in)

1. Create a test product (Razorpay, 10% upfront), fund wallet with ₹100 via the top-up flow.
2. Install track.js on a throwaway page with a Razorpay Standard Checkout button (test mode keys).
3. Click your own `/ref/{slug}` link from an incognito window (self-referral check uses email, so use a different buyer email) → buy ₹1.
4. Assert all of: click counter +1 · webhook 200 in `webhook_logs` (after fixing the `event_type` column — FND-9) · transaction row `billing_status='billed'` · wallet ₹100 → ₹100−10p · seller pending +9p−+… (10% of ₹1 = 10 paise, minus 5% fee = 9 paise) · seller notification row exists.
5. Advance `payout_due_date` manually in DB → run the escrow cron locally → assert `withdrawable` +9p.
6. **Repeat with (a) an organic purchase with NO ref → must 200-skip (after ATTR-1 fix), (b) subscription renewal, (c) Stripe test-mode if you plan to allow Stripe at launch.**
Film step 3–5 — that video is both your YC demo and your seller-recruiting asset.

---

## 5. This week's gating checklist (no new architecture — decisions you already made)

| Prio | Item | Effort |
|---|---|---|
| 🔴 P0 | SEC-1 profile column lockdown — this is also what *enforces* "wallet-only" (§1.5) | half day (SQL migration) |
| 🔴 P0 | SEC-2 public_products view without `webhook_secret` + rotate all existing secrets + switch form to server-generated secret (FRM-4) | 1 day |
| 🔴 P0 | ATTR-1: missing-ref ⇒ 200-skip + "unattributed sale" notification, never 400 | 30 min |
| 🔴 P0 | Stripe event split (sub=`invoice.paid`, one-time=`payment_intent.succeeded`) + fix instruction card; PayPal event name; LS `subscription_payment_success` handler | 1 day |
| 🟠 P1 | FRM-2 write `category` to its column (one line in the insert) + select it in GET /api/products → Vault filters come alive | 1 hour |
| 🟠 P1 | Commission bounds in form + API + DB CHECK (§2), fee-side decision for the "100%" marketing | half day |
| 🟠 P1 | Wizard Step 3: track.js install + subscription-notes warning; Stripe two-phase secret flow (FRM-4/FRM-6) | 1 day |
| 🟠 P1 | Wallet dead-zone: low-balance email + auto-pause + retry-on-topup (MNY-8) | 1 day |
| 🟡 P2 | Structured `price_inr`, trial-days field, legal checkbox, commission versioning (FRM-7), edit-product secret rotation | 2 days |
