┌──────────────────────────────────────────────┐
│  CUSTOMER JOURNEY                            │
└──────────────────────────────────────────────┘

Step 1: Customer clicks seller's link
https://blackindex.in/ref/aryan-prometheus
↓
Step 2: Black Index redirects WITH ref_id
https://prometheus.app?ref_id=550e8400-uuid
↓
Step 3: Founder's site captures ref_id (AUTOMATIC)
<script src="https://blackindex.in/track.js"></script>
- Auto-stores ref_id in localStorage (30 days)
- Auto-injects into Stripe/Razorpay metadata
- Exposes window.BlackIndex.getRefId() for manual use
↓
Step 4: Customer adds to cart, checks out
ref_id is automatically included in payment metadata
↓
Step 5: Payment provider charges customer
Payment goes to founder's account (not ours)
↓
Step 6: Provider fires webhook to Black Index
POST https://blackindex.in/api/webhooks/{provider}/{productId}

Native webhooks supported:
- /api/webhooks/razorpay/{productId}  → payment.captured
- /api/webhooks/stripe/{productId}    → checkout.session.completed
- /api/webhooks/gumroad/{productId}   → Ping URL
- /api/webhooks/lemonsqueezy/{productId} → order_created
- /api/webhooks/paypal/{productId}    → PAYMENT.CAPTURE.COMPLETED
↓
Step 7: Webhook handler processes
- Validates ref_id → Finds seller
- Self-referral check → Blocks fraud
- Idempotency check → No duplicates
- NEW vs RECURRING → Different commission rates
- Calculate commission (upfront 40%, recurring 15%)
- Platform fee (5% of commission)
↓
Step 8: Ledger updates
- Credit seller's pending_balance
- Add to founder's unbilled_amount (metered billing)
↓
Step 9: Payouts (T+30)
- Seller can withdraw after 30-day escrow
- Founder charged via mandate (RBI compliant)

┌──────────────────────────────────────────────┐
│  FOUNDER SETUP (ZERO-CODE)                   │
└──────────────────────────────────────────────┘

1. Add tracking script:
   <script src="https://blackindex.in/track.js"></script>

2. Copy webhook URL from dashboard

3. Paste in payment provider settings

4. Done! Conversions auto-tracked.

┌──────────────────────────────────────────────┐
│  MANUAL INTEGRATION (Advanced)               │
└──────────────────────────────────────────────┘

If auto-injection doesn't work:

// Get ref_id manually
const refId = window.BlackIndex.getRefId();

// Pass to Razorpay
const rzp = new Razorpay({
  ...options,
  notes: { ref_id: refId }
});

// Pass to Stripe
await stripe.redirectToCheckout({
  ...options,
  clientReferenceId: refId
});
