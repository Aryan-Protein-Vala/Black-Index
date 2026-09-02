<div align="center">
  <img src="https://www.blackindex.in/images/logos/index_gold.png" alt="Black Index Logo" width="200"/>
  <h1>Black Index</h1>
  <p><strong>The Exclusive Stealth Distribution Network</strong></p>
</div>

---

## 🏴‍☠️ Welcome to Black Index

Black Index is an elite, invite-only digital distribution platform engineered for high-performance founders and sellers. It is not an open marketplace. It is a stealth network. 

Our architecture is built on absolute security, seamless global attribution, and an atomic money engine that guarantees every transaction is securely mapped and distributed.

> **PROPRIETARY CODEBASE**: This repository and all associated software are strictly proprietary. Unauthorized copying, distribution, modification, or commercial use is explicitly prohibited. See the `LICENSE` file for details.

---

## ⚡ Core Architecture

Black Index operates on a highly sophisticated tech stack designed to prevent fraud, ensure split commissions, and guarantee money flow integrity.

### 🛡️ The Gauntlet (Verification Engine)
Before a product is approved on the network, it must survive **The Gauntlet**. 
- **Synthetic Sale Simulation**: We simulate live transactions through a sandbox environment to ensure webhooks fire correctly.
- **Cryptographic Handshakes**: Products are authenticated via cryptographic handshake tokens.
- **Fail-Safe Webhook Listeners**: Built to handle asynchronous network drops from Razorpay, LemonSqueezy, Stripe, and PayPal without dropping attribution.

### 💰 Atomic Money Engine
Our backend relies on the `record_conversion()` Postgres SQL function. This enforces ACID-compliant transactions directly at the database layer. If a server crashes mid-sale, the transaction automatically rolls back. **We never lose a dollar.**

### 👑 The Founder / Seller Dynamic
- **Founders**: Elite affiliates who drive traffic and secure distribution. They control their own commission rates via dynamic links.
- **Sellers**: The creators. They list unlimited products on our infrastructure and let the Warlord network distribute it.

---

## 🛠 Tech Stack

- **Frontend**: Next.js 14, React, Tailwind CSS, Framer Motion
- **Backend**: Next.js API Routes, Node.js
- **Database**: Supabase (PostgreSQL with RLS & Stored Procedures)
- **Payments**: Razorpay, LemonSqueezy, Stripe, PayPal integrations
- **Hosting**: Vercel

---

## 🔒 Security & Compliance

Black Index employs strict Row Level Security (RLS) on all Supabase tables. 
- Profiles are locked down and cannot be modified via client-side scripts.
- Wallet balances are computed exclusively via server-side ledgers. 
- API endpoints are rate-limited and secured via custom authentication middleware.

---

<div align="center">
  <p><i>"Prepare for War."</i></p>
  <p>&copy; 2026 Black Index. All Rights Reserved.</p>
</div>
