import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'
import Razorpay from 'razorpay'
import Stripe from 'stripe'

const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID!,
    key_secret: process.env.RAZORPAY_KEY_SECRET!,
})

function getStripe() {
    return new Stripe(process.env.STRIPE_SECRET_KEY!, {
        apiVersion: '2024-06-20' as any,
    })
}

const MIN_DEPOSIT_INR = 1000000 // ₹10,000 in paise
const MIN_DEPOSIT_USD = 12000   // $120 in cents

/**
 * GET — Check wallet balance
 * POST — Create wallet deposit order
 */

export async function GET(request: NextRequest) {
    const supabase = createAdminClient()

    const { data: { user } } = await supabase.auth.getUser()

    return NextResponse.json({
        wallet_balance: 0,
        min_deposit_inr: MIN_DEPOSIT_INR / 100,
        min_deposit_usd: MIN_DEPOSIT_USD / 100,
    })
}

export async function POST(request: NextRequest) {
    const supabase = createAdminClient()
    const body = await request.json()
    const { user_id, amount, currency } = body

    if (!user_id) {
        return NextResponse.json({ error: 'Missing user_id' }, { status: 400 })
    }

    try {
        // ── International (Stripe Checkout in USD) ──
        if (currency === 'USD') {
            const depositAmount = amount || MIN_DEPOSIT_USD
            const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://blackindex.in'

            // Get founder email for Stripe
            const { data: profile } = await supabase
                .from('profiles')
                .select('email')
                .eq('id', user_id)
                .single()

            const session = await getStripe().checkout.sessions.create({
                mode: 'payment',
                line_items: [{
                    price_data: {
                        currency: 'usd',
                        product_data: { name: 'Black Index — Wallet Top-up' },
                        unit_amount: depositAmount,
                    },
                    quantity: 1,
                }],
                metadata: { type: 'wallet_topup', founder_id: user_id },
                customer_email: (profile as any)?.email || undefined,
                success_url: `${appUrl}/dashboard/founder?wallet=success`,
                cancel_url: `${appUrl}/dashboard/founder?wallet=cancelled`,
            })

            // Record pending deposit
            await supabase.from('founder_deposits').insert({
                founder_id: user_id,
                type: 'wallet_topup',
                amount: depositAmount,
                currency: 'USD',
                status: 'pending',
                order_id: session.id,
            } as never)

            return NextResponse.json({ checkoutUrl: session.url })
        }

        // ── India (Razorpay in INR) ──
        const depositAmount = amount || MIN_DEPOSIT_INR

        if (depositAmount < MIN_DEPOSIT_INR) {
            return NextResponse.json({ error: `Minimum deposit is ₹${MIN_DEPOSIT_INR / 100}` }, { status: 400 })
        }

        const order = await razorpay.orders.create({
            amount: depositAmount,
            currency: 'INR',
            receipt: `wallet_${user_id.slice(0, 8)}_${Date.now()}`,
            notes: {
                type: 'wallet_topup',
                founder_id: user_id,
            }
        })

        // Record pending deposit
        await supabase.from('founder_deposits').insert({
            founder_id: user_id,
            type: 'wallet_topup',
            amount: depositAmount,
            status: 'pending',
            order_id: order.id,
        } as never)

        return NextResponse.json({
            order_id: order.id,
            amount: depositAmount,
            currency: 'INR',
            key_id: process.env.RAZORPAY_KEY_ID,
        })
    } catch (error) {
        console.error('Failed to create wallet deposit order:', error)
        return NextResponse.json({ error: 'Failed to create order' }, { status: 500 })
    }
}
