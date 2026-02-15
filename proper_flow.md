# 🔍 BLACK INDEX: THE COMPLETE USER FLOWS
## Every Single Step - Nothing Hidden

---

# 👤 FLOW 1: THE FOUNDER JOURNEY

---

## 🚀 STAGE 1: FOUNDER DISCOVERS BLACK INDEX

### **Step 1.1: First Touch**

```
Founder (Raj) sees Black Index via:
- Twitter post from another founder
- LinkedIn ad
- IndieHackers mention
- Friend recommendation
- Your 250k influencer friend's post

He clicks: https://black-index.vercel.app
```

**What Raj sees:**
- Landing page (dark aesthetic, "The Performance Layer")
- Two big buttons:
  - "I'm a Founder" (this one)
  - "I'm a Seller"
- Value prop: "Pay only when you get sales. 10,000+ sellers ready to promote."

**What Black Index does:**
```javascript
// Landing page loads
- Logs anonymous visit (IP, timestamp, referrer)
- Sets session cookie
- Tracks "founder_landing_view" event
```

---

### **Step 1.2: Founder Signs Up**

**Raj clicks "I'm a Founder"**

**Signup form appears:**
```
Email: raj@gstgenius.com
Password: ••••••••••
Full Name: Raj Kumar
Company: GSTGenius
[x] I agree to Terms of Service

[Create Account]
```

**What Black Index does:**
```javascript
// Frontend validation
- Check email format
- Check password strength (min 8 chars)
- Validate required fields

// API call: POST /api/auth/signup
{
  email: "raj@gstgenius.com",
  password: "hashed_password",
  full_name: "Raj Kumar",
  role: "founder"
}

// Supabase Auth
- Creates user in auth.users table
- Sends verification email
- Returns user ID

// Database insertion
INSERT INTO profiles (
  id,
  email,
  full_name,
  role,
  founder_tier,
  charge_threshold,
  charge_schedule,
  created_at
) VALUES (
  'uuid-123',
  'raj@gstgenius.com',
  'Raj Kumar',
  'founder',
  'new',          -- New founder = ₹3k threshold
  300000,         -- ₹3,000 in paise
  'weekly',
  NOW()
);

// Response
{
  success: true,
  message: "Check your email to verify account"
}
```

**Raj receives email:**
```
Subject: Verify your Black Index account

Click here to verify: 
https://black-index.vercel.app/verify?token=abc123

This link expires in 24 hours.
```

---

### **Step 1.3: Email Verification**

**Raj clicks verification link**

**What Black Index does:**
```javascript
// GET /verify?token=abc123

// Supabase verifies token
await supabase.auth.verifyOtp({
  token_hash: 'abc123',
  type: 'email'
})

// Updates profile
UPDATE profiles
SET email_verified = true
WHERE id = 'uuid-123';

// Auto-login and redirect
→ https://black-index.vercel.app/dashboard/founder
```

---

## 📦 STAGE 2: FOUNDER LISTS FIRST PRODUCT

### **Step 2.1: Dashboard First View**

**Raj lands on founder dashboard:**

**What he sees:**
```
┌─────────────────────────────────────────────┐
│  BLACK INDEX - Founder Dashboard           │
├─────────────────────────────────────────────┤
│                                             │
│  Welcome, Raj! 👋                          │
│                                             │
│  You have 0 products listed.               │
│  Let's add your first product.             │
│                                             │
│  [+ Add Product]                           │
│                                             │
│  ┌─────────────────────────────────┐       │
│  │  Quick Start Guide              │       │
│  │  1. Add your product            │       │
│  │  2. Set up payment method       │       │
│  │  3. Integrate tracking          │       │
│  │  4. Go live!                    │       │
│  └─────────────────────────────────┘       │
└─────────────────────────────────────────────┘
```

**What Black Index does:**
```javascript
// Page load: GET /api/dashboard/founder

// Fetch founder data
const founder = await supabase
  .from('profiles')
  .select('*')
  .eq('id', user.id)
  .single()

// Fetch products
const products = await supabase
  .from('products')
  .select('*, _count:links(count)')
  .eq('founder_id', user.id)

// Fetch recent transactions
const transactions = await supabase
  .from('transactions')
  .select('*')
  .in('product_id', productIds)
  .order('created_at', { desc: true })
  .limit(10)

// Calculate stats
const stats = {
  total_products: products.length,
  active_sellers: unique(transactions.map(t => t.seller_id)).length,
  unbilled_commissions: founder.unbilled_commissions,
  total_sales: transactions.reduce((sum, t) => sum + t.sale_amount, 0)
}

// Return dashboard data
```

---

### **Step 2.2: Add Product Form**

**Raj clicks "+ Add Product"**

**Modal appears:**
```
┌─────────────────────────────────────────────┐
│  Add New Product                            │
├─────────────────────────────────────────────┤
│                                             │
│  Product Name:                              │
│  [GSTGenius                              ]  │
│                                             │
│  Description:                               │
│  [Cloud GST invoicing for Indian busine  ]  │
│  [sses. Auto-calculate taxes, recurring  ]  │
│  [invoices, WhatsApp reminders.          ]  │
│                                             │
│  Website URL:                               │
│  [https://gstgenius.com                  ]  │
│                                             │
│  Logo URL (optional):                       │
│  [https://gstgenius.com/logo.png         ]  │
│                                             │
│  Product Type:                              │
│  (•) SaaS Subscription                      │
│  ( ) One-time Product                       │
│  ( ) Service                                │
│                                             │
│  Pricing:                                   │
│  ₹ [799] / [month ▼]                       │
│                                             │
│  ─────── Commission Structure ──────────    │
│                                             │
│  New Customer (First payment):              │
│  [40] % commission                          │
│                                             │
│  Recurring Customer:                        │
│  [20] % commission per renewal              │
│  Duration: [12] months                      │
│                                             │
│  Maximum CAC (optional):                    │
│  ₹ [500] per customer                      │
│                                             │
│  ─────── Example Calculation ──────────     │
│                                             │
│  If seller brings 1 customer:               │
│  • Month 1: ₹320 (40% of ₹799)            │
│  • Months 2-12: ₹160/month (20% of ₹799)  │
│  • Total: ₹2,080 over 12 months            │
│                                             │
│  [Cancel]  [Continue to Integration →]     │
└─────────────────────────────────────────────┘
```

**What Black Index does (real-time validation):**
```javascript
// As Raj types, frontend validates:

// URL validation
if (website_url) {
  try {
    new URL(website_url) // Throws if invalid
    setUrlValid(true)
  } catch {
    setError("Invalid URL")
  }
}

// Commission validation
if (upfront_pct < 10 || upfront_pct > 80) {
  setWarning("Typical range: 20-50%")
}

if (recurring_pct > upfront_pct) {
  setWarning("Recurring usually lower than upfront")
}

// Calculate example earnings (live)
const exampleEarnings = {
  month1: (price * upfront_pct / 100),
  monthly: (price * recurring_pct / 100),
  total: (price * upfront_pct / 100) + 
         (price * recurring_pct / 100) * recurring_months
}
```

**Raj clicks "Continue to Integration →"**

---

### **Step 2.3: Integration Setup**

**New modal appears:**

```
┌─────────────────────────────────────────────┐
│  Step 2: Payment Integration                │
├─────────────────────────────────────────────┤
│                                             │
│  How do customers pay?                      │
│                                             │
│  ┌────────────────────────────────┐        │
│  │ (•) I use Razorpay              │        │
│  │     Most Indian SaaS            │        │
│  └────────────────────────────────┘        │
│                                             │
│  ┌────────────────────────────────┐        │
│  │ ( ) I use Stripe                │        │
│  │     International/Global        │        │
│  └────────────────────────────────┘        │
│                                             │
│  ┌────────────────────────────────┐        │
│  │ ( ) I use Gumroad/LemonSqueezy │        │
│  │     Digital products            │        │
│  └────────────────────────────────┘        │
│                                             │
│  ┌────────────────────────────────┐        │
│  │ ( ) Manual/Other                │        │
│  │     I'll report sales manually  │        │
│  └────────────────────────────────┘        │
│                                             │
│  [← Back]  [Continue →]                    │
└─────────────────────────────────────────────┘
```

**Raj selects "I use Razorpay"**

---

### **Step 2.4: Razorpay Webhook Setup**

**Next screen:**

```
┌─────────────────────────────────────────────┐
│  Razorpay Integration Guide                 │
├─────────────────────────────────────────────┤
│                                             │
│  Step 1: Add tracking script to your site  │
│                                             │
│  Copy this code and add before </head>:     │
│                                             │
│  ┌─────────────────────────────────┐       │
│  │ <script src="https://black-    │ [Copy]│
│  │ index.vercel.app/track.js">     │       │
│  │ </script>                        │       │
│  └─────────────────────────────────┘       │
│                                             │
│  This captures ref_id from affiliate links.│
│                                             │
│  ─────────────────────────────────────────  │
│                                             │
│  Step 2: Set up Razorpay webhook           │
│                                             │
│  a) Go to Razorpay Dashboard →             │
│     Settings → Webhooks                     │
│                                             │
│  b) Click "Create New Webhook"             │
│                                             │
│  c) Enter this URL:                        │
│                                             │
│  ┌─────────────────────────────────┐       │
│  │ https://black-index.vercel.app/ │ [Copy]│
│  │ api/webhooks/razorpay           │       │
│  └─────────────────────────────────┘       │
│                                             │
│  d) Select these events:                   │
│     ☑ payment.captured                     │
│     ☑ invoice.paid                         │
│     ☑ subscription.charged                 │
│                                             │
│  e) Enter this secret (for security):      │
│                                             │
│  ┌─────────────────────────────────┐       │
│  │ whsec_a1b2c3d4e5f6g7h8i9j0...  │ [Copy]│
│  └─────────────────────────────────┘       │
│                                             │
│  [Watch 2-min Setup Video]                 │
│                                             │
│  ─────────────────────────────────────────  │
│                                             │
│  Step 3: Test the integration              │
│                                             │
│  [Send Test Webhook]                       │
│                                             │
│  Status: ⚪ Not tested yet                 │
│                                             │
│  [← Back]  [Skip for Now]  [Complete →]   │
└─────────────────────────────────────────────┘
```

**What Black Index does when product created:**

```javascript
// API call: POST /api/products/create

const webhook_secret = crypto.randomBytes(32).toString('hex')

const { data: product } = await supabase
  .from('products')
  .insert({
    founder_id: user.id,
    name: "GSTGenius",
    description: "Cloud GST invoicing...",
    website_url: "https://gstgenius.com",
    logo_url: "https://gstgenius.com/logo.png",
    is_active: false, // Not active until payment method set up
    commission_config: {
      type: "hybrid",
      upfront_pct: 40,
      recurring_pct: 20,
      max_recurring_months: 12
    },
    max_cac_limit: 50000, // ₹500 in paise
    webhook_secret: webhook_secret,
    product_type: "saas_subscription",
    price: 79900, // ₹799 in paise
    currency: "INR"
  })
  .select()
  .single()

// Return product with secret
return {
  success: true,
  product_id: product.id,
  webhook_secret: webhook_secret,
  webhook_url: `https://black-index.vercel.app/api/webhooks/razorpay`,
  tracking_script: `<script src="https://black-index.vercel.app/track.js"></script>`
}
```

---

### **Step 2.5: Test Webhook**

**Raj clicks "Send Test Webhook"**

**What Black Index does:**

```javascript
// API call: POST /api/products/:id/test-webhook

// Send test payload to YOUR webhook (not Razorpay's)
// This verifies the webhook_secret works

const testPayload = {
  event: "payment.captured",
  payload: {
    payment: {
      entity: {
        id: "pay_test_123",
        amount: 79900,
        currency: "INR",
        email: "test@example.com",
        notes: {
          ref_id: "test-ref-id-123"
        }
      }
    }
  }
}

// Simulate webhook call
const response = await fetch(`${YOUR_WEBHOOK_URL}/api/webhooks/test`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-razorpay-signature': generateTestSignature(testPayload, webhook_secret)
  },
  body: JSON.stringify(testPayload)
})

if (response.ok) {
  // Update UI
  Status: ✅ Integration working!
  
  // Activate product
  await supabase
    .from('products')
    .update({ is_active: true })
    .eq('id', product.id)
} else {
  Status: ❌ Integration failed
  Error: "Could not verify webhook. Check your setup."
}
```

**Success screen:**

```
┌─────────────────────────────────────────────┐
│  ✅ Product Added Successfully!            │
├─────────────────────────────────────────────┤
│                                             │
│  GSTGenius is now live on Black Index!     │
│                                             │
│  Sellers can now promote your product.     │
│                                             │
│  Next steps:                                │
│  1. Set up auto-billing (required)         │
│  2. Generate your first seller link        │
│  3. Share with your network                │
│                                             │
│  [Set Up Auto-Billing →]                   │
│                                             │
│  [View Product Page]  [Back to Dashboard]  │
└─────────────────────────────────────────────┘
```

---

## 💳 STAGE 3: FOUNDER SETS UP AUTO-BILLING

### **Step 3.1: Billing Setup Page**

**Raj clicks "Set Up Auto-Billing"**

```
┌─────────────────────────────────────────────┐
│  Payment Method Setup                       │
├─────────────────────────────────────────────┤
│                                             │
│  To pay commissions automatically, set up:  │
│                                             │
│  ┌────────────────────────────────┐        │
│  │ 🔷 UPI Autopay (Recommended)   │        │
│  │                                 │        │
│  │ ✓ No OTP after setup           │        │
│  │ ✓ Works with any UPI app       │        │
│  │ ✓ Lower fees (₹2/transaction)  │        │
│  │                                 │        │
│  │ [Set Up UPI Autopay]           │        │
│  └────────────────────────────────┘        │
│                                             │
│  ┌────────────────────────────────┐        │
│  │ 💳 Credit/Debit Card            │        │
│  │                                 │        │
│  │ ✓ International cards work     │        │
│  │ ⚠ Indian cards need OTP        │        │
│  │ • Higher fees (2%)             │        │
│  │                                 │        │
│  │ [Set Up Card]                  │        │
│  └────────────────────────────────┘        │
│                                             │
│  How it works:                              │
│  • You authorize max ₹1L/month             │
│  • We charge when commissions reach ₹3k    │
│  • 24h notification before charge (RBI)    │
│  • No manual top-ups needed                │
│                                             │
└─────────────────────────────────────────────┘
```

**Raj clicks "Set Up UPI Autopay"**

---

### **Step 3.2: UPI Mandate Creation**

**What Black Index does:**

```javascript
// API call: POST /api/billing/setup-mandate

// Step 1: Create/get Razorpay customer
let customerId = founder.razorpay_customer_id

if (!customerId) {
  const customer = await razorpay.customers.create({
    name: "Raj Kumar",
    email: "raj@gstgenius.com",
    contact: founder.phone || "",
    notes: {
      founder_id: founder.id,
      platform: "black_index"
    }
  })
  
  customerId = customer.id
  
  // Save to database
  await supabase
    .from('profiles')
    .update({ razorpay_customer_id: customerId })
    .eq('id', founder.id)
}

// Step 2: Create subscription (UPI mandate)
const subscription = await razorpay.subscriptions.create({
  plan_id: process.env.RAZORPAY_PLAN_ID, // Your variable amount plan
  customer_id: customerId,
  total_count: 999, // Effectively unlimited
  quantity: 1,
  start_at: Math.floor(Date.now() / 1000) + 300, // Start in 5 mins
  notes: {
    founder_id: founder.id,
    max_amount: 10000000, // ₹1L in paise
    payment_method: "upi"
  },
  notify_info: {
    notify_email: "raj@gstgenius.com"
  }
})

// Step 3: Save subscription details
await supabase
  .from('profiles')
  .update({
    razorpay_subscription_id: subscription.id,
    mandate_status: 'pending',
    mandate_payment_method: 'upi',
    mandate_max_amount: 10000000,
    mandate_created_at: new Date().toISOString()
  })
  .eq('id', founder.id)

// Step 4: Return authorization URL
return {
  success: true,
  subscription_id: subscription.id,
  short_url: subscription.short_url, // Razorpay hosted page
  message: "Complete authorization in GPay/PhonePe"
}
```

---

### **Step 3.3: UPI Authorization**

**Raj is redirected to Razorpay page:**

```
Razorpay Authorization Page:

┌─────────────────────────────────────────────┐
│  Authorize Recurring Payments               │
├─────────────────────────────────────────────┤
│                                             │
│  Black Index wants to auto-debit:          │
│  Maximum: ₹1,00,000 per month              │
│                                             │
│  Choose UPI App:                            │
│  [Google Pay]  [PhonePe]  [Paytm]         │
│                                             │
│  Or scan QR code:                           │
│  [QR CODE]                                  │
└─────────────────────────────────────────────┘
```

**Raj clicks "Google Pay"**

**GPay opens:**

```
Google Pay:

Black Index
wants to set up AutoPay

Amount: Up to ₹1,00,000/month
Frequency: As needed

[Authorize with UPI PIN]

Enter UPI PIN: [••••]

[Confirm]
```

**Raj enters PIN and confirms**

---

### **Step 3.4: Mandate Activated**

**What happens:**

```javascript
// Razorpay sends webhook to Black Index
POST /api/webhooks/razorpay
{
  "event": "subscription.authenticated",
  "payload": {
    "subscription": {
      "entity": {
        "id": "sub_abc123",
        "status": "active",
        "customer_id": "cust_xyz789"
      }
    }
  }
}

// Black Index webhook handler
export async function POST(request: NextRequest) {
  const event = await request.json()
  
  if (event.event === 'subscription.authenticated') {
    const subscriptionId = event.payload.subscription.entity.id
    
    // Update founder status
    await supabase
      .from('profiles')
      .update({
        mandate_status: 'active',
        mandate_activated_at: new Date().toISOString()
      })
      .where('razorpay_subscription_id', subscriptionId)
    
    // Activate all their products
    await supabase
      .from('products')
      .update({ is_active: true })
      .eq('founder_id', founderId)
  }
}

// Redirect Raj back to dashboard
→ https://black-index.vercel.app/dashboard/founder?setup=complete
```

**Raj sees:**

```
┌─────────────────────────────────────────────┐
│  ✅ Auto-Billing Activated!                │
├─────────────────────────────────────────────┤
│                                             │
│  Your payment method is set up.             │
│  You'll be charged when:                    │
│  • Commissions reach ₹3,000, OR            │
│  • Weekly (whichever comes first)           │
│                                             │
│  You'll get 24h notice before each charge.  │
│                                             │
│  GSTGenius is now LIVE! 🎉                 │
│  Sellers can start promoting.               │
│                                             │
│  [View Dashboard]                           │
└─────────────────────────────────────────────┘
```

---

## 📊 STAGE 4: FOUNDER MONITORING

### **Step 4.1: Dashboard Overview**

**Raj's dashboard now shows:**

```
┌─────────────────────────────────────────────┐
│  BLACK INDEX - Founder Dashboard           │
├─────────────────────────────────────────────┤
│                                             │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐      │
│  │ Unbilled│ │ Sellers │ │  Sales  │      │
│  │  ₹0     │ │    0    │ │    0    │      │
│  └─────────┘ └─────────┘ └─────────┘      │
│                                             │
│  Products (1)                               │
│  ┌───────────────────────────────────┐     │
│  │ 🟢 GSTGenius                      │     │
│  │ ₹799/month • 40% upfront + 20%   │     │
│  │ 0 active sellers • 0 sales        │     │
│  │                                   │     │
│  │ [View Analytics] [Get Link]      │     │
│  └───────────────────────────────────┘     │
│                                             │
│  Recent Activity                            │
│  No activity yet                            │
│                                             │
│  Payment Method                             │
│  ✅ UPI Autopay (₹1L max/month)           │
│  Next charge: When unbilled reaches ₹3k    │
│                                             │
└─────────────────────────────────────────────┘
```

**What Black Index is tracking (backend):**

```javascript
// Real-time dashboard data fetch
setInterval(async () => {
  const stats = await supabase
    .from('profiles')
    .select(`
      unbilled_commissions,
      mandate_status,
      products (
        id,
        name,
        is_active,
        _count_links:links(count),
        _count_sales:transactions(count)
      ),
      recent_transactions:transactions (
        id,
        created_at,
        sale_amount,
        commission_amount,
        seller:profiles(full_name)
      )
    `)
    .eq('id', founderId)
    .single()
  
  updateDashboard(stats)
}, 5000) // Update every 5 seconds
```

---

**Now Raj waits for sellers to promote his product...**

---

# 🎯 FLOW 2: THE SELLER JOURNEY

---

## 🔍 STAGE 1: SELLER DISCOVERS BLACK INDEX

### **Step 1.1: First Touch**

```
Seller (Aryan) sees Black Index via:
- Instagram reel from 250k influencer friend
- "Earn ₹5L/month selling products online"
- College WhatsApp group forward
- Twitter post

He clicks: https://black-index.vercel.app
```

**What Aryan sees:**
```
Landing page shows:
- "Earn by selling products. 40% commission + recurring income."
- Success story: "Priya earned ₹2.5L last month"
- [Start Earning] button
```

---

### **Step 1.2: Seller Signs Up**

**Aryan clicks "Start Earning"**

**Signup form:**
```
Email: aryan@example.com
Password: ••••••••••
Full Name: Aryan Sharma
Username: aryan_tech
[x] I agree to Terms

[Create Account]
```

**What Black Index does:**

```javascript
// POST /api/auth/signup

// Create auth user
const { user } = await supabase.auth.signUp({
  email: "aryan@example.com",
  password: "hashed_password"
})

// Create seller profile
await supabase
  .from('profiles')
  .insert({
    id: user.id,
    email: "aryan@example.com",
    full_name: "Aryan Sharma",
    username: "aryan_tech",
    role: "warlord", // Seller role
    pending_balance: 0,
    withdrawable_balance: 0,
    total_earnings: 0,
    kyc_verified: false
  })

// Send verification email
// Redirect to dashboard after verification
```

---

### **Step 1.3: Seller Onboarding**

**After verification, Aryan lands on dashboard:**

```
┌─────────────────────────────────────────────┐
│  Welcome to Black Index, Aryan! 👋         │
├─────────────────────────────────────────────┤
│                                             │
│  Quick Start:                               │
│  1. Browse products ✓ (You're here)        │
│  2. Generate your link                      │
│  3. Share and earn                          │
│                                             │
│  Your Earnings:                             │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐      │
│  │ Pending │ │Available│ │  Total  │      │
│  │  ₹0     │ │   ₹0    │ │   ₹0    │      │
│  └─────────┘ └─────────┘ └─────────┘      │
│                                             │
│  Available Products (1)                     │
│                                             │
│  ┌───────────────────────────────────┐     │
│  │ 🏢 GSTGenius                      │     │
│  │ Cloud GST invoicing for Indian    │     │
│  │ businesses                         │     │
│  │                                   │     │
│  │ Price: ₹799/month                 │     │
│  │ Your earnings:                    │     │
│  │ • ₹320 upfront (40%)              │     │
│  │ • ₹160/month for 12 months        │     │
│  │ Total: ₹2,080 per customer        │     │
│  │                                   │     │
│  │ [Generate Link] [Learn More]     │     │
│  └───────────────────────────────────┘     │
│                                             │
└─────────────────────────────────────────────┘
```

---

## 🔗 STAGE 2: SELLER GENERATES LINK

### **Step 2.1: Generate Link**

**Aryan clicks "Generate Link" on GSTGenius**

**What Black Index does:**

```javascript
// POST /api/links/generate
{
  product_id: "product-uuid-gstgenius",
  seller_id: "aryan-uuid"
}

// Check if link already exists
const existingLink = await supabase
  .from('links')
  .select('*')
  .eq('seller_id', aryanId)
  .eq('product_id', gstgeniusId)
  .maybeSingle()

if (existingLink) {
  // Return existing link
  return existingLink
}

// Create new link
const slug = `aryan-gstgenius-${shortid()}` // e.g., "aryan-gstgenius-x7k2"

const { data: link } = await supabase
  .from('links')
  .insert({
    id: generateUUID(),
    seller_id: aryanId,
    product_id: gstgeniusId,
    slug: slug,
    clicks: 0,
    unique_visitors: 0
  })
  .select()
  .single()

return {
  success: true,
  link_id: link.id,
  short_url: `https://black-index.vercel.app/ref/${slug}`,
  full_url: `https://black-index.vercel.app/ref/${slug}`
}
```

---

### **Step 2.2: Link Generated**

**Aryan sees:**

```
┌─────────────────────────────────────────────┐
│  ✅ Your Link is Ready!                    │
├─────────────────────────────────────────────┤
│                                             │
│  Share this link to earn:                   │
│                                             │
│  ┌─────────────────────────────────┐       │
│  │ https://black-index.vercel.     │ [Copy]│
│  │ app/ref/aryan-gstgenius-x7k2    │       │
│  └─────────────────────────────────┘       │
│                                             │
│  How to promote:                            │
│  • Share on social media                   │
│  • Send to business owners you know        │
│  • Create review/tutorial content          │
│  • Add to email signature                  │
│                                             │
│  [Download Graphics] [See Examples]        │
│                                             │
│  Sample Posts:                              │
│  ┌─────────────────────────────────┐       │
│  │ "Tired of GST calculation       │ [Copy]│
│  │  headaches? Check out GSTGenius │       │
│  │  - automates everything!        │       │
│  │  [link]"                        │       │
│  └─────────────────────────────────┘       │
│                                             │
│  Your Stats:                                │
│  Clicks: 0 | Sales: 0 | Earned: ₹0        │
│                                             │
│  [Back to Dashboard]                       │
└─────────────────────────────────────────────┘
```

---

## 📢 STAGE 3: SELLER PROMOTES

### **Step 3.1: Aryan Shares Link**

**Aryan copies link and posts on Twitter:**

```
Twitter Post:

Just found GSTGenius - game changer for Indian businesses! 

✅ Auto-calculate GST
✅ Recurring invoices
✅ WhatsApp reminders
✅ Cloud sync

Try it: https://black-index.vercel.app/ref/aryan-gstgenius-x7k2

#GSTIndia #SaaS #SmallBusiness
```

**Aryan also:**
- Sends to 5 business owner friends on WhatsApp
- Posts in 2 entrepreneur Facebook groups
- Adds to LinkedIn post about business tools

---

## ⏳ STAGE 4: SELLER WAITS

**Aryan checks dashboard next day:**

```
Dashboard shows:
┌─────────────────────────────────────────────┐
│  Link Performance                           │
│  https://...ref/aryan-gstgenius-x7k2       │
│                                             │
│  Clicks: 23                                 │
│  Unique visitors: 18                        │
│  Sales: 0                                   │
│  Conversion rate: 0%                        │
│                                             │
│  Earnings: ₹0                              │
└─────────────────────────────────────────────┘
```

**What Black Index tracked:**

```javascript
// Every click on Aryan's link:
GET /ref/aryan-gstgenius-x7k2

// Async logging (doesn't block redirect)
await supabase
  .from('links')
  .update({
    clicks: clicks + 1
  })
  .eq('slug', 'aryan-gstgenius-x7k2')

// Track unique visitor (via IP + user agent hash)
const visitorHash = hash(ip + userAgent)
if (!seenBefore(visitorHash)) {
  unique_visitors++
}

// Then redirect to founder's site
→ https://gstgenius.com?ref_id=550e8400-link-uuid
```

**Aryan waits for someone to buy...**

---

# 🛒 FLOW 3: THE BUYER JOURNEY

---

## 🖱️ STAGE 1: BUYER CLICKS LINK

### **Step 1.1: Initial Click**

```
Buyer (Rohan) sees Aryan's Twitter post
He clicks: https://black-index.vercel.app/ref/aryan-gstgenius-x7k2
```

**What happens (Black Index):**

```javascript
// GET /ref/aryan-gstgenius-x7k2

export async function GET(request, { params }) {
  const { slug } = params
  const supabase = createAdminClient()
  
  // 1. Find link
  const { data: link } = await supabase
    .from('links')
    .select(`
      id,
      seller_id,
      product:products(id, website_url, is_active)
    `)
    .eq('slug', slug)
    .single()
  
  if (!link) {
    return new NextResponse('Link not found', { status: 404 })
  }
  
  if (!link.product.is_active) {
    return new NextResponse('Product not available', { status: 410 })
  }
  
  // 2. Log click (async, non-blocking)
  supabase
    .from('links')
    .update({ clicks: link.clicks + 1 })
    .eq('id', link.id)
    .then()
  
  // 3. Build redirect URL with ref_id
  const productUrl = new URL(link.product.website_url)
  productUrl.searchParams.set('ref_id', link.id) // CRITICAL: Attach link UUID
  
  // 4. Redirect immediately (don't block user)
  return NextResponse.redirect(productUrl.toString(), 307)
}
```

**Rohan is redirected to:**
```
https://gstgenius.com?ref_id=550e8400-e29b-41d4-a716-446655440000
                             ↑
                      This is the link.id (UUID)
                      Maps to Aryan's seller account
```

---

## 🌐 STAGE 2: BUYER ON FOUNDER'S SITE

### **Step 2.1: Landing on GSTGenius**

**Rohan lands on GSTGenius.com**

**What the page does (Founder's JavaScript):**

```javascript
// GSTGenius has Black Index tracking script installed
<script src="https://black-index.vercel.app/track.js"></script>

// track.js auto-executes:
(function() {
  // 1. Extract ref_id from URL
  const urlParams = new URLSearchParams(window.location.search)
  const refId = urlParams.get('ref_id')
  
  // 2. Store it (multiple methods for reliability)
  if (refId) {
    // LocalStorage
    localStorage.setItem('bi_ref_id', refId)
    
    // Cookie (30 days)
    document.cookie = `bi_ref_id=${refId}; max-age=2592000; path=/; SameSite=Lax`
    
    // SessionStorage (backup)
    sessionStorage.setItem('bi_ref_id', refId)
    
    console.log('[Black Index] Tracking initialized:', refId)
  }
  
  // 3. Expose globally for checkout
  window.BlackIndex = {
    getRefId: function() {
      return localStorage.getItem('bi_ref_id') || 
             document.cookie.match(/bi_ref_id=([^;]+)/)?.[1] ||
             sessionStorage.getItem('bi_ref_id')
    }
  }
})()
```

**Result:**
- ref_id is now stored on Rohan's browser
- Survives page navigation
- Will be included in checkout

---

### **Step 2.2: Rohan Browses Site**

**Rohan:**
- Reads about GSTGenius features
- Watches demo video
- Checks pricing (₹799/month)
- Clicks "Start Free Trial"

**The ref_id stays in his browser cookies/storage the entire time**

---

### **Step 2.3: Rohan Signs Up for Trial**

**GSTGenius signup form:**
```
Email: rohan@mybusiness.com
Business Name: Rohan Traders
Phone: +91 98765 43210

[Start Free Trial]
```

**GSTGenius backend:**

```javascript
// Founder's signup API
app.post('/api/signup', async (req, res) => {
  const { email, business_name, phone } = req.body
  
  // Create user account
  const user = await createUser(email, business_name, phone)
  
  // ⚠️ CRITICAL: Capture ref_id from frontend
  // Frontend sends it:
  const refId = req.body.ref_id // From BlackIndex.getRefId()
  
  // Store with user record
  await db.users.update(user.id, {
    signup_ref_id: refId,
    signup_source: 'black_index'
  })
  
  res.json({ success: true, user_id: user.id })
})
```

**Frontend (GSTGenius checkout page) includes:**

```javascript
// When user clicks "Start Free Trial"
const refId = window.BlackIndex?.getRefId()

fetch('/api/signup', {
  method: 'POST',
  body: JSON.stringify({
    email: 'rohan@mybusiness.com',
    business_name: 'Rohan Traders',
    phone: '+91 98765 43210',
    ref_id: refId // ← CRITICAL: Include ref_id
  })
})
```

---

## 💳 STAGE 3: BUYER SUBSCRIBES (Free Trial Starts)

### **Step 3.1: Trial Activated**

**Rohan gets:**
- 14-day free trial
- Full access to GSTGenius
- No payment yet

**What GSTGenius does:**

```javascript
// Create Razorpay subscription (starts after trial)
const subscription = await razorpay.subscriptions.create({
  plan_id: 'plan_gst_genius_799',
  customer_id: rohanCustomerId,
  total_count: 12, // 12 months
  quantity: 1,
  start_at: Math.floor(Date.now() / 1000) + (14 * 86400), // Start after 14 days
  notes: {
    user_id: user.id,
    ref_id: refId, // ← CRITICAL: Include in Razorpay metadata
    business_name: 'Rohan Traders'
  }
})

// Save subscription
await db.subscriptions.insert({
  user_id: user.id,
  razorpay_subscription_id: subscription.id,
  status: 'trialing',
  trial_end: addDays(new Date(), 14),
  ref_id: refId // Store for later
})
```

**Rohan receives email:**
```
Subject: Welcome to GSTGenius!

Your 14-day trial has started.
After trial, you'll be charged ₹799/month.

Start using GSTGenius now: [Link]
```

---

## ⏰ STAGE 4: TRIAL ENDS, FIRST PAYMENT

### **Step 4.1: Day 14 - First Charge**

**14 days later, Razorpay auto-charges Rohan:**

```javascript
// Razorpay automatically charges ₹799
// (subscription starts, trial period over)

// Razorpay sends webhook to GSTGenius:
POST https://gstgenius.com/api/webhooks/razorpay
{
  "event": "subscription.charged",
  "payload": {
    "subscription": {
      "entity": {
        "id": "sub_abc123",
        "status": "active",
        "customer_id": "cust_rohan",
        "notes": {
          "ref_id": "550e8400-e29b-41d4-a716-446655440000"
        }
      }
    },
    "payment": {
      "entity": {
        "id": "pay_xyz789",
        "amount": 79900, // ₹799 in paise
        "status": "captured",
        "email": "rohan@mybusiness.com"
      }
    }
  }
}
```

---

### **Step 4.2: GSTGenius Forwards to Black Index**

**GSTGenius webhook handler:**

```javascript
// GSTGenius backend receives Razorpay webhook
app.post('/api/webhooks/razorpay', async (req, res) => {
  const event = req.body
  
  if (event.event === 'subscription.charged') {
    const subscription = event.payload.subscription.entity
    const payment = event.payload.payment.entity
    
    // Extract ref_id
    const refId = subscription.notes.ref_id
    
    // Update local database
    await db.subscriptions.update({
      status: 'active',
      last_payment: new Date()
    }, { razorpay_subscription_id: subscription.id })
    
    // ⭐ CRITICAL: Forward to Black Index
    if (refId) {
      await fetch('https://black-index.vercel.app/api/webhooks/razorpay', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-black-index-signature': generateHMAC(event, webhookSecret)
        },
        body: JSON.stringify({
          event_type: 'payment.success',
          product_id: 'product-uuid-gstgenius',
          ref_id: refId, // ← THE KEY
          amount: payment.amount,
          customer_id: payment.email,
          transaction_id: payment.id,
          subscription_id: subscription.id
        })
      })
    }
  }
  
  res.json({ success: true })
})
```

---

# 🎛️ FLOW 4: BLACK INDEX PROCESSES SALE

---

## 🔍 STAGE 1: WEBHOOK RECEIVED

### **Step 1.1: Webhook Hits Black Index**

```
POST https://black-index.vercel.app/api/webhooks/razorpay
Headers:
  Content-Type: application/json
  x-black-index-signature: hmac_sha256_signature

Body:
{
  "event_type": "payment.success",
  "product_id": "product-uuid-gstgenius",
  "ref_id": "550e8400-e29b-41d4-a716-446655440000",
  "amount": 79900,
  "customer_id": "rohan@mybusiness.com",
  "transaction_id": "pay_xyz789",
  "subscription_id": "sub_abc123"
}
```

**What Black Index does:**

```javascript
export async function POST(request: NextRequest) {
  const supabase = createAdminClient()
  const rawBody = await request.text()
  const payload = JSON.parse(rawBody)
  
  console.log('[WEBHOOK] Received:', payload)
  
  // ============================================
  // STEP 1: EXTRACT DATA
  // ============================================
  
  const {
    event_type,
    product_id,
    ref_id,
    amount,
    customer_id,
    transaction_id,
    subscription_id
  } = payload
  
  // ============================================
  // STEP 2: VALIDATE EVENT TYPE
  // ============================================
  
  if (event_type !== 'payment.success') {
    await logWebhook(supabase, product_id, payload, 'ignored', 'Unsupported event type')
    return NextResponse.json({ message: 'Event type not processed' })
  }
  
  // ============================================
  // STEP 3: CHECK FOR ref_id (CRITICAL)
  // ============================================
  
  if (!ref_id) {
    // NO ref_id = Direct sale (not through Black Index)
    console.log('[WEBHOOK] Direct sale, no ref_id')
    await logWebhook(supabase, product_id, payload, 'ignored', 'No ref_id - direct sale')
    
    return NextResponse.json({
      message: 'Direct sale, no commission',
      affiliate: false
    })
  }
  
  console.log('[WEBHOOK] Affiliate sale detected, ref_id:', ref_id)
  
  // ============================================
  // STEP 4: VALIDATE ref_id
  // ============================================
  
  const { data: link, error: linkError } = await supabase
    .from('links')
    .select(`
      id,
      seller_id,
      product:products(
        id,
        founder_id,
        name,
        commission_config,
        webhook_secret,
        max_cac_limit
      )
    `)
    .eq('id', ref_id)
    .single()
  
  if (linkError || !link) {
    console.error('[WEBHOOK] Invalid ref_id:', ref_id)
    await logWebhook(supabase, product_id, payload, 'rejected', 'Invalid ref_id')
    
    return NextResponse.json({
      error: 'Invalid ref_id',
      message: 'This ref_id does not exist in our system'
    }, { status: 400 })
  }
  
  console.log('[WEBHOOK] Valid link found, seller:', link.seller_id)
  
  // ============================================
  // STEP 5: VERIFY PRODUCT MATCH
  // ============================================
  
  if (link.product.id !== product_id) {
    console.error('[WEBHOOK] Product mismatch')
    await logWebhook(supabase, product_id, payload, 'rejected', 'Product mismatch')
    
    return NextResponse.json({
      error: 'Product mismatch',
      message: 'ref_id is for a different product'
    }, { status: 400 })
  }
  
  // ============================================
  // STEP 6: VERIFY HMAC SIGNATURE
  // ============================================
  
  const signature = request.headers.get('x-black-index-signature')
  
  if (signature) {
    const expectedSignature = crypto
      .createHmac('sha256', link.product.webhook_secret)
      .update(rawBody)
      .digest('hex')
    
    if (signature !== expectedSignature) {
      console.error('[WEBHOOK] Invalid signature')
      await logWebhook(supabase, product_id, payload, 'rejected', 'Invalid signature')
      
      return NextResponse.json({
        error: 'Invalid signature'
      }, { status: 401 })
    }
    
    console.log('[WEBHOOK] Signature verified ✓')
  }
  
  // ============================================
  // STEP 7: IDEMPOTENCY CHECK
  // ============================================
  
  const { data: existingTxn } = await supabase
    .from('transactions')
    .select('id')
    .eq('external_transaction_id', transaction_id)
    .maybeSingle()
  
  if (existingTxn) {
    console.log('[WEBHOOK] Duplicate transaction, already processed')
    await logWebhook(supabase, product_id, payload, 'success', 'Duplicate - already processed')
    
    return NextResponse.json({
      message: 'Already processed',
      transaction_id: existingTxn.id
    })
  }
  
  // ============================================
  // STEP 8: FRAUD CHECK - SELF-REFERRAL
  // ============================================
  
  const selfReferralCheck = await checkSelfReferral(
    supabase,
    link.seller_id,
    customer_id
  )
  
  if (selfReferralCheck.isFraud) {
    console.warn('[FRAUD] Self-referral detected:', link.seller_id)
    await logWebhook(supabase, product_id, payload, 'fraud_blocked', selfReferralCheck.reason)
    
    // Create transaction with ₹0 commission
    await supabase.from('transactions').insert({
      type: 'sale',
      status: 'fraud_blocked',
      billing_status: 'unbilled',
      product_id: link.product.id,
      seller_id: link.seller_id,
      link_id: link.id,
      sale_amount: amount,
      commission_amount: 0,
      platform_fee: 0,
      external_customer_id: customer_id,
      external_transaction_id: transaction_id,
      ref_id: ref_id
    })
    
    // Don't alert attacker - return success
    return NextResponse.json({
      message: 'Processed',
      commission: 0
    })
  }
  
  console.log('[WEBHOOK] Fraud check passed ✓')
  
  // ============================================
  // STEP 9: DETERMINE NEW vs RECURRING
  // ============================================
  
  const { data: existingCustomer } = await supabase
    .from('customers')
    .select('id')
    .eq('product_id', link.product.id)
    .eq('external_customer_id', customer_id)
    .maybeSingle()
  
  const isNewCustomer = !existingCustomer
  
  if (isNewCustomer) {
    console.log('[WEBHOOK] NEW customer')
    await supabase.from('customers').insert({
      product_id: link.product.id,
      seller_id: link.seller_id,
      external_customer_id: customer_id
    })
  } else {
    console.log('[WEBHOOK] RECURRING customer')
  }
  
  // ============================================
  // STEP 10: CALCULATE COMMISSION
  // ============================================
  
  const config = link.product.commission_config
  const commissionPct = isNewCustomer ? config.upfront_pct : (config.recurring_pct || 0)
  
  let commissionAmount = Math.floor((amount * commissionPct) / 100)
  
  // Apply CAC limit if set
  if (link.product.max_cac_limit && commissionAmount > link.product.max_cac_limit) {
    commissionAmount = link.product.max_cac_limit
  }
  
  const platformFee = Math.floor((commissionAmount * 10) / 100) // 10% platform fee
  const netCommission = commissionAmount - platformFee
  
  console.log('[WEBHOOK] Commission calculated:', {
    isNewCustomer,
    commissionPct,
    commissionAmount,
    platformFee,
    netCommission
  })
  
  // ============================================
  // STEP 11: VELOCITY CHECK
  // ============================================
  
  const velocityCheck = await checkVelocityLimits(
    supabase,
    link.product.founder_id,
    netCommission + platformFee
  )
  
  if (!velocityCheck.allowed) {
    console.warn('[FRAUD] Velocity limit exceeded:', link.product.founder_id)
    await logWebhook(supabase, product_id, payload, 'rejected', velocityCheck.reason)
    
    return NextResponse.json({
      error: 'Rate limit exceeded',
      message: velocityCheck.reason
    }, { status: 429 })
  }
  
  console.log('[WEBHOOK] Velocity check passed ✓')
  
  // ============================================
  // STEP 12: CREATE TRANSACTION (UNBILLED)
  // ============================================
  
  const payoutDueDate = new Date()
  payoutDueDate.setDate(payoutDueDate.getDate() + 30) // T+30 escrow
  
  const { data: transaction, error: txnError } = await supabase
    .from('transactions')
    .insert({
      type: 'sale',
      status: 'pending',
      billing_status: 'unbilled', // ← Key: Not billed yet
      product_id: link.product.id,
      seller_id: link.seller_id,
      link_id: link.id,
      sale_amount: amount,
      commission_amount: netCommission,
      platform_fee: platformFee,
      external_customer_id: customer_id,
      external_transaction_id: transaction_id,
      payout_due_date: payoutDueDate.toISOString(),
      ref_id: ref_id
    })
    .select()
    .single()
  
  if (txnError) {
    console.error('[WEBHOOK] Transaction creation failed:', txnError)
    await logWebhook(supabase, product_id, payload, 'failed', txnError.message)
    
    return NextResponse.json({
      error: 'Failed to create transaction'
    }, { status: 500 })
  }
  
  console.log('[WEBHOOK] Transaction created:', transaction.id)
  
  // ============================================
  // STEP 13: INCREMENT UNBILLED COMMISSIONS
  // ============================================
  
  await supabase.rpc('increment_unbilled_commissions', {
    p_founder_id: link.product.founder_id,
    p_amount: netCommission + platformFee
  })
  
  console.log('[WEBHOOK] Founder unbilled amount updated')
  
  // ============================================
  // STEP 14: CHECK IF CHARGE SHOULD BE SCHEDULED
  // ============================================
  
  await checkAndScheduleCharge(supabase, link.product.founder_id)
  
  console.log('[WEBHOOK] Checked for charge threshold')
  
  // ============================================
  // STEP 15: LOG SUCCESS
  // ============================================
  
  await logWebhook(supabase, product_id, payload, 'success', null)
  
  // ============================================
  // STEP 16: RETURN RESPONSE
  // ============================================
  
  return NextResponse.json({
    success: true,
    transaction_id: transaction.id,
    customer_type: isNewCustomer ? 'NEW' : 'RECURRING',
    commission: netCommission / 100, // Convert paise to rupees
    platform_fee: platformFee / 100,
    message: 'Commission will be paid after 30-day escrow period'
  })
}
```

---

## 💰 STAGE 2: COMMISSION TRACKED

### **Step 2.1: Database State After Webhook**

**`transactions` table:**
```sql
id: txn-uuid-123
type: 'sale'
status: 'pending'
billing_status: 'unbilled' ← Key
product_id: product-uuid-gstgenius
seller_id: aryan-uuid
link_id: link-uuid-aryan-gst
sale_amount: 79900 (₹799)
commission_amount: 28800 (₹288 after 10% platform fee)
platform_fee: 3200 (₹32)
external_customer_id: rohan@mybusiness.com
external_transaction_id: pay_xyz789
payout_due_date: 2026-02-03 (30 days from now)
ref_id: 550e8400-link-uuid
created_at: 2026-01-04 10:30:00
```

**`profiles` table (Raj - Founder):**
```sql
id: raj-uuid
unbilled_commissions: 32000 (₹320: ₹288 + ₹32) ← Incremented
charge_threshold: 300000 (₹3,000)
mandate_status: 'active'
last_charge_date: null (no charges yet)
```

**`profiles` table (Aryan - Seller):**
```sql
id: aryan-uuid
pending_balance: 0 ← NOT updated yet (still unbilled)
withdrawable_balance: 0
total_earnings: 0
```

**Key insight: Aryan does NOT see money yet because founder hasn't been charged**

---

### **Step 2.2: What Everyone Sees**

**Aryan's dashboard:**
```
┌─────────────────────────────────────────────┐
│  Link Performance                           │
│  https://...ref/aryan-gstgenius-x7k2       │
│                                             │
│  Clicks: 23                                 │
│  Sales: 1 ✨ NEW                           │
│  Conversion: 4.3%                           │
│                                             │
│  ┌───────────────────────────────────┐     │
│  │ ⏳ Processing                    │     │
│  │ Sale detected: ₹799               │     │
│  │ Your commission: ₹288             │     │
│  │ Status: Waiting for founder       │     │
│  │         payment                   │     │
│  └───────────────────────────────────┘     │
│                                             │
│  Pending: ₹0                               │
│  Available: ₹0                             │
└─────────────────────────────────────────────┘
```

**Raj's dashboard:**
```
┌─────────────────────────────────────────────┐
│  Unbilled Commissions: ₹320                │
│  (Will be charged when reaching ₹3,000)    │
│                                             │
│  Recent Sales:                              │
│  ┌───────────────────────────────────┐     │
│  │ 📊 New sale!                     │     │
│  │ Product: GSTGenius                │     │
│  │ Amount: ₹799                      │     │
│  │ Commission: ₹320                  │     │
│  │ Status: Unbilled                  │     │
│  │ Seller: aryan_tech                │     │
│  └───────────────────────────────────┘     │
└─────────────────────────────────────────────┘
```

**Rohan (buyer):**
- Using GSTGenius
- Doesn't know about Black Index
- Doesn't see any affiliate info

---

## ⏰ STAGE 3: THRESHOLD HIT & CHARGING

### **Step 3.1: More Sales Come In**

**Over next few days:**
- 9 more customers sign up via Aryan's link
- Total unbilled commissions: ₹3,200 (crosses ₹3k threshold)

**What Black Index does automatically:**

```javascript
// After each webhook, this runs:
await checkAndScheduleCharge(supabase, founderId)

// Inside checkAndScheduleCharge:
const founder = await supabase
  .from('profiles')
  .select('*')
  .eq('id', founderId)
  .single()

const unbilled = founder.unbilled_commissions // ₹3,200
const threshold = founder.charge_threshold // ₹3,000

if (unbilled >= threshold) {
  // THRESHOLD HIT! Schedule charge
  
  const chargeScheduledAt = new Date()
  chargeScheduledAt.setHours(chargeScheduledAt.getHours() + 24) // RBI: 24h notice
  
  const { data: schedule } = await supabase
    .from('charge_schedules')
    .insert({
      founder_id: founderId,
      amount: unbilled, // ₹3,200
      trigger_reason: 'threshold',
      charge_scheduled_at: chargeScheduledAt.toISOString(),
      status: 'scheduled'
    })
    .select()
    .single()
  
  // Send pre-debit notification

  await sendPreDebitNotification(supabase, schedule.id)
  
  // Update transactions to "scheduled"
  await supabase
    .from('transactions')
    .update({ billing_status: 'scheduled', charge_schedule_id: schedule.id })
    .eq('billing_status', 'unbilled')
    .eq('founder_id', founderId)
}
```

---

### **Step 3.2: Pre-Debit Notification (RBI Compliance)**

**Raj receives:**

**Email:**
```
Subject: Black Index - Upcoming Charge Notification

Hi Raj,

We will charge ₹3,200 from your UPI Autopay on:
Date: January 5, 2026 at 10:30 AM

This covers commissions for:
- 10 sales
- Total revenue generated: ₹7,990

Breakdown:
- Seller commissions: ₹2,880
- Platform fee: ₹320
- Total: ₹3,200

Questions? Visit your dashboard.

Best,
Black Index Team
```

**SMS:**
```
Black Index will charge ₹3,200 tomorrow at 10:30 AM for commissions. View details: [link]
```

---

### **Step 3.3: 24 Hours Later - Charge Executes**

**Cron job runs (every hour):**

```javascript
// GET /api/cron/execute-charges (triggered by Vercel Cron)

// Find all charges due for execution
const { data: dueCharges } = await supabase
  .from('charge_schedules')
  .select('*, founder:profiles!founder_id(*)')
  .eq('status', 'notified')
  .lte('charge_scheduled_at', new Date().toISOString())

for (const charge of dueCharges) {
  await executeCharge(supabase, charge)
}

// Inside executeCharge:
async function executeCharge(supabase, charge) {
  const founder = charge.founder
  
  // Update status
  await supabase
    .from('charge_schedules')
    .update({ status: 'processing' })
    .eq('id', charge.id)
  
  // Create Razorpay invoice (charges via mandate)
  const invoice = await razorpay.invoices.create({
    type: 'invoice',
    customer_id: founder.razorpay_customer_id,
    amount: charge.amount, // ₹3,200
    currency: 'INR',
    description: `Black Index - Commission charges (threshold)`,
    notes: {
      charge_schedule_id: charge.id,
      founder_id: founder.id
    }
  })
  
  // Issue invoice (triggers auto-charge via UPI mandate)
  await razorpay.invoices.issue(invoice.id)
  
  // Wait 2 seconds
  await sleep(2000)
  
  // Check status
  const updatedInvoice = await razorpay.invoices.fetch(invoice.id)
  
  if (updatedInvoice.status === 'paid') {
    // ✅ SUCCESS
    await handleChargeSuccess(supabase, charge, invoice.id, updatedInvoice.payment_id)
  } else {
    // ⏳ PENDING or ❌ FAILED
    await handleChargePending(supabase, charge, invoice.id)
  }
}
```

---

### **Step 3.4: Charge Success**

**What happens:**

```javascript
async function handleChargeSuccess(supabase, charge, invoiceId, paymentId) {
  // 1. Update charge schedule
  await supabase
    .from('charge_schedules')
    .update({
      status: 'completed',
      charge_executed_at: new Date().toISOString(),
      razorpay_invoice_id: invoiceId,
      razorpay_payment_id: paymentId
    })
    .eq('id', charge.id)
  
  // 2. Get all transactions for this charge
  const { data: transactions } = await supabase
    .from('transactions')
    .select('*')
    .eq('charge_schedule_id', charge.id)
    .eq('billing_status', 'scheduled')
  
  // 3. Credit each seller's PENDING balance
  for (const txn of transactions) {
    await supabase.rpc('lock_commission_funds', {
      p_seller_id: txn.seller_id,
      p_amount: txn.commission_amount
    })
    
    // Mark transaction as billed
    await supabase
      .from('transactions')
      .update({
        billing_status: 'billed',
        billed_at: new Date().toISOString()
      })
      .eq('id', txn.id)
  }
  
  // 4. Reset founder's unbilled amount
  await supabase
    .from('profiles')
    .update({
      unbilled_commissions: 0,
      last_charge_date: new Date().toISOString(),
      total_charges_today: 0
    })
    .eq('id', charge.founder_id)
  
  // 5. Update founder tier (if applicable)
  await supabase.rpc('update_founder_tier', {
    p_founder_id: charge.founder_id
  })
  
  console.log('[CHARGE SUCCESS] Founder:', charge.founder_id, 'Amount:', charge.amount)
}
```

---

### **Step 3.5: What Everyone Sees Now**

**Aryan's dashboard:**
```
┌─────────────────────────────────────────────┐
│  Earnings                                   │
│                                             │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐      │
│  │ Pending │ │Available│ │  Total  │      │
│  │ ₹2,880  │ │   ₹0    │ │ ₹2,880  │      │
│  └─────────┘ └─────────┘ └─────────┘      │
│       ↑                                     │
│  NOW SHOWING!                               │
│                                             │
│  Recent Transactions:                       │
│  ✅ 10 sales billed                        │
│  Status: In escrow (29 days remaining)     │
│                                             │
│  Payout available: February 3, 2026        │
└─────────────────────────────────────────────┘
```

**Raj's dashboard:**
```
┌─────────────────────────────────────────────┐
│  ✅ Charge Successful                      │
│  ₹3,200 charged via UPI Autopay            │
│                                             │
│  Unbilled: ₹0                              │
│  Next charge: When unbilled reaches ₹3k    │
│                                             │
│  Total paid to date: ₹3,200                │
└─────────────────────────────────────────────┘
```

---

## 💸 STAGE 4: PAYOUT TO SELLER

### **Step 4.1: 30 Days Later**

**On February 3, 2026 (T+30 days):**

**Black Index cron job runs:**

```javascript
// Move pending → withdrawable for transactions past payout_due_date

const { data: clearedTransactions } = await supabase
  .from('transactions')
  .select('*')
  .eq('status', 'pending')
  .eq('billing_status', 'billed')
  .lte('payout_due_date', new Date().toISOString())

for (const txn of clearedTransactions) {
  // Move to withdrawable
  await supabase
    .from('profiles')
    .update({
      pending_balance: sql`pending_balance - ${txn.commission_amount}`,
      withdrawable_balance: sql`withdrawable_balance + ${txn.commission_amount}`
    })
    .eq('id', txn.seller_id)
  
  // Update transaction status
  await supabase
    .from('transactions')
    .update({ status: 'cleared' })
    .eq('id', txn.id)
}
```

**Aryan's dashboard:**
```
┌─────────────────────────────────────────────┐
│  Earnings                                   │
│                                             │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐      │
│  │ Pending │ │Available│ │  Total  │      │
│  │   ₹0    │ │ ₹2,880  │ │ ₹2,880  │      │
│  └─────────┘ └─────────┘ └─────────┘      │
│                    ↑                        │
│             NOW WITHDRAWABLE!               │
│                                             │
│  [Withdraw ₹2,880]                         │
└─────────────────────────────────────────────┘
```

---

### **Step 4.2: Aryan Requests Payout**

**Aryan clicks "Withdraw ₹2,880"**

**First-time payout - KYC required:**

```
┌─────────────────────────────────────────────┐
│  Add Bank Details                           │
├─────────────────────────────────────────────┤
│                                             │
│  Choose payout method:                      │
│                                             │
│  (•) UPI ID (Instant)                      │
│  ( ) Bank Account (2-4 hours)              │
│                                             │
│  UPI ID:                                    │
│  [aryan@paytm                            ]  │
│                                             │
│  Account Holder Name:                       │
│  [Aryan Sharma                           ]  │
│                                             │
│  [Save & Continue]                          │
└─────────────────────────────────────────────┘
```

**Aryan enters details and clicks "Save & Continue"**

---

### **Step 4.3: Payout Executed**

**What Black Index does:**

```javascript
// POST /api/seller/request-payout

const seller = await supabase
  .from('profiles')
  .select('*')
  .eq('id', aryanId)
  .single()

// Validate minimum payout
if (seller.withdrawable_balance < 100000) { // ₹1,000
  return { error: 'Minimum payout is ₹1,000' }
}

// Create/get Razorpay fund account
let fundAccountId = seller.razorpay_fund_account_id

if (!fundAccountId) {
  // Create contact
  const contact = await razorpayx.contacts.create({
    name: 'Aryan Sharma',
    email: 'aryan@example.com',
    type: 'vendor',
    reference_id: aryanId
  })
  
  // Create fund account
  const fundAccount = await razorpayx.fundAccount.create({
    contact_id: contact.id,
    account_type: 'vpa', // UPI
    vpa: {
      address: 'aryan@paytm'
    }
  })
  
  fundAccountId = fundAccount.id
  
  await supabase
    .from('profiles')
    .update({
      razorpay_customer_id: contact.id,
      razorpay_fund_account_id: fundAccountId
    })
    .eq('id', aryanId)
}

// Create payout
const payout = await razorpayx.payouts.create({
  account_number: process.env.RAZORPAY_ACCOUNT_NUMBER,
  fund_account_id: fundAccountId,
  amount: seller.withdrawable_balance, // ₹2,880
  currency: 'INR',
  mode: 'UPI', // Instant
  purpose: 'payout',
  reference_id: `payout_${aryanId}_${Date.now()}`,
  narration: 'Black Index Earnings'
})

// Record transaction
await supabase.from('transactions').insert({
  type: 'payout',
  status: 'paid',
  seller_id: aryanId,
  sale_amount: 0,
  commission_amount: seller.withdrawable_balance,
  platform_fee: 0,
  external_transaction_id: payout.id
})

// Update seller balance
await supabase
  .from('profiles')
  .update({
    withdrawable_balance: 0,
    total_withdrawn: (seller.total_withdrawn || 0) + seller.withdrawable_balance
  })
  .eq('id', aryanId)

return {
  success: true,
  payout_id: payout.id,
  amount: 2880,
  message: 'Money will arrive in 2-4 hours'
}
```

---

### **Step 4.4: Aryan Receives Money**

**2-3 hours later:**

**Aryan's bank account:**
```
Credit: ₹2,880
From: RAZORPAY
Narration: Black Index Earnings
```

**Aryan's dashboard:**
```
┌─────────────────────────────────────────────┐
│  ✅ Payout Successful                      │
│  ₹2,880 transferred to aryan@paytm         │
│                                             │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐      │
│  │ Pending │ │Available│ │  Total  │      │
│  │   ₹0    │ │   ₹0    │ │ ₹2,880  │      │
│  └─────────┘ └─────────┘ └─────────┘      │
│                                             │
│  Total Withdrawn: ₹2,880                   │
│                                             │
│  [View Transaction History]                │
└─────────────────────────────────────────────┘
```

---

# 📊 COMPLETE TIMELINE SUMMARY

```
DAY 0:
- Raj (Founder) signs up, lists GSTGenius, sets up UPI Autopay
- Aryan (Seller) signs up, generates affiliate link
- Aryan shares link on Twitter

DAY 1:
- Rohan (Buyer) clicks link
- Redirected to gstgenius.com?ref_id=550e8400-uuid
- ref_id stored in browser
- Rohan signs up for 14-day free trial

DAY 14:
- Trial ends, Razorpay charges Rohan ₹799
- GSTGenius forwards webhook to Black Index
- Black Index validates ref_id, checks fraud
- Transaction created: ₹288 commission (unbilled)
- Raj's unbilled: ₹320

DAYS 15-20:
- 9 more customers sign up via Aryan's link
- Raj's unbilled: ₹3,200 (crosses ₹3k threshold)
- Black Index schedules charge

DAY 21:
- 24h pre-debit notification sent to Raj

DAY 22:
- Razorpay charges Raj ₹3,200 via UPI mandate
- Aryan's pending balance: ₹2,880
- Transaction status: billed (T+30 escrow starts)

DAY 52 (30 days later):
- Escrow cleared
- Aryan's withdrawable balance: ₹2,880
- Aryan requests payout
- RazorpayX sends ₹2,880 to aryan@paytm

DAY 52 (2-3 hours later):
- Aryan receives money in bank
- Complete! 🎉
```

---

# 🎯 KEY TAKEAWAYS

**ref_id is the backbone:**
- Attached at redirect
- Stored in browser
- Included in checkout
- Sent via webhook
- Validates entire flow

**Money never touches Black Index:**
- Customer → Founder (direct)
- Founder → Black Index (via mandate)
- Black Index → Seller (payout)

**Multiple fraud checks:**
- Self-referral detection
- Velocity limits
- Suspicious patterns
- All transparent to legitimate users

**Everyone knows their status:**
- Raj sees unbilled → when he'll be charged
- Aryan sees pending → when he can withdraw
- System is fully transparent

---

**This is the complete, detailed flow of Black Index. Every single step.** 🖤✨