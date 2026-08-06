import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, createAdminClient } from '@/lib/supabase-server'
import { checkRateLimit } from '@/lib/rate-limit'
import crypto from 'crypto'

/**
 * POST /api/install/token  { product_id }
 * Mints a per-product install token for the `npx @blackindex/init` CLI.
 * Scoped to /api/install/* only. NOT the webhook secret.
 *
 * DELETE /api/install/token  { product_id }  → revoke all tokens for product
 */
export async function POST(request: NextRequest) {
    try {
        const supabase = await createServerSupabaseClient()
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { product_id } = await request.json()
        if (!product_id) {
            return NextResponse.json({ error: 'product_id required' }, { status: 400 })
        }

        if (!(await checkRateLimit(`install-token:${user.id}`, 10, 3600))) {
            return NextResponse.json({ error: 'Too many token requests' }, { status: 429 })
        }

        const admin = createAdminClient()
        const { data: product, error } = await admin
            .from('products')
            .select('id, founder_id')
            .eq('id', product_id)
            .single()

        if (error || !product) {
            return NextResponse.json({ error: 'Product not found' }, { status: 404 })
        }
        if ((product as { founder_id: string }).founder_id !== user.id) {
            return NextResponse.json({ error: 'Not your product' }, { status: 403 })
        }

        const rawToken = `bi_install_${crypto.randomBytes(24).toString('hex')}`
        const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex')

        await admin.from('install_tokens').insert({
            product_id,
            founder_id: user.id,
            token_hash: tokenHash,
        } as never)

        return NextResponse.json({
            install_token: rawToken,
            message: 'Token minted. It is shown once — store it in your project env.',
            usage: `npx @blackindex/init --product ${product_id} --token ${rawToken}`,
        })

    } catch (error) {
        console.error('Install token error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}

export async function DELETE(request: NextRequest) {
    try {
        const supabase = await createServerSupabaseClient()
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { product_id } = await request.json()
        const admin = createAdminClient()
        await admin
            .from('install_tokens')
            .update({ revoked_at: new Date().toISOString() } as never)
            .eq('product_id', product_id)
            .eq('founder_id', user.id)
            .is('revoked_at', null)

        return NextResponse.json({ success: true })
    } catch (error) {
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
