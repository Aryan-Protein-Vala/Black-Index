import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, createAdminClient } from '@/lib/supabase-server'
import crypto from 'crypto'

/**
 * POST — Verify security deposit payment
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

    // Idempotency: check if already paid
    const { data: existingProfile } = await supabase
        .from('profiles')
        .select('security_deposit_paid')
        .eq('id', verifiedUserId)
        .single()

    if ((existingProfile as any)?.security_deposit_paid) {
        return NextResponse.json({ success: true, message: 'Already verified' })
    }

    // Update profile
    const { error: profileError } = await supabase
        .from('profiles')
        .update({ security_deposit_paid: true } as never)
        .eq('id', verifiedUserId)

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
        .eq('founder_id', verifiedUserId)

    return NextResponse.json({ success: true, message: 'Security deposit verified' })
}
