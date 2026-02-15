import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'
import { processConversion } from '@/lib/webhook-processor'
import crypto from 'crypto'

/**
 * Lemon Squeezy Native Webhook Handler
 * POST /api/webhooks/lemonsqueezy/[productId]
 * 
 * Founders configure this URL in Lemon Squeezy → Settings → Webhooks
 * Events: order_created
 * 
 * Ref tracking: Add ref_id in checkout custom_data
 * Example: LemonSqueezy.Checkout({ custom: { ref_id: 'link-uuid' } })
 */

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ productId: string }> }
) {
    const { productId } = await params
    const supabase = createAdminClient()

    try {
        const rawBody = await request.text()
        const payload = JSON.parse(rawBody)

        const secret = request.nextUrl.searchParams.get('secret')

        // ================================================
        // STEP 1: VERIFY SIGNATURE
        // ================================================
        const lemonSignature = request.headers.get('x-signature')

        const { data: product, error: productError } = await supabase
            .from('products')
            .select('webhook_secret')
            .eq('id', productId)
            .single()

        if (productError || !product) {
            return NextResponse.json({ error: 'Product not found' }, { status: 404 })
        }

        const webhookSecret = (product as { webhook_secret: string }).webhook_secret

        if (lemonSignature) {
            const expectedSignature = crypto
                .createHmac('sha256', webhookSecret)
                .update(rawBody)
                .digest('hex')

            if (lemonSignature !== expectedSignature) {
                return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
            }
        } else if (secret !== webhookSecret) {
            return NextResponse.json({ error: 'Invalid secret' }, { status: 401 })
        }

        // ================================================
        // STEP 2: PARSE LEMON SQUEEZY PAYLOAD
        // ================================================
        const eventName = payload.meta?.event_name

        if (eventName !== 'order_created') {
            return NextResponse.json({
                message: `Event ${eventName} ignored`,
                status: 'skipped'
            })
        }

        const data = payload.data?.attributes
        const customData = payload.meta?.custom_data || {}

        if (!data) {
            return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
        }

        const refId = customData.ref_id || customData.refId

        if (!refId) {
            return NextResponse.json({
                error: 'Missing ref_id in custom_data',
                hint: 'Pass ref_id in checkout custom_data'
            }, { status: 400 })
        }

        // Lemon Squeezy amounts are in cents
        const amount = data.total || data.subtotal || 0

        // ================================================
        // STEP 3: PROCESS CONVERSION
        // ================================================
        const result = await processConversion({
            productId,
            refId,
            externalCustomerId: data.user_email || payload.data?.id,
            externalTransactionId: payload.data?.id?.toString() || data.order_number,
            amount: amount, // in cents
            customerEmail: data.user_email || '',
            provider: 'lemonsqueezy',
            rawPayload: payload,
        })

        if (!result.success) {
            return NextResponse.json({
                status: 'error',
                message: result.message,
                error: result.error,
            })
        }

        return NextResponse.json({
            status: 'success',
            message: result.message,
            transaction_id: result.transactionId,
            commission: result.commission,
        })

    } catch (error) {
        console.error('Lemon Squeezy webhook error:', error)
        return NextResponse.json({
            error: error instanceof Error ? error.message : 'Internal error'
        }, { status: 500 })
    }
}
