import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'
import Razorpay from 'razorpay'

const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID!,
    key_secret: process.env.RAZORPAY_KEY_SECRET!,
})

export async function POST(request: NextRequest) {
    const supabase = createAdminClient()
    const body = await request.json()
    const { user_id, currency } = body

    if (!user_id) return NextResponse.json({ error: 'Missing user_id' }, { status: 400 })

    // If USD, generate Lemon Squeezy Checkout
    if (currency === 'USD') {
        const lsAmountCents = 12000 // $120.00
        
        try {
            const lsRes = await fetch('https://api.lemonsqueezy.com/v1/checkouts', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${process.env.LEMONSQUEEZY_API_KEY}`,
                    'Accept': 'application/vnd.api+json',
                    'Content-Type': 'application/vnd.api+json'
                },
                body: JSON.stringify({
                    data: {
                        type: "checkouts",
                        attributes: {
                            custom_price: lsAmountCents,
                            checkout_data: { custom: { user_id, type: 'wallet_topup' } }
                        },
                        relationships: {
                            store: { data: { type: "stores", id: process.env.LEMONSQUEEZY_STORE_ID } },
                            variant: { data: { type: "variants", id: process.env.LEMONSQUEEZY_VARIANT_ID } }
                        }
                    }
                })
            })
            const lsData = await lsRes.json()
            return NextResponse.json({ checkoutUrl: lsData.data.attributes.url })
        } catch (error) {
            console.error('Lemon Squeezy error:', error)
            return NextResponse.json({ error: 'Failed to create global checkout' }, { status: 500 })
        }
    }

    // If INR, generate Razorpay Order
    const depositAmountINR = 1000000 // ₹10,000 in paise
    try {
        const order = await razorpay.orders.create({
            amount: depositAmountINR,
            currency: 'INR',
            receipt: `wallet_${user_id.slice(0, 8)}_${Date.now()}`,
            notes: { type: 'wallet_topup', founder_id: user_id }
        })

        await supabase.from('founder_deposits').insert({
            founder_id: user_id, type: 'wallet_topup', amount: depositAmountINR, status: 'pending', order_id: order.id
        } as never)

        return NextResponse.json({
            order_id: order.id, amount: depositAmountINR, currency: 'INR', key_id: process.env.RAZORPAY_KEY_ID,
        })
    } catch (error) {
        return NextResponse.json({ error: 'Failed to create Indian order' }, { status: 500 })
    }
}
