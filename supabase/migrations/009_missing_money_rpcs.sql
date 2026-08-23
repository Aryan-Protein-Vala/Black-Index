-- 009_missing_money_rpcs.sql
-- Atomic primitives required by the withdrawal and escrow cron routes.
-- Run after 008_admin_backoffice.sql.

create or replace function public.initiate_withdrawal_atomic(
  p_seller_id uuid,
  p_amount bigint,
  p_external_tx_id text
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_tx_id uuid;
  v_balance bigint;
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'invalid withdrawal amount';
  end if;
  if p_external_tx_id is null or length(trim(p_external_tx_id)) = 0 then
    raise exception 'missing idempotency reference';
  end if;

  select withdrawable_balance into v_balance
    from public.profiles where id = p_seller_id for update;
  if v_balance is null or v_balance < p_amount then
    raise exception 'insufficient withdrawable balance';
  end if;

  select id into v_tx_id from public.transactions
    where external_transaction_id = p_external_tx_id;
  if v_tx_id is not null then return v_tx_id; end if;

  update public.profiles
    set withdrawable_balance = withdrawable_balance - p_amount,
        updated_at = timezone('utc', now())
    where id = p_seller_id;

  insert into public.transactions(
    type, status, seller_id, sale_amount, commission_amount, platform_fee,
    external_transaction_id, payout_due_date
  ) values (
    'payout', 'pending', p_seller_id, p_amount, p_amount, 0,
    p_external_tx_id, now()
  ) returning id into v_tx_id;

  return v_tx_id;
exception when unique_violation then
  select id into v_tx_id from public.transactions
    where external_transaction_id = p_external_tx_id;
  return v_tx_id;
end $$;

create or replace function public.release_transaction_escrow(
  p_transaction_id uuid
) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  v_tx public.transactions%rowtype;
begin
  select * into v_tx from public.transactions
    where id = p_transaction_id for update;
  if not found then return false; end if;
  if v_tx.type <> 'sale' or v_tx.status <> 'pending'
     or v_tx.billing_status <> 'billed'
     or v_tx.payout_due_date is null
     or v_tx.payout_due_date > timezone('utc', now()) then
    return false;
  end if;

  update public.profiles
    set pending_balance = greatest(0, coalesce(pending_balance, 0) - v_tx.commission_amount),
        withdrawable_balance = coalesce(withdrawable_balance, 0) + v_tx.commission_amount,
        updated_at = timezone('utc', now())
    where id = v_tx.seller_id;
  update public.transactions set status = 'cleared' where id = p_transaction_id;
  return true;
end $$;

revoke all on function public.initiate_withdrawal_atomic(uuid,bigint,text) from public, anon, authenticated;
revoke all on function public.release_transaction_escrow(uuid) from public, anon, authenticated;
grant execute on function public.initiate_withdrawal_atomic(uuid,bigint,text) to service_role;
grant execute on function public.release_transaction_escrow(uuid) to service_role;

create unique index if not exists transactions_external_transaction_id_uidx
  on public.transactions(external_transaction_id)
  where external_transaction_id is not null;
