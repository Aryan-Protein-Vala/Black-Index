import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'
import { processConversion, processRefund } from '@/lib/webhook-processor'
import { convertMinorToINRPaise } from '@/lib/fx'
import crypto from 'crypto'

/**
 * Stripe Webhook Handler
 * POST /api/webhooks/stripe/[productId]
 *
 * EVENT MODEL (this split kills the old double/triple commission):
 * - Subscription products  → invoice.paid ONLY (fires EVERY billing cycle,
 *   including month 1)
 * - One-time products      → payment_intent.succeeded ONLY
 * - customer.subscription.deleted → churn
 * - charge.refunded        → clawback
 *
 * checkout.session.completed is deliberately IGNORED. It and invoice.paid
 * fire with different ids for the same money, so processing both pays the
 * affiliate twice and drains the founder's wallet twice as fast.
 *
 * Ref tracking: ref_id in subscription metadata (subs) or payment_intent /
 * checkout session metadata (one-time).
 */

function sigInvalid(a: string, b: string): boolean {
    const bufA = Buffer.from(a)
    const bufB = Buffer.from(b)
    if (bufA.length !== bufB.length) return true
    return !crypto.timingSafeEqual(bufA, bufB)
}

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
        // STEP 1: VERIFY STRIPE SIGNATURE (STRICT)
        // ================================================
        const stripeSignature = request.headers.get('stripe-signature')

        if (!stripeSignature) {
            return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 401 })
        }

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

        const signedPayload = `${timestamp}.${rawBody}`
        const expectedSignature = crypto
            .createHmac('sha256', webhookSecret)
            .update(signedPayload)
            .digest('hex')

        if (sigInvalid(signature, expectedSignature)) {
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
        const event: string = payload.type
        const data = payload.data?.object

        if (!data) {
            return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
        }

        let refId: string | undefined
        let externalCustomerId: string
        let externalTransactionId: string
        let amountMinor: number
        let currency: string
        let customerEmail: string

        if (event === 'invoice.paid') {
            // =============================================
            // SUBSCRIPTION (PRIMARY — every billing cycle incl. first)
            // =============================================
            refId = data.subscription_details?.metadata?.ref_id
                || data.lines?.data?.[0]?.metadata?.ref_id
                || data.metadata?.ref_id
            externalCustomerId = data.customer
            externalTransactionId = data.id // invoice id: unique per billing cycle
            amountMinor = data.amount_paid
            currency = data.currency || 'inr'
            customerEmail = data.customer_email || ''

        } else if (event === 'payment_intent.succeeded') {
            // =============================================
            // ONE-TIME PAYMENT ONLY
            // subscription charges ALSO fire this, but they carry an
            // `invoice` field — we ignore those (invoice.paid handles them)
            // =============================================
            if (data.invoice) {
                return NextResponse.json({ message: 'Subscription payment — handled by invoice.paid', status: 'skipped' })
            }
            refId = data.metadata?.ref_id || data.metadata?.refId
            externalCustomerId = data.customer || data.receipt_email || data.id
            externalTransactionId = data.id
            amountMinor = data.amount
            currency = data.currency || 'inr'
            customerEmail = data.receipt_email || ''

        } else if (event === 'checkout.session.completed') {
            // =============================================
            // DELIBERATELY IGNORED (see header) — processing this
            // alongside invoice.paid double-pays affiliates.
            // =============================================
            return NextResponse.json({ message: 'checkout.session.completed ignored by design', status: 'skipped' })

        } else if (event === 'customer.subscription.deleted') {
            const customerId = data.customer
            if (customerId) {
                await supabase
                    .from('customers')
                    .update({ status: 'cancelled' } as never)
                    .eq('external_customer_id', customerId)
                    .eq('product_id', productId)
            }
            return NextResponse.json({ message: 'Subscription cancellation recorded', status: 'processed' })

        } else if (event === 'charge.refunded') {
            // Clawback: charge carries payment_intent and/or invoice linkage
            const refundFx = convertMinorToINRPaise(data.amount_refunded || 0, data.currency)
            const result = await processRefund({
                productId,
                externalTransactionIdCandidates: [data.payment_intent, data.invoice].filter(Boolean),
                refundExternalId: `rf_${data.id}`,
                amount: refundFx.amountInPaise,
                provider: 'stripe',
                rawPayload: payload,
            })
            return NextResponse.json({ status: result.success ? 'success' : 'error', message: result.message })

        } else {
            return NextResponse.json({ message: `Event ${event} ignored`, status: 'skipped' })
        }

        if (!refId) {
            console.warn(`[STRIPE WEBHOOK] Missing ref_id for product ${productId}. Event: ${event}`)
            await supabase.from('webhook_logs').insert({
                product_id: productId,
                event_type: event,
                payload,
                status: 'skipped',
                error_message: 'Missing ref_id — organic sale or metadata not wired',
                ip_address: request.headers.get('x-forwarded-for') || 'stripe-webhook',
            } as never)
            // 200, not 400: Stripe retries non-2xx
            return NextResponse.json({ status: 'skipped_no_ref', message: 'No ref_id — organic sale ignored' })
        }

        // ================================================
        // STEP 3: PROCESS CONVERSION (FX: cents → paise)
        // ================================================
        const fx = convertMinorToINRPaise(amountMinor, currency)

        const result = await processConversion({
            productId,
            refId,
            externalCustomerId,
            externalTransactionId,
            amount: fx.amountInPaise,
            customerEmail,
            provider: 'stripe',
            rawPayload: payload,
            currency: fx.currency,
            amountMinor,
            fxRate: fx.fxRate,
        })

        if (!result.success) {
            return NextResponse.json({ status: 'error', message: result.message, error: result.error })
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
