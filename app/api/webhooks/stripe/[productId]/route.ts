import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'
import { processConversion } from '@/lib/webhook-processor'
import crypto from 'crypto'

/**
 * Stripe Native Webhook Handler
 * POST /api/webhooks/stripe/[productId]
 * 
 * Founders configure this URL in Stripe Dashboard → Developers → Webhooks
 * Events: checkout.session.completed, payment_intent.succeeded
 * 
 * Ref tracking: Add ref_id in session/payment_intent metadata
 * Example: stripe.checkout.sessions.create({ metadata: { ref_id: 'link-uuid' } })
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

        // Get webhook secret from query params
        const secret = request.nextUrl.searchParams.get('secret')

        // ================================================
        // STEP 1: VERIFY SIGNATURE
        // ================================================
        const stripeSignature = request.headers.get('stripe-signature')

        // Fetch product to get webhook_secret
        const { data: product, error: productError } = await supabase
            .from('products')
            .select('webhook_secret')
            .eq('id', productId)
            .single()

        if (productError || !product) {
            return NextResponse.json({ error: 'Product not found' }, { status: 404 })
        }

        const webhookSecret = (product as { webhook_secret: string }).webhook_secret

        // Verify Stripe signature if present
        if (stripeSignature) {
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

            if (signature !== expectedSignature) {
                return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
            }
        } else if (secret !== webhookSecret) {
            return NextResponse.json({ error: 'Invalid secret' }, { status: 401 })
        }

        // ================================================
        // STEP 2: PARSE STRIPE PAYLOAD
        // ================================================
        const event = payload.type
        const data = payload.data?.object

        if (!data) {
            return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
        }

        let refId: string | undefined
        let externalCustomerId: string
        let externalTransactionId: string
        let amount: number
        let customerEmail: string

        if (event === 'checkout.session.completed') {
            // Checkout Session
            refId = data.metadata?.ref_id || data.metadata?.refId
            externalCustomerId = data.customer || data.customer_email || data.id
            externalTransactionId = data.payment_intent || data.id
            amount = data.amount_total // in smallest currency unit
            customerEmail = data.customer_email || data.customer_details?.email || ''
        } else if (event === 'payment_intent.succeeded') {
            // Payment Intent
            refId = data.metadata?.ref_id || data.metadata?.refId
            externalCustomerId = data.customer || data.receipt_email || data.id
            externalTransactionId = data.id
            amount = data.amount
            customerEmail = data.receipt_email || ''
        } else {
            return NextResponse.json({
                message: `Event ${event} ignored`,
                status: 'skipped'
            })
        }

        if (!refId) {
            return NextResponse.json({
                error: 'Missing ref_id in metadata',
                hint: 'Add ref_id in session/payment_intent metadata'
            }, { status: 400 })
        }

        // ================================================
        // STEP 3: PROCESS CONVERSION
        // ================================================
        const result = await processConversion({
            productId,
            refId,
            externalCustomerId,
            externalTransactionId,
            amount, // Already in smallest unit (cents/paise)
            customerEmail,
            provider: 'stripe',
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
        console.error('Stripe webhook error:', error)
        return NextResponse.json({
            error: error instanceof Error ? error.message : 'Internal error'
        }, { status: 500 })
    }
}
