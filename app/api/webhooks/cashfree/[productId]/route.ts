import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'
import { processConversion } from '@/lib/webhook-processor'
import crypto from 'crypto'

/**
 * Cashfree Webhook Handler
 * POST /api/webhooks/cashfree/[productId]
 */

function verifySignature(timestamp: string, rawBody: string, secret: string, signature: string): boolean {
    const payload = timestamp + rawBody
    const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(payload)
        .digest('base64')
    
    const bufA = Buffer.from(signature)
    const bufB = Buffer.from(expectedSignature)
    if (bufA.length !== bufB.length) return false
    return crypto.timingSafeEqual(bufA, bufB)
}

async function logSkippedNoRef(supabase: any, productId: string, event: string, payload: any, request: NextRequest) {
    await supabase.from('webhook_logs').insert({
        product_id: productId,
        event_type: event,
        payload,
        status: 'skipped',
        error_message: 'Missing ref_id — organic sale or tracking not installed',
        ip_address: request.headers.get('x-forwarded-for') || 'cashfree-webhook',
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

        const timestamp = request.headers.get('x-webhook-timestamp')
        const signature = request.headers.get('x-webhook-signature')

        if (!timestamp || !signature) {
            return NextResponse.json({ error: 'Missing Cashfree signature headers' }, { status: 401 })
        }

        const { data: product, error: productError } = await supabase
            .from('products')
            .select('webhook_secret')
            .eq('id', productId)
            .single()

        if (productError || !product) {
            return NextResponse.json({ error: 'Product not found' }, { status: 404 })
        }

        if (!verifySignature(timestamp, rawBody, product.webhook_secret, signature)) {
            return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
        }

        const event = payload.type || payload.event

        if (event === 'PAYMENT_SUCCESS_WEBHOOK') {
            const data = payload.data
            
            // Extract ref_id from order_tags (expected structure from user specification)
            const tags = data?.order?.order_tags || {}
            // It could be stored under 'ref_id' key or similar inside order_tags
            const refId = tags.ref_id || tags.refId || tags.ref || undefined

            const externalCustomerId = data?.customer_details?.customer_id || data?.customer_details?.customer_email
            const externalTransactionId = data?.payment?.cf_payment_id?.toString() || data?.order?.order_id
            const amount = data?.order?.order_amount || 0
            const customerEmail = data?.customer_details?.customer_email || ''

            if (!refId) {
                console.warn(`[CASHFREE WEBHOOK] Missing ref_id. Event: ${event}`)
                await logSkippedNoRef(supabase, productId, event, payload, request)
                return NextResponse.json({ status: 'skipped_no_ref', message: 'No ref_id found in order_tags' })
            }

            const result = await processConversion({
                productId,
                refId,
                externalCustomerId,
                externalTransactionId,
                amount,
                customerEmail,
                provider: 'cashfree',
                rawPayload: payload,
                currency: data?.order?.order_currency || 'INR',
                amountMinor: amount * 100, // Assuming order_amount is in INR not paise. If Cashfree sends it in INR, amountMinor is amount * 100
                fxRate: 1,
            })

            if (!result.success) {
                return NextResponse.json({ status: 'error', message: result.message, error: result.error })
            }

            return NextResponse.json({ status: 'success', transaction_id: result.transactionId })
        }

        return NextResponse.json({ message: `Event ${event} ignored`, status: 'skipped' })

    } catch (error) {
        console.error('Cashfree webhook error:', error)
        return NextResponse.json({ error: error instanceof Error ? error.message : 'Internal error' }, { status: 500 })
    }
}
