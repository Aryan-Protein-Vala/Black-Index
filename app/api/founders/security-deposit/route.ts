import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'
import Razorpay from 'razorpay'

const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID!,
    key_secret: process.env.RAZORPAY_KEY_SECRET!,
})

const SECURITY_DEPOSIT_AMOUNT = 500000 // ₹5,000 in paise

/**
 * GET — Check security deposit status
 * POST — Create order for security deposit payment
 */

export async function GET(request: NextRequest) {
    const supabase = createAdminClient()

    const authHeader = request.headers.get('authorization')
    const { data: { user }, error: authError } = await supabase.auth.getUser(
        authHeader?.replace('Bearer ', '')
    )

    if (authError || !user) {
        // Try cookie-based auth
        const { data: profile } = await supabase
            .from('profiles')
            .select('security_deposit_paid')
            .limit(1)
            .single()

        return NextResponse.json({
            deposit_paid: false,
            amount: SECURITY_DEPOSIT_AMOUNT / 100,
            refund_policy: 'Refundable upon account closure'
        })
    }

    const { data: profile } = await supabase
        .from('profiles')
        .select('security_deposit_paid')
        .eq('id', user.id)
        .single()

    return NextResponse.json({
        deposit_paid: (profile as any)?.security_deposit_paid || false,
        amount: SECURITY_DEPOSIT_AMOUNT / 100,
        refund_policy: 'Refundable upon account closure'
    })
}

export async function POST(request: NextRequest) {
    const supabase = createAdminClient()
    const body = await request.json()
    const { user_id } = body

    if (!user_id) {
        return NextResponse.json({ error: 'Missing user_id' }, { status: 400 })
    }

    // Check if already paid
    const { data: profile } = await supabase
        .from('profiles')
        .select('security_deposit_paid, full_name, email')
        .eq('id', user_id)
        .single()

    if ((profile as any)?.security_deposit_paid) {
        return NextResponse.json({ error: 'Security deposit already paid' }, { status: 400 })
    }

    try {
        // Create Razorpay order
        const order = await razorpay.orders.create({
            amount: SECURITY_DEPOSIT_AMOUNT,
            currency: 'INR',
            receipt: `sec_dep_${user_id.slice(0, 8)}`,
            notes: {
                type: 'security_deposit',
                founder_id: user_id,
            }
        })

        // Record pending deposit
        await supabase.from('founder_deposits').insert({
            founder_id: user_id,
            type: 'security_deposit',
            amount: SECURITY_DEPOSIT_AMOUNT,
            status: 'pending',
            order_id: order.id,
        } as never)

        return NextResponse.json({
            order_id: order.id,
            amount: SECURITY_DEPOSIT_AMOUNT,
            currency: 'INR',
            key_id: process.env.RAZORPAY_KEY_ID,
            name: (profile as any)?.full_name || 'Founder',
        })
    } catch (error) {
        console.error('Failed to create security deposit order:', error)
        return NextResponse.json({ error: 'Failed to create order' }, { status: 500 })
    }
}
