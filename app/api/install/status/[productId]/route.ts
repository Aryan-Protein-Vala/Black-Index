import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, createAdminClient } from '@/lib/supabase-server'

/**
 * GET /api/install/status/[productId]
 * Owner-only. One call → full certification state for the dashboard to poll.
 * L0 handshake → L1 simulation → L2 certified (verified_at).
 */
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ productId: string }> }
) {
    try {
        const { productId } = await params
        const supabase = await createServerSupabaseClient()

        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const admin = createAdminClient()
        const { data: product, error } = await admin
            .from('products')
            .select('id, founder_id, script_detected_at, verified_at, is_active')
            .eq('id', productId)
            .single()

        if (error || !product) {
            return NextResponse.json({ error: 'Product not found' }, { status: 404 })
        }
        if ((product as { founder_id: string }).founder_id !== user.id) {
            return NextResponse.json({ error: 'Not your product' }, { status: 403 })
        }

        // Last 5 webhook events for this product (the handshake evidence)
        const { data: logs } = await admin
            .from('webhook_logs')
            .select('event_type, status, error_message, created_at')
            .eq('product_id', productId)
            .order('created_at', { ascending: false })
            .limit(5)

        const p = product as {
            founder_id: string
            script_detected_at: string | null
            verified_at: string | null
            is_active: boolean
        }

        const lastConversion = (logs as any[] || []).find(l => l.event_type === 'conversion' && l.status === 'success')
        const lastSim = (logs as any[] || []).find(l => l.event_type === 'simulated_sale')

        return NextResponse.json({
            script_detected: !!p.script_detected_at,
            script_detected_at: p.script_detected_at,
            handshake_done: (logs as any[] || []).some(l => l.status === 'success'), // any real webhook got through signature verification
            simulation_done: !!lastSim,
            certified: !!p.verified_at,
            certified_at: p.verified_at,
            listed_in_vault: !!(p.verified_at && p.is_active),
            first_real_sale_at: lastConversion?.created_at || null,
            recent_events: logs || [],
        })

    } catch (error) {
        console.error('Install status error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
