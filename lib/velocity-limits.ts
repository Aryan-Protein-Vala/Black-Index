import { SupabaseClient } from '@supabase/supabase-js'

/**
 * Velocity Limits for Fraud Prevention
 * 
 * Prevents abuse by limiting daily transaction volumes
 */

interface VelocityCheckResult {
    allowed: boolean
    reason?: string
    currentDayTotal?: number
    limit?: number
}

// Limits in paise
const DAILY_FOUNDER_LIMIT = 5000000 // ₹50,000 per day per founder
const DAILY_SELLER_LIMIT = 1000000  // ₹10,000 per day per seller
const HOURLY_PRODUCT_LIMIT = 500000 // ₹5,000 per hour per product
const HOURLY_IP_LIMIT = 100          // 100 requests per hour per IP

/**
 * Check if a new sale is within velocity limits
 */
export async function checkVelocityLimits(
    supabase: SupabaseClient,
    founderId: string,
    sellerId: string,
    productId: string,
    amount: number,
    clientIp?: string
): Promise<VelocityCheckResult> {
    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
    const hourAgo = new Date(now.getTime() - 60 * 60 * 1000).toISOString()

    // Check 1: Daily founder limit
    const { data: founderDailyTxns } = await supabase
        .from('transactions')
        .select('commission_amount')
        .gte('created_at', todayStart)
        .eq('status', 'pending')

    // Get transactions for this founder's products
    const { data: founderProducts } = await supabase
        .from('products')
        .select('id')
        .eq('founder_id', founderId)

    const productIds = (founderProducts || []).map(p => (p as { id: string }).id)

    const { data: founderTxns } = await supabase
        .from('transactions')
        .select('commission_amount')
        .in('product_id', productIds)
        .gte('created_at', todayStart)

    const founderDayTotal = (founderTxns || []).reduce((sum, t) => {
        const txn = t as { commission_amount: number }
        return sum + (txn.commission_amount || 0)
    }, 0)

    if (founderDayTotal + amount > DAILY_FOUNDER_LIMIT) {
        return {
            allowed: false,
            reason: `Daily limit exceeded for founder. Current: ₹${founderDayTotal / 100}, Limit: ₹${DAILY_FOUNDER_LIMIT / 100}`,
            currentDayTotal: founderDayTotal,
            limit: DAILY_FOUNDER_LIMIT,
        }
    }

    // Check 2: Daily seller limit
    const { data: sellerTxns } = await supabase
        .from('transactions')
        .select('commission_amount')
        .eq('seller_id', sellerId)
        .gte('created_at', todayStart)

    const sellerDayTotal = (sellerTxns || []).reduce((sum, t) => {
        const txn = t as { commission_amount: number }
        return sum + (txn.commission_amount || 0)
    }, 0)

    if (sellerDayTotal + amount > DAILY_SELLER_LIMIT) {
        return {
            allowed: false,
            reason: `Daily limit exceeded for seller. Current: ₹${sellerDayTotal / 100}, Limit: ₹${DAILY_SELLER_LIMIT / 100}`,
            currentDayTotal: sellerDayTotal,
            limit: DAILY_SELLER_LIMIT,
        }
    }

    // Check 3: Hourly product limit (burst protection)
    const { data: productHourlyTxns } = await supabase
        .from('transactions')
        .select('commission_amount')
        .eq('product_id', productId)
        .gte('created_at', hourAgo)

    const productHourTotal = (productHourlyTxns || []).reduce((sum, t) => {
        const txn = t as { commission_amount: number }
        return sum + (txn.commission_amount || 0)
    }, 0)

    if (productHourTotal + amount > HOURLY_PRODUCT_LIMIT) {
        return {
            allowed: false,
            reason: `Hourly limit exceeded for product. Unusual activity detected.`,
            currentDayTotal: productHourTotal,
            limit: HOURLY_PRODUCT_LIMIT,
        }
    }

    // Check 4: Hourly IP limit (rate limiting)
    if (clientIp) {
        const { count } = await supabase
            .from('webhook_logs')
            .select('*', { count: 'exact', head: true })
            .eq('client_ip', clientIp)
            .gte('created_at', hourAgo)

        if (count && count > HOURLY_IP_LIMIT) {
            return {
                allowed: false,
                reason: `IP rate limit exceeded. Too many requests.`,
            }
        }
    }

    return { allowed: true }
}

/**
 * Check for suspicious patterns
 */
export async function checkSuspiciousPatterns(
    supabase: SupabaseClient,
    sellerId: string,
    customerEmail: string
): Promise<{ suspicious: boolean; reasons: string[] }> {
    const reasons: string[] = []
    const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

    // Check 1: Same customer bought from same seller multiple times today
    const { count: repeatPurchases } = await supabase
        .from('transactions')
        .select('*', { count: 'exact', head: true })
        .eq('seller_id', sellerId)
        .eq('external_customer_id', customerEmail)
        .gte('created_at', dayAgo)

    if (repeatPurchases && repeatPurchases > 3) {
        reasons.push(`Customer ${customerEmail} has made ${repeatPurchases} purchases from same seller today`)
    }

    // Check 2: Burst of sales in short time
    const { count: burstSales } = await supabase
        .from('transactions')
        .select('*', { count: 'exact', head: true })
        .eq('seller_id', sellerId)
        .gte('created_at', hourAgo)

    if (burstSales && burstSales > 10) {
        reasons.push(`Seller has ${burstSales} sales in the last hour - unusual burst`)
    }

    // Check 3: Customer email looks suspicious
    const suspiciousPatterns = [
        /test/i,
        /fake/i,
        /temp/i,
        /disposable/i,
        /mailinator/i,
        /guerrillamail/i,
        /10minutemail/i,
    ]

    if (suspiciousPatterns.some(pattern => pattern.test(customerEmail))) {
        reasons.push(`Customer email ${customerEmail} appears to be temporary/fake`)
    }

    return {
        suspicious: reasons.length > 0,
        reasons,
    }
}

/**
 * Log velocity limit hit for monitoring
 */
export async function logVelocityHit(
    supabase: SupabaseClient,
    type: 'founder' | 'seller' | 'product' | 'ip',
    entityId: string,
    limit: number,
    current: number
): Promise<void> {
    try {
        await supabase.from('velocity_logs').insert({
            type,
            entity_id: entityId,
            limit_amount: limit,
            current_amount: current,
            hit_at: new Date().toISOString(),
        } as never)
    } catch (err) {
        console.error('[VELOCITY] Failed to log hit:', err)
    }
}
