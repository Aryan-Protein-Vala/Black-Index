I am pivoting my affiliate network to be exclusively for SaaS products. Update my database schema to handle recurring subscriptions, pre-paid wallets, and a fraud bounty system.

In profiles: Add wallet_balance (bigint, default 0), security_deposit_paid (boolean, default false), stripe_connect_id (text), and razorpay_account_id (text).

Create a new table called saas_customers. Columns: id (uuid), external_customer_id (text, from Stripe/Razorpay), product_id (uuid), seller_id (uuid, references warlords), and status (text: 'active' or 'cancelled'). Add standard RLS policies.

Create a new table called fraud_reports. Columns: id (uuid), reporter_id (uuid, Warlord), founder_id (uuid), product_id (uuid), evidence_url (text), status (text: 'pending', 'verified', 'rejected'). Add standard RLS policies.

Ensure database.types.ts is updated to reflect these new tables and columns.


Rewrite my Stripe and Razorpay webhooks to support SaaS subscriptions and enforce strict security.

Webhooks must strictly enforce HMAC signature verification. If the signature is missing or invalid, return a 401 Unauthorized immediately.

Change the target events: Listen for invoice.paid (Stripe) and subscription.charged (Razorpay) instead of one-time payment events.

When an event fires, check if the external_customer_id exists in the saas_customers table. If it is new (Month 1), create the record linking it to the ref_id (Warlord). If it already exists (Month 2+), pull the seller_id from the table and process the recurring commission.

In webhook-processor.ts, add logic to check max_recurring_months from the product config. If the customer has been billed more times than this limit, ignore the webhook and do not pay the commission.


Overhaul the Founder Billing Setup UI and logic. There are now two tiers of billing.

Add a mandatory step for ALL founders: They must pay a ₹5,000 Refundable Security Deposit before their account is activated. Create the UI and Stripe/Razorpay checkout link for this.

Tier 1 (Automated): Create UI buttons saying "Connect Stripe" and "Connect Razorpay". These should initiate OAuth flows to save stripe_connect_id or razorpay_account_id to their profile for Split Payments.

Tier 2 (Pre-Paid): For founders using Gumroad/Lemon Squeezy, create a UI to "Deposit Funds to Commission Wallet". Add a checkout flow that allows them to deposit ₹10,000 into their wallet_balance.
Remove the old RBI Post-Paid UPI mandate flow entirely.


Create two cron jobs for the Black Index network.

Create /api/cron/wallet-check/route.ts. This script should fetch all founders who do NOT have a stripe_connect_id or razorpay_account_id (Tier 2 founders). Check their wallet_balance. If it is exactly 0, automatically update all their products in the products table to is_active = false.

Ensure /api/cron/release-escrow/route.ts finds all transactions in the transactions table where payout_due_date is in the past (T+30 days) and status is 'pending'. Update these to 'cleared', and move the commission_amount from the seller's pending_balance to withdrawable_balance in the profiles table.



Update the Founder Dashboard UI to reflect a SaaS-exclusive platform.

Change the top metrics: Replace "Total Sales" with "MRR Generated" (Monthly Recurring Revenue) and add a new metric card for "Active Subscribers".

In the "Webhook URLs Modal" (where they get their integration links), add a highly visible code block titled "Step 3: Enable Split Payments". Provide a code snippet showing them how to add transfer_data (for Stripe) and transfers (for Razorpay Route) to their checkout session creation on their backend, using our platform's Connected Account ID. Add a warning that failure to add this split logic will result in forfeiture of their security deposit.



Update the Seller (Warlord) Dashboard UI for SaaS and add the Fraud Bounty system.

Change the top metrics: Replace "Total Earnings" with "Active SaaS Subscriptions" and add a metric for "Projected Monthly Passive Income".

In the "Vault" tab, change the filter tags. Remove the percentage filters and replace them with SaaS categories: "B2B", "AI SaaS", "DevTools", "Marketing", "Creator Tools".

In the "My Links" tab, add a small red flag icon (🚩) next to the copy button for every link. When clicked, open a "Report Scam" modal. The modal should explain that if a founder is using a fake checkout page to steal traffic, the Warlord can upload a screenshot URL and describe the issue to claim a ₹2,500 bounty. Submit this data to the fraud_reports table.