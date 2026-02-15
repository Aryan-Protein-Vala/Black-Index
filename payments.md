Here is the Master Architecture Document for the payments system.


Markdown

# 💳 Black Index: Financial Engine Architecture
**Status:** Approved
**Stack:** Next.js, Supabase, Razorpay (Subscriptions + Invoices), RazorpayX (Payouts)

## 🧠 The Core Logic: "The Meter"
We do **not** charge Founders instantly per sale (RBI 24-hour notification rule).
Instead, we implement a **"Metered Billing"** system:
1.  **Accumulate:** Sales increase the Founder's `unbilled_amount`.
2.  **Trigger:** When `unbilled_amount >= threshold` (e.g., ₹5,000), we schedule a charge.
3.  **Notify:** Send "Pre-Debit Notification" (Email/SMS).
4.  **Charge:** Execute auto-debit 24 hours later via Razorpay Mandate (UPI/Card).
5.  **Distribute:** Only *after* success, credit Sellers' `pending_balance`.

---

## 🏗️ Step 0: Database Schema Updates (Supabase)

Run this SQL to upgrade the `profiles` and `transactions` tables for financial tracking.

```sql
-- 1. UPDATE PROFILES (Founders & Sellers)
alter table public.profiles 
add column if not exists razorpay_customer_id text,
add column if not exists razorpay_subscription_id text, -- The Mandate ID
add column if not exists mandate_status text check (mandate_status in ('active', 'paused', 'failed', 'pending')),
add column if not exists mandate_max_limit bigint default 10000000, -- ₹1 Lakh (in paise)

-- The "Meter" (Founders)
add column if not exists unbilled_amount bigint default 0, -- Amount owed to us
add column if not exists billing_threshold bigint default 500000, -- ₹5,000 trigger (in paise)
add column if not exists last_charge_date timestamp with time zone,

-- Banking (Sellers)
add column if not exists razorpay_fund_account_id text, -- For RazorpayX payouts
add column if not exists upi_vpa text; -- Seller's UPI ID for payouts

-- 2. CREATE "CHARGES" TABLE (Billing Events)
create table public.charges (
  id uuid default gen_random_uuid() primary key,
  founder_id uuid references public.profiles(id) not null,
  amount bigint not null,
  status text check (status in ('scheduled', 'notified', 'processing', 'paid', 'failed')) default 'scheduled',
  
  -- RBI Compliance
  notification_sent_at timestamp with time zone,
  scheduled_execution_at timestamp with time zone, -- 24h after notification
  
  razorpay_invoice_id text,
  razorpay_payment_id text,
  failure_reason text,
  
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- 3. LINK TRANSACTIONS TO CHARGES
alter table public.transactions
add column if not exists charge_id uuid references public.charges(id);
-- When a sale happens, it has NO charge_id. 
-- When we run a batch charge, we update these rows with the new charge_id.
🚀 Step 1: Founder Billing Setup (Frontend + API)
Goal: Founder clicks "Authorize Auto-Pay" and sets up a recurring mandate.

A. API Route: app/api/founders/billing/create-mandate/route.ts

Logic:

Create a Razorpay Customer.

Create a Razorpay Subscription (Plan Type: "Periodic", Amount: Variable/On-demand).

Return short_url to frontend.

B. Frontend: components/founder/setup-billing.tsx

UI: "Authorize Black Index to debit commissions up to ₹1,00,000/month."

Action: Opens Razorpay Checkout. User enters UPI PIN once.

Callback: On success, update profiles.razorpay_subscription_id.

👂 Step 2: The "Meter" (Webhook Logic)
Goal: Record debt, don't charge yet.

Update: app/api/webhooks/conversion/route.ts

Current Logic: Validates signature -> Inserts Transaction.

New Logic:

Calculate total_deduction (Commission + Platform Fee).

Update Founder Profile: unbilled_amount = unbilled_amount + total_deduction.

Insert Transaction with status: 'unbilled'.

Trigger Check:

IF unbilled_amount >= billing_threshold: Call scheduleCharge(founder_id).

⏱️ Step 3: The "Biller" (Scheduled Logic)
Goal: The engine that manages the 24h RBI delay.

A. Function: scheduleCharge(founder_id)

Create a row in charges table.

amount: Current unbilled_amount.

status: 'notified'.

scheduled_execution_at: NOW() + 24 HOURS.

Send Notification: Email/SMS to Founder: "Scheduled Charge: ₹5,000 will be debited on [Date] for [X] sales."

B. Cron Job: api/cron/execute-charges (Runs hourly)

Query charges where status = 'notified' AND scheduled_execution_at <= NOW().

Loop & Execute:

Call Razorpay API: create_invoice({ subscription_id, amount }).

Note: This triggers the actual debit against the mandate.

Handle Response:

Success: * Mark charge as paid.

Find all transactions linked to this charge -> Update to status: 'pending' (Escrow start).

Credit Sellers' pending_balance.

Reset Founder's unbilled_amount to 0.

Failure:

Mark charge failed.

Pause Founder's Products (Safety Switch).

Notify Founder.

💸 Step 4: Seller Payouts (The Vault)
Goal: Allow Sellers to withdraw "Cleared" funds.

A. API Route: app/api/sellers/withdraw/route.ts

Check withdrawable_balance (Must be > ₹1000).

Fetch Seller's razorpay_fund_account_id (create if needed using Bank/UPI details).

Execute: Call RazorpayX payouts.create.

On Success:

Deduct withdrawable_balance.

Insert Transaction: type: 'payout', status: 'paid'.

🧪 Implementation Order
DB Schema: Run the SQL.

Founder Settings: Build the "Authorize Mandate" UI.

Webhook Update: Switch to "Metered" accumulation.

Cron Job: Build the execute-charges endpoint (you can trigger this manually for testing).

Payouts: Build the Withdraw button.