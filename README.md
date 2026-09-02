<div align="center">
  <img src="./public/logo.png" alt="Black Index Logo" width="200"/>
  <h1>Black Index</h1>
  <p><strong>The Next-Generation Digital Distribution Engine</strong></p>
</div>

---

## 🚀 Welcome to Black Index

**Black Index** is a modern, high-performance commerce platform built to seamlessly connect SaaS Founders with digital Sellers. We’ve built an open ecosystem where anyone with a great product or an audience can scale their revenue.

Whether you're a Founder looking to solve the cold-start problem or a Seller looking for a reliable, recurring income stream, Black Index provides the enterprise-grade infrastructure to make it happen.

> **PROPRIETARY CODEBASE**: This repository and all associated software are strictly proprietary. Unauthorized copying, distribution, modification, or commercial use is explicitly prohibited. See the `LICENSE` file for details.

---

## ✨ Why Black Index?

Our platform is engineered for absolute reliability, transparent payouts, and frictionless onboarding.

### 🛡️ The Gauntlet (Verification Engine)
Quality and security are our top priorities. Before any product is distributed on the network, it goes through **The Gauntlet**:
- **Live Sandbox Simulation**: We simulate real transactions to ensure product webhooks fire correctly.
- **Cryptographic Authentication**: Every product is secured via handshake tokens.
- **Fail-Safe Webhook Listeners**: We handle asynchronous drops from Razorpay, LemonSqueezy, Stripe, and PayPal seamlessly.

### 💰 Atomic Money Engine
Financial integrity is non-negotiable. Our backend utilizes a custom `record_conversion()` Postgres SQL function to enforce ACID-compliant transactions directly at the database layer. 
- If a server crashes mid-sale, the transaction automatically rolls back. 
- Balances are computed exclusively via server-side, immutable ledgers.
- **Zero dropped transactions. We never lose a dollar.**

### 🤝 The Founder & Seller Ecosystem
- **For Founders**: Deploy your SaaS, dynamically set your own upfront and recurring commission rates, and let a global network of sellers drive your customer acquisition.
- **For Sellers**: Access a curated marketplace of high-converting products. Track your success through a beautiful real-time sales dashboard, backed by secure escrow protection and trusted settlements.

---

## 💻 Tech Stack

Built with modern web technologies to ensure a lightning-fast, scalable, and secure experience:

- **Frontend**: Next.js 14, React, Tailwind CSS, Framer Motion for buttery-smooth animations.
- **Backend**: Next.js Serverless API Routes, Node.js.
- **Database**: Supabase (PostgreSQL) heavily utilizing Row Level Security (RLS) and custom Stored Procedures.
- **Payments & Payouts**: Multi-provider integrations including Razorpay, LemonSqueezy, Stripe, and PayPal.
- **Infrastructure**: Vercel for edge hosting and analytics.
- **Security**: Zod for schema validation, HMAC webhook verification, and robust idempotency/velocity limits.

---

<div align="center">
  <p><i>Empowering creators. Connecting the digital economy.</i></p>
  <p>&copy; 2026 Black Index. All Rights Reserved.</p>
</div>
