import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'
import crypto from 'crypto'

/**
 * POST — Verify wallet deposit payment and credit wallet
 */
export async function POST(request: NextRequest) {
    const supabase = createAdminClient()
    const body = await request.json()
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, user_id } = body

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !user_id) {
        return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

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
        .select('amount')
        .eq('order_id', razorpay_order_id)
        .eq('founder_id', user_id)
        .single()

    if (!deposit) {
        return NextResponse.json({ error: 'Deposit record not found' }, { status: 404 })
    }

    const depositAmount = (deposit as { amount: number }).amount

    // Credit wallet
    const { data: profile } = await supabase
        .from('profiles')
        .select('wallet_balance')
        .eq('id', user_id)
        .single()

    const currentBalance = (profile as { wallet_balance: number })?.wallet_balance || 0

    const { error: updateError } = await supabase
        .from('profiles')
        .update({
            wallet_balance: currentBalance + depositAmount,
        } as never)
        .eq('id', user_id)

    if (updateError) {
        console.error('Failed to credit wallet:', updateError)
        return NextResponse.json({ error: 'Failed to credit wallet' }, { status: 500 })
    }

    // Update deposit record
    await supabase
        .from('founder_deposits')
        .update({
            status: 'completed',
            payment_id: razorpay_payment_id,
        } as never)
        .eq('order_id', razorpay_order_id)
        .eq('founder_id', user_id)

    return NextResponse.json({
        success: true,
        message: 'Wallet credited',
        new_balance: (currentBalance + depositAmount) / 100,
    })
}
