-- ============================================
-- Black Index - Advanced Billing System
-- Run this in Supabase SQL Editor
-- ============================================

-- ============================================
-- 1. UPDATE PROFILES FOR METERED BILLING
-- ============================================
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS razorpay_customer_id TEXT,
ADD COLUMN IF NOT EXISTS razorpay_subscription_id TEXT,
ADD COLUMN IF NOT EXISTS mandate_max_amount BIGINT DEFAULT 10000000, -- ₹1L max auto-debit
ADD COLUMN IF NOT EXISTS unbilled_amount BIGINT DEFAULT 0, -- The "Meter" - accumulates until threshold
ADD COLUMN IF NOT EXISTS charge_threshold BIGINT DEFAULT 500000, -- ₹5k trigger for billing
ADD COLUMN IF NOT EXISTS razorpay_fund_account_id TEXT,
ADD COLUMN IF NOT EXISTS upi_vpa TEXT;

-- ============================================
-- 2. CHARGE SCHEDULES (RBI Compliance Engine)
-- ============================================
-- This table tracks scheduled charges with 24h notification requirement
CREATE TABLE IF NOT EXISTS public.charge_schedules (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    founder_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    amount BIGINT NOT NULL, -- Amount in paise
    status TEXT CHECK (status IN ('scheduled', 'notified', 'processing', 'paid', 'failed')) DEFAULT 'scheduled',
    notification_sent_at TIMESTAMPTZ,
    charge_scheduled_at TIMESTAMPTZ, -- 24h after notification (RBI requirement)
    razorpay_invoice_id TEXT,
    failure_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for cron queries
CREATE INDEX IF NOT EXISTS idx_charge_schedules_status ON charge_schedules(status);
CREATE INDEX IF NOT EXISTS idx_charge_schedules_founder ON charge_schedules(founder_id);

-- Enable RLS
ALTER TABLE charge_schedules ENABLE ROW LEVEL SECURITY;

-- Founders can only see their own charges
DROP POLICY IF EXISTS "Founders can view own charges" ON charge_schedules;
CREATE POLICY "Founders can view own charges" ON charge_schedules
    FOR SELECT USING (founder_id = auth.uid());

-- ============================================
-- 3. UPDATE PRODUCTS FOR FEATURED
-- ============================================
ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS is_featured BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS featured_until TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS tracking_type TEXT CHECK (tracking_type IN ('webhook', 'manual')) DEFAULT 'webhook';

-- ============================================
-- 4. UPDATE TRANSACTIONS FOR BILLING STATUS
-- ============================================
ALTER TABLE public.transactions
ADD COLUMN IF NOT EXISTS billing_status TEXT CHECK (billing_status IN ('unbilled', 'scheduled', 'billed')) DEFAULT 'unbilled',
ADD COLUMN IF NOT EXISTS charge_schedule_id UUID REFERENCES public.charge_schedules(id),
ADD COLUMN IF NOT EXISTS external_customer_id TEXT, -- For recurring checks
ADD COLUMN IF NOT EXISTS is_recurring BOOLEAN DEFAULT FALSE;

-- ============================================
-- 5. STORED PROCEDURES
-- ============================================

-- Increment click count (atomic)
CREATE OR REPLACE FUNCTION increment_clicks(link_id UUID)
RETURNS VOID AS $$
BEGIN
    UPDATE links SET clicks = clicks + 1 WHERE id = link_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Increment unbilled amount (atomic)
CREATE OR REPLACE FUNCTION increment_unbilled(founder_id UUID, amount BIGINT)
RETURNS VOID AS $$
BEGIN
    UPDATE profiles SET unbilled_amount = unbilled_amount + amount WHERE id = founder_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Reset unbilled after charge
CREATE OR REPLACE FUNCTION reset_unbilled(founder_id UUID)
RETURNS VOID AS $$
BEGIN
    UPDATE profiles SET unbilled_amount = 0 WHERE id = founder_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Move pending to withdrawable (for T+30 escrow release)
CREATE OR REPLACE FUNCTION release_escrow(seller_id UUID, amount BIGINT)
RETURNS VOID AS $$
BEGIN
    UPDATE profiles 
    SET pending_balance = pending_balance - amount,
        withdrawable_balance = withdrawable_balance + amount
    WHERE id = seller_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 6. FEATURED PRODUCTS PAYMENT LOG
-- ============================================
CREATE TABLE IF NOT EXISTS public.featured_payments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    product_id UUID REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
    founder_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    order_id TEXT UNIQUE NOT NULL,
    payment_id TEXT,
    amount BIGINT NOT NULL, -- 499900 paise = ₹4999
    status TEXT CHECK (status IN ('created', 'succeeded', 'failed')) DEFAULT 'created',
    months_purchased INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE featured_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Founders can view own featured payments" ON featured_payments;
CREATE POLICY "Founders can view own featured payments" ON featured_payments
    FOR SELECT USING (founder_id = auth.uid());

-- ============================================
-- COMMENTS
-- ============================================
COMMENT ON TABLE charge_schedules IS 'Tracks metered billing charges with 24h RBI notification requirement';
COMMENT ON COLUMN profiles.unbilled_amount IS 'Accumulated commissions waiting to be charged to founder';
COMMENT ON COLUMN profiles.charge_threshold IS 'Trigger point for creating a charge schedule';
COMMENT ON COLUMN transactions.is_recurring IS 'True if this is a repeat purchase by same customer';
COMMENT ON TABLE featured_payments IS 'Payment records for featured product subscriptions';
