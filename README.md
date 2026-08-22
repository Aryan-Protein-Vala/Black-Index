# Black Index

> **The affiliate marketplace for Indian SaaS:** founders list products and define commission terms; independent sellers, creators, and salespeople discover those products, share tracked referral links, and earn commissions on verified conversions.

**Repository status:** working MVP / pre-public-launch codebase. The product concept is clear and substantial, but production money movement, compliance, and several security and UX claims still require verification before taking live customer funds.

## What is Black Index?

Black Index is intended to be a two-sided, performance-based distribution marketplace for SaaS and digital products.

- **Founders** are SaaS or digital-product businesses that need distribution without paying for impressions or unqualified leads. They publish a product, provide payment/webhook integration details, and configure the commission they are willing to pay.
- **Sellers** (the product currently calls them **Warlords**) are affiliates, creators, consultants, communities, sales agents, and other people who can introduce customers. They browse the marketplace, generate a product-specific referral link, promote it through their own channels, and receive a share when a conversion is verified.
- **Customers** buy from the founder's checkout. The payment provider webhook tells Black Index what product, referral link, customer, amount, and external transaction were involved. Black Index records the conversion, calculates the commission, and exposes earnings and transaction history to the seller.
- **Black Index** supplies discovery, referral-link generation, attribution, commission calculation, fraud controls, escrow/wallet accounting, notifications, dashboards, and payout workflow.

The central promise is simple: **founders pay for outcomes rather than reach, while people who can sell SaaS get a structured way to earn from their distribution.** The long-term thesis is recurring commission: when a referred customer continues subscribing, the seller can continue earning for the configured period, subject to the product's terms.

## The problem

Many early-stage SaaS companies can build software but do not have a repeatable sales or distribution channel. Traditional advertising charges for attention and may produce no sale. Building an affiliate program independently requires tracking, partner recruitment, fraud prevention, payout operations, and support.

At the other side of the market, creators, niche communities, consultants, and freelance salespeople may have trust and reach but lack a catalogue of credible SaaS products with transparent tracking and recurring economics.

Black Index attempts to join those two needs in one marketplace instead of being only an affiliate-tracking plug-in. Its proposed wedge is India-first SaaS distribution, INR/UPI-oriented payouts, and a network of sellers rather than merely software that a founder must operate alone.

## How the product is supposed to work

### 1. Founder creates a listing

A founder signs up, completes onboarding, and creates a product listing with information such as name, description, category, price, logo, active status, payment provider, and commission configuration. The founder can edit products from the founder dashboard.

The commission model is represented as a hybrid configuration:

- an upfront percentage for the first qualifying sale or subscription;
- an optional recurring percentage for subsequent subscription events; and
- an optional maximum number of recurring months.

The business concept has also discussed founder upgrades, security deposits, prepaid wallets, featured listings, and platform fees. These are business-model proposals and must not be treated as live, enforceable revenue features unless the corresponding UI, server-side rules, ledger, payment collection, and legal terms are verified together.

### 2. Seller discovers and selects a product

A seller uses the Armoury/Vault-style product marketplace to review active listings. For a selected product, the seller generates a unique referral link. The link routes through the Black Index referral endpoint and associates traffic and later provider events with the seller and product.

The seller dashboard is intended to show links, products, transactions, earnings, pending/withdrawable balances, conversions, and payout status. It also contains seller-oriented features such as onboarding, wallet views, withdrawal actions, notifications, and a fraud-reporting flow.

### 3. Attribution and checkout

The product includes browser-side tracking and referral routes. The customer ultimately completes checkout through the founder's payment provider. The founder's integration must pass the Black Index referral identifier and the provider's event data back to the correct product webhook.

Supported or scaffolded provider routes include Razorpay, Stripe, Gumroad, Lemon Squeezy, PayPal, Cashfree, PhonePe, PayU, Instamojo, CCAvenue, Shopflo, Shopify, Cal.com, and test/custom webhook paths. “Supported” should mean tested end-to-end for the exact provider event set; the existence of a route alone is not proof of production readiness.

### 4. Webhook-verified conversion

The shared conversion processor validates the product and referral link, checks that the link belongs to the product, applies self-referral and velocity checks, and calls an atomic database RPC named `record_conversion`. The intended atomic path covers customer upsert, recurring billing count, idempotent transaction insertion, founder wallet debit, seller escrow credit, and platform-fee accounting.

The processor is designed to reject invalid products, inactive products, mismatched referral links, self-referrals, duplicates, and conversions that violate configured limits. Post-conversion notifications and email effects are designed to be safe to retry.

### 5. Pending funds and payout

The intended settlement model is a 30-day hold:

1. a verified conversion is recorded;
2. the seller's commission is placed in pending/escrow status;
3. refunds, chargebacks, and the applicable dispute period are allowed to resolve;
4. eligible funds become withdrawable; and
5. the seller requests a payout through the supported payout rail, currently oriented around Razorpay/RazorpayX and UPI in India.

This is a risk-control design, not a guarantee that money is already safeguarded. The production system must prove that wallet funding, escrow release, refunds, chargebacks, payout eligibility, idempotency, and platform-fee settlement are all enforced server-side and reconciled against payment-provider records.

## Product surfaces in this repository

- Public landing page explaining the marketplace, mechanics, earnings model, and joining flow.
- Authentication and onboarding pages for login, signup, and user setup.
- Seller dashboard for products, referral links, transactions, earnings, notifications, and withdrawals.
- Founder dashboard for creating/editing products, integration setup, wallet/deposit flows, analytics, and product management.
- Admin dashboard for users, products, transactions, disputes, blacklist data, and operational review.
- Integration documentation at `/docs/integration`.
- Protocol, terms, privacy, cookies, refunds, disclaimer, contact, blog, and early-access pages.
- Referral route at `/ref/[slug]` and a broad set of provider webhook endpoints under `/api/webhooks`.
- Cron endpoints for escrow release, wallet checks, reconciliation, dispute handling, and meeting confirmation.
- Fraud-reporting, dispute-evidence, blacklist, product-badge, product-secret, logo-upload, and install/status APIs.

## Technical architecture

| Layer | Current technology / role |
|---|---|
| Web application | Next.js App Router, React, TypeScript |
| UI | Tailwind CSS, Radix UI primitives, Framer Motion, Lucide icons |
| Data and auth | Supabase PostgreSQL, Supabase Auth, Row-Level Security, realtime subscriptions |
| Payments | Razorpay/RazorpayX and provider-specific webhook adapters; Stripe and other adapters are present in the codebase |
| Email | Resend integration and email templates |
| Analytics | Vercel Analytics plus local tracking script |
| Hosting target | Vercel; cron routes are configured through deployment settings |
| Validation/security utilities | Zod, HMAC webhook verification, idempotency handling, rate/velocity checks, server-side admin client |

Important data concepts include profiles, products, links, transactions, customers, notifications, fraud reports, founder deposits, webhook logs, payments, featured payments, charge schedules, and wallet/payout records. SQL is stored under `supabase/`. `lib/database.types.ts` is a hand-maintained type stub and should be regenerated from the authoritative production schema before treating it as complete type safety.

## Security and trust model

The intended safeguards include signed webhook verification, timing-safe secret comparisons, server-created payment orders, idempotent external transaction IDs, self-referral detection, velocity limits, product-specific webhook secrets, RLS, admin-only server operations, pending/withdrawable balances, and a 30-day settlement delay.

These controls are essential because Black Index handles attribution and may eventually coordinate real commissions. A claim in a document or UI is not itself a control. Every money-affecting action must be authorized on the server, validated against a canonical ledger, and covered by adversarial tests. Refund and chargeback handling, platform revenue settlement, KYC/PAN/TDS/GST workflows, and wallet-funding rules need explicit production verification.

## Business model

The proposed model has several possible revenue streams:

1. **Transaction/platform fee:** a percentage of the commission or transaction flow, commonly described in the project materials as approximately 2–5% depending on the final contract and implementation.
2. **Founder subscription or listing/upgrade fee:** a recurring or one-time fee for access, enhanced analytics, priority placement, or other premium features.
3. **Featured placement and premium tools:** promoted listings, advanced analytics, API access, integration support, and operational tooling.

The most convincing core value proposition is not a fee table; it is measurable, lower-risk customer acquisition for founders and credible recurring earning potential for high-performing sellers. Pricing should be tested with real founders and sellers rather than relying on projections.

### Illustrative unit economics

For a ₹10,000 annual subscription with a 30% upfront commission and 15% recurring commission, the gross seller payout and Black Index fee depend on whether the customer is new, how many recurring months are eligible, whether the sale is refunded, and how the platform fee is defined. Any public calculator must show these assumptions clearly. Percentages, recurring duration, refund rules, taxes, payment-provider fees, and payout timing must be contractually consistent.

The repository's business documents contain ambitious scenarios for founder count, active sellers, GMV, and revenue. Those are hypotheses, not traction evidence or forecasts validated by the code. A credible plan should measure active sellers, products with at least one real conversion, tracked-sale rate, refund rate, payout success rate, founder retention, seller retention, and contribution margin.

## What is promising about the idea?

Yes, the business idea is promising enough to validate aggressively. It addresses a real two-sided problem, has an understandable performance-based value proposition, and recurring SaaS commissions can create seller retention. India-first payment and operational knowledge could be a useful wedge if it genuinely improves onboarding and payouts.

However, it is **not yet safe to market “crazily” as if the business is proven**. The network has a difficult cold-start problem, founders may bypass attribution, top sellers have many alternatives, recurring commissions can create significant cash-flow exposure, and compliance obligations become serious as soon as the platform facilitates or controls payouts. Competitors and founder-built programs already exist internationally, so the defensible asset must become real supply, real seller performance, trusted settlement, and reliable integrations—not slogans.

The honest verdict is:

> **Strong concept; unproven business; pre-launch implementation risk.**

Market the problem and the pilot, not guaranteed income, fake traction, instant payouts, “passive income,” “trustless” infrastructure, or unsupported compliance/certification claims. Use real testimonials, real conversion data, and real payout records only after obtaining permission and reconciling them.

## Recommended go-to-market sequence

1. Start with a concierge pilot: 5–10 carefully selected Indian SaaS founders and 20–50 relevant sellers.
2. Choose one payment provider and one payout path first; test the complete lifecycle from click to sale, refund, escrow release, and payout.
3. Recruit sellers who already sell to a specific niche rather than chasing a large vanity sign-up number.
4. Publish a transparent commission contract and a founder integration health report.
5. Track weekly proof metrics: activated products, active sellers, tracked clicks, verified conversions, missing attribution, refund/chargeback rate, time to payout, and net revenue.
6. Remove unverified leaderboard numbers and replace them with real, timestamped, consented data.
7. Expand providers, categories, recurring terms, and geography only after the first cohort is profitable and operationally reliable.

## Pre-public-launch checklist

- Consolidate the SQL files into ordered, tested migrations and confirm the production schema/RPCs match the application.
- Lock down every profile, product, balance, transaction, payout, deposit, and admin mutation with server-side authorization and ownership checks.
- Test the complete ledger with duplicate, replay, refund, chargeback, inactive-product, self-referral, insufficient-wallet, and concurrent-webhook cases.
- Implement a canonical platform-earnings ledger and reconciliation view.
- Enforce commission bounds and grandfather terms for existing links; notify sellers when terms change.
- Finish founder billing/deposit/wallet UI wiring and verify that the advertised fee is actually collected.
- Implement KYC, PAN, applicable TDS, GST invoicing, privacy/DPDP obligations, consumer disclosures, affiliate disclosures, and grievance/support processes with qualified Indian legal and tax advice.
- Configure and verify live payment, payout, email, storage, cron, and domain environment variables.
- Run security review, dependency checks, database policy tests, end-to-end payment-provider tests, and a controlled-money pilot before launch.
- Reconcile every public claim in the site, docs, legal pages, and README with the current code and actual business operations.

## Local development

```bash
npm install
npm run dev
```

Other scripts:

```bash
npm run lint
npm run build
npm start
```

Configure the required Supabase, payment-provider, email, cron, payout, and application environment variables in the deployment environment. Never commit secrets. Use test/sandbox credentials for local and staging verification.

## Repository notes

The repository contains product specifications, audits, launch-status notes, UI fix lists, and backend fix lists in addition to the application. Some documents describe intended or previously proposed behavior and may not match the current implementation. When there is a conflict, verify the code, schema, provider configuration, and live operational controls together; do not use a marketing document as proof that a feature is deployed.

## Disclaimer

Black Index is a software and marketplace concept under development. Nothing in this README promises income, conversion rates, recurring commissions, payout speed, regulatory status, security certification, market leadership, or investment returns. Commission availability depends on each founder's terms, valid attribution, customer payment status, refunds/chargebacks, platform rules, and applicable law.
