import { NextResponse } from 'next/server'
import { createServerSupabaseClient, createAdminClient } from '@/lib/supabase-server'

// SECURITY: These secrets are server-side only
const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID!
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET!

/**
 * POST /api/founders/upgrade
 * Create a Razorpay order for upgrading to Seller/Founder status
 * Also logs the payment attempt in our database
 */
export async function POST() {
    try {
        const supabase = await createServerSupabaseClient()
        const { data: { user }, error: authError } = await supabase.auth.getUser()

        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const adminClient = createAdminClient()

        // Check current role
        const { data: profile } = await adminClient
            .from('profiles')
            .select('role, full_name')
            .eq('id', user.id)
            .single()

        const profileData = profile as { role: string; full_name: string | null } | null

        if (profileData?.role === 'founder') {
            return NextResponse.json({ error: 'Already a founder' }, { status: 400 })
        }

        const amount = 10000 // ₹100 in paise (discounted from 500)

        // Check for existing recent order
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
        const { data: existingPayment } = await adminClient
            .from('payments')
            .select('order_id, amount')
            .eq('user_id', user.id)
            .eq('payment_type', 'founder_upgrade')
            .eq('status', 'created')
            .gte('created_at', oneHourAgo)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle()

        if (existingPayment) {
            const ep = existingPayment as any
            return NextResponse.json({
                orderId: ep.order_id,
                amount: ep.amount,
                email: user.email,
                name: profileData?.full_name,
                phone: null,
            })
        }

        // Create Razorpay order
        const orderResponse = await fetch('https://api.razorpay.com/v1/orders', {
            method: 'POST',
            headers: {
                'Authorization': `Basic ${Buffer.from(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`).toString('base64')}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                amount,
                currency: 'INR',
                receipt: `upg_${user.id.slice(0, 8)}_${Date.now()}`.slice(0, 40),
                notes: {
                    user_id: user.id,
                    type: 'founder_upgrade',
                },
            }),
        })

        if (!orderResponse.ok) {
            const errorData = await orderResponse.json()
            console.error('Razorpay error:', errorData)
            throw new Error(errorData?.error?.description || 'Failed to create order')
        }

        const order = await orderResponse.json()

        // Log payment in database with status "created"
        // This happens BEFORE user sees checkout - we track all attempts
        await adminClient
            .from('payments')
            .insert({
                user_id: user.id,
                order_id: order.id,
                amount,
                currency: 'INR',
                status: 'created',
                payment_type: 'founder_upgrade',
                source: 'checkout',
                metadata: {
                    receipt: order.receipt,
                    full_name: profileData?.full_name,
                },
            } as never)

        return NextResponse.json({
            orderId: order.id,
            amount: order.amount,
            email: user.email,
            name: profileData?.full_name,
            phone: null,
        })

    } catch (error) {
        console.error('Upgrade order error:', error)
        return NextResponse.json({
            error: error instanceof Error ? error.message : 'Failed to create order',
        }, { status: 500 })
    }
}
