import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, createAdminClient } from '@/lib/supabase-server'
import crypto from 'crypto'

/**
 * POST — Verify wallet deposit payment and credit wallet
 * SECURITY: Requires authentication. user_id must match authenticated user.
 */
export async function POST(request: NextRequest) {
    // SECURITY: Authenticate the user
    const authSupabase = await createServerSupabaseClient()
    const { data: { user }, error: authError } = await authSupabase.auth.getUser()

    if (authError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createAdminClient()
    const body = await request.json()
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, user_id } = body

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
        return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // SECURITY: user_id must match authenticated user (if provided)
    if (user_id && user_id !== user.id) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const verifiedUserId = user.id

    // Verify Razorpay signature
    const expectedSignature = crypto
        .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET!)
        .update(`${razorpay_order_id}|${razorpay_payment_id}`)
        .digest('hex')

    const sigA = Buffer.from(razorpay_signature)
    const sigB = Buffer.from(expectedSignature)
    if (sigA.length !== sigB.length || !crypto.timingSafeEqual(sigA, sigB)) {
        return NextResponse.json({ error: 'Invalid payment signature' }, { status: 401 })
    }

    // Get deposit record to find amount
    const { data: deposit } = await supabase
        .from('founder_deposits')
        .select('amount, status')
        .eq('order_id', razorpay_order_id)
        .eq('founder_id', verifiedUserId)
        .single()

    if (!deposit) {
        return NextResponse.json({ error: 'Deposit record not found' }, { status: 404 })
    }

    const typedDeposit = deposit as { amount: number; status: string }

    // Idempotency: don't credit twice
    if (typedDeposit.status === 'completed') {
        return NextResponse.json({ success: true, message: 'Already credited' })
    }

    const depositAmount = typedDeposit.amount

    // Credit wallet using atomic SQL increment and mark deposit completed in one transaction
    // This avoids read-then-write race conditions and double-crediting
    const { error: creditError } = await supabase.rpc('credit_founder_wallet_atomic', {
        p_deposit_id: typedDeposit.id,
        p_payment_id: razorpay_payment_id,
    })

    if (creditError) {
        console.error('Failed to credit wallet via RPC:', creditError)
        return NextResponse.json({ error: 'Failed to credit wallet' }, { status: 500 })
    }

    // Settle queued sales: sellers who earned commissions while the wallet
    // was empty get paid now, and auto-paused products resume automatically.
    let settled = 0
    try {
        const { data: settleResult } = await supabase.rpc('settle_queued_conversions' as never, {
            p_founder_id: verifiedUserId,
        } as never)
        settled = ((settleResult as any)?.settled as number) || 0
        if (settled > 0) {
            await supabase.from('notifications').insert({
                user_id: verifiedUserId,
                type: 'queue_settled',
                title: `${settled} queued seller(s) just got paid`,
                message: 'Your wallet top-up automatically settled queued commissions and resumed paused products.',
                metadata: { settled },
                read: false,
            } as never)
        }
    } catch (settleErr) {
        console.error('[WALLET VERIFY] Queue settlement failed (non-fatal):', settleErr)
    }

    // Get updated balance for response
    const { data: updatedProfile } = await supabase
        .from('profiles')
        .select('wallet_balance')
        .eq('id', verifiedUserId)
        .single()

    const newBalance = ((updatedProfile as any)?.wallet_balance as number) || 0

    return NextResponse.json({
        success: true,
        message: settled > 0 ? `Wallet credited. ${settled} queued seller(s) paid automatically.` : 'Wallet credited',
        new_balance: newBalance,
        queued_sales_settled: settled,
    })
}
