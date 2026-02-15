-- ============================================
-- BLACK INDEX: ADDITIONAL SCHEMA (instructions.md)
-- Run this AFTER schema.sql
-- ============================================

-- 1. CUSTOMERS TABLE (NEW vs RECURRING source of truth)
-- Tracks first-seen customers per product to determine commission type
create table if not exists public.customers (
  id uuid default gen_random_uuid() primary key,
  product_id uuid references public.products(id) on delete cascade not null,
  seller_id uuid references public.profiles(id) on delete cascade not null,
  external_customer_id text not null,
  first_seen_at timestamp with time zone default timezone('utc', now()),
  unique (product_id, external_customer_id)
);

-- Enable RLS
alter table public.customers enable row level security;

-- Customers are internal tracking, only service role should access
-- No public policies needed

-- Index for fast lookups
create index if not exists idx_customers_lookup 
  on customers(product_id, external_customer_id);

-- ============================================
-- 2. ATOMIC BALANCE UPDATE FUNCTION (RPC)
-- Prevents race conditions in balance updates
-- ============================================

create or replace function lock_commission_funds(
  p_seller_id uuid,
  p_amount bigint
)
returns void as $$
begin
  update profiles
  set pending_balance = pending_balance + p_amount,
      total_earnings = total_earnings + p_amount,
      updated_at = timezone('utc', now())
  where id = p_seller_id;
end;
$$ language plpgsql security definer;

-- Grant execute to authenticated users (will be called via service role anyway)
grant execute on function lock_commission_funds to authenticated;
grant execute on function lock_commission_funds to service_role;

-- ============================================
-- 3. RELEASE FUNDS FUNCTION (for T+30 settlement)
-- Moves funds from pending to withdrawable
-- ============================================

create or replace function release_cleared_funds(
  p_seller_id uuid,
  p_amount bigint
)
returns void as $$
begin
  update profiles
  set pending_balance = pending_balance - p_amount,
      withdrawable_balance = withdrawable_balance + p_amount,
      updated_at = timezone('utc', now())
  where id = p_seller_id
    and pending_balance >= p_amount;
end;
$$ language plpgsql security definer;

grant execute on function release_cleared_funds to authenticated;
grant execute on function release_cleared_funds to service_role;

-- ============================================
-- 4. PROCESS PAYOUT FUNCTION
-- Deducts from withdrawable balance
-- ============================================

create or replace function process_payout(
  p_seller_id uuid,
  p_amount bigint
)
returns boolean as $$
declare
  current_balance bigint;
begin
  select withdrawable_balance into current_balance
  from profiles
  where id = p_seller_id
  for update;
  
  if current_balance >= p_amount then
    update profiles
    set withdrawable_balance = withdrawable_balance - p_amount,
        updated_at = timezone('utc', now())
    where id = p_seller_id;
    return true;
  else
    return false;
  end if;
end;
$$ language plpgsql security definer;

grant execute on function process_payout to authenticated;
grant execute on function process_payout to service_role;
