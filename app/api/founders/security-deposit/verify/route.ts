import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'
import crypto from 'crypto'

/**
 * POST — Verify security deposit payment
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

    // Update profile
    const { error: profileError } = await supabase
        .from('profiles')
        .update({ security_deposit_paid: true } as never)
        .eq('id', user_id)

    if (profileError) {
        console.error('Failed to update profile:', profileError)
        return NextResponse.json({ error: 'Failed to update deposit status' }, { status: 500 })
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

    return NextResponse.json({ success: true, message: 'Security deposit verified' })
}
