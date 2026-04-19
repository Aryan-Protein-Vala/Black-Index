import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'
import Razorpay from 'razorpay'

const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID!,
    key_secret: process.env.RAZORPAY_KEY_SECRET!,
})

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
    const { user_id, amount, currency, ref_id } = body

    if (!user_id) {
        return NextResponse.json({ error: 'Missing user_id' }, { status: 400 })
    }

    try {
        // ── International (Lemon Squeezy Checkout in USD) ──
        if (currency === 'USD') {
            const depositAmount = amount || MIN_DEPOSIT_USD
            const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://blackindex.in'

            const lsRes = await fetch('https://api.lemonsqueezy.com/v1/checkouts', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${process.env.LEMONSQUEEZY_API_KEY}`,
                    'Accept': 'application/vnd.api+json',
                    'Content-Type': 'application/vnd.api+json',
                },
                body: JSON.stringify({
                    data: {
                        type: 'checkouts',
                        attributes: {
                            custom_price: depositAmount,
                            product_options: {
                                redirect_url: `${appUrl}/dashboard/founder?wallet=success`,
                            },
                            checkout_data: {
                                custom: {
                                    user_id,
                                    type: 'wallet_topup',
                                    ref_id: ref_id || null,
                                },
                            },
                        },
                        relationships: {
                            store: {
                                data: {
                                    type: 'stores',
                                    id: process.env.LEMONSQUEEZY_STORE_ID!,
                                },
                            },
                            variant: {
                                data: {
                                    type: 'variants',
                                    id: process.env.LEMONSQUEEZY_VARIANT_ID!,
                                },
                            },
                        },
                    },
                }),
            })

            if (!lsRes.ok) {
                const errBody = await lsRes.text()
                console.error('Lemon Squeezy checkout error:', errBody)
                throw new Error('Failed to create Lemon Squeezy checkout')
            }

            const lsData = await lsRes.json()
            const checkoutUrl = lsData.data.attributes.url

            // Record pending deposit
            await supabase.from('founder_deposits').insert({
                founder_id: user_id,
                type: 'wallet_topup',
                amount: depositAmount,
                currency: 'USD',
                status: 'pending',
                order_id: lsData.data.id,
            } as never)

            return NextResponse.json({ checkoutUrl })
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
                ref_id: ref_id || null,
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
