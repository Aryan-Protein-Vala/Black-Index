import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'
import { processConversion, processRefund } from '@/lib/webhook-processor'
import { convertMinorToINRPaise } from '@/lib/fx'
import crypto from 'crypto'

/**
 * Lemon Squeezy Native Webhook Handler
 * POST /api/webhooks/lemonsqueezy/[productId]
 *
 * Founders configure this URL in Lemon Squeezy → Settings → Webhooks.
 *
 * Events:
 * - order_created                  → first sale (one-time OR month 0 of a sub)
 * - subscription_payment_success   → recurring renewals (was IGNORED before —
 *                                    LS products never earned recurring commission)
 * - order_refunded                 → clawback
 * - subscription_cancelled/expired → churn
 *
 * Ref tracking: pass ref_id in checkout custom_data. LS echoes
 * meta.custom_data on EVERY event for that customer, including renewals.
 *
 * Security: HMAC (x-signature) when configured, else ?secret= fallback.
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

            if (sigInvalid(lemonSignature, expectedSignature)) {
                return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
            }
        } else if (secret !== webhookSecret) {
            return NextResponse.json({ error: 'Invalid secret' }, { status: 401 })
        }

        // ================================================
        // STEP 2: PARSE LEMON SQUEEZY PAYLOAD
        // ================================================
        const eventName: string = payload.meta?.event_name
        const data = payload.data?.attributes
        const customData = payload.meta?.custom_data || {}

        if (!data) {
            return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
        }

        // ---- Churn ----
        if (eventName === 'subscription_cancelled' || eventName === 'subscription_expired') {
            const customerId = payload.data?.attributes?.customer_id?.toString()
            if (customerId) {
                await supabase
                    .from('customers')
                    .update({ status: 'cancelled' } as never)
                    .eq('external_customer_id', customerId)
                    .eq('product_id', productId)
            }
            return NextResponse.json({ message: 'Churn recorded', status: 'processed' })
        }

        // ---- Refund ----
        if (eventName === 'order_refunded' || eventName === 'subscription_payment_refunded') {
            const refundFx = convertMinorToINRPaise(data.total || data.refunded_amount || 0, data.currency)
            const result = await processRefund({
                productId,
                externalTransactionIdCandidates: [
                    payload.data?.id?.toString(),
                    data.order_id?.toString(),
                    data.order_number?.toString(),
                ].filter(Boolean) as string[],
                refundExternalId: `rf_${payload.data?.id?.toString() || Date.now()}`,
                amount: refundFx.amountInPaise,
                provider: 'lemonsqueezy',
                rawPayload: payload,
            })
            return NextResponse.json({ status: result.success ? 'success' : 'error', message: result.message })
        }

        // ---- Sales ----
        if (eventName !== 'order_created' && eventName !== 'subscription_payment_success') {
            return NextResponse.json({ message: `Event ${eventName} ignored`, status: 'skipped' })
        }

        const refId = customData.ref_id || customData.refId

        if (!refId) {
            console.warn(`[LS WEBHOOK] Missing ref_id for product ${productId}. Event: ${eventName}`)
            await supabase.from('webhook_logs').insert({
                product_id: productId,
                event_type: eventName,
                payload,
                status: 'skipped',
                error_message: 'Missing ref_id in custom_data — organic sale ignored',
                ip_address: request.headers.get('x-forwarded-for') || 'ls-webhook',
            } as never)
            // 200, not 400: LS retries non-2xx
            return NextResponse.json({ status: 'skipped_no_ref', message: 'No ref_id in custom_data — organic sale ignored' })
        }

        // LS amounts are in cents of the order currency (usually USD)
        const amountMinor = data.total || data.subtotal || 0
        const fx = convertMinorToINRPaise(amountMinor, data.currency)

        // Stable customer identity so renewals + churn match:
        // prefer LS customer_id over email
        const externalCustomerId =
            data.customer_id?.toString() || data.user_email || payload.data?.id?.toString()

        // subscription_payment_success events have their own id per renewal → ideal idempotency key
        const externalTransactionId = payload.data?.id?.toString() || data.order_number?.toString()

        // ================================================
        // STEP 3: PROCESS CONVERSION
        // ================================================
        const result = await processConversion({
            productId,
            refId,
            externalCustomerId,
            externalTransactionId,
            amount: fx.amountInPaise,
            customerEmail: data.user_email || '',
            provider: 'lemonsqueezy',
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
        console.error('Lemon Squeezy webhook error:', error)
        return NextResponse.json({
            error: error instanceof Error ? error.message : 'Internal error'
        }, { status: 500 })
    }
}
