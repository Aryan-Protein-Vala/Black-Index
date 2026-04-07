import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'
import { processConversion } from '@/lib/webhook-processor'
import crypto from 'crypto'

/**
 * Stripe Webhook Handler
 * POST /api/webhooks/stripe/[productId]
 * 
 * Supported events:
 * - invoice.paid (SaaS subscription renewals — PRIMARY)
 * - checkout.session.completed (one-time + first subscription payment)
 * - payment_intent.succeeded (fallback for direct payments)
 * 
 * Ref tracking: Add ref_id in session/subscription metadata
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
        // STEP 1: VERIFY STRIPE SIGNATURE (STRICT — NO FALLBACK)
        // ================================================
        const stripeSignature = request.headers.get('stripe-signature')

        if (!stripeSignature) {
            return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 401 })
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

        // Parse Stripe signature header
        const elements = stripeSignature.split(',')
        const signatureData: Record<string, string> = {}
        elements.forEach(el => {
            const [key, value] = el.split('=')
            signatureData[key] = value
        })

        const timestamp = signatureData['t']
        const signature = signatureData['v1']

        if (!timestamp || !signature) {
            return NextResponse.json({ error: 'Invalid signature format' }, { status: 401 })
        }

        // Verify signature
        const signedPayload = `${timestamp}.${rawBody}`
        const expectedSignature = crypto
            .createHmac('sha256', webhookSecret)
            .update(signedPayload)
            .digest('hex')

        if (!crypto.timingSafeEqual(
            Buffer.from(signature),
            Buffer.from(expectedSignature)
        )) {
            return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
        }

        // Reject stale webhooks (older than 5 minutes)
        const webhookAge = Math.floor(Date.now() / 1000) - parseInt(timestamp)
        if (webhookAge > 300) {
            return NextResponse.json({ error: 'Webhook too old' }, { status: 401 })
        }

        // ================================================
        // STEP 2: PARSE STRIPE PAYLOAD
        // ================================================
        const event = payload.type
        const data = payload.data?.object

        if (!data) {
            return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
        }

        let refId: string | undefined
        let externalCustomerId: string
        let externalTransactionId: string
        let amount: number
        let customerEmail: string

        if (event === 'invoice.paid') {
            // =============================================
            // SaaS SUBSCRIPTION RENEWAL (PRIMARY EVENT)
            // This fires on EVERY successful invoice payment,
            // including the first one for a new subscription.
            // =============================================
            refId = data.subscription_details?.metadata?.ref_id
                || data.lines?.data?.[0]?.metadata?.ref_id
                || data.metadata?.ref_id
            externalCustomerId = data.customer
            externalTransactionId = data.id // Invoice ID is unique per billing cycle
            amount = data.amount_paid // in smallest currency unit
            customerEmail = data.customer_email || ''

        } else if (event === 'checkout.session.completed') {
            // One-time purchase or first subscription checkout
            refId = data.metadata?.ref_id || data.metadata?.refId
            externalCustomerId = data.customer || data.customer_email || data.id
            externalTransactionId = data.payment_intent || data.id
            amount = data.amount_total
            customerEmail = data.customer_email || data.customer_details?.email || ''

        } else if (event === 'payment_intent.succeeded') {
            // Direct payment (fallback)
            refId = data.metadata?.ref_id || data.metadata?.refId
            externalCustomerId = data.customer || data.receipt_email || data.id
            externalTransactionId = data.id
            amount = data.amount
            customerEmail = data.receipt_email || ''

        } else if (event === 'customer.subscription.deleted') {
            // Subscription cancelled — update customer status
            const customerId = data.customer
            if (customerId) {
                await supabase
                    .from('customers')
                    .update({ status: 'cancelled' } as never)
                    .eq('external_customer_id', customerId)
                    .eq('product_id', productId)
            }
            return NextResponse.json({ message: 'Subscription cancellation recorded', status: 'processed' })

        } else {
            return NextResponse.json({
                message: `Event ${event} ignored`,
                status: 'skipped'
            })
        }

        if (!refId) {
            return NextResponse.json({
                error: 'Missing ref_id in metadata',
                hint: 'Add ref_id in session/subscription metadata'
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
            provider: 'stripe',
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
        console.error('Stripe webhook error:', error)
        return NextResponse.json({
            error: error instanceof Error ? error.message : 'Internal error'
        }, { status: 500 })
    }
}
