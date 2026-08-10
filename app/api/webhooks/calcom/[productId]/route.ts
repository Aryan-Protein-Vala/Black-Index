import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'
import { processRefund } from '@/lib/webhook-processor'
import { emailsMatch } from '@/lib/anti-fraud'
import crypto from 'crypto'

function sigInvalid(a: string, b: string): boolean {
    const bufA = Buffer.from(a)
    const bufB = Buffer.from(b)
    if (bufA.length !== bufB.length) return true
    return !crypto.timingSafeEqual(bufA, bufB)
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ productId: string }> }) {
    const { productId } = await params
    const adminClient = createAdminClient()

    try {
        const { data: product } = await adminClient
            .from('products')
            .select('webhook_secret, founder_id')
            .eq('id', productId)
            .single()

        const p = product as any;
        if (!p || !p.webhook_secret) {
            return NextResponse.json({ error: 'Product not found or not configured' }, { status: 404 })
        }

        const rawBody = await request.text()
        let payload
        try {
            payload = JSON.parse(rawBody)
        } catch (e) {
            return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
        }

        const signature = request.headers.get('x-cal-signature-256')
        if (!signature) {
            return NextResponse.json({ error: 'Missing signature' }, { status: 401 })
        }

        const expected = crypto.createHmac('sha256', p.webhook_secret).update(rawBody).digest('hex')
        if (sigInvalid(signature, expected)) {
            return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
        }

        const triggerEvent = payload.triggerEvent
        const uid = payload.payload?.uid
        const metadata = payload.payload?.metadata || {}
        const attendeeEmail = payload.payload?.attendees?.[0]?.email
        const attendeePhone = payload.payload?.responses?.phone || metadata.phone
        const startTime = payload.payload?.startTime

        if (triggerEvent === 'BOOKING_CREATED') {
            const biRef = metadata.bi_ref
            
            if (!biRef) {
                await adminClient.from('webhook_logs').insert({
                    product_id: productId, event_type: triggerEvent, payload, status: 'success', error_message: 'skipped_no_ref'
                } as never)
                
                await adminClient.from('notifications').insert({
                    user_id: p.founder_id,
                    type: 'unattributed_sale',
                    title: 'Unattributed Booking',
                    message: 'A booking was made without a referral link.',
                    read: false
                } as never)

                return NextResponse.json({ status: 'skipped_no_ref', message: 'No bi_ref found' })
            }

            // Get link info to find seller
            const { data: link } = await adminClient
                .from('links')
                .select('seller_id')
                .eq('id', biRef)
                .single()

            if (!link) {
                return NextResponse.json({ status: 'skipped', message: 'Invalid ref' })
            }

            const sellerId = (link as any).seller_id

            // COLLUSION HEURISTIC — compare against BOTH profiles.phone and upi_vpa
            const { data: sellerProfile } = await adminClient
                .from('profiles')
                .select('email, phone, upi_vpa')
                .eq('id', sellerId)
                .single()

            const sellerEmail = (sellerProfile as any)?.email
            const sellerPhone = (sellerProfile as any)?.phone
            const sellerVpa = (sellerProfile as any)?.upi_vpa

            const phoneMatches =
                (attendeePhone && sellerPhone && attendeePhone === sellerPhone) ||
                (attendeePhone && sellerVpa && attendeePhone === sellerVpa)

            if (emailsMatch(attendeeEmail, sellerEmail) || phoneMatches) {
                
                // Flag fraud
                await adminClient.from('fraud_reports').insert({
                    product_id: productId,
                    founder_id: p.founder_id,
                    reporter_id: p.founder_id, // system heuristic — attributed to founder, not seller
                    evidence_url: 'system_heuristic',
                    description: 'Self-booking detected based on email/phone match.',
                    status: 'confirmed'
                } as never)

                await adminClient.from('notifications').insert({
                    user_id: p.founder_id,
                    type: 'system',
                    title: 'Fraud Detected',
                    message: 'A self-booking attempt was blocked.',
                    read: false
                } as never)

                return NextResponse.json({ status: 'flagged', message: 'Self-booking blocked' })
            }

            const { data: result, error: rpcError } = await adminClient.rpc('record_meeting_booking' as never, {
                p_product_id: productId,
                p_link_id: biRef,
                p_seller_id: sellerId,
                p_buyer_email: attendeeEmail || 'unknown@example.com',
                p_cal_booking_uid: uid,
                p_meeting_start_at: startTime
            } as never)

            if (rpcError) {
                console.error("RPC Error:", rpcError)
                return NextResponse.json({ error: rpcError.message }, { status: 500 })
            }

            // Graceful handling of business-level rejections (product inactive,
            // service not enabled, etc.) — still return 200 so Cal.com stops retrying
            const r = result as any
            if (r && r.success === false) {
                await adminClient.from('webhook_logs').insert({
                    product_id: productId,
                    event_type: triggerEvent,
                    payload,
                    status: 'failed',
                    error_message: r.error || 'Booking rejected',
                    ip_address: 'calcom-webhook',
                } as never)
                return NextResponse.json({ status: 'skipped', message: r.error })
            }

            return NextResponse.json({ success: true, result })
        }

        if (triggerEvent === 'BOOKING_CANCELLED') {
            await processRefund({
                productId,
                refundExternalId: uid,
                
                amount: 0,
                externalTransactionIdCandidates: [uid],
                provider: 'calcom'
            })
            return NextResponse.json({ success: true, status: 'cancelled' })
        }

        return NextResponse.json({ status: 'ignored' })
    } catch (error) {
        console.error('Cal webhook error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
