import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'
import { processConversion } from '@/lib/webhook-processor'
import crypto from 'crypto'

/**
 * Razorpay Webhook Handler
 * POST /api/webhooks/razorpay/[productId]
 * 
 * Supported events:
 * - subscription.charged (SaaS subscription renewals — PRIMARY)
 * - payment.captured (one-time payments)
 * - subscription.cancelled (churn tracking)
 * 
 * Ref tracking: Add ref_id in order/subscription notes
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

        // ================================================
        // STEP 1: VERIFY RAZORPAY SIGNATURE (STRICT — NO FALLBACK)
        // ================================================
        const razorpaySignature = request.headers.get('x-razorpay-signature')

        if (!razorpaySignature) {
            return NextResponse.json({ error: 'Missing x-razorpay-signature header' }, { status: 401 })
        }

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

        // Verify HMAC-SHA256 signature
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

        // ================================================
        // STEP 2: PARSE RAZORPAY PAYLOAD
        // ================================================
        const event = payload.event

        let refId: string | undefined
        let externalCustomerId: string
        let externalTransactionId: string
        let amount: number
        let customerEmail: string

        if (event === 'subscription.charged') {
            // =============================================
            // SaaS SUBSCRIPTION RENEWAL (PRIMARY EVENT)
            // =============================================
            const subEntity = payload.payload?.subscription?.entity
            const payEntity = payload.payload?.payment?.entity

            if (!payEntity) {
                return NextResponse.json({ error: 'Invalid subscription.charged payload' }, { status: 400 })
            }

            refId = subEntity?.notes?.ref_id
                || payEntity?.notes?.ref_id
                || subEntity?.notes?.refId
                || payEntity?.notes?.refId

            externalCustomerId = payEntity.email || subEntity?.customer_id || payEntity.id
            externalTransactionId = payEntity.id
            amount = payEntity.amount
            customerEmail = payEntity.email || ''

        } else if (event === 'payment.captured' || event === 'order.paid') {
            // =============================================
            // ONE-TIME PAYMENT (MANUAL OR TRACK.JS)
            // =============================================
            const paymentEntity = payload.payload?.payment?.entity
            const orderEntity = payload.payload?.order?.entity

            if (!paymentEntity && !orderEntity) {
                return NextResponse.json({ error: 'Invalid payload structure (no payment or order entity)' }, { status: 400 })
            }

            // Extract ref_id — Check Payment notes first, then Order notes (often used by track.js)
            refId = paymentEntity?.notes?.ref_id 
                || orderEntity?.notes?.ref_id
                || paymentEntity?.notes?.refId
                || orderEntity?.notes?.refId
                || paymentEntity?.description?.match(/ref_id[:=]\s*([a-zA-Z0-9_-]+)/)?.[1] // Fallback regex from description

            externalCustomerId = paymentEntity?.email || orderEntity?.customer_id || paymentEntity?.id || orderEntity?.id
            externalTransactionId = paymentEntity?.id || orderEntity?.id
            amount = paymentEntity?.amount || orderEntity?.amount || 0
            customerEmail = paymentEntity?.email || ''

        } else if (event === 'subscription.cancelled' || event === 'subscription.halted') {
            // Subscription cancelled or halted — update customer status
            const subEntity = payload.payload?.subscription?.entity
            const customerId = subEntity?.customer_id

            if (customerId) {
                await supabase
                    .from('customers')
                    .update({ status: event === 'subscription.cancelled' ? 'cancelled' : 'churned' } as never)
                    .eq('external_customer_id', customerId)
                    .eq('product_id', productId)
            }

            return NextResponse.json({
                message: `${event} recorded`,
                status: 'processed'
            })

        } else {
            return NextResponse.json({
                message: `Event ${event} ignored`,
                status: 'skipped'
            })
        }

        if (!refId) {
            console.warn(`[RAZORPAY WEBHOOK] Missing ref_id for product ${productId}. Event: ${event}`)
            
            // Log the failure for founder troubleshooting
            await supabase.from('webhook_logs').insert({
                product_id: productId,
                event_type: event,
                payload: payload,
                status: 'error',
                error_message: 'Missing ref_id in payment or order notes',
                ip_address: request.headers.get('x-forwarded-for') || 'razorpay-webhook'
            } as never)

            return NextResponse.json({
                error: 'Missing ref_id in notes',
                hint: 'Ensure your checkout form includes ref_id in notes'
            }, { status: 400 })
        }

        // ================================================
        // STEP 3: PROCESS CONVERSION
        // ================================================
        const result = await processConversion({
            productId,
            refId,
            externalCustomerId,
            externalTransactionId,
            amount,
            customerEmail,
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
