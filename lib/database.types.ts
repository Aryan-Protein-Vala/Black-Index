// Database type definitions for Black Index
// These are manually defined since auto-generation was cancelled

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
    commission_config: {
        type: 'hybrid' | 'upfront' | 'recurring'
        upfront_pct: number
        recurring_pct?: number
    }
    max_cac_limit?: number
    webhook_secret?: string
    webhook_status?: 'pending' | 'verified'
    webhook_verified_at?: string
    last_webhook_at?: string
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
    billing_status?: 'unbilled' | 'scheduled' | 'billed'
    charge_schedule_id?: string
    is_recurring?: boolean
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
    avatar_url?: string
    role: 'admin' | 'founder' | 'warlord'
    pending_balance: number
    withdrawable_balance: number
    total_earnings: number
    unbilled_amount?: number
    charge_threshold?: number
    razorpay_customer_id?: string
    razorpay_subscription_id?: string
    mandate_max_amount?: number
    razorpay_fund_account_id?: string
    upi_vpa?: string
    created_at: string
}

export interface CommissionConfig {
    type: 'hybrid' | 'upfront' | 'recurring'
    upfront_pct: number
    recurring_pct?: number
}