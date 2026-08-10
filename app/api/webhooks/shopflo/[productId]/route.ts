import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'
import { processConversion, processRefund } from '@/lib/webhook-processor'
import crypto from 'crypto'

/**
 * Shopflo Webhook Handler
 * POST /api/webhooks/shopflo/[productId]
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
        ip_address: request.headers.get('x-forwarded-for') || 'shopflo-webhook',
    } as never)
}

export async function POST(
    request: NextRequest,
    context: { params: Promise<{ productId: string }> }
) {
    const { productId } = await context.params
    const supabase = createAdminClient()

    try {
        const rawBody = await request.text()
        const payload = JSON.parse(rawBody)

        // ================================================
        // STEP 1: VERIFY SHOPFLO SIGNATURE
        // ================================================
        const shopfloSignature = request.headers.get('x-shopflo-signature') || request.headers.get('X-Shopflo-Hmac-Sha256')

        if (!shopfloSignature) {
            return NextResponse.json({ error: 'Missing Shopflo signature header' }, { status: 401 })
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

        if (sigInvalid(shopfloSignature, expectedSignature)) {
            return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
        }

        // ================================================
        // STEP 2: PARSE SHOPFLO PAYLOAD
        // ================================================
        const event = payload.event || payload.type

        let refId: string | undefined
        let externalCustomerId: string
        let externalTransactionId: string
        let amount: number
        let customerEmail: string

        if (event === 'order.paid' || event === 'order.completed' || event === 'payment.captured') {
            const orderEntity = payload.data?.order || payload.order || payload

            refId = orderEntity?.notes?.ref_id
                || orderEntity?.utm_source
                || orderEntity?.utm_campaign
                || orderEntity?.tags?.find((t: string) => t.startsWith('ref_'))?.replace('ref_', '')

            externalCustomerId = orderEntity?.customer?.id || orderEntity?.customer?.email || orderEntity?.id
            externalTransactionId = orderEntity?.id
            amount = orderEntity?.total || orderEntity?.amount || 0
            customerEmail = orderEntity?.customer?.email || orderEntity?.email || ''

        } else if (event === 'refund.processed') {
            const refundEntity = payload.data?.refund || payload.refund || payload
            
            const result = await processRefund({
                productId,
                externalTransactionIdCandidates: [refundEntity.order_id].filter(Boolean),
                refundExternalId: `rf_${refundEntity.id}`,
                amount: refundEntity.amount || 0,
                provider: 'shopflo',
                rawPayload: payload,
            })

            return NextResponse.json({ status: result.success ? 'success' : 'error', message: result.message })
        } else {
            return NextResponse.json({ message: `Event ${event} ignored`, status: 'skipped' })
        }

        if (!refId) {
            console.warn(`[SHOPFLO WEBHOOK] Missing ref_id for product ${productId}. Event: ${event}`)
            await logSkippedNoRef(supabase, productId, event, payload, request)
            return NextResponse.json({
                status: 'skipped_no_ref',
                message: 'No ref_id in payment/order notes — organic sale ignored',
            })
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
            provider: 'shopflo',
            rawPayload: payload,
            currency: 'INR',
            amountMinor: amount,
            fxRate: 1,
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
        console.error('Shopflo webhook error:', error)
        return NextResponse.json({
            error: error instanceof Error ? error.message : 'Internal error'
        }, { status: 500 })
    }
}
