import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, createAdminClient } from '@/lib/supabase-server'
import { checkRateLimit } from '@/lib/rate-limit'

/**
 * POST /api/products/[id]/shopify-secret
 * Owner-only. Sets the Shopify webhook HMAC secret for this product.
 *
 * Needed because protect_product_columns blocks browser writes to
 * shopify_hmac_secret — only service-role (this route) can set it.
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

        if (!(await checkRateLimit(`shopify-secret:${user.id}`, 10, 3600))) {
            return NextResponse.json({ error: 'Too many attempts — try again later' }, { status: 429 })
        }

        const body = await request.json()
        const { secret } = body
        if (typeof secret !== 'string' || secret.trim().length < 16) {
            return NextResponse.json({ error: 'A valid Shopify webhook secret is required (min 16 chars)' }, { status: 400 })
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
            .update({ shopify_hmac_secret: secret.trim() } as never)
            .eq('id', productId)

        if (updateError) {
            return NextResponse.json({ error: 'Failed to save Shopify secret' }, { status: 500 })
        }

        return NextResponse.json({
            success: true,
            message: 'Shopify webhook secret saved. Paste the URL into Shopify → Settings → Notifications → Webhooks.',
        })
    } catch (error) {
        console.error('Shopify secret error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
