-- ============================================
-- BLACK INDEX: DASHBOARD REALIZATION SCHEMA
-- Run this AFTER additional-schema.sql
-- ============================================

-- 1. PAYOUT REQUESTS TABLE
-- Tracks seller withdrawal requests
create table if not exists public.payout_requests (
  id uuid default gen_random_uuid() primary key,
  seller_id uuid references public.profiles(id) on delete cascade not null,
  amount bigint not null,
  status text check (status in ('requested', 'approved', 'paid', 'rejected')) default 'requested',
  admin_notes text,
  processed_at timestamp with time zone,
  created_at timestamp with time zone default timezone('utc', now())
);

-- Enable RLS
alter table public.payout_requests enable row level security;

-- Sellers can view their own payout requests
create policy "Sellers can view own payout requests" on payout_requests
  for select using (auth.uid() = seller_id);

-- Sellers can create payout requests
create policy "Sellers can create payout requests" on payout_requests
  for insert with check (auth.uid() = seller_id);

-- Index for fast lookups
create index if not exists idx_payout_requests_seller 
  on payout_requests(seller_id, status);

-- ============================================
-- 2. ADD SETTLEMENT_MODE TO PRODUCTS
-- ============================================

-- Add settlement_mode column if it doesn't exist
do $$ 
begin
  if not exists (
    select 1 from information_schema.columns 
    where table_name = 'products' and column_name = 'settlement_mode'
  ) then
    alter table public.products 
    add column settlement_mode text check (settlement_mode in ('escrow', 'webhook')) default 'webhook';
  end if;
end $$;

-- ============================================
-- 3. ADD LAST_WEBHOOK_AT TO PRODUCTS
-- For tracking if webhooks are being received
-- ============================================

do $$ 
begin
  if not exists (
    select 1 from information_schema.columns 
    where table_name = 'products' and column_name = 'last_webhook_at'
  ) then
    alter table public.products 
    add column last_webhook_at timestamp with time zone;
  end if;
end $$;
