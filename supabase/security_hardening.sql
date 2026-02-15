-- ============================================
-- Black Index - Security Hardening SQL
-- Run this in your Supabase SQL Editor
-- ============================================

-- ============================================
-- PART 1: VERIFY/FIX RLS POLICIES
-- ============================================

-- Enable RLS on all tables (if not already enabled)
ALTER TABLE IF EXISTS profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS products ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS links ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS charges ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS payout_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS webhook_logs ENABLE ROW LEVEL SECURITY;

-- ============================================
-- PROFILES TABLE POLICIES
-- ============================================
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;

CREATE POLICY "Users can view own profile" ON profiles
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON profiles
    FOR UPDATE USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- ============================================
-- PRODUCTS TABLE POLICIES
-- ============================================
DROP POLICY IF EXISTS "Anyone can view active products" ON products;
DROP POLICY IF EXISTS "Founders can view own products" ON products;
DROP POLICY IF EXISTS "Founders can insert own products" ON products;
DROP POLICY IF EXISTS "Founders can update own products" ON products;
DROP POLICY IF EXISTS "Founders can delete own products" ON products;

-- Public can only see active products
CREATE POLICY "Anyone can view active products" ON products
    FOR SELECT USING (is_active = true);

-- Founders can see ALL their own products (including inactive)
CREATE POLICY "Founders can view own products" ON products
    FOR SELECT USING (founder_id = auth.uid());

-- Founders can only insert products they own
CREATE POLICY "Founders can insert own products" ON products
    FOR INSERT WITH CHECK (founder_id = auth.uid());

-- Founders can only update their own products
CREATE POLICY "Founders can update own products" ON products
    FOR UPDATE USING (founder_id = auth.uid())
    WITH CHECK (founder_id = auth.uid());

-- Founders can only delete their own products
CREATE POLICY "Founders can delete own products" ON products
    FOR DELETE USING (founder_id = auth.uid());

-- ============================================
-- LINKS TABLE POLICIES
-- ============================================
DROP POLICY IF EXISTS "Sellers can view own links" ON links;
DROP POLICY IF EXISTS "Sellers can insert own links" ON links;
DROP POLICY IF EXISTS "Public links are viewable" ON links;

-- Sellers can see their own links
CREATE POLICY "Sellers can view own links" ON links
    FOR SELECT USING (seller_id = auth.uid());

-- Sellers can create links (must be their own)
CREATE POLICY "Sellers can insert own links" ON links
    FOR INSERT WITH CHECK (seller_id = auth.uid());

-- Anyone can view links (needed for redirect)
CREATE POLICY "Public links are viewable" ON links
    FOR SELECT USING (true);

-- ============================================
-- TRANSACTIONS TABLE POLICIES
-- ============================================
DROP POLICY IF EXISTS "Sellers can view own transactions" ON transactions;
DROP POLICY IF EXISTS "Founders can view product transactions" ON transactions;

-- Sellers see transactions where they are the seller
CREATE POLICY "Sellers can view own transactions" ON transactions
    FOR SELECT USING (seller_id = auth.uid());

-- ============================================
-- CHARGES TABLE POLICIES
-- ============================================
DROP POLICY IF EXISTS "Founders can view own charges" ON charges;

-- Founders can only see their own charges
CREATE POLICY "Founders can view own charges" ON charges
    FOR SELECT USING (founder_id = auth.uid());

-- ============================================
-- PAYOUT REQUESTS TABLE POLICIES
-- ============================================
DROP POLICY IF EXISTS "Sellers can view own payouts" ON payout_requests;
DROP POLICY IF EXISTS "Sellers can request payouts" ON payout_requests;

-- Sellers can see their payout requests
CREATE POLICY "Sellers can view own payouts" ON payout_requests
    FOR SELECT USING (seller_id = auth.uid());

-- Sellers can insert payout requests (must be their own)
CREATE POLICY "Sellers can request payouts" ON payout_requests
    FOR INSERT WITH CHECK (seller_id = auth.uid());

-- NO UPDATE policy - payouts are immutable after creation

-- ============================================
-- CUSTOMERS TABLE - SERVER ONLY
-- ============================================
-- No SELECT/INSERT/UPDATE/DELETE policies = completely blocked for anon/authenticated
-- Only service_role can access this table

-- ============================================
-- WEBHOOK_LOGS TABLE - SERVER ONLY
-- ============================================
-- No policies = server-only access

-- ============================================
-- PART 2: ROLES TABLE FOR ADMIN MANAGEMENT
-- ============================================

-- Create roles enum type
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('warlord', 'founder', 'admin', 'super_admin');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create roles table
CREATE TABLE IF NOT EXISTS user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role user_role NOT NULL DEFAULT 'warlord',
    granted_by UUID REFERENCES auth.users(id),
    granted_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, role)
);

-- Enable RLS on roles table
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

-- Only admins can view roles (via service_role in server routes)
-- No client-side access to roles table

-- ============================================
-- HELPER FUNCTION: Check if user is admin
-- ============================================
CREATE OR REPLACE FUNCTION is_admin(user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM user_roles 
        WHERE user_roles.user_id = $1 
        AND role IN ('admin', 'super_admin')
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- VERIFICATION QUERIES (run these to check)
-- ============================================

-- Check RLS is enabled on all tables:
-- SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public';

-- Check policies on products table:
-- SELECT policyname, cmd, qual FROM pg_policies WHERE tablename = 'products';

-- Check policies on profiles table:
-- SELECT policyname, cmd, qual FROM pg_policies WHERE tablename = 'profiles';

COMMENT ON TABLE user_roles IS 'Role-based access control for admin management. Only accessible via service_role.';
