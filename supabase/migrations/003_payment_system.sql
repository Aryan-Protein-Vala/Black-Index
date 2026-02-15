-- Black Index: Financial Engine - Database Schema Updates
-- Status: Step 0 - Database Schema
-- Run this in Supabase SQL Editor

-- 1. UPDATE PROFILES (Founders & Sellers)
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS razorpay_customer_id text,
ADD COLUMN IF NOT EXISTS razorpay_subscription_id text, -- The Mandate ID
ADD COLUMN IF NOT EXISTS mandate_status text CHECK (mandate_status IN ('active', 'paused', 'failed', 'pending')),
ADD COLUMN IF NOT EXISTS mandate_max_limit bigint DEFAULT 10000000, -- ₹1 Lakh (in paise)

-- The "Meter" (Founders)
ADD COLUMN IF NOT EXISTS unbilled_amount bigint DEFAULT 0, -- Amount owed to us
ADD COLUMN IF NOT EXISTS billing_threshold bigint DEFAULT 500000, -- ₹5,000 trigger (in paise)
ADD COLUMN IF NOT EXISTS last_charge_date timestamp with time zone,

-- Banking (Sellers)
ADD COLUMN IF NOT EXISTS razorpay_fund_account_id text, -- For RazorpayX payouts
ADD COLUMN IF NOT EXISTS upi_vpa text; -- Seller's UPI ID for payouts

-- 2. CREATE "CHARGES" TABLE (Billing Events)
CREATE TABLE IF NOT EXISTS public.charges (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  founder_id uuid REFERENCES public.profiles(id) NOT NULL,
  amount bigint NOT NULL,
  status text CHECK (status IN ('scheduled', 'notified', 'processing', 'paid', 'failed')) DEFAULT 'scheduled',
  
  -- RBI Compliance
  notification_sent_at timestamp with time zone,
  scheduled_execution_at timestamp with time zone, -- 24h after notification
  
  razorpay_invoice_id text,
  razorpay_payment_id text,
  failure_reason text,
  
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now())
);

-- Index for cron job queries
CREATE INDEX IF NOT EXISTS charges_status_execution_idx 
ON public.charges(status, scheduled_execution_at);

-- Index for founder lookups
CREATE INDEX IF NOT EXISTS charges_founder_idx 
ON public.charges(founder_id);

-- 3. LINK TRANSACTIONS TO CHARGES
ALTER TABLE public.transactions
ADD COLUMN IF NOT EXISTS charge_id uuid REFERENCES public.charges(id);

-- 4. RLS Policies for charges table
ALTER TABLE public.charges ENABLE ROW LEVEL SECURITY;

-- Service role can manage all charges
CREATE POLICY "Service role can manage charges" ON public.charges
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- Founders can view their own charges
CREATE POLICY "Founders can view own charges" ON public.charges
    FOR SELECT
    USING (founder_id = auth.uid());
