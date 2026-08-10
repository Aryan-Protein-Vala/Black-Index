-- MIGRATION 007: VERTICAL EXPANSION SPRINT + TRUST AMENDMENTS
-- Safe, Idempotent. Run after 005_backend_security_and_money.sql.
--
-- Contains:
--   T1. Kill-switch trigger (wallet drops below ₹500 → auto-pause + notification)
--   T2. Trust tiers (0 confirmed fraud reports, sales_count = billed & not refunded)
--   T3. Blacklist table (transparency page + guillotine)
--   M1. record_conversion + p_escrow_days (single overload, 005-compatible shape)
--   M2. transactions: status CHECK + 'disputed', vertical, confirmed_by_buyer, meeting_start_at
--   M3. products: meeting_commission_flat, cal_link, shopify_hmac_secret + fixed protect trigger
--   M4. dispute_evidence table + RLS + storage bucket
--   M5. seller_service_stats view
--   S1. record_meeting_booking RPC (flat commission, 48h escrow, vertical='service')

-- ============================================================
-- T1. KILL-SWITCH
-- If a founder's wallet_balance drops from >= ₹500 (50,000 paise)
-- to < ₹500 on ANY balance write, instantly pause their products
-- (auto_paused=true so a top-up auto-resumes ONLY these) and notify.
-- ============================================================
create or replace function public.auto_pause_on_wallet_drop()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.wallet_balance >= 50000 and new.wallet_balance < 50000 then
    update public.products
      set is_active = false, auto_paused = true
      where founder_id = new.id and is_active = true;

    insert into public.notifications (user_id, type, title, message, metadata)
    values (
      new.id,
      'product_auto_paused',
      'Products paused — wallet below ₹500',
      'Your commission wallet dropped below ₹500, so your products were auto-paused. Sellers can no longer earn commissions you could not pay. Top up your wallet and they resume instantly.',
      jsonb_build_object('wallet_balance', new.wallet_balance)
    );
  end if;
  return new;
end;
$$;

drop trigger if exists auto_pause_on_wallet_drop_trigger on public.profiles;
create trigger auto_pause_on_wallet_drop_trigger
  after update of wallet_balance on public.profiles
  for each row execute function public.auto_pause_on_wallet_drop();

-- ============================================================
-- T2. TRUST TIERS
--   tier 0 = "Not yet certified"   (no verified money pipe)
--   tier 1 = Certified             (verified_at set)
--   tier 2 = Trusted               (>= 5 billed sales, 0 confirmed fraud)
--   tier 3 = Suspended/Blacklisted (confirmed fraud or blacklist row)
-- Fraud counts ONLY 'confirmed' reports (never 'dismissed').
-- sales_count = billed AND not refunded sales ONLY.
-- ============================================================
alter table public.products add column if not exists trust_tier int default 0;
comment on column public.products.trust_tier is '0=Not yet certified, 1=Certified, 2=Trusted, 3=Suspended/Blacklisted';

-- fraud_reports gains 'confirmed' / 'dismissed' lifecycle states
alter table public.fraud_reports drop constraint if exists fraud_reports_status_check;
alter table public.fraud_reports add constraint fraud_reports_status_check
  check (status in ('pending', 'verified', 'rejected', 'confirmed', 'dismissed'));

-- ============================================================
-- T3. BLACKLIST (transparency)
-- ============================================================
create table if not exists public.blacklist (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.profiles(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  display_name text not null,
  product_name text,
  offense_code text not null,
  note text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz default now()
);

alter table public.blacklist enable row level security;

-- Public transparency page: name + product + offense + date ONLY.
drop policy if exists "Blacklist is public transparency data" on public.blacklist;
create policy "Blacklist is public transparency data"
  on public.blacklist for select
  to anon, authenticated
  using (true);

create index if not exists idx_blacklist_profile on public.blacklist(profile_id);
create index if not exists idx_blacklist_product on public.blacklist(product_id);

-- ============================================================
-- T2 (cont). product_trust_stats — single source for badge endpoint
-- ============================================================
create or replace view public.product_trust_stats as
select
  p.id as product_id,
  p.founder_id,
  p.trust_tier,
  p.verified_at,
  p.is_active,
  coalesce((
    select count(*) from public.fraud_reports fr
    where fr.product_id = p.id
      and fr.status = 'confirmed'
      and fr.status <> 'dismissed'
  ), 0) as confirmed_fraud_count,
  coalesce((
    select count(*) from public.transactions t
    where t.product_id = p.id
      and t.type = 'sale'
      and t.billing_status = 'billed'
      and t.status <> 'refunded'
  ), 0) as sales_count,
  exists (
    select 1 from public.blacklist b
    where b.product_id = p.id or b.profile_id = p.founder_id
  ) as is_blacklisted,
  case
    when exists (
      select 1 from public.blacklist b
      where b.product_id = p.id or b.profile_id = p.founder_id
    ) then 3
    when coalesce((
      select count(*) from public.fraud_reports fr
      where fr.product_id = p.id
        and fr.status = 'confirmed'
        and fr.status <> 'dismissed'
    ), 0) > 0 then 3
    when p.verified_at is null then 0
    when coalesce((
      select count(*) from public.transactions t
      where t.product_id = p.id
        and t.type = 'sale'
        and t.billing_status = 'billed'
        and t.status <> 'refunded'
    ), 0) >= 5 then 2
    else 1
  end as tier
from public.products p;

grant select on public.product_trust_stats to anon, authenticated, service_role;

-- ============================================================
-- M1. record_conversion — ONE atomic money path (+ p_escrow_days, + vertical)
-- ============================================================
-- Drop the legacy 9-arg overload from 005 so default-arg calls resolve to
-- this single function (PostgreSQL would otherwise pick the 9-arg overload
-- and never apply the new p_escrow_days default).
drop function if exists public.record_conversion(uuid, uuid, uuid, text, text, bigint, text, bigint, numeric);

create or replace function public.record_conversion(
  p_product_id uuid,
  p_link_id uuid,
  p_seller_id uuid,
  p_external_customer_id text,
  p_external_transaction_id text,
  p_amount bigint,
  p_currency text default 'INR',
  p_amount_minor bigint default null,
  p_fx_rate numeric default 1,
  p_escrow_days int default 30
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
  v_escrow_days int;
begin
  v_escrow_days := greatest(1, coalesce(p_escrow_days, 30));

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
    -- NOTE: customers has NO link_id/created_at columns — match the proven 005 insert
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

  -- Spec: platform takes 5% of the commission
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
      currency, amount_minor, fx_rate, vertical
    ) values (
      'sale', 'pending', p_product_id, p_seller_id, p_link_id,
      p_amount, v_net, v_fee,
      p_external_customer_id, p_external_transaction_id,
      now() + make_interval(days => v_escrow_days), not v_is_new, v_billing_status,
      p_currency, coalesce(p_amount_minor, p_amount), p_fx_rate, 'saas'
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
end;
$$;

revoke all on function public.record_conversion(uuid, uuid, uuid, text, text, bigint, text, bigint, numeric, int)
  from public, anon, authenticated;
grant execute on function public.record_conversion(uuid, uuid, uuid, text, text, bigint, text, bigint, numeric, int)
  to service_role;

-- ============================================================
-- M2. transactions schema updates
-- ============================================================
alter table public.transactions drop constraint if exists transactions_status_check;
alter table public.transactions add constraint transactions_status_check
  check (status in ('pending', 'cleared', 'cancelled', 'paid', 'refunded', 'failed', 'disputed'));

alter table public.transactions
  add column if not exists vertical text default 'saas' check (vertical in ('saas', 'service', 'physical')),
  add column if not exists confirmed_by_buyer boolean default false,
  add column if not exists meeting_start_at timestamptz;

-- Guillotine / meeting-confirm query support
create index if not exists idx_transactions_vertical_status
  on public.transactions (vertical, status) where type = 'sale';
create index if not exists idx_transactions_seller_vertical
  on public.transactions (seller_id, vertical) where type = 'sale';

-- ============================================================
-- M3. products schema updates + FIXED protect trigger
-- ============================================================
alter table public.products
  add column if not exists meeting_commission_flat bigint default null,
  add column if not exists cal_link text default null,
  add column if not exists shopify_hmac_secret text default null;

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
      new.webhook_secret := encode(extensions.gen_random_bytes(32), 'hex');
      new.is_featured := false;
      new.is_founders_choice := false;
      new.featured_until := null;
      new.verified_at := null;
      new.script_detected_at := null;
      new.trust_tier := 0;
    else
      -- UPDATE: money/signing columns are untouchable from the browser
      if old.founder_id is distinct from new.founder_id then
        new.founder_id := old.founder_id;
      end if;
      if old.webhook_secret is distinct from new.webhook_secret then
        new.webhook_secret := old.webhook_secret;
      end if;
      if old.shopify_hmac_secret is distinct from new.shopify_hmac_secret then
        new.shopify_hmac_secret := old.shopify_hmac_secret;
      end if;
      if old.verified_at is distinct from new.verified_at then
        new.verified_at := old.verified_at;
      end if;
      if old.trust_tier is distinct from new.trust_tier then
        new.trust_tier := old.trust_tier;
      end if;
    end if;
  end if;
  return new;
end;
$$;

-- ============================================================
-- M4. dispute_evidence table
-- ============================================================
create table if not exists public.dispute_evidence (
    id uuid primary key default gen_random_uuid(),
    transaction_id uuid not null references public.transactions(id) on delete cascade,
    uploaded_by uuid not null references public.profiles(id) on delete cascade,
    file_url text not null,
    note text,
    created_at timestamptz default now()
);

alter table public.dispute_evidence enable row level security;

drop policy if exists "Uploader can view own evidence" on public.dispute_evidence;
create policy "Uploader can view own evidence"
  on public.dispute_evidence for select
  to authenticated
  using (uploaded_by = auth.uid());

drop policy if exists "Founder can view tx evidence" on public.dispute_evidence;
create policy "Founder can view tx evidence"
  on public.dispute_evidence for select
  to authenticated
  using (
    exists (
      select 1 from public.transactions t
      join public.products p on t.product_id = p.id
      where t.id = transaction_id and p.founder_id = auth.uid()
    )
  );

drop policy if exists "Seller can view tx evidence" on public.dispute_evidence;
create policy "Seller can view tx evidence"
  on public.dispute_evidence for select
  to authenticated
  using (
    exists (
      select 1 from public.transactions t
      where t.id = transaction_id and t.seller_id = auth.uid()
    )
  );

drop policy if exists "Uploader can insert evidence" on public.dispute_evidence;
create policy "Uploader can insert evidence"
  on public.dispute_evidence for insert
  to authenticated
  with check (
    uploaded_by = auth.uid() and
    exists (
      select 1 from public.transactions t
      join public.products p on t.product_id = p.id
      where t.id = transaction_id and (p.founder_id = auth.uid() or t.seller_id = auth.uid())
    )
  );

-- storage bucket handled manually or via API, but we'll create record if missing
insert into storage.buckets (id, name, public)
values ('dispute-evidence', 'dispute-evidence', false)
on conflict (id) do nothing;

-- ============================================================
-- M5. Service stats view (dispute-rate engine for the guillotine)
-- ============================================================
create or replace view public.seller_service_stats as
select
    seller_id,
    count(*) as total_services,
    count(*) filter (where status = 'disputed') as disputed_services,
    case when count(*) > 0 then
        (count(*) filter (where status = 'disputed')::numeric / count(*))
    else 0 end as dispute_rate
from public.transactions
where vertical = 'service' and type = 'sale'
group by seller_id;

grant select on public.seller_service_stats to service_role;

-- ============================================================
-- S1. record_meeting_booking — flat commission + 48h escrow
-- ============================================================
create or replace function public.record_meeting_booking(
  p_product_id uuid,
  p_link_id uuid,
  p_seller_id uuid,
  p_buyer_email text,
  p_cal_booking_uid text,
  p_meeting_start_at timestamptz
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_product record;
  v_founder_balance bigint;
  v_commission bigint;
  v_fee bigint;
  v_net bigint;
  v_billing_status text;
  v_tx_id uuid;
begin
  -- Lock product row
  select id, founder_id, meeting_commission_flat, is_active
    into v_product
    from public.products
    where id = p_product_id
    for update;

  if v_product is null then
    return jsonb_build_object('success', false, 'error', 'PRODUCT_NOT_FOUND');
  end if;

  if not v_product.is_active then
    return jsonb_build_object('success', false, 'error', 'PRODUCT_INACTIVE');
  end if;

  if v_product.meeting_commission_flat is null then
    return jsonb_build_object('success', false, 'error', 'SERVICE_NOT_ENABLED');
  end if;

  -- Idempotency check
  if exists (select 1 from public.transactions where external_transaction_id = p_cal_booking_uid) then
    return jsonb_build_object('success', true, 'duplicate', true);
  end if;

  v_commission := v_product.meeting_commission_flat;

  -- Founder Wallet Check & Deduct
  select wallet_balance into v_founder_balance
    from public.profiles
    where id = v_product.founder_id
    for update;

  if v_founder_balance >= v_commission then
    update public.profiles
      set wallet_balance = wallet_balance - v_commission
      where id = v_product.founder_id;
    v_billing_status := 'billed';
  else
    v_billing_status := 'wallet_insufficient';
  end if;

  -- Spec: platform takes 5% of the commission
  v_fee := floor(v_commission * 5 / 100);
  v_net := v_commission - v_fee;

  -- Log Transaction
  insert into public.transactions (
    type, status, billing_status, product_id, link_id, seller_id,
    external_customer_id, external_transaction_id,
    sale_amount, commission_amount, platform_fee,
    currency, amount_minor, fx_rate,
    payout_due_date, vertical, meeting_start_at
  ) values (
    'sale',
    'pending',
    v_billing_status,
    p_product_id,
    p_link_id,
    p_seller_id,
    p_buyer_email,
    p_cal_booking_uid,
    v_commission,
    v_net,
    v_fee,
    'INR',
    v_commission,
    1,
    p_meeting_start_at + interval '48 hours',
    'service',
    p_meeting_start_at
  ) returning id into v_tx_id;

  -- Credit Escrow only if billed (and book platform fee + earnings)
  if v_billing_status = 'billed' then
    update public.profiles
      set pending_balance = coalesce(pending_balance, 0) + v_net,
          total_earnings = coalesce(total_earnings, 0) + v_net
      where id = p_seller_id;

    insert into public.platform_revenue (transaction_id, product_id, founder_id, seller_id, amount, currency)
    values (v_tx_id, p_product_id, v_product.founder_id, p_seller_id, v_fee, 'INR');

    update public.products set verified_at = now()
      where id = p_product_id and verified_at is null;
  end if;

  return jsonb_build_object(
    'success', true,
    'tx_id', v_tx_id,
    'status', v_billing_status,
    'commission', v_commission,
    'net', v_net
  );
end;
$$;

revoke all on function public.record_meeting_booking(uuid, uuid, uuid, text, text, timestamptz)
  from public, anon, authenticated;
grant execute on function public.record_meeting_booking(uuid, uuid, uuid, text, text, timestamptz)
  to service_role;
