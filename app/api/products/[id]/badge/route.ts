import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'

/**
 * GET /api/products/[id]/badge
 * Public trust-tier badge endpoint.
 *
 * Tier ladder (computed from product_trust_stats — never fabricated):
 *   0 = "Not yet certified"  (no verified money pipe yet)
 *   1 = "Certified"          (verified_at set)
 *   2 = "Trusted"            (>= 5 billed & non-refunded sales, 0 confirmed fraud)
 *   3 = "Blacklisted"        (blacklist row OR >= 1 CONFIRMED fraud report)
 *
 * Fraud count = reports with status='confirmed' (dismissed never counts).
 * Sales count = billed AND not refunded only.
 */
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
        const supabase = createAdminClient()

        const { data: product, error: productError } = await supabase
            .from('products')
            .select('id, founder_id, verified_at, is_active')
            .eq('id', id)
            .single()

        if (productError || !product) {
            return NextResponse.json({ error: 'Product not found' }, { status: 404 })
        }

        const { data: stats, error: statsError } = await supabase
            .from('product_trust_stats' as never)
            .select('confirmed_fraud_count, sales_count, is_blacklisted, tier')
            .eq('product_id', id)
            .single()

        if (statsError || !stats) {
            return NextResponse.json({ error: 'Product stats unavailable' }, { status: 500 })
        }

        const s = stats as { confirmed_fraud_count: number; sales_count: number; is_blacklisted: boolean; tier: number }

        const tier = s.tier
        const label =
            tier === 3
                ? s.is_blacklisted
                    ? 'Blacklisted'
                    : 'Suspended'
                : tier === 2
                    ? 'Trusted'
                    : tier === 1
                        ? 'Certified'
                        : 'Not yet certified'

        return NextResponse.json({
            product_id: id,
            tier,
            label,
            confirmed_fraud_count: s.confirmed_fraud_count,
            sales_count: s.sales_count,
        })
    } catch (error) {
        console.error('Badge endpoint error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
