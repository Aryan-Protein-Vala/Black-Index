import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, createAdminClient } from '@/lib/supabase-server'
import crypto from 'crypto'

// SECURITY: Server-side only secret
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET!

/**
 * POST /api/products/feature/verify
 * Verify featured product payment and activate feature status
 */
export async function POST(request: NextRequest) {
    const adminClient = createAdminClient()
    let razorpay_order_id: string | undefined

    try {
        const supabase = await createServerSupabaseClient()
        const { data: { user }, error: authError } = await supabase.auth.getUser()

        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const body = await request.json()
        razorpay_order_id = body.razorpay_order_id
        const { razorpay_payment_id, razorpay_signature, product_id } = body

        if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !product_id) {
            return NextResponse.json({ error: 'Missing payment details' }, { status: 400 })
        }

        // Verify signature
        const expectedSignature = crypto
            .createHmac('sha256', RAZORPAY_KEY_SECRET)
            .update(`${razorpay_order_id}|${razorpay_payment_id}`)
            .digest('hex')

        if (expectedSignature !== razorpay_signature) {
            await adminClient
                .from('featured_payments')
                .update({ status: 'failed' } as never)
                .eq('order_id', razorpay_order_id)

            return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
        }

        // Idempotency check
        const { data: existingPayment } = await adminClient
            .from('featured_payments')
            .select('status')
            .eq('order_id', razorpay_order_id)
            .single()

        if ((existingPayment as { status: string } | null)?.status === 'succeeded') {
            return NextResponse.json({
                success: true,
                message: 'Already processed',
            })
        }

        // Update payment status
        await adminClient
            .from('featured_payments')
            .update({
                status: 'succeeded',
                payment_id: razorpay_payment_id,
            } as never)
            .eq('order_id', razorpay_order_id)

        // Calculate featured_until (30 days from now, or extend if already featured)
        const { data: product } = await adminClient
            .from('products')
            .select('featured_until')
            .eq('id', product_id)
            .single()

        let featuredUntil = new Date()
        const currentFeaturedUntil = (product as any)?.featured_until

        if (currentFeaturedUntil && new Date(currentFeaturedUntil) > new Date()) {
            // Extend from current expiry
            featuredUntil = new Date(currentFeaturedUntil)
        }
        featuredUntil.setDate(featuredUntil.getDate() + 30)

        // Activate featured status
        const { error: updateError } = await adminClient
            .from('products')
            .update({
                is_featured: true,
                featured_until: featuredUntil.toISOString(),
            } as never)
            .eq('id', product_id)

        if (updateError) {
            console.error('Failed to activate featured:', updateError)
            return NextResponse.json({ error: 'Failed to activate featured status' }, { status: 500 })
        }

        return NextResponse.json({
            success: true,
            message: 'Product is now featured!',
            featured_until: featuredUntil.toISOString(),
        })

    } catch (error) {
        console.error('Feature verification error:', error)

        if (razorpay_order_id) {
            await adminClient
                .from('featured_payments')
                .update({ status: 'failed' } as never)
                .eq('order_id', razorpay_order_id)
        }

        return NextResponse.json({
            error: error instanceof Error ? error.message : 'Verification failed',
        }, { status: 500 })
    }
}
