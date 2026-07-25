import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, createAdminClient } from '@/lib/supabase-server'
import Razorpay from 'razorpay'

// Razorpay initialization moved inside POST to avoid build errors

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
    // SECURITY: Authenticate the user
    const authSupabase = await createServerSupabaseClient()
    const { data: { user }, error: authError } = await authSupabase.auth.getUser()

    if (authError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createAdminClient()
    const body = await request.json()
    const { currency, ref_id, user_id } = body

    // SECURITY: user_id from body must match authenticated user (if provided)
    if (user_id && user_id !== user.id) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const verifiedUserId = user.id

    // Check if already paid
    const { data: profile } = await supabase
        .from('profiles')
        .select('security_deposit_paid, full_name, email')
        .eq('id', verifiedUserId)
        .single()

    if ((profile as any)?.security_deposit_paid) {
        return NextResponse.json({ error: 'Security deposit already paid' }, { status: 400 })
    }

    try {
        // ── International (Lemon Squeezy Checkout in USD) ──
        if (currency === 'USD') {
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
                            custom_price: SECURITY_DEPOSIT_USD,
                            product_options: {
                                redirect_url: `${appUrl}/dashboard/founder?deposit=success`,
                            },
                            checkout_data: {
                                custom: {
                                    user_id: verifiedUserId,
                                    type: 'security_deposit',
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
                founder_id: verifiedUserId,
                type: 'security_deposit',
                amount: SECURITY_DEPOSIT_USD,
                currency: 'USD',
                status: 'pending',
                order_id: lsData.data.id,
            } as never)

            return NextResponse.json({ checkoutUrl })
        }

        // ── India (Razorpay in INR) ──
        const razorpay = new Razorpay({
            key_id: process.env.RAZORPAY_KEY_ID!,
            key_secret: process.env.RAZORPAY_KEY_SECRET!,
        });

        const order = await razorpay.orders.create({
            amount: SECURITY_DEPOSIT_INR,
            currency: 'INR',
            receipt: `sec_dep_${verifiedUserId.slice(0, 8)}`,
            notes: {
                type: 'security_deposit',
                founder_id: verifiedUserId,
                ref_id: ref_id || null,
            }
        })

        // Record pending deposit
        await supabase.from('founder_deposits').insert({
            founder_id: verifiedUserId,
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
