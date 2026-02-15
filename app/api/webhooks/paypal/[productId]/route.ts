import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'
import { processConversion } from '@/lib/webhook-processor'

/**
 * PayPal Native Webhook Handler
 * POST /api/webhooks/paypal/[productId]
 * 
 * Founders configure this URL in PayPal Developer → Webhooks
 * Events: PAYMENT.CAPTURE.COMPLETED
 * 
 * Ref tracking: Add ref_id in custom_id field when creating order
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

        const secret = request.nextUrl.searchParams.get('secret')

        // ================================================
        // STEP 1: VERIFY SECRET (PayPal webhook verification is complex)
        // ================================================
        const { data: product, error: productError } = await supabase
            .from('products')
            .select('webhook_secret')
            .eq('id', productId)
            .single()

        if (productError || !product) {
            return NextResponse.json({ error: 'Product not found' }, { status: 404 })
        }

        const webhookSecret = (product as { webhook_secret: string }).webhook_secret

        // For PayPal, we primarily rely on secret in URL
        // Full PayPal signature verification requires API call to PayPal
        if (secret !== webhookSecret) {
            return NextResponse.json({ error: 'Invalid secret' }, { status: 401 })
        }

        // ================================================
        // STEP 2: PARSE PAYPAL PAYLOAD
        // ================================================
        const eventType = payload.event_type

        if (eventType !== 'PAYMENT.CAPTURE.COMPLETED') {
            return NextResponse.json({
                message: `Event ${eventType} ignored`,
                status: 'skipped'
            })
        }

        const resource = payload.resource
        if (!resource) {
            return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
        }

        // Get ref_id from custom_id
        const refId = resource.custom_id

        if (!refId) {
            return NextResponse.json({
                error: 'Missing ref_id in custom_id',
                hint: 'Pass ref_id in custom_id when creating PayPal order'
            }, { status: 400 })
        }

        // PayPal amounts are in currency units (e.g., "10.00" for $10)
        const amountValue = parseFloat(resource.amount?.value || '0')
        const amountInPaise = Math.floor(amountValue * 100) // Convert to smallest unit

        // Get payer email
        const payerEmail = payload.resource?.payer?.email_address || ''

        // ================================================
        // STEP 3: PROCESS CONVERSION
        // ================================================
        const result = await processConversion({
            productId,
            refId,
            externalCustomerId: payload.resource?.payer?.payer_id || payerEmail || resource.id,
            externalTransactionId: resource.id,
            amount: amountInPaise,
            customerEmail: payerEmail,
            provider: 'paypal',
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
        console.error('PayPal webhook error:', error)
        return NextResponse.json({
            error: error instanceof Error ? error.message : 'Internal error'
        }, { status: 500 })
    }
}
