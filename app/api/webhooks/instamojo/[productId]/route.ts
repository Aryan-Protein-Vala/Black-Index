import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'
import { processConversion } from '@/lib/webhook-processor'
import crypto from 'crypto'

/**
 * Instamojo Webhook Handler
 * POST /api/webhooks/instamojo/[productId]
 */

function verifySignature(payload: any, privateSalt: string): boolean {
    const providedMac = payload.mac
    if (!providedMac) return false

    // Extract all parameters except 'mac'
    const keys = Object.keys(payload).filter(k => k !== 'mac').sort()
    const values = keys.map(k => payload[k])
    const message = values.join('|')

    const expectedMac = crypto.createHmac('sha1', privateSalt).update(message).digest('hex')

    const bufA = Buffer.from(providedMac.toLowerCase())
    const bufB = Buffer.from(expectedMac.toLowerCase())
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
        ip_address: request.headers.get('x-forwarded-for') || 'instamojo-webhook',
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

        if (!verifySignature(payload, (product as any).webhook_secret)) {
            return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
        }

        const event = payload.status

        if (event === 'Credit') {
            // refId is often appended to purpose or passed in custom_fields
            let refId = undefined
            const purpose = payload.purpose || ''
            
            const refMatch = purpose.match(/ref_([a-zA-Z0-9_-]+)/i)
            if (refMatch) {
                refId = refMatch[1]
            } else if (payload.custom_fields) {
                try {
                    const cf = JSON.parse(payload.custom_fields)
                    refId = cf.ref_id || cf.refId
                } catch (e) {
                    // Ignore
                }
            }

            const externalCustomerId = payload.buyer || payload.payment_id
            const externalTransactionId = payload.payment_id
            const amountRupees = parseFloat(payload.amount || '0')
            const amountPaise = Math.round(amountRupees * 100)
            const customerEmail = payload.buyer || ''

            if (!refId) {
                console.warn(`[INSTAMOJO WEBHOOK] Missing ref_id. Event: ${event}`)
                await logSkippedNoRef(supabase, productId, event, payload, request)
                return NextResponse.json({ status: 'skipped_no_ref', message: 'No ref_id found in payload' })
            }

            const result = await processConversion({
                productId,
                refId,
                externalCustomerId,
                externalTransactionId,
                amount: amountPaise,
                customerEmail,
                provider: 'instamojo',
                rawPayload: payload,
                currency: payload.currency || 'INR',
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
        console.error('Instamojo webhook error:', error)
        return NextResponse.json({ error: error instanceof Error ? error.message : 'Internal error' }, { status: 500 })
    }
}
