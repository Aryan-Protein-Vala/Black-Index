import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'
import { processConversion } from '@/lib/webhook-processor'
import crypto from 'crypto'

/**
 * Razorpay Native Webhook Handler
 * POST /api/webhooks/razorpay/[productId]
 * 
 * Founders configure this URL in Razorpay Dashboard → Webhooks
 * Events: payment.captured
 * 
 * Ref tracking: Add ref_id in order notes when creating Razorpay order
 * Example: razorpay.orders.create({ notes: { ref_id: 'link-uuid' } })
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

        // Get webhook secret from query params or product
        const secret = request.nextUrl.searchParams.get('secret')

        // ================================================
        // STEP 1: VERIFY SIGNATURE
        // ================================================
        const razorpaySignature = request.headers.get('x-razorpay-signature')

        // Fetch product to get webhook_secret
        const { data: product, error: productError } = await supabase
            .from('products')
            .select('webhook_secret')
            .eq('id', productId)
            .single()

        if (productError || !product) {
            return NextResponse.json({ error: 'Product not found' }, { status: 404 })
        }

        const webhookSecret = (product as { webhook_secret: string }).webhook_secret

        // Verify using Razorpay signature if present
        if (razorpaySignature) {
            const expectedSignature = crypto
                .createHmac('sha256', webhookSecret)
                .update(rawBody)
                .digest('hex')

            if (!crypto.timingSafeEqual(
                Buffer.from(razorpaySignature),
                Buffer.from(expectedSignature)
            )) {
                return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
            }
        } else if (secret !== webhookSecret) {
            // Fallback: verify via query param secret
            return NextResponse.json({ error: 'Invalid secret' }, { status: 401 })
        }

        // ================================================
        // STEP 2: PARSE RAZORPAY PAYLOAD
        // ================================================
        const event = payload.event

        // Only process payment.captured events
        if (event !== 'payment.captured') {
            return NextResponse.json({
                message: `Event ${event} ignored`,
                status: 'skipped'
            })
        }

        const paymentEntity = payload.payload?.payment?.entity
        if (!paymentEntity) {
            return NextResponse.json({ error: 'Invalid payload structure' }, { status: 400 })
        }

        // Extract data from Razorpay payment
        const {
            id: paymentId,
            order_id: orderId,
            amount, // in paise
            email: customerEmail,
            contact: customerPhone,
            notes,
        } = paymentEntity

        // Get ref_id from notes (founder must pass this when creating order)
        const refId = notes?.ref_id || notes?.refId || notes?.referral_id

        if (!refId) {
            return NextResponse.json({
                error: 'Missing ref_id in payment notes',
                hint: 'Add ref_id in notes when creating Razorpay order'
            }, { status: 400 })
        }

        // Use email or phone as customer identifier
        const externalCustomerId = customerEmail || customerPhone || paymentId

        // ================================================
        // STEP 3: PROCESS CONVERSION
        // ================================================
        const result = await processConversion({
            productId,
            refId,
            externalCustomerId,
            externalTransactionId: paymentId,
            amount: amount, // Already in paise
            customerEmail: customerEmail || '',
            provider: 'razorpay',
            rawPayload: payload,
        })

        if (!result.success) {
            // Return 200 to prevent Razorpay from retrying (we logged the issue)
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
        console.error('Razorpay webhook error:', error)
        return NextResponse.json({
            error: error instanceof Error ? error.message : 'Internal error'
        }, { status: 500 })
    }
}
