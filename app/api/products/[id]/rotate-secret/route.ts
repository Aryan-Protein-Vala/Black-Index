import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, createAdminClient } from '@/lib/supabase-server'
import { checkRateLimit } from '@/lib/rate-limit'
import crypto from 'crypto'

/**
 * POST /api/products/[id]/rotate-secret
 * Owner-only. Generates a fresh webhook signing secret.
 * The new secret is returned exactly ONCE — update your provider dashboard
 * immediately. Old signatures start 401ing the moment this runs.
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

        if (!(await checkRateLimit(`rotate-secret:${user.id}`, 5, 3600))) {
            return NextResponse.json({ error: 'Too many rotations — try again later' }, { status: 429 })
        }

        // Ownership check (RLS-friendly read via admin for reliability)
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

        const newSecret = crypto.randomBytes(32).toString('hex')

        const { error: updateError } = await admin
            .from('products')
            .update({ webhook_secret: newSecret } as never)
            .eq('id', productId)

        if (updateError) {
            return NextResponse.json({ error: 'Failed to rotate secret' }, { status: 500 })
        }

        return NextResponse.json({
            webhook_secret: newSecret,
            message: 'Secret rotated. Copy it now — it will not be shown again. Update your provider webhook settings immediately.',
        })

    } catch (error) {
        console.error('Rotate secret error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
