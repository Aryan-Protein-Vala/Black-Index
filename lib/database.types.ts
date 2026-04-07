// Database type definitions for Black Index
// SaaS Pivot — Updated types

export interface Product {
    id: string
    founder_id: string
    name: string
    description?: string
    logo_url?: string
    website_url: string
    is_active: boolean
    is_founders_choice?: boolean
    is_featured?: boolean
    featured_until?: string
    category: 'b2b' | 'ai_saas' | 'devtools' | 'marketing' | 'creator_tools' | 'other'
    commission_config: CommissionConfig
    max_cac_limit?: number
    webhook_secret?: string
    settlement_mode?: string
    created_at: string
}

export interface Transaction {
    id: string
    type: 'sale' | 'refund' | 'payout'
    status: 'pending' | 'cleared' | 'paid' | 'cancelled'
    product_id: string
    seller_id: string
    link_id?: string
    sale_amount: number
    commission_amount: number
    platform_fee: number
    external_customer_id?: string
    external_transaction_id?: string
    payout_due_date?: string
    billing_status?: 'unbilled' | 'scheduled' | 'billed' | 'wallet_insufficient'
    charge_schedule_id?: string
    is_recurring?: boolean
    cleared_at?: string
    created_at: string
}

export interface Link {
    id: string
    seller_id: string
    product_id: string
    slug: string
    clicks: number
    conversions: number
    created_at: string
    products?: Partial<Product>
}

export interface Profile {
    id: string
    full_name?: string
    email?: string
    phone?: string
    avatar_url?: string
    role: 'admin' | 'founder' | 'warlord'
    // Balances (in paise)
    pending_balance: number
    withdrawable_balance: number
    total_earnings: number
    wallet_balance: number
    // Billing
    security_deposit_paid: boolean
    unbilled_amount?: number
    charge_threshold?: number
    // Connected accounts (Tier 1)
    stripe_connect_id?: string
    razorpay_account_id?: string
    // Legacy (may be removed)
    razorpay_customer_id?: string
    razorpay_subscription_id?: string
    mandate_max_amount?: number
    razorpay_fund_account_id?: string
    upi_vpa?: string
    created_at: string
}

export interface SaasCustomer {
    id: string
    product_id: string
    seller_id: string
    external_customer_id: string
    status: 'active' | 'cancelled' | 'churned'
    billing_count: number
    first_seen_at: string
}

export interface FraudReport {
    id: string
    reporter_id: string
    founder_id: string
    product_id: string
    evidence_url: string
    description?: string
    status: 'pending' | 'verified' | 'rejected'
    resolution_notes?: string
    bounty_paid: boolean
    created_at: string
    resolved_at?: string
}

export interface Notification {
    id: string
    user_id: string
    type: string
    title: string
    message: string
    metadata?: Record<string, any>
    read: boolean
    created_at: string
}

export interface FounderDeposit {
    id: string
    founder_id: string
    type: 'security_deposit' | 'wallet_topup' | 'refund'
    amount: number
    status: 'pending' | 'completed' | 'refunded'
    payment_id?: string
    order_id?: string
    refund_reason?: string
    created_at: string
}

export interface CommissionConfig {
    type: 'hybrid' | 'upfront' | 'recurring'
    upfront_pct: number
    recurring_pct?: number
    max_recurring_months?: number
}