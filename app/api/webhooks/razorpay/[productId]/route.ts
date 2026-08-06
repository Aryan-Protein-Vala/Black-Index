import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'
import { processConversion, processRefund } from '@/lib/webhook-processor'
import crypto from 'crypto'

/**
 * Razorpay Webhook Handler
 * POST /api/webhooks/razorpay/[productId]
 *
 * Supported events:
 * - subscription.charged (SaaS subscription renewals — PRIMARY)
 * - payment.captured / order.paid (one-time payments)
 * - subscription.cancelled / subscription.halted (churn)
 * - refund.processed (clawbacks)
 *
 * Ref tracking: ref_id in payment/order notes (track.js injects for
 * client-side Standard Checkout) or subscription notes (server-side at
 * subscription creation — REQUIRED for renewals).
 *
 * IMPORTANT: returns 200 for everything except bad signatures / malformed
 * payloads. 4xx responses make Razorpay retry and eventually auto-disable
 * the endpoint — one organic (unattributed) sale must never kill tracking.
 */

function sigInvalid(a: string, b: string): boolean {
    const bufA = Buffer.from(a)
    const bufB = Buffer.from(b)
    if (bufA.length !== bufB.length) return true
    return !crypto.timingSafeEqual(bufA, bufB)
}

async function logSkippedNoRef(supabase: any, productId: string, event: string, payload: any, request: NextRequest) {
    await supabase.from('webhook_logs').insert({
        product_id: productId,
        event_type: event,
        payload,
        status: 'skipped',
        error_message: 'Missing ref_id — organic sale or tracking not installed',
        ip_address: request.headers.get('x-forwarded-for') || 'razorpay-webhook',
    } as never)

    // Founder-facing digest: unattributed sale happened (great upsell signal)
    try {
        const { data: product } = await supabase
            .from('products')
            .select('founder_id, name')
            .eq('id', productId)
            .single()
        const p = product as { founder_id: string; name: string } | null
        if (p?.founder_id) {
            const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
            const { count } = await supabase
                .from('notifications')
                .select('*', { count: 'exact', head: true })
                .eq('user_id', p.founder_id)
                .eq('type', 'unattributed_sale')
                .gte('created_at', dayAgo)
            if (!count || count === 0) {
                await supabase.from('notifications').insert({
                    user_id: p.founder_id,
                    type: 'unattributed_sale',
                    title: 'Unattributed sale detected',
                    message: `A payment hit ${p.name}'s webhook with no affiliate ref. If buyers should come via sellers, install track.js on your site (dashboard → integration).`,
                    metadata: { product_id: productId, event },
                    read: false,
                } as never)
            }
        }
    } catch (e) {
        console.error('[RAZORPAY WEBHOOK] unattributed-sale notify failed:', e)
    }
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
        // STEP 1: VERIFY RAZORPAY SIGNATURE (STRICT)
        // ================================================
        const razorpaySignature = request.headers.get('x-razorpay-signature')

        if (!razorpaySignature) {
            return NextResponse.json({ error: 'Missing x-razorpay-signature header' }, { status: 401 })
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

        const expectedSignature = crypto
            .createHmac('sha256', webhookSecret)
            .update(rawBody)
            .digest('hex')

        if (sigInvalid(razorpaySignature, expectedSignature)) {
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
            // SaaS SUBSCRIPTION RENEWAL (PRIMARY EVENT)
            const subEntity = payload.payload?.subscription?.entity
            const payEntity = payload.payload?.payment?.entity

            if (!payEntity) {
                return NextResponse.json({ error: 'Invalid subscription.charged payload' }, { status: 400 })
            }

            refId = subEntity?.notes?.ref_id
                || payEntity?.notes?.ref_id
                || subEntity?.notes?.refId
                || payEntity?.notes?.refId

            // Prefer Razorpay's stable customer id so churn matching works;
            // fall back to email for legacy/unlinked payments.
            externalCustomerId = subEntity?.customer_id || payEntity.email || payEntity.id
            externalTransactionId = payEntity.id
            amount = payEntity.amount
            customerEmail = payEntity.email || ''

        } else if (event === 'payment.captured' || event === 'order.paid') {
            // ONE-TIME PAYMENT (manual wiring or track.js)
            const paymentEntity = payload.payload?.payment?.entity
            const orderEntity = payload.payload?.order?.entity

            if (!paymentEntity && !orderEntity) {
                return NextResponse.json({ error: 'Invalid payload structure (no payment or order entity)' }, { status: 400 })
            }

            refId = paymentEntity?.notes?.ref_id
                || orderEntity?.notes?.ref_id
                || paymentEntity?.notes?.refId
                || orderEntity?.notes?.refId
                || paymentEntity?.description?.match(/ref_id[:=\s]+([a-zA-Z0-9_-]+)/)?.[1]

            externalCustomerId = paymentEntity?.customer_id || paymentEntity?.email || orderEntity?.customer_id || paymentEntity?.id || orderEntity?.id
            externalTransactionId = paymentEntity?.id || orderEntity?.id
            amount = paymentEntity?.amount || orderEntity?.amount || 0
            customerEmail = paymentEntity?.email || ''

        } else if (event === 'subscription.cancelled' || event === 'subscription.halted' || event === 'subscription.completed' || event === 'subscription.expired') {
            const subEntity = payload.payload?.subscription?.entity
            const customerId = subEntity?.customer_id

            if (customerId) {
                await supabase
                    .from('customers')
                    .update({ status: event === 'subscription.cancelled' ? 'cancelled' : 'churned' } as never)
                    .eq('external_customer_id', customerId)
                    .eq('product_id', productId)
            }

            // Founder notification on halted (payment failing = churn risk)
            if (event === 'subscription.halted' || event === 'subscription.cancelled') {
                const { data: prod } = await supabase
                    .from('products')
                    .select('founder_id, name')
                    .eq('id', productId)
                    .single()
                const p = prod as { founder_id: string; name: string } | null
                if (p?.founder_id) {
                    await supabase.from('notifications').insert({
                        user_id: p.founder_id,
                        type: 'subscription_churn',
                        title: `Subscription ${event === 'subscription.halted' ? 'halted' : 'cancelled'}`,
                        message: `A subscription on ${p.name} was ${event === 'subscription.halted' ? 'halted (payments failing)' : 'cancelled'}.`,
                        metadata: { product_id: productId, event, customer_id: customerId },
                        read: false,
                    } as never)
                }
            }

            return NextResponse.json({ message: `${event} recorded`, status: 'processed' })

        } else if (event === 'refund.processed') {
            const refundEntity = payload.payload?.refund?.entity
            if (!refundEntity) {
                return NextResponse.json({ error: 'Invalid refund payload' }, { status: 400 })
            }

            const result = await processRefund({
                productId,
                externalTransactionIdCandidates: [refundEntity.payment_id].filter(Boolean),
                refundExternalId: `rf_${refundEntity.id}`,
                amount: refundEntity.amount || 0,
                provider: 'razorpay',
                rawPayload: payload,
            })

            return NextResponse.json({ status: result.success ? 'success' : 'error', message: result.message })

        } else {
            return NextResponse.json({ message: `Event ${event} ignored`, status: 'skipped' })
        }

        if (!refId) {
            console.warn(`[RAZORPAY WEBHOOK] Missing ref_id for product ${productId}. Event: ${event}`)
            await logSkippedNoRef(supabase, productId, event, payload, request)

            // 200, not 400: Razorpay retries non-2xx and can auto-disable the endpoint
            return NextResponse.json({
                status: 'skipped_no_ref',
                message: 'No ref_id in payment/order notes — organic sale ignored',
            })
        }

        // ================================================
        // STEP 3: PROCESS CONVERSION (Razorpay amounts are INR paise)
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
            currency: 'INR',
            amountMinor: amount,
            fxRate: 1,
        })

        if (!result.success) {
            // 200 on purpose: the failure is logged, blocking retries is intentional
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
