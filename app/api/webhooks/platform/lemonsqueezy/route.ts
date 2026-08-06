import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'
import { convertMinorToINRPaise } from '@/lib/fx'
import crypto from 'crypto'

/**
 * POST /api/webhooks/platform/lemonsqueezy
 *
 * Processes Lemon Squeezy webhook events for founder deposits.
 * Verifies HMAC-SHA256 signature, then handles `order_created` events
 * for security_deposit and wallet_topup types.
 */
export async function POST(request: NextRequest) {
    const secret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET
    if (!secret) {
        console.error('[LS WEBHOOK] LEMONSQUEEZY_WEBHOOK_SECRET not configured')
        return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 })
    }

    // ── Read raw body for signature verification ──
    const rawBody = await request.text()

    // ── Verify HMAC signature ──
    const signature = request.headers.get('x-signature')
    if (!signature) {
        return NextResponse.json({ error: 'Missing signature' }, { status: 401 })
    }

    const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(rawBody)
        .digest('hex')

    if (!crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSignature)
    )) {
        console.error('[LS WEBHOOK] Invalid signature')
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }

    // ── Parse the payload ──
    let payload: any
    try {
        payload = JSON.parse(rawBody)
    } catch {
        return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }

    const eventName = payload?.meta?.event_name
    if (eventName !== 'order_created') {
        // Acknowledge but ignore non-order events
        return NextResponse.json({ received: true, event: eventName })
    }

    // ── Extract custom data ──
    const customData = payload?.meta?.custom_data
    const userId = customData?.user_id
    const type = customData?.type // 'security_deposit' or 'wallet_topup'

    if (!userId || !type) {
        console.error('[LS WEBHOOK] Missing user_id or type in custom_data:', customData)
        return NextResponse.json({ error: 'Missing custom_data fields' }, { status: 400 })
    }

    // ── Extract order amount (in cents) ──
    const totalCents = payload?.data?.attributes?.total || 0

    const supabase = createAdminClient()

    try {
        if (type === 'security_deposit') {
            // Mark security deposit as paid
            const { error } = await supabase
                .from('profiles')
                .update({ security_deposit_paid: true } as never)
                .eq('id', userId)

            if (error) {
                console.error('[LS WEBHOOK] Failed to update security_deposit_paid:', error)
                return NextResponse.json({ error: 'Database update failed' }, { status: 500 })
            }

            console.log(`[LS WEBHOOK] Security deposit marked paid for ${userId}`)

        } else if (type === 'wallet_topup') {
            // FX from env (no more hardcoded ×84)
            const fx = convertMinorToINRPaise(totalCents, payload?.data?.attributes?.currency || 'USD')
            const amountInPaise = fx.amountInPaise

            // Try atomic RPC first, fallback to read-then-write
            const { error: rpcError } = await supabase.rpc('credit_wallet' as any, {
                p_user_id: userId,
                p_amount: amountInPaise,
            } as any)

            if (rpcError) {
                // Fallback: read-then-write (acceptable for low-volume webhook calls)
                console.warn('[LS WEBHOOK] credit_wallet RPC not found, using fallback:', rpcError.message)
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('wallet_balance')
                    .eq('id', userId)
                    .single()

                const currentBalance = (profile as any)?.wallet_balance || 0

                const { error } = await supabase
                    .from('profiles')
                    .update({ wallet_balance: currentBalance + amountInPaise } as never)
                    .eq('id', userId)

                if (error) {
                    console.error('[LS WEBHOOK] Failed to credit wallet:', error)
                    return NextResponse.json({ error: 'Database update failed' }, { status: 500 })
                }
            }

            console.log(`[LS WEBHOOK] Wallet credited +${amountInPaise} paise for ${userId}`)

            // Settle queued sales (sellers earned while wallet was empty) + auto-resume products
            try {
                const { data: settleResult } = await supabase.rpc('settle_queued_conversions' as never, {
                    p_founder_id: userId,
                } as never)
                const settled = ((settleResult as any)?.settled as number) || 0
                if (settled > 0) {
                    await supabase.from('notifications').insert({
                        user_id: userId,
                        type: 'queue_settled',
                        title: `${settled} queued seller(s) just got paid`,
                        message: 'Your wallet top-up automatically settled queued commissions and resumed paused products.',
                        metadata: { settled },
                        read: false,
                    } as never)
                }
            } catch (settleErr) {
                console.error('[LS WEBHOOK] Queue settlement failed (non-fatal):', settleErr)
            }
        }

        // ── Record completed deposit ──
        await supabase.from('founder_deposits').insert({
            founder_id: userId,
            type,
            amount: totalCents,
            currency: 'USD',
            status: 'completed',
            order_id: payload?.data?.id || `ls_${Date.now()}`,
            payment_id: payload?.data?.attributes?.first_order_item?.id || null,
        } as never)

        return NextResponse.json({ success: true, type, userId })

    } catch (error) {
        console.error('[LS WEBHOOK] Processing error:', error)
        return NextResponse.json({ error: 'Internal error' }, { status: 500 })
    }
}
