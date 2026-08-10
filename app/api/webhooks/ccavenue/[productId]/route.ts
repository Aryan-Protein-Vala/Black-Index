import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'
import { processConversion } from '@/lib/webhook-processor'
import crypto from 'crypto'

/**
 * CCAvenue Webhook Handler
 * POST /api/webhooks/ccavenue/[productId]
 */

function decryptCCAvenueResponse(encResp: string, workingKey: string): any {
    try {
        const m = crypto.createHash('md5')
        m.update(workingKey)
        const key = m.digest()
        
        const iv = Buffer.from('\x00\x01\x02\x03\x04\x05\x06\x07\x08\x09\x0a\x0b\x0c\x0d\x0e\x0f', 'binary')
        const decipher = crypto.createDecipheriv('aes-128-cbc', key, iv)
        let decoded = decipher.update(encResp, 'hex', 'utf8')
        decoded += decipher.final('utf8')
        
        // Decoded string is usually key-value pairs separated by '&' and '='
        const params = new URLSearchParams(decoded)
        const result: any = {}
        params.forEach((value, key) => {
            result[key] = value
        })
        return result
    } catch (e) {
        console.error('CCAvenue decryption failed:', e)
        return null
    }
}

async function logSkippedNoRef(supabase: any, productId: string, event: string, payload: any, request: NextRequest) {
    await supabase.from('webhook_logs').insert({
        product_id: productId,
        event_type: event,
        payload,
        status: 'skipped',
        error_message: 'Missing ref_id — organic sale or tracking not installed',
        ip_address: request.headers.get('x-forwarded-for') || 'ccavenue-webhook',
    } as never)
}

export async function POST(
    request: NextRequest,
    context: { params: Promise<{ productId: string }> }
) {
    const { productId } = await context.params
    const supabase = createAdminClient()

    try {
        const formData = await request.formData()
        const encResp = formData.get('encResp')?.toString()

        if (!encResp) {
            return NextResponse.json({ error: 'Missing encResp' }, { status: 400 })
        }

        const { data: product, error: productError } = await supabase
            .from('products')
            .select('webhook_secret')
            .eq('id', productId)
            .single()

        if (productError || !product) {
            return NextResponse.json({ error: 'Product not found' }, { status: 404 })
        }

        const payload = decryptCCAvenueResponse(encResp, product.webhook_secret)

        if (!payload) {
            return NextResponse.json({ error: 'Failed to decrypt response. Check Working Key.' }, { status: 401 })
        }

        const event = payload.order_status

        if (event === 'Success') {
            const refId = payload.merchant_param1
            const externalCustomerId = payload.billing_email || payload.tracking_id
            const externalTransactionId = payload.tracking_id
            const amount = parseFloat(payload.amount || '0')
            const customerEmail = payload.billing_email || ''

            if (!refId) {
                console.warn(`[CCAVENUE WEBHOOK] Missing ref_id. Event: ${event}`)
                await logSkippedNoRef(supabase, productId, event, payload, request)
                return NextResponse.json({ status: 'skipped_no_ref', message: 'No ref_id found in merchant_param1' })
            }

            const result = await processConversion({
                productId,
                refId,
                externalCustomerId,
                externalTransactionId,
                amount,
                customerEmail,
                provider: 'ccavenue',
                rawPayload: payload,
                currency: payload.currency || 'INR',
                amountMinor: Math.round(amount * 100),
                fxRate: 1,
            })

            if (!result.success) {
                return NextResponse.json({ status: 'error', message: result.message, error: result.error })
            }

            return NextResponse.json({ status: 'success', transaction_id: result.transactionId })
        }

        return NextResponse.json({ message: `Order status ${event} ignored`, status: 'skipped' })

    } catch (error) {
        console.error('CCAvenue webhook error:', error)
        return NextResponse.json({ error: error instanceof Error ? error.message : 'Internal error' }, { status: 500 })
    }
}
