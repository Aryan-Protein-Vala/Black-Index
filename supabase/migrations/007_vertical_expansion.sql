-- MIGRATION 007: VERTICAL EXPANSION SPRINT
-- Safe, Idempotent, Immutable where possible

-- M1. record_conversion update with p_escrow_days
CREATE OR REPLACE FUNCTION public.record_conversion(
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
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
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
BEGIN
  -- Lock product row
  select id, founder_id, commission_config, max_cac_limit, is_active
    into v_product
    from public.products
    where id = p_product_id
    for update;

  if v_product is null then
    return jsonb_build_object('success', false, 'error', 'Product not found');
  end if;

  if not v_product.is_active then
    return jsonb_build_object('success', false, 'error', 'Product is inactive');
  end if;

  -- Idempotency check
  if exists (select 1 from public.transactions where external_transaction_id = p_external_transaction_id) then
    return jsonb_build_object('success', false, 'error', 'Duplicate transaction');
  end if;

  -- Lock and update customer
  select * into v_customer
    from public.customers
    where product_id = p_product_id and external_customer_id = p_external_customer_id
    for update;

  if v_customer is null then
    v_is_new := true;
    v_billing_count := 1;
    insert into public.customers (product_id, link_id, seller_id, external_customer_id, billing_count, created_at, updated_at)
      values (p_product_id, p_link_id, p_seller_id, p_external_customer_id, 1, now(), now())
      returning * into v_customer;
  else
    v_is_new := false;
    v_billing_count := coalesce(v_customer.billing_count, 0) + 1;
    
    if v_customer.seller_id != p_seller_id then
      return jsonb_build_object('success', false, 'error', 'Customer belongs to different seller');
    end if;

    update public.customers
      set billing_count = v_billing_count, updated_at = now()
      where id = v_customer.id;
  end if;

  -- Commission math
  if v_is_new then
    v_commission_pct := coalesce((v_product.commission_config->>'upfront_pct')::numeric, 0);
  else
    v_max_months := coalesce((v_product.commission_config->>'max_recurring_months')::int, 0);
    if v_billing_count > v_max_months then
      return jsonb_build_object('success', false, 'error', 'Subscription exceeded max commission months');
    end if;
    v_commission_pct := coalesce((v_product.commission_config->>'recurring_pct')::numeric, 0);
  end if;

  if v_commission_pct = 0 then
    return jsonb_build_object('success', true, 'status', 'skipped_zero_pct');
  end if;

  v_commission := (p_amount * v_commission_pct) / 100;

  if v_product.max_cac_limit is not null and v_commission > v_product.max_cac_limit then
    v_commission := v_product.max_cac_limit;
  end if;

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

  -- Split Math
  -- Spec: platform takes 5% of the commission
  v_fee := (v_commission * 5) / 100;
  v_net := v_commission - v_fee;

  -- Log Transaction
  insert into public.transactions (
    type, status, billing_status, product_id, link_id, seller_id, founder_id,
    external_customer_id, external_transaction_id,
    sale_amount, sale_currency, sale_amount_minor, sale_fx_rate,
    commission_amount, platform_fee, payout_due_date, vertical
  ) values (
    'sale',
    'pending',
    v_billing_status,
    p_product_id,
    p_link_id,
    p_seller_id,
    v_product.founder_id,
    p_external_customer_id,
    p_external_transaction_id,
    p_amount,
    p_currency,
    p_amount_minor,
    p_fx_rate,
    v_commission,
    v_fee,
    now() + make_interval(days => p_escrow_days),
    'saas'
  ) returning id into v_tx_id;

  -- Credit Escrow only if billed
  if v_billing_status = 'billed' then
    update public.profiles
      set pending_balance = coalesce(pending_balance, 0) + v_net
      where id = p_seller_id;
  end if;

  -- System Flags
  if not exists (select 1 from public.public_products where id = p_product_id) then
    update public.products set verified_at = now() where id = p_product_id;
  end if;

  return jsonb_build_object(
    'success', true,
    'tx_id', v_tx_id,
    'status', v_billing_status,
    'commission', v_commission,
    'net', v_net
  );
END;
$$;

REVOKE ALL ON FUNCTION public.record_conversion(uuid, uuid, uuid, text, text, bigint, text, bigint, numeric, int) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.record_conversion(uuid, uuid, uuid, text, text, bigint, text, bigint, numeric, int) FROM anon;
REVOKE ALL ON FUNCTION public.record_conversion(uuid, uuid, uuid, text, text, bigint, text, bigint, numeric, int) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.record_conversion(uuid, uuid, uuid, text, text, bigint, text, bigint, numeric, int) TO service_role;


-- M2. transactions schema updates
ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS transactions_status_check;
ALTER TABLE public.transactions ADD CONSTRAINT transactions_status_check 
  CHECK (status IN ('pending', 'cleared', 'cancelled', 'paid', 'refunded', 'failed', 'disputed'));

ALTER TABLE public.transactions 
  ADD COLUMN IF NOT EXISTS vertical text DEFAULT 'saas' CHECK (vertical IN ('saas', 'service', 'physical')),
  ADD COLUMN IF NOT EXISTS confirmed_by_buyer boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS meeting_start_at timestamptz;

-- M3. products schema updates
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS meeting_commission_flat bigint DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS cal_link text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS shopify_hmac_secret text DEFAULT NULL;

CREATE OR REPLACE FUNCTION public.protect_product_columns()
RETURNS trigger AS $$
BEGIN
    IF (OLD.founder_id IS DISTINCT FROM NEW.founder_id) THEN
        NEW.founder_id = OLD.founder_id;
    END IF;
    IF (OLD.webhook_secret IS DISTINCT FROM NEW.webhook_secret) THEN
        NEW.webhook_secret = OLD.webhook_secret;
    END IF;
    IF (OLD.shopify_hmac_secret IS DISTINCT FROM NEW.shopify_hmac_secret) THEN
        NEW.shopify_hmac_secret = OLD.shopify_hmac_secret;
    END IF;
    IF (OLD.verified_at IS DISTINCT FROM NEW.verified_at AND current_user != 'service_role') THEN
        NEW.verified_at = OLD.verified_at;
    END IF;
    IF (OLD.trust_tier IS DISTINCT FROM NEW.trust_tier AND current_user != 'service_role') THEN
        NEW.trust_tier = OLD.trust_tier;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- M4. dispute_evidence table
CREATE TABLE IF NOT EXISTS public.dispute_evidence (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id UUID NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
    uploaded_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    file_url TEXT NOT NULL,
    note TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.dispute_evidence ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Uploader can view own evidence" 
  ON public.dispute_evidence FOR SELECT 
  TO authenticated 
  USING (uploaded_by = auth.uid());

CREATE POLICY "Founder can view tx evidence" 
  ON public.dispute_evidence FOR SELECT 
  TO authenticated 
  USING (
    EXISTS (
      SELECT 1 FROM transactions t
      WHERE t.id = transaction_id AND t.founder_id = auth.uid()
    )
  );

CREATE POLICY "Seller can view tx evidence" 
  ON public.dispute_evidence FOR SELECT 
  TO authenticated 
  USING (
    EXISTS (
      SELECT 1 FROM transactions t
      WHERE t.id = transaction_id AND t.seller_id = auth.uid()
    )
  );

CREATE POLICY "Uploader can insert evidence" 
  ON public.dispute_evidence FOR INSERT 
  TO authenticated 
  WITH CHECK (
    uploaded_by = auth.uid() AND
    EXISTS (
      SELECT 1 FROM transactions t
      WHERE t.id = transaction_id AND (t.founder_id = auth.uid() OR t.seller_id = auth.uid())
    )
  );

-- storage bucket handled manually or via API, but we'll create record if missing
INSERT INTO storage.buckets (id, name, public) 
VALUES ('dispute-evidence', 'dispute-evidence', false)
ON CONFLICT (id) DO NOTHING;

-- M5. Service stats view
CREATE OR REPLACE VIEW public.seller_service_stats AS
SELECT 
    seller_id,
    COUNT(*) as total_services,
    COUNT(*) FILTER (WHERE status = 'disputed') as disputed_services,
    CASE WHEN COUNT(*) > 0 THEN 
        (COUNT(*) FILTER (WHERE status = 'disputed')::numeric / COUNT(*)) 
    ELSE 0 END as dispute_rate
FROM transactions
WHERE vertical = 'service' AND type = 'sale'
GROUP BY seller_id;

GRANT SELECT ON public.seller_service_stats TO service_role;

-- S1. record_meeting_booking RPC
CREATE OR REPLACE FUNCTION public.record_meeting_booking(
  p_product_id uuid,
  p_link_id uuid,
  p_seller_id uuid,
  p_buyer_email text,
  p_cal_booking_uid text,
  p_meeting_start_at timestamptz
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_product record;
  v_founder_balance bigint;
  v_commission bigint;
  v_fee bigint;
  v_net bigint;
  v_billing_status text;
  v_tx_id uuid;
BEGIN
  -- Lock product row
  select id, founder_id, meeting_commission_flat, is_active
    into v_product
    from public.products
    where id = p_product_id
    for update;

  if v_product is null then
    return jsonb_build_object('success', false, 'error', 'Product not found');
  end if;

  if not v_product.is_active then
    return jsonb_build_object('success', false, 'error', 'Product is inactive');
  end if;

  if v_product.meeting_commission_flat is null then
    return jsonb_build_object('success', false, 'error', 'SERVICE_NOT_ENABLED');
  end if;

  -- Idempotency check
  if exists (select 1 from public.transactions where external_transaction_id = p_cal_booking_uid) then
    return jsonb_build_object('success', false, 'error', 'Duplicate booking transaction');
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

  -- Split Math
  -- Spec: platform takes 5% of the commission
  v_fee := (v_commission * 5) / 100;
  v_net := v_commission - v_fee;

  -- Log Transaction
  insert into public.transactions (
    type, status, billing_status, product_id, link_id, seller_id, founder_id,
    external_customer_id, external_transaction_id,
    sale_amount, sale_currency, sale_amount_minor, sale_fx_rate,
    commission_amount, platform_fee, payout_due_date, vertical, meeting_start_at
  ) values (
    'sale',
    'pending',
    v_billing_status,
    p_product_id,
    p_link_id,
    p_seller_id,
    v_product.founder_id,
    p_buyer_email,
    p_cal_booking_uid,
    v_commission,
    'INR',
    v_commission,
    1,
    v_commission,
    v_fee,
    p_meeting_start_at + interval '48 hours',
    'service',
    p_meeting_start_at
  ) returning id into v_tx_id;

  -- Credit Escrow only if billed
  if v_billing_status = 'billed' then
    update public.profiles
      set pending_balance = coalesce(pending_balance, 0) + v_net
      where id = p_seller_id;
  end if;

  -- System Flags
  if not exists (select 1 from public.public_products where id = p_product_id) then
    update public.products set verified_at = now() where id = p_product_id;
  end if;

  return jsonb_build_object(
    'success', true,
    'tx_id', v_tx_id,
    'status', v_billing_status,
    'commission', v_commission,
    'net', v_net
  );
END;
$$;

REVOKE ALL ON FUNCTION public.record_meeting_booking(uuid, uuid, uuid, text, text, timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.record_meeting_booking(uuid, uuid, uuid, text, text, timestamptz) FROM anon;
REVOKE ALL ON FUNCTION public.record_meeting_booking(uuid, uuid, uuid, text, text, timestamptz) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.record_meeting_booking(uuid, uuid, uuid, text, text, timestamptz) TO service_role;

