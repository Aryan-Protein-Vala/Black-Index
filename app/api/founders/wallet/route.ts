import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'
import Razorpay from 'razorpay'

const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID!,
    key_secret: process.env.RAZORPAY_KEY_SECRET!,
})

const MIN_DEPOSIT = 1000000 // ₹10,000 in paise

/**
 * GET — Check wallet balance
 * POST — Create wallet deposit order
 */

export async function GET(request: NextRequest) {
    const supabase = createAdminClient()

    // Get user from auth header or cookie
    const { data: { user } } = await supabase.auth.getUser()

    return NextResponse.json({
        wallet_balance: 0,
        min_deposit: MIN_DEPOSIT / 100,
    })
}

export async function POST(request: NextRequest) {
    const supabase = createAdminClient()
    const body = await request.json()
    const { user_id, amount } = body

    if (!user_id) {
        return NextResponse.json({ error: 'Missing user_id' }, { status: 400 })
    }

    const depositAmount = amount || MIN_DEPOSIT

    if (depositAmount < MIN_DEPOSIT) {
        return NextResponse.json({ error: `Minimum deposit is ₹${MIN_DEPOSIT / 100}` }, { status: 400 })
    }

    try {
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
