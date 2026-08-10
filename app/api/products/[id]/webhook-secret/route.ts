import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, createAdminClient } from '@/lib/supabase-server'
import { checkRateLimit } from '@/lib/rate-limit'

/**
 * POST /api/products/[id]/webhook-secret
 * Owner-only. Sets the webhook signing secret to a specific value.
 *
 * Needed for Stripe, which generates its own endpoint signing secret
 * (whsec_...) — founders cannot choose it. All other providers paste the
 * BlackIndex-generated secret into their dashboard instead.
 *
 * protect_product_columns blocks browser writes to webhook_secret, so only
 * service-role (this route) can set it.
 */
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: productId } = await params
        const supabase = await createServerSupabaseClient()

        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        if (!(await checkRateLimit(`set-webhook-secret:${user.id}`, 10, 3600))) {
            return NextResponse.json({ error: 'Too many attempts — try again later' }, { status: 429 })
        }

        const body = await request.json()
        const { secret } = body
        if (typeof secret !== 'string' || secret.trim().length < 16) {
            return NextResponse.json({ error: 'A valid webhook signing secret is required (min 16 chars)' }, { status: 400 })
        }

        const admin = createAdminClient()
        const { data: product, error } = await admin
            .from('products')
            .select('id, founder_id')
            .eq('id', productId)
            .single()

        if (error || !product) {
            return NextResponse.json({ error: 'Product not found' }, { status: 404 })
        }

        if ((product as { founder_id: string }).founder_id !== user.id) {
            return NextResponse.json({ error: 'Not your product' }, { status: 403 })
        }

        const { error: updateError } = await admin
            .from('products')
            .update({ webhook_secret: secret.trim() } as never)
            .eq('id', productId)

        if (updateError) {
            return NextResponse.json({ error: 'Failed to save webhook secret' }, { status: 500 })
        }

        return NextResponse.json({
            success: true,
            message: 'Webhook secret updated. Any provider using the old secret will start failing signature checks immediately.',
        })
    } catch (error) {
        console.error('Set webhook secret error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
