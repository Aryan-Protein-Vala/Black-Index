-- Early Access Waitlist Table
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS public.early_access (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    role TEXT CHECK (role IN ('founder', 'warlord')) NOT NULL,
    position INTEGER NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- For tracking referrals (future use)
    referred_by UUID REFERENCES public.early_access(id),
    referral_code TEXT UNIQUE DEFAULT encode(gen_random_bytes(4), 'hex')
);

-- Index for fast email lookups
CREATE INDEX IF NOT EXISTS early_access_email_idx ON public.early_access(email);

-- Index for position ordering
CREATE INDEX IF NOT EXISTS early_access_position_idx ON public.early_access(position);

-- RLS Policies (Admin only - no public access needed)
ALTER TABLE public.early_access ENABLE ROW LEVEL SECURITY;

-- Allow service role to insert (for API)
CREATE POLICY "Service role can manage early_access" ON public.early_access
    FOR ALL
    USING (true)
    WITH CHECK (true);
