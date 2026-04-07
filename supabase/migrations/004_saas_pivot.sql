-- ============================================
-- BLACK INDEX: SaaS PIVOT MIGRATION
-- Run this AFTER schema.sql + additional-schema.sql
-- ============================================

-- ============================================
-- 1. ALTER customers → add billing_count and status
-- ============================================
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS status text DEFAULT 'active'
  CHECK (status IN ('active', 'cancelled', 'churned'));
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS billing_count int DEFAULT 0;

-- ============================================
-- 2. ADD wallet/connect columns to profiles
-- ============================================
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS wallet_balance bigint DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS security_deposit_paid boolean DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS stripe_connect_id text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS razorpay_account_id text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone text;

-- ============================================
-- 3. ADD category to products
-- ============================================
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS category text DEFAULT 'other'
  CHECK (category IN ('b2b', 'ai_saas', 'devtools', 'marketing', 'creator_tools', 'other'));

-- ============================================
-- 4. ADD is_recurring, billing_status, cleared_at to transactions (if missing)
-- ============================================
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS is_recurring boolean DEFAULT false;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS billing_status text DEFAULT 'unbilled';
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS cleared_at timestamptz;

-- ============================================
-- 5. CREATE fraud_reports table
-- ============================================
CREATE TABLE IF NOT EXISTS public.fraud_reports (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  reporter_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  founder_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  evidence_url text NOT NULL,
  description text,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'rejected')),
  resolution_notes text,
  bounty_paid boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  resolved_at timestamptz
);

ALTER TABLE public.fraud_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own fraud reports" ON fraud_reports
  FOR SELECT USING (auth.uid() = reporter_id);

CREATE POLICY "Users can insert fraud reports" ON fraud_reports
  FOR INSERT WITH CHECK (auth.uid() = reporter_id);

-- ============================================
-- 6. CREATE notifications table
-- ============================================
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  type text NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  metadata jsonb,
  read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notifications" ON notifications
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications" ON notifications
  FOR UPDATE USING (auth.uid() = user_id);

-- ============================================
-- 7. CREATE founder_deposits table (track security deposits & refunds)
-- ============================================
CREATE TABLE IF NOT EXISTS public.founder_deposits (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  founder_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  type text NOT NULL CHECK (type IN ('security_deposit', 'wallet_topup', 'refund')),
  amount bigint NOT NULL, -- in paise
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'refunded')),
  payment_id text, -- Razorpay/Stripe payment ID
  order_id text,   -- Razorpay/Stripe order ID
  refund_reason text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.founder_deposits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Founders can view own deposits" ON founder_deposits
  FOR SELECT USING (auth.uid() = founder_id);

-- ============================================
-- 8. NEW INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_fraud_reports_product ON fraud_reports(product_id);
CREATE INDEX IF NOT EXISTS idx_fraud_reports_status ON fraud_reports(status);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, read);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_customers_billing ON customers(product_id, external_customer_id, billing_count);
CREATE INDEX IF NOT EXISTS idx_founder_deposits_founder ON founder_deposits(founder_id);
CREATE INDEX IF NOT EXISTS idx_profiles_stripe_connect ON profiles(stripe_connect_id) WHERE stripe_connect_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_profiles_razorpay_account ON profiles(razorpay_account_id) WHERE razorpay_account_id IS NOT NULL;
