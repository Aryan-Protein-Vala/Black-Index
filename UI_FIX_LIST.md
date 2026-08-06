## PART B — UI REMEDIATION BATCH (only after Part A is green)
LOCKED DECISIONS (owner-approved, do not relitigate):
 • Founder upgrade = ₹100 ONE-TIME "launch deal" (was ₹500). NEVER write "/month" anywhere — the code bills exactly once.
 • Money model = prepaid wallet only. "Auto-Split at checkout" appears ONLY as a disabled card with a "Coming soon" badge.
 • Fee phrasing everywhere = "5% of the commission". Kill all other fee descriptions.
 • Min wallet top-up ₹1,000. Payout min ₹1,000. Escrow T+30.
 • NEVER fabricate numbers, names, testimonials, or social proof. Empty states beat lies.
 • PRESERVE the owner's ₹100 pricing block + /api/config/razorpay checkout wiring in components/become-seller-modal.tsx — fix labels/wording only.

### U1 — TRUST-BREAKERS
U1.1 Delete components/seller/payout-popover.tsx. Mount components/seller/withdraw-funds.tsx in app/dashboard/seller/page.tsx. Fix withdraw-funds: send header Idempotency-Key: crypto.randomUUID() on POST; DELETE its "automated UPI payouts coming soon" footer; add fetch-error state with retry; client-side UPI regex + amount ≤ balance validation.
U1.2 Build components/notifications-bell.tsx — unread-count badge, dropdown list, mark-read single + mark-all — mounted in BOTH dashboard headers.
U1.3 app/dashboard/founder/page.tsx: kill silent error-swallowing, add real loading / empty / error-with-retry states per card.
U1.4 Header balances must be LIVE-fetched, refreshed after any withdraw/top-up and every 60s.

### U2 — FOUNDER ONBOARDING V2
U2.1 REMOVE webhook secret input. Show it ONCE post-create.
U2.2 Form fields must write REAL columns.
U2.3 Bounds: upfront 1-100 | recurring 0-100 | months 1-36 | CAC 10-100000. Calculator.
U2.4 Step-2 webhook instructions match rewritten code.
U2.5 Step 3 = Install: snippet card + Verify button.
U2.6 Step 4 = The Gauntlet: L1 Simulate, L2 Real checkout.
U2.7 Edit-product: bounds/validation, commission warning, Rotate-secret button.

### U3 — SELLER DASHBOARD REALNESS
U3.1 Vault category filters read real column.
U3.2 Product detail modal renders real fields.
U3.3 DELETE fake analytics. Show clicks, conversions, conversion rate, earned.
U3.4 components/become-seller-modal.tsx — fix labels (upgrade to FOUNDER), ₹100 one-time.
U3.5 Re-enable product tour.

### U4 — SETTINGS / BILLING
U4.1 Wallet top-up front-and-center.
U4.2 Auto-Split card visually disabled.
U4.3 Remove subscription management affordances.
U4.4 Statements view: format paise→₹ via shared formatINR helper.

### U5 — COPY HONESTY
U5.1 sections/hero.tsx pass 5-second test.
U5.2 DELETE fabrications: earnings.tsx, leaderboard.tsx.
U5.3 how-it-works.tsx truth pass.
U5.4 the-maths.tsx internal consistency.
U5.5 app/protocol/page.tsx tiers.
U5.6 footer.tsx © 2026.
U5.7 app/early-access/page.tsx floor at 0.
U5.8 app/docs/integration/page.tsx rewrite. Delete app/page-main.tsx.

### U6 — TYPESCRIPT UN-QUARANTINE
Fix ALL ~20 TS errors.
