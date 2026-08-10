-- MIGRATION 008: ADMIN BACK-OFFICE + MEETING FLOW FIX
-- Idempotent. Run after 007.
--
-- 1. FIX record_meeting_booking: transactions has NO founder_id column —
--    the 007 version inserted founder_id and would error on first booking.
-- 2. admin_actions audit log (every admin money/role/blacklist action).
-- 3. Indexes for admin queries.

-- ============================================================
-- 1. FIX record_meeting_booking (drop nonexistent founder_id column)
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
  -- Lock product row (founder_id lives on products, not transactions)
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

  -- Log Transaction (NO founder_id column on transactions)
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

-- ============================================================
-- 2. admin_actions audit log
-- Every admin money/role/blacklist/dispute action lands here.
-- ============================================================
create table if not exists public.admin_actions (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid references public.profiles(id) on delete set null,
  action text not null,
  target_type text,
  target_id text,
  note text,
  metadata jsonb,
  created_at timestamptz default now()
);

alter table public.admin_actions enable row level security;
-- no policies => service-role only

create index if not exists idx_admin_actions_admin on public.admin_actions(admin_id, created_at);
create index if not exists idx_admin_actions_target on public.admin_actions(target_type, target_id);

-- ============================================================
-- 3. Admin query indexes
-- ============================================================
create index if not exists idx_transactions_status ON public.transactions (status);
create index if not exists idx_transactions_created ON public.transactions (created_at desc);
create index if not exists idx_fraud_reports_created ON public.fraud_reports (created_at desc);
create index if not exists idx_blacklist_created ON public.blacklist (created_at desc);
create index if not exists idx_dispute_evidence_tx ON public.dispute_evidence (transaction_id);
