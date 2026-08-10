import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'
import { processConversion } from '@/lib/webhook-processor'
import crypto from 'crypto'

/**
 * PayU Webhook Handler
 * POST /api/webhooks/payu/[productId]
 */

function verifySignature(payload: any, salt: string): boolean {
    // SHA-512(salt|status||||||udf5|udf4|udf3|udf2|udf1|email|firstname|productinfo|amount|txnid|key)
    const { status, udf5 = '', udf4 = '', udf3 = '', udf2 = '', udf1 = '', email = '', firstname = '', productinfo = '', amount = '', txnid = '', key = '', hash: providedHash } = payload

    const hashString = `${salt}|${status}||||||${udf5}|${udf4}|${udf3}|${udf2}|${udf1}|${email}|${firstname}|${productinfo}|${amount}|${txnid}|${key}`
    const expectedHash = crypto.createHash('sha512').update(hashString).digest('hex')

    if (!providedHash) return false
    
    const bufA = Buffer.from(providedHash.toLowerCase())
    const bufB = Buffer.from(expectedHash.toLowerCase())
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
        ip_address: request.headers.get('x-forwarded-for') || 'payu-webhook',
    } as never)
}

export async function POST(
    request: NextRequest,
    context: { params: Promise<{ productId: string }> }
) {
    const { productId } = await context.params
    const supabase = createAdminClient()

    try {
        const contentType = request.headers.get('content-type') || ''
        let payload: any = {}

        if (contentType.includes('application/json')) {
            payload = await request.json()
        } else {
            const formData = await request.formData()
            formData.forEach((value, key) => {
                payload[key] = value.toString()
            })
        }

        const { data: product, error: productError } = await supabase
            .from('products')
            .select('webhook_secret')
            .eq('id', productId)
            .single()

        if (productError || !product) {
            return NextResponse.json({ error: 'Product not found' }, { status: 404 })
        }

        if (!verifySignature(payload, product.webhook_secret)) {
            return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
        }

        const event = payload.status

        if (event === 'success') {
            const refId = payload.udf1
            const externalCustomerId = payload.email || payload.txnid
            const externalTransactionId = payload.txnid
            const amount = parseFloat(payload.amount || '0')
            const customerEmail = payload.email || ''

            if (!refId) {
                console.warn(`[PAYU WEBHOOK] Missing ref_id. Event: ${event}`)
                await logSkippedNoRef(supabase, productId, event, payload, request)
                return NextResponse.json({ status: 'skipped_no_ref', message: 'No ref_id found in udf1' })
            }

            const result = await processConversion({
                productId,
                refId,
                externalCustomerId,
                externalTransactionId,
                amount,
                customerEmail,
                provider: 'payu',
                rawPayload: payload,
                currency: 'INR',
                amountMinor: Math.round(amount * 100),
                fxRate: 1,
            })

            if (!result.success) {
                return NextResponse.json({ status: 'error', message: result.message, error: result.error })
            }

            return NextResponse.json({ status: 'success', transaction_id: result.transactionId })
        }

        return NextResponse.json({ message: `Event ${event} ignored`, status: 'skipped' })

    } catch (error) {
        console.error('PayU webhook error:', error)
        return NextResponse.json({ error: error instanceof Error ? error.message : 'Internal error' }, { status: 500 })
    }
}
