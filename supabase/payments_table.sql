-- ============================================
-- Black Index - Payment Logging System
-- Run this in your Supabase SQL Editor
-- ============================================

-- Create payment status enum
DO $$ BEGIN
    CREATE TYPE payment_status AS ENUM ('created', 'attempted', 'succeeded', 'failed', 'refunded');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create payment source enum
DO $$ BEGIN
    CREATE TYPE payment_source AS ENUM ('checkout', 'webhook');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ============================================
-- PAYMENTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    order_id TEXT UNIQUE NOT NULL,
    payment_id TEXT,
    amount INTEGER NOT NULL, -- in paise
    currency TEXT NOT NULL DEFAULT 'INR',
    status payment_status NOT NULL DEFAULT 'created',
    payment_type TEXT NOT NULL DEFAULT 'founder_upgrade', -- founder_upgrade, product_purchase, etc.
    failure_reason TEXT,
    metadata JSONB DEFAULT '{}'::jsonb, -- additional flexible data
    source payment_source NOT NULL DEFAULT 'checkout',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_payments_user_id ON payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_order_id ON payments(order_id);
CREATE INDEX IF NOT EXISTS idx_payments_payment_id ON payments(payment_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);

-- ============================================
-- RLS POLICIES
-- ============================================
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- Users can only view their own payments
DROP POLICY IF EXISTS "Users can view own payments" ON payments;
CREATE POLICY "Users can view own payments" ON payments
    FOR SELECT USING (auth.uid() = user_id);

-- NO INSERT/UPDATE/DELETE policies = server-only write access
-- Only service_role can modify payments

-- ============================================
-- UPDATED_AT TRIGGER
-- ============================================
CREATE OR REPLACE FUNCTION update_payments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_payments_updated_at ON payments;
CREATE TRIGGER trigger_payments_updated_at
    BEFORE UPDATE ON payments
    FOR EACH ROW
    EXECUTE FUNCTION update_payments_updated_at();

-- ============================================
-- PAYMENT STATE TRANSITIONS
-- ============================================
-- 
-- created → attempted (user opened checkout but didn't complete)
-- created → succeeded (direct success from verify endpoint)
-- created → failed (payment failed)
-- attempted → succeeded (retry success)
-- attempted → failed (final failure)
-- succeeded → refunded (manual refund processed)
--
-- Webhooks should NOT downgrade:
-- - succeeded → failed (ignore)
-- - refunded → any (ignore)
--

COMMENT ON TABLE payments IS 'Server-managed payment logs. RLS protected - users can only read their own. Write access via service_role only.';
COMMENT ON COLUMN payments.order_id IS 'Razorpay order ID - unique identifier for idempotency';
COMMENT ON COLUMN payments.payment_id IS 'Razorpay payment ID - set after successful payment';
COMMENT ON COLUMN payments.source IS 'checkout = from verify endpoint, webhook = from Razorpay webhook';
