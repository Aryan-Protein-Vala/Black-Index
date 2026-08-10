import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'
import { processRefund } from '@/lib/webhook-processor'
import { convertMinorToINRPaise } from '@/lib/fx'
import { emailsMatch } from '@/lib/anti-fraud'
import crypto from 'crypto'

function verifyShopifyHmac(body: string, secret: string, hmac: string): boolean {
    const hash = crypto.createHmac('sha256', secret).update(body).digest('base64')
    const bufA = Buffer.from(hmac)
    const bufB = Buffer.from(hash)
    if (bufA.length !== bufB.length) return false
    return crypto.timingSafeEqual(bufA, bufB)
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ productId: string }> }) {
    const { productId } = await params
    const adminClient = createAdminClient()

    try {
        const { data: product } = await adminClient
            .from('products')
            .select('shopify_hmac_secret, founder_id')
            .eq('id', productId)
            .single()

        const p = product as any;
        if (!p || !p.shopify_hmac_secret) {
            return NextResponse.json({ error: 'Product not found or not configured' }, { status: 404 })
        }

        const rawBody = await request.text()
        const hmac = request.headers.get('x-shopify-hmac-sha256')
        
        if (!hmac || !verifyShopifyHmac(rawBody, p.shopify_hmac_secret, hmac)) {
            return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
        }

        const topic = request.headers.get('x-shopify-topic')
        let payload
        try {
            payload = JSON.parse(rawBody)
        } catch(e) {
            return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
        }

        if (topic === 'orders/create') {
            const attributes = payload.note_attributes || []
            const biRefObj = attributes.find((a: any) => a.name === 'bi_ref')
            const biRef = biRefObj?.value
            
            if (!biRef) {
                await adminClient.from('webhook_logs').insert({
                    product_id: productId, event_type: topic, payload, status: 'success', error_message: 'skipped_no_ref'
                } as never)
                return NextResponse.json({ status: 'skipped_no_ref', message: 'No bi_ref found' })
            }

            const { data: link } = await adminClient.from('links').select('seller_id').eq('id', biRef).single()
            if (!link) return NextResponse.json({ status: 'skipped', message: 'Invalid ref' })
            
            const sellerId = (link as any).seller_id
            const buyerEmail = payload.email || payload.customer?.email
            const buyerPhone = payload.phone || payload.customer?.phone
            const orderId = String(payload.id ?? '')
            const totalPrice = Number(payload.total_price) // e.g. 100.00 (major units)
            const currency = payload.currency || 'INR'
            
            const { data: sellerProfile } = await adminClient.from('profiles').select('email, phone, upi_vpa').eq('id', sellerId).single()
            const sellerEmail = (sellerProfile as any)?.email
            const sellerPhone = (sellerProfile as any)?.phone
            const sellerVpa = (sellerProfile as any)?.upi_vpa

            const phoneMatches =
                (buyerPhone && sellerPhone && buyerPhone === sellerPhone) ||
                (buyerPhone && sellerVpa && buyerPhone === sellerVpa)

            if (emailsMatch(buyerEmail, sellerEmail) || phoneMatches) {
                
                await adminClient.from('fraud_reports').insert({
                    product_id: productId, founder_id: p.founder_id, reporter_id: p.founder_id,
                    evidence_url: 'system_heuristic', description: 'Self-purchase detected based on email/phone match.', status: 'confirmed'
                } as never)

                return NextResponse.json({ status: 'flagged', message: 'Self-purchase blocked' })
            }

            // CRITICAL FIX: never hardcode FX rates — lib/fx is the single source
            // (env FX_<CURRENCY>_INR, fallbacks only for USD/EUR/GBP, loud warning otherwise)
            const amountMinor = Number.isFinite(totalPrice) ? Math.round(totalPrice * 100) : 0 // Shopify sends major units
            const fx = convertMinorToINRPaise(amountMinor, currency)
            const amountPaise = fx.amountInPaise

            // Check repeat purchases (>3 in 24h)
            const yesterday = new Date(Date.now() - 24*60*60*1000).toISOString()
            const { count } = await adminClient.from('transactions').select('*', { count: 'exact', head: true })
                .eq('seller_id', sellerId)
                .eq('external_customer_id', buyerEmail)
                .gte('created_at', yesterday)
            
            if (count && count >= 3) {
                await adminClient.from('fraud_reports').insert({
                    product_id: productId, founder_id: p.founder_id, reporter_id: sellerId,
                    evidence_url: 'system_heuristic', description: 'Repeat purchase flagged (>3 in 24h).', status: 'pending'
                } as never)
            }

            const { data: result, error: rpcError } = await adminClient.rpc('record_conversion' as never, {
                p_product_id: productId,
                p_link_id: biRef,
                p_seller_id: sellerId,
                p_external_customer_id: buyerEmail || 'unknown@example.com',
                p_external_transaction_id: orderId,
                p_amount: amountPaise,
                p_currency: fx.currency,
                p_amount_minor: amountMinor,
                p_fx_rate: fx.fxRate,
                p_escrow_days: 14
            } as never)

            if (rpcError) return NextResponse.json({ error: rpcError.message }, { status: 500 })

            // CRITICAL FIX: parse result.tx_id safely — never assume the RPC succeeded
            const txId = (result as any)?.transaction_id
            if (txId) {
                await adminClient.from('transactions').update({ vertical: 'physical' } as never).eq('id', txId)
            }

            return NextResponse.json({ success: true, result })
        }

        if (topic === 'orders/refunded' || topic === 'refunds/create') {
            const orderId = payload.order_id?.toString() || payload.id?.toString()
            await processRefund({
                productId,
                refundExternalId: orderId,
                
                amount: 0,
                externalTransactionIdCandidates: [orderId],
                provider: 'shopify'
            })
            return NextResponse.json({ success: true, status: 'refunded' })
        }

        return NextResponse.json({ status: 'ignored' })
    } catch (error) {
        console.error('Shopify webhook error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
