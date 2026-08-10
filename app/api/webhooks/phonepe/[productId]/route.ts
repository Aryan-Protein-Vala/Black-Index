import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'
import { processConversion } from '@/lib/webhook-processor'
import crypto from 'crypto'

/**
 * PhonePe Webhook Handler
 * POST /api/webhooks/phonepe/[productId]
 */

function verifySignature(payloadStr: string, saltKey: string, signatureHeader: string): boolean {
    const [providedHash, saltIndex] = signatureHeader.split('###')
    
    // PhonePe callback checksum is usually SHA256(base64Body + saltKey)
    const expectedHash = crypto
        .createHash('sha256')
        .update(payloadStr + saltKey)
        .digest('hex')

    const bufA = Buffer.from(providedHash || '')
    const bufB = Buffer.from(expectedHash)
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
        ip_address: request.headers.get('x-forwarded-for') || 'phonepe-webhook',
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
        const bodyJson = JSON.parse(rawBody)

        const signature = request.headers.get('x-verify')

        if (!signature || !bodyJson.response) {
            return NextResponse.json({ error: 'Missing PhonePe signature or response payload' }, { status: 401 })
        }

        const { data: product, error: productError } = await supabase
            .from('products')
            .select('webhook_secret')
            .eq('id', productId)
            .single()

        if (productError || !product) {
            return NextResponse.json({ error: 'Product not found' }, { status: 404 })
        }

        if (!verifySignature(bodyJson.response, (product as any).webhook_secret, signature)) {
            return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
        }

        // Decode the base64 response
        const decodedStr = Buffer.from(bodyJson.response, 'base64').toString('utf8')
        const payload = JSON.parse(decodedStr)
        const event = payload.code

        if (event === 'PAYMENT_SUCCESS') {
            const data = payload.data
            const merchantTransactionId = data?.merchantTransactionId || ''
            
            // Extract ref_id from merchantTransactionId (e.g. TXN_123_REF_abc123)
            const refMatch = merchantTransactionId.match(/REF_([a-zA-Z0-9_-]+)/i)
            const refId = refMatch ? refMatch[1] : undefined

            const externalCustomerId = data?.paymentInstrument?.email || merchantTransactionId
            const externalTransactionId = data?.transactionId
            const amountPaise = data?.amount || 0
            const customerEmail = data?.paymentInstrument?.email || ''

            if (!refId) {
                console.warn(`[PHONEPE WEBHOOK] Missing ref_id. Event: ${event}`)
                await logSkippedNoRef(supabase, productId, event, payload, request)
                return NextResponse.json({ status: 'skipped_no_ref', message: 'No ref_id found in merchantTransactionId' })
            }

            const result = await processConversion({
                productId,
                refId,
                externalCustomerId,
                externalTransactionId,
                amount: amountPaise,
                customerEmail,
                provider: 'phonepe',
                rawPayload: payload,
                currency: 'INR',
                amountMinor: amountPaise,
                fxRate: 1,
            })

            if (!result.success) {
                return NextResponse.json({ status: 'error', message: result.message, error: result.error })
            }

            return NextResponse.json({ status: 'success', transaction_id: result.transactionId })
        }

        return NextResponse.json({ message: `Event ${event} ignored`, status: 'skipped' })

    } catch (error) {
        console.error('PhonePe webhook error:', error)
        return NextResponse.json({ error: error instanceof Error ? error.message : 'Internal error' }, { status: 500 })
    }
}
