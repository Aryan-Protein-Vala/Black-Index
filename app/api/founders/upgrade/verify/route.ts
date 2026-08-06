import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, createAdminClient } from '@/lib/supabase-server'
import crypto from 'crypto'

// SECURITY: Server-side only secret
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET!

/**
 * POST /api/founders/upgrade/verify
 * Verify Razorpay payment and upgrade user to founder
 * Updates payment log with success/failure status
 */
export async function POST(request: NextRequest) {
    const adminClient = createAdminClient()
    let razorpay_order_id: string | undefined
    let current_user_id: string | undefined

    try {
        const supabase = await createServerSupabaseClient()
        const { data: { user }, error: authError } = await supabase.auth.getUser()

        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }
        current_user_id = user.id

        const body = await request.json()
        razorpay_order_id = body.razorpay_order_id
        const { razorpay_payment_id, razorpay_signature } = body

        if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
            return NextResponse.json({ error: 'Missing payment details' }, { status: 400 })
        }

        const { data: existingPayment, error: existingError } = await adminClient
            .from('payments')
            .select('status')
            .eq('order_id', razorpay_order_id)
            .eq('user_id', user.id)
            .maybeSingle()

        if (existingError || !existingPayment) {
            return NextResponse.json({ error: 'Unknown order' }, { status: 404 })
        }

        if ((existingPayment as { status: string }).status === 'succeeded') {
            // Already processed - return success without re-granting access
            return NextResponse.json({
                success: true,
                message: 'Payment already processed',
            })
        }

        // Verify signature using HMAC SHA256
        const expectedSignature = crypto
            .createHmac('sha256', RAZORPAY_KEY_SECRET)
            .update(`${razorpay_order_id}|${razorpay_payment_id}`)
            .digest('hex')

        const expectedBuffer = Buffer.from(expectedSignature)
        const actualBuffer = typeof razorpay_signature === 'string' ? Buffer.from(razorpay_signature) : Buffer.from('')
        const isValid = expectedBuffer.length === actualBuffer.length && crypto.timingSafeEqual(expectedBuffer, actualBuffer)

        if (!isValid) {
            // Log failure
            await adminClient
                .from('payments')
                .update({
                    status: 'failed',
                    failure_reason: 'Invalid signature',
                } as never)
                .eq('order_id', razorpay_order_id)
                .eq('user_id', user.id)

            return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
        }

        // Update payment status to succeeded FIRST (before granting access)
        const { error: paymentUpdateError } = await adminClient
            .from('payments')
            .update({
                status: 'succeeded',
                payment_id: razorpay_payment_id,
                source: 'checkout',
            } as never)
            .eq('order_id', razorpay_order_id)
            .eq('user_id', user.id)

        if (paymentUpdateError) {
            console.error('Failed to update payment:', paymentUpdateError)
            // Don't grant access if we can't log the payment
            return NextResponse.json({ error: 'Payment logging failed' }, { status: 500 })
        }

        // NOW grant access - upgrade user to founder
        const { error: updateError } = await adminClient
            .from('profiles')
            .update({ role: 'founder' } as never)
            .eq('id', user.id)

        if (updateError) {
            console.error('Failed to upgrade user:', updateError)
            // Payment is logged but upgrade failed - needs manual intervention
            await adminClient
                .from('payments')
                .update({
                    metadata: { upgrade_failed: true, error: updateError.message },
                } as never)
                .eq('order_id', razorpay_order_id)
                .eq('user_id', user.id)

            return NextResponse.json({ error: 'Failed to upgrade' }, { status: 500 })
        }

        return NextResponse.json({
            success: true,
            message: 'Successfully upgraded to Founder!',
        })

    } catch (error) {
        console.error('Verify payment error:', error)

        // Try to log failure
        if (razorpay_order_id && current_user_id) {
            await adminClient
                .from('payments')
                .update({
                    status: 'failed',
                    failure_reason: error instanceof Error ? error.message : 'Unknown error',
                } as never)
                .eq('order_id', razorpay_order_id)
                .eq('user_id', current_user_id)
        }

        return NextResponse.json({
            error: error instanceof Error ? error.message : 'Verification failed',
        }, { status: 500 })
    }
}
