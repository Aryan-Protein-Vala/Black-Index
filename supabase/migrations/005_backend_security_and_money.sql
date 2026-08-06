-- ============================================================
-- 005_backend_security_and_money.sql
-- Phase 0-3 of FINAL_BACKEND_FIX_LIST.md
-- Run ONCE in Supabase SQL Editor (or via supabase db push).
-- Idempotent: safe to re-run.
-- ============================================================

create extension if not exists pgcrypto;

-- ============================================================
-- DEFENSIVE PREAMBLE — make prod whole FIRST.
-- INF-8: we don't know which legacy SQL files actually ran on
-- prod. Every table/column this migration (and the new code)
-- depends on is created/added idempotently here, BEFORE
-- anything references it.
-- ============================================================

-- customers (additional-schema.sql — may never have run)
create table if not exists public.customers (
  id uuid default gen_random_uuid() primary key,
  product_id uuid references public.products(id) on delete cascade not null,
  seller_id uuid references public.profiles(id) on delete cascade not null,
  external_customer_id text not null,
  first_seen_at timestamp with time zone default timezone('utc', now()),
  unique (product_id, external_customer_id)
);
alter table public.customers enable row level security;
alter table public.customers add column if not exists status text default 'active';
alter table public.customers add column if not exists billing_count int default 0;

-- profiles money/identity columns (003/004/advanced_billing)
alter table public.profiles add column if not exists wallet_balance bigint default 0;
alter table public.profiles add column if not exists security_deposit_paid boolean default false;
alter table public.profiles add column if not exists stripe_connect_id text;
alter table public.profiles add column if not exists razorpay_account_id text;
alter table public.profiles add column if not exists razorpay_fund_account_id text;
alter table public.profiles add column if not exists upi_vpa text;
alter table public.profiles add column if not exists email text;
alter table public.profiles add column if not exists phone text;

-- transactions lifecycle columns (004/advanced_billing)
alter table public.transactions add column if not exists is_recurring boolean default false;
alter table public.transactions add column if not exists billing_status text default 'unbilled';

-- LANDMINE DEFUSED: advanced_billing.sql created a CHECK on
-- billing_status allowing only ('unbilled','scheduled','billed').
-- 'wallet_insufficient' violates it → every sale with an empty
-- wallet would throw and be LOST. Drop ANY check on that column.
do $$
declare c record;
begin
  for c in
    select con.conname
      from pg_constraint con
      join pg_class rel on rel.oid = con.conrelid
      join pg_namespace nsp on nsp.oid = rel.relnamespace
      join pg_attribute att on att.attrelid = rel.oid and att.attnum = any(con.conkey)
     where nsp.nspname = 'public'
       and rel.relname = 'transactions'
       and con.contype = 'c'
       and att.attname = 'billing_status'
  loop
    execute format('alter table public.transactions drop constraint if exists %I', c.conname);
  end loop;
end $$;

-- ============================================================
-- 0.1 SEC-1: PROFILES COLUMN LOCKDOWN
-- Browser sessions may only update display/payout-identity columns.
-- Money, role, deposit, and connected-account columns are service-role only.
-- ============================================================
alter table public.profiles add column if not exists has_seen_founder_tour boolean default false;
alter table public.profiles add column if not exists has_seen_seller_tour boolean default false;

revoke update on table public.profiles from anon, authenticated;
grant update (full_name, avatar_url, username, upi_vpa, has_seen_founder_tour, has_seen_seller_tour)
  on public.profiles to authenticated;

-- ============================================================
-- 0.2 SEC-2: webhook_secret leaves the public read path
-- ============================================================
alter table public.products add column if not exists category text default 'other';
alter table public.products add column if not exists price_inr bigint;
alter table public.products add column if not exists billing_type text default 'subscription'
  check (billing_type in ('one_time', 'subscription'));
alter table public.products add column if not exists is_featured boolean default false;
alter table public.products add column if not exists is_founders_choice boolean default false;
alter table public.products add column if not exists featured_until timestamptz;
alter table public.products add column if not exists verified_at timestamptz;
alter table public.products add column if not exists script_detected_at timestamptz;
alter table public.products add column if not exists auto_paused boolean default false;

drop policy if exists "Anyone can view active products" on public.products;

-- Rotate every existing webhook secret (old ones may have leaked via the public SELECT policy)
update public.products set webhook_secret = encode(gen_random_bytes(32), 'hex');

-- Public, secret-free view for the Vault. NOTE the certification gate:
-- only products with a verified money pipe are public.
create or replace view public.public_products as
select id, founder_id, name, description, logo_url, website_url,
       is_active, is_featured, is_founders_choice, featured_until,
       commission_config, max_cac_limit, category, price_inr, billing_type,
       verified_at, created_at
from public.products
where is_active = true and verified_at is not null;

grant select on public.public_products to anon, authenticated;

-- ============================================================
-- 0.7 Server-side guard: browser writes can never set secrets or featured flags
-- ============================================================
create or replace function public.protect_product_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  _role text;
begin
  _role := coalesce(
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role',
    'service_role' -- direct SQL (psql / migrations) has no JWT claims: privileged
  );

  if _role <> 'service_role' then
    if tg_op = 'INSERT' then
      new.webhook_secret := encode(gen_random_bytes(32), 'hex');
      new.is_featured := false;
      new.is_founders_choice := false;
      new.featured_until := null;
      new.verified_at := null;
      new.script_detected_at := null;
    else
      new.webhook_secret := old.webhook_secret;
      new.is_featured := old.is_featured;
      new.is_founders_choice := old.is_founders_choice;
      new.featured_until := old.featured_until;
      new.founder_id := old.founder_id;
      new.verified_at := old.verified_at;
      new.script_detected_at := old.script_detected_at;
    end if;
  end if;
  return new;
end $$;

drop trigger if exists protect_product_columns_trigger on public.products;
create trigger protect_product_columns_trigger
  before insert or update on public.products
  for each row execute function public.protect_product_columns();

-- Product INSERT now requires founder/admin role (was: any authenticated user)
drop policy if exists "Founders can insert own products" on public.products;
create policy "Founders can insert own products" on public.products
  for insert with check (
    founder_id = auth.uid()
    and exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('founder', 'admin')
    )
  );

-- ============================================================
-- 0.3 SEC-3: Balance RPCs — re-create idempotently THEN lock down.
-- (Re-creating also repairs prod if additional-schema.sql never
-- ran; bare REVOKEs on missing functions would abort the migration.)
-- ============================================================
create or replace function public.lock_commission_funds(p_seller_id uuid, p_amount bigint)
returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.profiles
  set pending_balance = coalesce(pending_balance, 0) + p_amount,
      total_earnings = coalesce(total_earnings, 0) + p_amount,
      updated_at = timezone('utc', now())
  where id = p_seller_id;
end $$;

create or replace function public.release_cleared_funds(p_seller_id uuid, p_amount bigint)
returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.profiles
  set pending_balance = pending_balance - p_amount,
      withdrawable_balance = coalesce(withdrawable_balance, 0) + p_amount,
      updated_at = timezone('utc', now())
  where id = p_seller_id
    and pending_balance >= p_amount;
end $$;

create or replace function public.process_payout(p_seller_id uuid, p_amount bigint)
returns boolean
language plpgsql security definer set search_path = public as $$
declare
  current_balance bigint;
begin
  select withdrawable_balance into current_balance
    from public.profiles where id = p_seller_id for update;

  if current_balance is not null and current_balance >= p_amount then
    update public.profiles
    set withdrawable_balance = withdrawable_balance - p_amount,
        updated_at = timezone('utc', now())
    where id = p_seller_id;
    return true;
  end if;
  return false;
end $$;

revoke all on function public.lock_commission_funds(uuid, bigint) from public, anon, authenticated;
revoke all on function public.release_cleared_funds(uuid, bigint) from public, anon, authenticated;
revoke all on function public.process_payout(uuid, bigint) from public, anon, authenticated;
grant execute on function public.lock_commission_funds(uuid, bigint) to service_role;
grant execute on function public.release_cleared_funds(uuid, bigint) to service_role;
grant execute on function public.process_payout(uuid, bigint) to service_role;

-- ============================================================
-- 0.4 SEC-4: charges table — strip every policy (service-role only by default under RLS)
-- ============================================================
do $$
declare pol record;
begin
  for pol in
    select policyname, tablename from pg_policies
    where schemaname = 'public' and tablename in ('charges', 'charge_schedules')
  loop
    execute format('drop policy if exists %I on public.%I', pol.policyname, pol.tablename);
  end loop;
end $$;

-- ============================================================
-- 0.9 SEC-9: links are not world-readable anymore
-- ============================================================
drop policy if exists "Anyone can view links" on public.links;
drop policy if exists "Public links are viewable" on public.links;

-- ============================================================
-- 0.11 SEC-11: founders can read their own products' transactions
-- (this is what makes the founder dashboard stop showing zeros)
-- ============================================================
drop policy if exists "Founders can view own product transactions" on public.transactions;
create policy "Founders can view own product transactions" on public.transactions
  for select using (
    seller_id = auth.uid()
    or exists (
      select 1 from public.products p
      where p.id = transactions.product_id and p.founder_id = auth.uid()
    )
  );

-- ============================================================
-- 0.12 INF-4a: webhook_logs can actually be written
-- ============================================================
alter table public.webhook_logs add column if not exists event_type text;
alter table public.webhook_logs drop constraint if exists webhook_logs_status_check;

-- transactions status check — allow refund/failed lifecycle states
alter table public.transactions drop constraint if exists transactions_status_check;
alter table public.transactions add constraint transactions_status_check
  check (status in ('pending', 'cleared', 'cancelled', 'paid', 'refunded', 'failed'));

-- ============================================================
-- 1.9 / 2.x Multi-currency columns + payout linkage + settled marker
-- ============================================================
alter table public.transactions add column if not exists currency text default 'INR';
alter table public.transactions add column if not exists amount_minor bigint;
alter table public.transactions add column if not exists fx_rate numeric default 1;
alter table public.transactions add column if not exists provider_payout_id text;
alter table public.transactions add column if not exists refund_of uuid;

-- ============================================================
-- 1.5 MNY-11: platform fee ledger (the 5% finally lands somewhere)
-- ============================================================
create table if not exists public.platform_revenue (
  id uuid default gen_random_uuid() primary key,
  transaction_id uuid references public.transactions(id) on delete set null,
  product_id uuid references public.products(id) on delete set null,
  founder_id uuid references public.profiles(id) on delete set null,
  seller_id uuid references public.profiles(id) on delete set null,
  amount bigint not null,           -- paise; negative on refunds
  currency text default 'INR',
  created_at timestamptz default now()
);
alter table public.platform_revenue enable row level security;
-- no policies => service-role only

-- ============================================================
-- TOOL-1: install tokens (founder CLI / site-scan verification)
-- ============================================================
create table if not exists public.install_tokens (
  id uuid default gen_random_uuid() primary key,
  product_id uuid references public.products(id) on delete cascade not null,
  founder_id uuid references public.profiles(id) on delete cascade not null,
  token_hash text not null,
  created_at timestamptz default now(),
  revoked_at timestamptz
);
create unique index if not exists install_tokens_token_hash_idx on public.install_tokens(token_hash);
alter table public.install_tokens enable row level security;

-- ============================================================
-- 3.2 Email delivery log
-- ============================================================
create table if not exists public.email_logs (
  id uuid default gen_random_uuid() primary key,
  recipient text not null,
  subject text,
  success boolean not null,
  provider_id text,
  error text,
  created_at timestamptz default now()
);
alter table public.email_logs enable row level security;

-- ============================================================
-- 0.x Phantom table fix + rate limiting storage
-- ============================================================
create table if not exists public.velocity_logs (
  id uuid default gen_random_uuid() primary key,
  type text,
  entity_id text,
  limit_amount bigint,
  current_amount bigint,
  hit_at timestamptz default now()
);
alter table public.velocity_logs enable row level security;

create table if not exists public.rate_limits (
  key text primary key,
  window_start timestamptz not null,
  count int not null default 0
);
alter table public.rate_limits enable row level security;

create or replace function public.check_rate_limit(
  p_key text, p_limit int, p_window_secs int
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  insert into public.rate_limits as rl (key, window_start, count)
  values (p_key, now(), 1)
  on conflict (key) do update set
    count = case
      when rl.window_start < now() - make_interval(secs => p_window_secs) then 1
      else rl.count + 1
    end,
    window_start = case
      when rl.window_start < now() - make_interval(secs => p_window_secs) then now()
      else rl.window_start
    end
  returning count into v_count;

  return v_count <= p_limit;
end $$;
revoke all on function public.check_rate_limit(text, int, int) from public, anon, authenticated;
grant execute on function public.check_rate_limit(text, int, int) to service_role;

-- ============================================================
-- increment_clicks (atomic; ref route uses it instead of read-modify-write)
-- NOTE: advanced_billing.sql may have created this with a different
-- parameter name (link_id) — DROP first (CREATE OR REPLACE cannot
-- rename parameters), then recreate.
-- ============================================================
drop function if exists public.increment_clicks(uuid);
create or replace function public.increment_clicks(p_link_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.links set clicks = coalesce(clicks, 0) + 1 where id = p_link_id;
$$;
revoke all on function public.increment_clicks(uuid) from public, anon, authenticated;
grant execute on function public.increment_clicks(uuid) to service_role;

-- ============================================================
-- 1.1 MNY-CORE: record_conversion() — ONE atomic money path
-- Replaces webhook-processor Steps 5-9. All-or-nothing.
-- ============================================================
create or replace function public.record_conversion(
  p_product_id uuid,
  p_link_id uuid,
  p_seller_id uuid,
  p_external_customer_id text,
  p_external_transaction_id text,
  p_amount bigint,
  p_currency text default 'INR',
  p_amount_minor bigint default null,
  p_fx_rate numeric default 1
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_product record;
  v_customer record;
  v_founder_balance bigint;
  v_is_new boolean;
  v_billing_count int;
  v_max_months int;
  v_commission_pct numeric;
  v_commission bigint;
  v_fee bigint;
  v_net bigint;
  v_billing_status text;
  v_tx_id uuid;
begin
  -- Lock product row
  select id, founder_id, commission_config, max_cac_limit, is_active
    into v_product
    from public.products
    where id = p_product_id
    for update;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'PRODUCT_NOT_FOUND');
  end if;
  if not v_product.is_active then
    return jsonb_build_object('ok', false, 'error', 'PRODUCT_INACTIVE');
  end if;

  -- Idempotency (provider retries / concurrent webhooks)
  select id into v_tx_id from public.transactions
    where external_transaction_id = p_external_transaction_id;
  if found then
    return jsonb_build_object('ok', true, 'duplicate', true, 'transaction_id', v_tx_id);
  end if;

  -- Serialize per customer identity
  perform pg_advisory_xact_lock(hashtext(p_product_id::text || ':' || coalesce(p_external_customer_id, '')));

  select id, billing_count into v_customer
    from public.customers
    where product_id = p_product_id
      and external_customer_id = p_external_customer_id
    for update;

  if not found then
    v_is_new := true;
    v_billing_count := 1;
    insert into public.customers (product_id, seller_id, external_customer_id, status, billing_count)
    values (p_product_id, p_seller_id, p_external_customer_id, 'active', 1);
  else
    v_is_new := false;
    v_billing_count := coalesce(v_customer.billing_count, 0) + 1;
    v_max_months := coalesce((v_product.commission_config->>'max_recurring_months')::int, 12);

    if coalesce(v_customer.billing_count, 0) >= v_max_months then
      return jsonb_build_object('ok', true, 'recurring_limit', true, 'max_months', v_max_months);
    end if;

    update public.customers
      set billing_count = v_billing_count, status = 'active'
      where id = v_customer.id;
  end if;

  -- Commission math
  v_commission_pct := case when v_is_new
    then coalesce((v_product.commission_config->>'upfront_pct')::numeric, 0)
    else coalesce((v_product.commission_config->>'recurring_pct')::numeric, 0)
  end;
  v_commission := floor(p_amount * v_commission_pct / 100);

  if v_product.max_cac_limit is not null and v_commission > v_product.max_cac_limit then
    v_commission := v_product.max_cac_limit;
  end if;

  v_fee := floor(v_commission * 5 / 100);
  v_net := v_commission - v_fee;

  -- Founder wallet (wallet-only model: every founder is prepaid)
  select wallet_balance into v_founder_balance
    from public.profiles where id = v_product.founder_id for update;

  if v_founder_balance is not null and v_founder_balance >= v_commission then
    update public.profiles
      set wallet_balance = wallet_balance - v_commission
      where id = v_product.founder_id;
    v_billing_status := 'billed';
  else
    v_billing_status := 'wallet_insufficient';
  end if;

  -- Transaction row (unique external_transaction_id guards races via exception below)
  begin
    insert into public.transactions (
      type, status, product_id, seller_id, link_id,
      sale_amount, commission_amount, platform_fee,
      external_customer_id, external_transaction_id,
      payout_due_date, is_recurring, billing_status,
      currency, amount_minor, fx_rate
    ) values (
      'sale', 'pending', p_product_id, p_seller_id, p_link_id,
      p_amount, v_net, v_fee,
      p_external_customer_id, p_external_transaction_id,
      now() + interval '30 days', not v_is_new, v_billing_status,
      p_currency, coalesce(p_amount_minor, p_amount), p_fx_rate
    ) returning id into v_tx_id;
  exception when unique_violation then
    select id into v_tx_id from public.transactions
      where external_transaction_id = p_external_transaction_id;
    return jsonb_build_object('ok', true, 'duplicate', true, 'transaction_id', v_tx_id);
  end;

  if v_billing_status = 'billed' then
    -- Seller escrow credit
    update public.profiles
      set pending_balance = coalesce(pending_balance, 0) + v_net,
          total_earnings = coalesce(total_earnings, 0) + v_net
      where id = p_seller_id;

    -- Platform fee ledger
    insert into public.platform_revenue (transaction_id, product_id, founder_id, seller_id, amount, currency)
    values (v_tx_id, p_product_id, v_product.founder_id, p_seller_id, v_fee, p_currency);

    -- Certification: first real conversion proves the money pipe
    update public.products set verified_at = now()
      where id = p_product_id and verified_at is null;
  end if;

  return jsonb_build_object(
    'ok', true,
    'duplicate', false,
    'transaction_id', v_tx_id,
    'commission', v_net,
    'gross_commission', v_commission,
    'fee', v_fee,
    'billing_status', v_billing_status,
    'is_new_customer', v_is_new,
    'billing_count', v_billing_count
  );
end $$;
revoke all on function public.record_conversion(uuid, uuid, uuid, text, text, bigint, text, bigint, numeric)
  from public, anon, authenticated;
grant execute on function public.record_conversion(uuid, uuid, uuid, text, text, bigint, text, bigint, numeric)
  to service_role;

-- ============================================================
-- 1.3 MNY-8: settle queued conversions when a founder tops up
-- ============================================================
create or replace function public.settle_queued_conversions(p_founder_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tx record;
  v_balance bigint;
  v_gross bigint;
  v_settled int := 0;
  v_total bigint := 0;
begin
  select wallet_balance into v_balance
    from public.profiles where id = p_founder_id for update;

  if v_balance is null then
    return jsonb_build_object('settled', 0, 'total', 0);
  end if;

  for v_tx in
    select t.id, t.seller_id, t.product_id, t.commission_amount, t.platform_fee
      from public.transactions t
      join public.products p on p.id = t.product_id
      where p.founder_id = p_founder_id
        and t.billing_status = 'wallet_insufficient'
        and t.status = 'pending'
        and t.type = 'sale'
      order by t.created_at
      for update of t
  loop
    v_gross := v_tx.commission_amount + v_tx.platform_fee;
    if v_balance < v_gross then
      exit;
    end if;

    update public.profiles set wallet_balance = wallet_balance - v_gross where id = p_founder_id;
    update public.profiles
      set pending_balance = coalesce(pending_balance, 0) + v_tx.commission_amount,
          total_earnings = coalesce(total_earnings, 0) + v_tx.commission_amount
      where id = v_tx.seller_id;
    update public.transactions set billing_status = 'billed' where id = v_tx.id;
    insert into public.platform_revenue (transaction_id, product_id, founder_id, seller_id, amount)
    values (v_tx.id, v_tx.product_id, p_founder_id, v_tx.seller_id, v_tx.platform_fee);

    v_balance := v_balance - v_gross;
    v_settled := v_settled + 1;
    v_total := v_total + v_tx.commission_amount;
  end loop;

  -- Auto-unpause only the products WE auto-paused (never touch manually disabled ones)
  update public.products set is_active = true, auto_paused = false
    where founder_id = p_founder_id and auto_paused = true and v_settled > 0;

  return jsonb_build_object('settled', v_settled, 'total', v_total);
end $$;
revoke all on function public.settle_queued_conversions(uuid) from public, anon, authenticated;
grant execute on function public.settle_queued_conversions(uuid) to service_role;

-- ============================================================
-- credit_wallet — atomic top-up credit (routes fell back to racy
-- read-then-write before; now the real function exists)
-- ============================================================
create or replace function public.credit_wallet(p_user_id uuid, p_amount bigint)
returns void
language sql
security definer
set search_path = public
as $$
  update public.profiles
    set wallet_balance = coalesce(wallet_balance, 0) + p_amount
    where id = p_user_id;
$$;
revoke all on function public.credit_wallet(uuid, bigint) from public, anon, authenticated;
grant execute on function public.credit_wallet(uuid, bigint) to service_role;

-- ============================================================
-- 2.11 Uniques + dedupe (kills concurrent-webhook double inserts)
-- ============================================================
delete from public.customers a using public.customers b
  where a.ctid < b.ctid
    and a.product_id = b.product_id
    and a.external_customer_id = b.external_customer_id;

create unique index if not exists customers_product_external_uidx
  on public.customers (product_id, external_customer_id);

create unique index if not exists transactions_external_tx_uidx
  on public.transactions (external_transaction_id)
  where external_transaction_id is not null;

-- ============================================================
-- Indexes (Phase 4 cheap wins)
-- ============================================================
create index if not exists transactions_seller_due_idx
  on public.transactions (seller_id, payout_due_date)
  where status = 'pending';
create index if not exists notifications_user_read_idx
  on public.notifications (user_id, read);
create index if not exists transactions_product_idx
  on public.transactions (product_id);
