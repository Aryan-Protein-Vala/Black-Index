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
    verified_at?: string | null
    auto_paused?: boolean
    trust_tier?: number // 0=Not yet certified, 1=Certified, 2=Trusted, 3=Suspended/Blacklisted
    // Service (Cal.com) vertical
    meeting_commission_flat?: number | null // paise per meeting
    cal_link?: string | null
    // Physical (Shopify) vertical
    shopify_hmac_secret?: string | null
    created_at: string
}

export interface Transaction {
    id: string
    type: 'sale' | 'refund' | 'payout'
    status: 'pending' | 'cleared' | 'paid' | 'cancelled' | 'refunded' | 'failed' | 'disputed'
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
    refund_of?: string
    currency?: string
    amount_minor?: number
    fx_rate?: number
    vertical?: 'saas' | 'service' | 'physical'
    confirmed_by_buyer?: boolean
    meeting_start_at?: string | null
    metadata?: Record<string, unknown> | null
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

// Database type for Supabase client generics
// This is a minimal type stub — for full type safety, generate types
// with `npx supabase gen types typescript`
export type Database = {
    public: {
        Tables: {
            profiles: { Row: Profile; Insert: Partial<Profile>; Update: Partial<Profile> }
            products: { Row: Product; Insert: Partial<Product>; Update: Partial<Product> }
            transactions: { Row: Transaction; Insert: Partial<Transaction>; Update: Partial<Transaction> }
            links: { Row: Link; Insert: Partial<Link>; Update: Partial<Link> }
            customers: { Row: SaasCustomer; Insert: Partial<SaasCustomer>; Update: Partial<SaasCustomer> }
            notifications: { Row: Notification; Insert: Partial<Notification>; Update: Partial<Notification> }
            fraud_reports: { Row: FraudReport; Insert: Partial<FraudReport>; Update: Partial<FraudReport> }
            founder_deposits: { Row: FounderDeposit; Insert: Partial<FounderDeposit>; Update: Partial<FounderDeposit> }
            webhook_logs: { Row: any; Insert: any; Update: any }
            charge_schedules: { Row: any; Insert: any; Update: any }
            featured_payments: { Row: any; Insert: any; Update: any }
            payments: { Row: any; Insert: any; Update: any }
            [key: string]: { Row: any; Insert: any; Update: any }
        }
        Views: { [key: string]: { Row: any } }
        Functions: { [key: string]: { Args: any; Returns: any } }
        Enums: { [key: string]: string }
    }
}