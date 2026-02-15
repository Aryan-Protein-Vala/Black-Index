# ⚔️ BLACK INDEX: SYSTEM IMPLEMENTATION PROTOCOL
**Version:** 1.0 (Production)
**Stack:** Next.js 14, Supabase, Razorpay (Subscriptions + X), Tailwind

---

## 🏗️ PART 1: THE LEDGER (Database Schema)
**Instruction:** Run this in Supabase SQL Editor. This sets up the "God Mode" commission engine and "Metered Billing" infrastructure.

```sql
-- 1. PROFILES (Warlords & Founders)
alter table public.profiles 
add column if not exists role text check (role in ('admin', 'founder', 'warlord')) default 'warlord',
add column if not exists razorpay_customer_id text,
add column if not exists razorpay_subscription_id text, -- UPI/Card Mandate
add column if not exists mandate_max_amount bigint default 10000000, -- ₹1L Limit
add column if not exists unbilled_amount bigint default 0, -- The "Meter"
add column if not exists charge_threshold bigint default 500000, -- ₹5k Trigger
add column if not exists pending_balance bigint default 0, -- Escrow (T+30)
add column if not exists withdrawable_balance bigint default 0, -- Cleared Funds
add column if not exists total_earnings bigint default 0,
add column if not exists razorpay_fund_account_id text, -- Seller Payout
add column if not exists upi_vpa text;

-- 2. PRODUCTS (The Armoury)
create table if not exists public.products (
  id uuid default gen_random_uuid() primary key,
  founder_id uuid references public.profiles(id) not null,
  name text not null,
  website_url text not null,
  webhook_secret text not null, -- HMAC Key
  tracking_type text check (tracking_type in ('webhook', 'manual')) default 'webhook',
  -- GOD MODE CONFIG: { "type": "hybrid", "upfront_pct": 40, "recurring_pct": 15 }
  commission_config jsonb not null, 
  is_active boolean default true,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- 3. CHARGE SCHEDULES (RBI Compliance Engine)
create table if not exists public.charge_schedules (
  id uuid default gen_random_uuid() primary key,
  founder_id uuid references public.profiles(id) not null,
  amount bigint not null,
  status text check (status in ('scheduled', 'notified', 'processing', 'paid', 'failed')) default 'scheduled',
  notification_sent_at timestamp with time zone,
  charge_scheduled_at timestamp with time zone, -- 24h delay target
  razorpay_invoice_id text,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- 4. TRANSACTIONS (The Flow)
create table if not exists public.transactions (
  id uuid default gen_random_uuid() primary key,
  type text check (type in ('sale', 'refund', 'payout')) not null,
  status text check (status in ('unbilled', 'pending', 'cleared', 'paid', 'cancelled')) default 'unbilled',
  billing_status text check (billing_status in ('unbilled', 'scheduled', 'billed')) default 'unbilled',
  product_id uuid references public.products(id),
  seller_id uuid references public.profiles(id),
  charge_schedule_id uuid references public.charge_schedules(id),
  sale_amount bigint not null,
  commission_amount bigint not null,
  platform_fee bigint not null,
  external_customer_id text, -- For Recurring checks
  payout_due_date timestamp with time zone, -- T+30 Lock
  created_at timestamp with time zone default timezone('utc'::text, now())
);
🔗 PART 2: THE SPINE (Tracking & Redirect)
File: app/ref/[slug]/route.ts

TypeScript

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'

export async function GET(req: NextRequest, { params }: { params: { slug: string } }) {
  const supabase = createAdminClient()
  
  // 1. Lookup Link
  const { data: link } = await supabase
    .from('links')
    .select('*, product:products(website_url)')
    .eq('slug', params.slug)
    .single()

  if (!link) return new NextResponse('Invalid Link', { status: 404 })

  // 2. Async Click Count (Fire & Forget)
  supabase.rpc('increment_clicks', { link_id: link.id })

  // 3. Construct Destination
  const url = new URL(link.product.website_url)
  url.searchParams.set('ref_id', link.id) // The Handshake

  return NextResponse.redirect(url.toString(), 307)
}
👂 PART 3: THE EARS (Ingestion & Fraud)
File: app/api/webhooks/conversion/route.ts

TypeScript

import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
// ... imports

export async function POST(req: NextRequest) {
  const body = await req.json()
  const signature = req.headers.get('x-black-index-signature')
  
  // 1. VALIDATE SIGNATURE
  // Fetch secret from DB based on product_id in body
  // crypto.createHmac... compare signature. If fail -> 401.

  // 2. SELF-REFERRAL KILL SWITCH
  const { data: link } = await supabase.from('links').select('seller:profiles(email)').eq('id', body.ref_id).single()
  if (link.seller.email === body.customer_email) {
    return NextResponse.json({ status: 'blocked', reason: 'self_referral' }) // 200 OK to fool hacker
  }

  // 3. CALCULATE COMMISSION (God Mode)
  // Check if external_customer_id exists in transactions
  // If New: commission = sale_amount * 0.40
  // If Recurring: commission = sale_amount * 0.15

  // 4. UPDATE METER
  const total_deduction = commission + platform_fee
  await supabase.rpc('increment_unbilled', { founder_id, amount: total_deduction })
  
  // 5. INSERT TRANSACTION
  await supabase.from('transactions').insert({
    status: 'unbilled', // Waiting for Founder Charge
    payout_due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // T+30
    // ... details
  })

  // 6. TRIGGER CHECK
  // If unbilled > 5000 -> Schedule Charge
}
⏱️ PART 4: THE BILLER (Cron Job)
File: app/api/cron/execute-charges/route.ts Schedule: Hourly

Logic:

Notification: Find charges where status='scheduled'. Send Email. Update to 'notified', set scheduled_at to +24h.

Execution: Find charges where status='notified' AND time >= now.

Call razorpay.invoices.create (Triggers UPI/Card Auto-debit).

IF SUCCESS:

Update Charge -> 'paid'.

Update Linked Transactions -> status 'pending' (Escrow starts).

Credit Seller's pending_balance.

IF FAIL:

Pause Product. Email Founder.

💰 PART 5: THE VAULT (Payouts)
File: app/api/seller/withdraw/route.ts

TypeScript

export async function POST(req: NextRequest) {
  // 1. THRESHOLD CHECK (The "Discount Hacker" Fix)
  if (seller.withdrawable_balance < 300000) { // 3000.00 INR
    return NextResponse.json({ error: 'Vault Locked. Min withdrawal ₹3,000' }, { status: 400 })
  }

  // 2. EXECUTE PAYOUT (RazorpayX)
  const payout = await razorpayx.payouts.create({
    account_number: process.env.RAZORPAYX_ACC,
    fund_account_id: seller.fund_id,
    amount: seller.withdrawable_balance,
    mode: 'UPI',
    purpose: 'payout'
  })

  // 3. ZERO BALANCE
  // Update DB: withdrawable_balance = 0
}
🛠️ PART 6: MANUAL REPORTING (High Ticket Service)
File: app/api/founders/report-manual/route.ts

Logic:

Founder submits: Amount, Customer Name, Ref ID.

System creates Transaction with status pending_verification.

Admin (You) approves it.

Transaction moves to unbilled -> Adds to Meter -> Charged in next cycle.