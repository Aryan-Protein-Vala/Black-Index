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

    if (!crypto.timingSafeEqual(
        Buffer.from(razorpay_signature),
        Buffer.from(expectedSignature)
    )) {
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

    // Credit wallet using atomic SQL increment (wallet_balance = wallet_balance + amount)
    // This avoids read-then-write race conditions
    const { error: creditError } = await supabase.rpc('credit_wallet' as any, {
        p_user_id: verifiedUserId,
        p_amount: depositAmount,
    } as any)

    if (creditError) {
        // Fallback if RPC doesn't exist: read-then-write (acceptable for low-volume founder deposits)
        console.warn('[WALLET VERIFY] credit_wallet RPC not found, using fallback:', creditError.message)
        const { data: profile } = await supabase
            .from('profiles')
            .select('wallet_balance')
            .eq('id', verifiedUserId)
            .single()

        const currentBalance = ((profile as any)?.wallet_balance as number) || 0

        const { error: updateError } = await supabase
            .from('profiles')
            .update({
                wallet_balance: currentBalance + depositAmount,
            } as never)
            .eq('id', verifiedUserId)

        if (updateError) {
            console.error('Failed to credit wallet:', updateError)
            return NextResponse.json({ error: 'Failed to credit wallet' }, { status: 500 })
        }
    }

    // Update deposit record (mark as completed to prevent double-crediting)
    await supabase
        .from('founder_deposits')
        .update({
            status: 'completed',
            payment_id: razorpay_payment_id,
        } as never)
        .eq('order_id', razorpay_order_id)
        .eq('founder_id', verifiedUserId)

    // Get updated balance for response
    const { data: updatedProfile } = await supabase
        .from('profiles')
        .select('wallet_balance')
        .eq('id', verifiedUserId)
        .single()

    const newBalance = ((updatedProfile as any)?.wallet_balance as number) || 0

    return NextResponse.json({
        success: true,
        message: 'Wallet credited',
        new_balance: newBalance,
    })
}
