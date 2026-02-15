# Black Index

## The Performance-Based Sales Infrastructure for Indian SaaS

---

## Executive Summary

**Black Index** is India's first performance-based affiliate marketplace connecting SaaS founders with a network of professional sales agents ("Warlords"). Unlike traditional affiliate programs that require founders to build and manage their own networks, Black Index provides instant access to a curated, incentivized salesforce.

**The Opportunity**: India's SaaS ecosystem is projected to reach $50B by 2030, yet 90% of bootstrapped founders struggle with customer acquisition. Black Index solves this by creating a marketplace where sales performance directly drives compensation—no upfront costs, no wasted ad spend.

---

## The Business Model

### How It Works

```
┌─────────────────┐     Lists Product      ┌─────────────────┐
│                 │ ──────────────────────▶ │                 │
│    FOUNDERS     │                         │   BLACK INDEX   │
│   (SaaS Owners) │ ◀────────────────────── │   (Marketplace) │
│                 │    Pays Only on Sale    │                 │
└─────────────────┘                         └─────────────────┘
                                                    │
                                                    │ Unique Referral Links
                                                    ▼
                                            ┌─────────────────┐
                                            │                 │
                                            │    WARLORDS     │
                                            │ (Sales Agents)  │
                                            │                 │
                                            └─────────────────┘
                                                    │
                                                    │ Promote Products
                                                    ▼
                                            ┌─────────────────┐
                                            │                 │
                                            │   CUSTOMERS     │
                                            │   (End Users)   │
                                            │                 │
                                            └─────────────────┘
```

### Revenue Streams

| Stream | Description | Example |
|--------|-------------|---------|
| **Founder Upgrade Fee** | One-time ₹499 fee to list products | 1,000 founders × ₹499 = ₹4.99L |
| **Platform Commission** | 5% of every sale processed | ₹1Cr GMV × 5% = ₹5L |
| **Premium Features** | Analytics, priority placement, API access | Future revenue stream |

### Commission Structure (Hybrid Model)

Founders set their own commission rates:
- **Upfront Commission**: 20-40% of first sale (paid to Warlord)
- **Recurring Commission**: 10-20% of subscription renewals (lifetime of customer)
- **Platform Fee**: 5% of transaction value

**Example**: A ₹10,000/year SaaS subscription with 30% upfront + 15% recurring:
- Warlord earns: ₹3,000 upfront + ₹1,500/year recurring
- Platform earns: ₹500 (5%)
- Founder pays: ₹4,000 total CAC (40% effective rate)

---

## Why This Is Not a Chicken-Egg Problem

### Day-1 Supply: 8 SaaS Products Confirmed

We already have **8 SaaS products** committed to launch on Black Index:

1. **NEETGenius** - NEET preparation platform
2. **InvoiceFlow** - GST-compliant invoicing
3. **HireStack** - Recruitment automation
4. **ContentPro** - AI content generation
5. **DesignDash** - Design collaboration tool
6. **SupportDesk** - Customer support SaaS
7. **AnalyticsHub** - Business intelligence
8. **FormBuilder** - No-code form creation

**This solves the cold-start problem.** Warlords immediately have products to promote.

### Day-1 Demand: Organic Warlord Acquisition

Our go-to-market targets:
- LinkedIn influencers in B2B space (1M+ combined reach)
- Tech Twitter community creators
- YouTube SaaS reviewers
- Newsletter operators
- Existing affiliate marketers looking for new verticals

---

## The Accidental Unicorn Thesis

### Market Timing Convergence

1. **India's SaaS Boom**: 1,400+ funded SaaS startups, most struggling with sales
2. **Creator Economy Saturation**: Influencers seeking new monetization beyond brand deals
3. **Performance Marketing Shift**: Brands moving from CPM to CPA models
4. **UPI Infrastructure**: Instant, low-cost payments enable micro-commissions

### Network Effects

```
More Products → More Warlords → More Sales → More Products
     ↑                                           │
     └───────────────────────────────────────────┘
```

Each side reinforces the other:
- Founders join because Warlords are active
- Warlords join because products pay well
- Success stories attract both sides

### Winner-Takes-Most Dynamics

Affiliate marketplaces have high switching costs:
- Warlords build reputation and relationships
- Founders integrate webhooks and tracking
- Historical data creates competitive moat

**Comparison**: Impact.com (acquired for $100M+), PartnerStack (raised $50M+), there is no Indian equivalent.

---

## Fraud Prevention Architecture

### Multi-Layer Defense System

```
┌────────────────────────────────────────────────────────────┐
│                    FRAUD PREVENTION STACK                   │
├────────────────────────────────────────────────────────────┤
│  Layer 1: Payment Verification                              │
│  ├─ Razorpay signature verification (HMAC-SHA256)          │
│  ├─ Server-side order creation (no client manipulation)    │
│  └─ Idempotent payment processing (no duplicates)          │
├────────────────────────────────────────────────────────────┤
│  Layer 2: Webhook Security                                  │
│  ├─ Per-product webhook secrets (HMAC validation)          │
│  ├─ Timing-safe comparison (prevents timing attacks)       │
│  └─ Immutable transaction logs                             │
├────────────────────────────────────────────────────────────┤
│  Layer 3: Commission Validation                             │
│  ├─ 30-day escrow period (prevents hit-and-run fraud)      │
│  ├─ Chargeback clawback mechanism                          │
│  └─ Maximum CAC limits per product                         │
├────────────────────────────────────────────────────────────┤
│  Layer 4: Identity & Access                                 │
│  ├─ Supabase Row-Level Security (RLS)                      │
│  ├─ Server-side secret management                          │
│  └─ Admin role-based access control                        │
└────────────────────────────────────────────────────────────┘
```

### Escrow System (T+30 Settlement)

```
Day 0:  Sale happens → Commission calculated → Added to "Pending Balance"
Day 30: Chargeback window closes → Moved to "Withdrawable Balance"
Day 31: Warlord can request payout → UPI transfer via RazorpayX
```

**Why T+30?**
- Matches Razorpay's chargeback dispute window
- Prevents affiliate fraud (fake sales, refund abuse)
- Gives founders confidence in commission legitimacy

### What We Prevent

| Fraud Type | Prevention Method |
|------------|-------------------|
| Fake conversions | Webhook signature verification |
| Self-referrals | Cookie + IP tracking |
| Commission stuffing | Rate limiting on link generation |
| Duplicate claims | Idempotent webhook processing |
| Payment manipulation | Server-side only payment creation |
| Data theft | RLS + encrypted secrets |

---

## Technical Infrastructure

### Stack

| Component | Technology | Why |
|-----------|------------|-----|
| Frontend | Next.js 16 (Turbopack) | Fast, SEO-optimized |
| Database | Supabase (PostgreSQL) | RLS, real-time, Auth |
| Payments | Razorpay + RazorpayX | Orders + Payouts |
| Hosting | Vercel | Edge deployment |
| Security | CSP Headers, HSTS | Production-grade |

### Security Certifications Path

- [x] PCI DSS compliant (via Razorpay)
- [x] HTTPS everywhere (HSTS enabled)
- [x] SOC 2 Type II (Supabase)
- [ ] ISO 27001 (planned post-Series A)

---

## Financial Projections

### Year 1 Conservative Estimate

| Metric | Target |
|--------|--------|
| Founders onboarded | 500 |
| Active Warlords | 2,000 |
| Monthly GMV | ₹50L |
| Platform Revenue | ₹2.5L/month |
| Annual Revenue | ₹30L |

### Year 3 Scale Target

| Metric | Target |
|--------|--------|
| Founders onboarded | 5,000 |
| Active Warlords | 50,000 |
| Monthly GMV | ₹5Cr |
| Platform Revenue | ₹25L/month |
| Annual Revenue | ₹3Cr |

### Unit Economics

- **CAC for Founders**: ₹0 (organic, SEO, referral)
- **CAC for Warlords**: ₹50-100 (content marketing)
- **LTV of Founder**: ₹499 + (5% of GMV generated)
- **LTV of Warlord**: Recurring commissions drive retention

---

## Regulatory Compliance

### RBI/FEMA Considerations

1. **Payment Aggregator**: We do NOT hold funds—Razorpay handles all money movement
2. **GST Compliance**: All invoices generated with proper GST
3. **TDS on Commissions**: Automated TDS deduction for payouts >₹50,000
4. **KYC**: UPI-based identity verification for payouts

### We Are NOT:

- A lending platform (no credit risk)
- A payment aggregator (Razorpay is)
- Handling forex (INR only)

---

## Competitive Landscape

| Player | Focus | Weakness |
|--------|-------|----------|
| **Impact.com** | Enterprise | Too expensive for Indian SMBs |
| **PartnerStack** | US SaaS | No India presence |
| **Affiliates India** | E-commerce | No SaaS focus |
| **Manual programs** | DIY | No network, high overhead |

**Black Index Advantage**: Purpose-built for Indian SaaS, performance-only pricing, instant Warlord network.

---

## Team

**Founder**: Building solo with AI-assisted development. 

Previous experience: [Add your background]

**Advisory**: [If applicable]

---

## The Ask

### Seed Round: ₹1Cr

**Use of Funds**:
- 40% - Growth (Warlord acquisition, founder outreach)
- 30% - Engineering (Team hire, infrastructure)
- 20% - Legal & Compliance
- 10% - Operations & Buffer

**Milestones**:
- 6 months: 1,000 founders, 5,000 Warlords
- 12 months: ₹1Cr monthly GMV
- 18 months: Series A readiness

---

## Why Now?

1. **Post-pandemic digital acceleration** has created 10x more SaaS products needing sales
2. **Creator economy maturity** means influencers understand performance deals
3. **UPI ubiquity** enables instant micro-payouts
4. **No dominant player** in Indian SaaS affiliate space

---

## Contact

**Website**: [blackindex.in](https://blackindex.in)
**Email**: aryansharma24112003@gmail.com

---

*"We're not building an affiliate program. We're building the sales layer of the World SaaS stack."*









Gemini's view point : 
bcz the above text misses few points!!!
---

### 📜 THE BLACK INDEX PROTOCOL (MASTER DOC)

Here is the **Final, Merged, and Perfected Document**. It combines the IDE's technical accuracy with the specific "Metered Financial Engine" and "God Mode" logic we developed.

Copy this. This is the truth.

---

# ⚔️ PROTOCOL: BLACK INDEX

### **The Distribution Layer of India**

**Version:** 1.0 (Production)
**Status:** **ONLINE**

---

## 1. 🦅 Core Identity

**Black Index** is not an affiliate network. It is a **Sales Operating System**.
We connect Founders (who have products but no distribution) with Warlords (who have influence but no assets).

* **The Thesis:** Startups typically die because CAC > LTV. Black Index solves this by replacing "Ad Spend" with "Performance Bounties."
* **The Mechanism:** A trust-enforced marketplace where Founders pay *only* for verified results, and Sellers earn "God Mode" commissions.
* **The Philosophy:** "I only pay when I win."

---

## 2. ⚙️ The "God Mode" Commission Engine

We replaced standard 10% affiliate links with a **Hybrid Incentive Model** designed to create "Golden Handcuffs" for sellers.

### The Structure (Hardcoded)

1. **⚡ Activation Bonus (The Hook):**
* **40%** of Month 1 Revenue.
* *Impact:* Instant cash flow for the Warlord. High dopamine.


2. **∞ Royalty Mode (The Retention):**
* **15%** Recurring Commission for 12 Months (as long as customer stays active).
* *Impact:* Creates passive income. Warlords never leave because they build a "Salary" on Black Index.


3. **📦 One-Time Assets:**
* Flat **30-50%** commission on sale value (e.g., Prometheus, E-books).



---

## 3. 💳 The Financial Architecture (RBI Compliant)

**The Challenge:** RBI e-Mandate rules require a 24-hour pre-debit notification. Instant charges fail.
**The Solution:** **"Metered Billing" (The Unbilled Ledger).**

### A. The Setup (The Mandate)

1. **Founder Action:** Connects payment method via Razorpay Subscriptions.
2. **Authorization:** Sets a `max_amount` (e.g., ₹1,00,000/month).
3. **Method:** Supports **UPI Autopay** (PIN once) and **Cards** (OTP once).

### B. The Accumulation (The Meter)

When a sale happens, money does **NOT** leave the Founder's bank immediately.

1. **Webhook Event:** `payment.success` received.
2. **System Action:**
* Calculates `Commission + Platform Fee`.
* Updates Database: `founder.unbilled_amount += total`.
* Log Transaction Status: `Unbilled`.



### C. The Trigger & Charge (Batching)

We trigger a charge against the Mandate when **ONE** condition is met:

1. **Threshold Hit:** `unbilled_amount >= ₹5,000`.
2. **Time Limit:** Every 7 Days (Weekly Settlement).

**The Execution Flow:**

1. **Notify:** System sends Email/SMS: *"Black Index will debit ₹5,000 in 24 hours."*
2. **Wait:** System pauses for 24h (RBI Compliance).
3. **Charge:** System calls Razorpay API to debit the Mandate.
4. **Result:**
* **Success:** Credit Sellers' `pending_balance`. Reset Meter.
* **Failure:** Pause Founder's Products immediately. Notify Warlords.



---

## 4. 🛡️ The "Anti-Fraud" Vault

We do not rely on trust. We rely on code.

### A. Self-Referral Kill Switch

* **Vector:** A user signs up as a seller just to buy the product with a 40% discount.
* **Defense:** Inside the webhook logic, we compare `payload.customer_email` vs `seller.email`.
* **Action:** If fuzzy match detected -> **Commission = 0**. Transaction flagged.

### B. The Vault Lock (Escrow)

* **Vector:** Seller makes a sale, cashes out instantly, then refunds the product.
* **Defense:**
* **State 1 (Pending):** Funds are locked for **30 Days** (covering the refund window).
* **State 2 (Withdrawable):** Funds move here only after T+30 logic check passes.
* **Refunds:** If a `refund` webhook hits, the system automatically claws back the commission from `Pending`.



### C. The "Serious Player" Threshold

* **Rule:** Minimum withdrawal is **₹3,000**.
* **Why:** This mathematically stops "Discount Hackers." If they buy one product to save ₹200, that money is stuck forever until they actually work to earn ₹2,800 more.

---

## 5. 🔌 Integration Tiers (Ingestion)

How we ingest data from Founders.

| Tier | Target Profile | Method | Tech Spec |
| --- | --- | --- | --- |
| **Tier 1** | SaaS / Web Apps | **Automated Webhook** | Founder adds our URL to Stripe/Razorpay. We listen for `payment_succeeded`. |
| **Tier 2** | Services / High Ticket | **Manual Reporting** | Founder fills a "Report Sale" form. Uploads screenshot. Admin approves. Transaction marked `unbilled`. |
| **Tier 3** | E-com / Partners | **Native / OAuth** | (Roadmap) One-click connect via Shopify App. |

---

## 6. 💰 Revenue Model (Unit Economics)

| Stream | Pricing | Rationale |
| --- | --- | --- |
| **1. Founder Subscription** | **₹499 – ₹4,999 / mo** | The "Gatekeeper Fee." Filters out non-serious founders. Covers server costs. |
| **2. Transaction Take Rate** | **5% of Commission** | The "Invisible Tax." If Warlord earns ₹100, we keep ₹5. Scales infinitely. |
| **3. Dogfooding** | **₹499 / mo** | We list Black Index itself as a product. Warlords sell Black Index to other Founders. |

---

## 7. 💻 Tech Stack & Security

**Infrastructure:**

* **Frontend:** Next.js 14 (App Router)
* **Database:** Supabase (PostgreSQL) + RLS Policies
* **Payments:** Razorpay Subscriptions (In) + RazorpayX (Out)
* **Styling:** Tailwind CSS + Framer Motion (The "Stealth" Aesthetic)

**Security Certifications:**

* **HMAC Verification:** Every webhook is signed. Fake API calls are rejected.
* **Idempotency Keys:** Prevents double-counting the same sale.
* **RLS (Row Level Security):** Sellers can physically only query their own data.

---

**System Status:** `DEPLOYED`
**Next Action:** Onboard first 5 Founders manually to test the Metered Billing cycle.