<div align="center">
  <img src="./public/logo.png" alt="Black Index Logo" width="200"/>
  <h1>Black Index</h1>
  <p><strong>The High-Performance Distribution Engine for SaaS Founders & Elite Sellers</strong></p>
</div>

---

## 🏴‍☠️ Welcome to Black Index

Black Index is a relentless, high-performance digital distribution platform engineered to solve the cold-start problem for SaaS Founders and provide credible, recurring earning potential for top-tier Sellers. 

We don't do "invite-only." If you have a killer product or the ability to move volume, you belong on the Index. Our architecture is built on absolute security, seamless global attribution, and an atomic money engine that guarantees every transaction is securely mapped and distributed.

> **PROPRIETARY CODEBASE**: This repository and all associated software are strictly proprietary. Unauthorized copying, distribution, modification, or commercial use is explicitly prohibited. See the `LICENSE` file for details.

---

## ⚡ Core Architecture

Black Index operates on a highly sophisticated tech stack designed to prevent fraud, ensure precise split commissions, and guarantee money flow integrity.

### 🛡️ The Gauntlet (Verification Engine)
Before a product goes live on the network, it must survive **The Gauntlet**. 
- **Synthetic Sale Simulation**: We simulate live transactions through a sandbox environment to ensure webhooks fire correctly.
- **Cryptographic Handshakes**: Products are authenticated via secure cryptographic handshake tokens.
- **Fail-Safe Webhook Listeners**: Built to handle asynchronous network drops from Razorpay, LemonSqueezy, Stripe, and PayPal without dropping attribution.

### 💰 Atomic Money Engine
Our backend relies on the `record_conversion()` Postgres SQL function. This enforces ACID-compliant transactions directly at the database layer. If a server crashes mid-sale, the transaction automatically rolls back. Every single money-affecting action is authorized on the server, validated against a canonical ledger, and covered by adversarial tests. **We never lose a dollar.**

### 👑 The Founder / Seller Dynamic
- **Founders**: Deploy your SaaS, set your own upfront and recurring commission rates, and let a legion of top-tier sellers drive your customer acquisition.
- **Sellers**: Access a curated network of high-converting products. Leverage our real-time sales dashboard, secure escrow protection, and trusted settlement to build recurring revenue streams.

---

## 🛠 Tech Stack

- **Frontend**: Next.js 14, React, Tailwind CSS, Framer Motion
- **Backend**: Next.js API Routes, Node.js
- **Database**: Supabase (PostgreSQL with RLS & Stored Procedures)
- **Payments & Payouts**: Razorpay, LemonSqueezy, Stripe, PayPal integrations
- **Hosting**: Vercel
- **Security Utilities**: Zod, HMAC webhook verification, idempotency handling, rate/velocity checks

---

## 🔒 Security & Compliance

Black Index employs strict Row Level Security (RLS) on all Supabase tables and robust server-side safeguards:
- **Immutable Ledgers**: Wallet balances are computed exclusively via server-side ledgers; profiles are locked down and cannot be modified via client-side scripts.
- **Idempotency & Velocity Limits**: Protection against replay attacks, duplicate webhooks, and concurrent transaction races.
- **Secure Settlements**: A 30-day settlement delay backed by explicit refund and chargeback handling ensures trusted payouts for all parties.

---

<div align="center">
  <p><i>"Prepare for War."</i></p>
  <p>&copy; 2026 Black Index. All Rights Reserved.</p>
</div>
