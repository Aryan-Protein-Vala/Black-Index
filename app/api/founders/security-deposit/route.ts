import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'
import Razorpay from 'razorpay'
import Stripe from 'stripe'

const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID!,
    key_secret: process.env.RAZORPAY_KEY_SECRET!,
})

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: '2024-06-20' as any,
})

const SECURITY_DEPOSIT_INR = 500000 // ₹5,000 in paise
const SECURITY_DEPOSIT_USD = 6000   // $60 in cents

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
        return NextResponse.json({
            deposit_paid: false,
            amount_inr: SECURITY_DEPOSIT_INR / 100,
            amount_usd: SECURITY_DEPOSIT_USD / 100,
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
        amount_inr: SECURITY_DEPOSIT_INR / 100,
        amount_usd: SECURITY_DEPOSIT_USD / 100,
        refund_policy: 'Refundable upon account closure'
    })
}

export async function POST(request: NextRequest) {
    const supabase = createAdminClient()
    const body = await request.json()
    const { user_id, currency } = body

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
        // ── International (Stripe Checkout in USD) ──
        if (currency === 'USD') {
            const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://blackindex.in'

            const session = await stripe.checkout.sessions.create({
                mode: 'payment',
                line_items: [{
                    price_data: {
                        currency: 'usd',
                        product_data: { name: 'Black Index — Security Deposit' },
                        unit_amount: SECURITY_DEPOSIT_USD,
                    },
                    quantity: 1,
                }],
                metadata: { type: 'security_deposit', founder_id: user_id },
                customer_email: (profile as any)?.email || undefined,
                success_url: `${appUrl}/dashboard/founder?deposit=success`,
                cancel_url: `${appUrl}/dashboard/founder?deposit=cancelled`,
            })

            // Record pending deposit
            await supabase.from('founder_deposits').insert({
                founder_id: user_id,
                type: 'security_deposit',
                amount: SECURITY_DEPOSIT_USD,
                currency: 'USD',
                status: 'pending',
                order_id: session.id,
            } as never)

            return NextResponse.json({ checkoutUrl: session.url })
        }

        // ── India (Razorpay in INR) ──
        const order = await razorpay.orders.create({
            amount: SECURITY_DEPOSIT_INR,
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
            amount: SECURITY_DEPOSIT_INR,
            status: 'pending',
            order_id: order.id,
        } as never)

        return NextResponse.json({
            order_id: order.id,
            amount: SECURITY_DEPOSIT_INR,
            currency: 'INR',
            key_id: process.env.RAZORPAY_KEY_ID,
            name: (profile as any)?.full_name || 'Founder',
        })
    } catch (error) {
        console.error('Failed to create security deposit order:', error)
        return NextResponse.json({ error: 'Failed to create order' }, { status: 500 })
    }
}
