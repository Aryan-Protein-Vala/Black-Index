import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'
import { processConversion } from '@/lib/webhook-processor'
import { convertMinorToINRPaise } from '@/lib/fx'

/**
 * Gumroad Native Webhook Handler
 * POST /api/webhooks/gumroad/[productId]
 * 
 * Founders configure this URL in Gumroad Settings → Advanced → Ping URL
 * 
 * Ref tracking: Add ?ref_id=xxx to product links
 * Example: https://yourproduct.gumroad.com/l/product?ref_id=link-uuid
 * 
 * Note: Gumroad sends form-encoded data, not JSON
 * Gumroad uses IP allowlist instead of signatures
 */

// Gumroad's known IP ranges (they recommend not relying on this)
const GUMROAD_IPS = [
    '54.241.226.', // Partial match for AWS range
]

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ productId: string }> }
) {
    const { productId } = await params
    const supabase = createAdminClient()

    try {
        // Gumroad sends form-encoded data
        const formData = await request.formData()
        const payload: Record<string, string> = {}
        formData.forEach((value, key) => {
            payload[key] = value.toString()
        })

        const secret = request.nextUrl.searchParams.get('secret')

        // ================================================
        // STEP 1: VERIFY SECRET
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

        if (secret !== webhookSecret) {
            return NextResponse.json({ error: 'Invalid secret' }, { status: 401 })
        }

        // ================================================
        // STEP 2: PARSE GUMROAD PAYLOAD
        // ================================================
        // Gumroad "ping" fields:
        // - sale_id: unique sale ID
        // - sale_timestamp: when sale occurred
        // - email: buyer's email
        // - price: in cents (e.g., "500" = $5.00)
        // - url_params: JSON string of URL params (including ref_id)
        // - referrer: the referrer URL

        const {
            sale_id,
            email,
            price,
            url_params,
            referrer,
            product_id: gumroadProductId,
        } = payload

        // Parse URL params to get ref_id
        let refId: string | undefined

        if (url_params) {
            try {
                const params = JSON.parse(url_params)
                refId = params.ref_id || params.refId || params.referral_id
            } catch {
                // Try parsing as query string
            }
        }

        // Fallback: try to extract from referrer URL
        if (!refId && referrer) {
            try {
                const url = new URL(referrer)
                refId = url.searchParams.get('ref_id') ||
                    url.searchParams.get('refId') ||
                    url.searchParams.get('ref') ||
                    undefined
            } catch {
                // Invalid URL
            }
        }

        if (!refId) {
            console.warn(`[GUMROAD WEBHOOK] Missing ref_id for product ${productId}`)
            await supabase.from('webhook_logs').insert({
                product_id: productId,
                event_type: 'sale',
                payload,
                status: 'skipped',
                error_message: 'Missing ref_id — organic sale ignored',
                ip_address: request.headers.get('x-forwarded-for') || 'gumroad-webhook',
            } as never)
            // 200, not 400: Gumroad retries non-2xx
            return NextResponse.json({ status: 'skipped_no_ref', message: 'No ref_id — organic sale ignored' })
        }

        // Gumroad ping `price` is in cents (USD by default). FX-convert at the edge.
        const amountMinor = parseInt(payload.price || '0', 10)
        const fx = convertMinorToINRPaise(amountMinor, payload.currency || 'USD')

        // ================================================
        // STEP 3: PROCESS CONVERSION
        // ================================================
        const result = await processConversion({
            productId,
            refId,
            externalCustomerId: email || sale_id,
            externalTransactionId: sale_id,
            amount: fx.amountInPaise,
            customerEmail: email || '',
            provider: 'gumroad',
            rawPayload: payload,
            currency: fx.currency,
            amountMinor,
            fxRate: fx.fxRate,
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
        console.error('Gumroad webhook error:', error)
        return NextResponse.json({
            error: error instanceof Error ? error.message : 'Internal error'
        }, { status: 500 })
    }
}
