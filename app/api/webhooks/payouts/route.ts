import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'
import { sendEmail } from '@/lib/email'
import crypto from 'crypto'

/**
 * RazorpayX Payout Status Webhook
 * POST /api/webhooks/payouts
 *
 * Why this exists: a withdrawal deducts the seller's withdrawable_balance
 * BEFORE the RazorpayX payout runs. If the payout later fails/reverses
 * (bad VPA, bank downtime), without this handler that money vanishes into
 * the void — deducted from the ledger, never delivered, discovered never.
 *
 * Configure in Razorpay Dashboard → Webhooks (X account):
 * events: payout.failed, payout.reversed, payout.rejected, payout.processed
 * secret: RAZORPAYX_WEBHOOK_SECRET (env)
 */

function sigInvalid(a: string, b: string): boolean {
    const bufA = Buffer.from(a)
    const bufB = Buffer.from(b)
    if (bufA.length !== bufB.length) return true
    return !crypto.timingSafeEqual(bufA, bufB)
}

export async function POST(request: NextRequest) {
    const supabase = createAdminClient()

    try {
        const secret = process.env.RAZORPAYX_WEBHOOK_SECRET
        if (!secret) {
            console.error('[PAYOUT WEBHOOK] RAZORPAYX_WEBHOOK_SECRET not configured')
            return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 })
        }

        const rawBody = await request.text()
        const payload = JSON.parse(rawBody)

        const signature = request.headers.get('x-razorpay-signature')
        if (!signature) {
            return NextResponse.json({ error: 'Missing signature' }, { status: 401 })
        }

        const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex')
        if (sigInvalid(signature, expected)) {
            return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
        }

        const event: string = payload.event
        const payoutEntity = payload.payload?.payout?.entity

        if (!payoutEntity) {
            return NextResponse.json({ message: 'No payout entity', status: 'skipped' })
        }

        const payoutId: string = payoutEntity.id

        if (event === 'payout.failed' || event === 'payout.reversed' || event === 'payout.rejected') {
            // Find the withdrawal tx by the stored RazorpayX payout id
            const { data: tx } = await supabase
                .from('transactions')
                .select('id, seller_id, commission_amount, status')
                .eq('provider_payout_id', payoutId)
                .eq('type', 'payout')
                .maybeSingle()

            if (!tx) {
                console.warn(`[PAYOUT WEBHOOK] ${event} for unknown payout ${payoutId}`)
                return NextResponse.json({ message: 'Payout not tracked here', status: 'skipped' })
            }

            const typedTx = tx as { id: string; seller_id: string; commission_amount: number; status: string }
            if (typedTx.status === 'failed') {
                return NextResponse.json({ message: 'Already handled', status: 'processed' })
            }

            const amount = typedTx.commission_amount || 0

            // Refund the seller's withdrawable balance + flag the payout tx
            const { data: profile } = await supabase
                .from('profiles')
                .select('withdrawable_balance, email, full_name')
                .eq('id', typedTx.seller_id)
                .single()

            await supabase
                .from('profiles')
                .update({ withdrawable_balance: ((profile as any)?.withdrawable_balance || 0) + amount } as never)
                .eq('id', typedTx.seller_id)

            await supabase
                .from('transactions')
                .update({ status: 'failed' } as never)
                .eq('id', typedTx.id)

            await supabase.from('notifications').insert({
                user_id: typedTx.seller_id,
                type: 'payout_failed',
                title: 'Payout failed — balance restored',
                message: `Your payout of ₹${(amount / 100).toLocaleString('en-IN')} failed (${payoutEntity.failure_reason || event}). The amount is back in your withdrawable balance. Check your UPI ID and retry.`,
                metadata: { payout_id: payoutId, amount, reason: payoutEntity.failure_reason },
                read: false,
            } as never)

            const email = (profile as any)?.email as string | undefined
            if (email) {
                await sendEmail({
                    to: email,
                    subject: 'Payout failed — money restored to your balance',
                    html: `<p>Your payout of <b>₹${(amount / 100).toLocaleString('en-IN')}</b> failed (${payoutEntity.failure_reason || event}). The full amount is back in your withdrawable balance. Please verify your UPI ID and retry.</p>`,
                })
            }

            await supabase.from('webhook_logs').insert({
                product_id: null,
                event_type: event,
                payload,
                status: 'success',
                error_message: null,
                ip_address: 'razorpayx-webhook',
            } as never)

            return NextResponse.json({ status: 'refunded', message: 'Balance restored to seller' })
        }

        if (event === 'payout.processed') {
            // Mark the payout tx as confirmed (best-effort; already 'paid')
            await supabase
                .from('transactions')
                .update({ status: 'paid' } as never)
                .eq('provider_payout_id', payoutId)
                .eq('type', 'payout')
            return NextResponse.json({ status: 'confirmed' })
        }

        return NextResponse.json({ message: `Event ${event} ignored`, status: 'skipped' })

    } catch (error) {
        console.error('Payout webhook error:', error)
        return NextResponse.json({ error: 'Internal error' }, { status: 500 })
    }
}
