# BLACK INDEX — CANONICAL IMPLEMENTATION INSTRUCTIONS
Version: FINAL
Audience: IDE (Cursor)
Purpose: Build the money-correct core from empty DB to first payout.

---

## 0. ASSUMPTIONS

- Supabase project is initialized
- Auth is enabled
- Tables already exist:
  - profiles
  - products
  - links
  - transactions
  - webhook_logs

If any of these do not exist, STOP.

---

## 1. DATABASE PRIMITIVES (REQUIRED)

### 1.1 Customers Table (NEW vs RECURRING source of truth)

Create this table if it does not exist.

```sql
create table if not exists public.customers (
  id uuid default gen_random_uuid() primary key,
  product_id uuid references public.products(id) not null,
  seller_id uuid references public.profiles(id) not null,
  external_customer_id text not null,
  first_seen_at timestamp with time zone default timezone('utc', now()),
  unique (product_id, external_customer_id)
);
1.2 Atomic Balance Update Function

Create a Supabase RPC to prevent race conditions.

create or replace function lock_commission_funds(
  p_seller_id uuid,
  p_amount bigint
)
returns void as $$
begin
  update profiles
  set pending_balance = pending_balance + p_amount,
      total_earnings = total_earnings + p_amount
  where id = p_seller_id;
end;
$$ language plpgsql;

2. TRACKING SPINE — REFERRAL REDIRECT
Route

/ref/[slug]

Rules

slug is an identifier (example: aryan-neet)

slug is NOT a full URL

one slug maps to one (seller, product)

Logic

Lookup links by slug

If not found → 404

Increment clicks asynchronously

Redirect with 307 to:
product.website_url?ref_id=links.id

Notes

Do NOT block on analytics

Do NOT mutate anything except clicks

3. WEBHOOK EARS — MONEY ENTRYPOINT
Route

POST /api/webhooks/conversion

REQUIRED ORDER (DO NOT CHANGE)
Step 1: Signature Verification

Header: x-black-index-signature

Fetch products.webhook_secret

Verify HMAC of raw body

Fail → 401

Step 2: Idempotency

Check transactions.external_transaction_id

If exists → return 200 (no-op)

Step 3: Customer Resolution

Lookup (product_id, external_customer_id) in customers

If not found:

Insert row

Mark as NEW

Else:

Mark as RECURRING

Step 4: Commission Calculation

Read commission_config

If NEW → upfront_pct

If RECURRING → recurring_pct

Calculate commission_amount

Enforce max_cac_limit if present

Step 5: Ledger Insert

Insert into transactions:

type = 'sale'

status = 'pending'

payout_due_date = now() + interval '30 days'

external_transaction_id (unique)

external_customer_id

Step 6: Atomic Escrow Lock

Call Supabase RPC:

lock_commission_funds(seller_id, commission_amount)

Step 7: Audit Log

Insert raw payload + status into webhook_logs

4. DASHBOARD WIRING
Live Ticker

Supabase Realtime on transactions

Only show type='sale'

Armoury

Fetch from products

Parse commission_config

Display expected payout math

Wallet

pending_balance

withdrawable_balance

DO NOT calculate balances from transactions in frontend.

5. PAYOUT FLOW
Seller

Can request payout only from withdrawable_balance

Admin

Review payout request

Send money externally

Mark as paid:

Insert transactions(type='payout')

Deduct from withdrawable_balance

Balances must always reconcile.

6. SEED DATA (MANUAL)

Create admin profile

Insert initial products

Generate webhook_secret per product

Generate initial links

7. NON-GOALS (DO NOT BUILD NOW)

Automated payouts

Refund processing

Multi-seller attribution

Chargebacks

END OF INSTRUCTIONS