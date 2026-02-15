import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, createAdminClient } from '@/lib/supabase-server'
import crypto from 'crypto'

// SECURITY: Server-side only secrets
const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID!
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET!

const FEATURED_PRICE = 499900 // ₹4999 in paise

/**
 * POST /api/products/feature
 * Create a Razorpay order to make a product featured (₹4999/month)
 */
export async function POST(request: NextRequest) {
    try {
        const supabase = await createServerSupabaseClient()
        const { data: { user }, error: authError } = await supabase.auth.getUser()

        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const body = await request.json()
        const { product_id } = body

        if (!product_id) {
            return NextResponse.json({ error: 'Missing product_id' }, { status: 400 })
        }

        const adminClient = createAdminClient()

        // Verify user owns this product
        const { data: product, error: productError } = await adminClient
            .from('products')
            .select('id, name, founder_id, is_featured, featured_until')
            .eq('id', product_id)
            .single()

        if (productError || !product) {
            return NextResponse.json({ error: 'Product not found' }, { status: 404 })
        }

        const typedProduct = product as { id: string; name: string; founder_id: string; is_featured: boolean; featured_until: string | null }

        if (typedProduct.founder_id !== user.id) {
            return NextResponse.json({ error: 'Not authorized to feature this product' }, { status: 403 })
        }

        // Check if already featured and not expired
        if (typedProduct.is_featured && typedProduct.featured_until) {
            const featuredUntil = new Date(typedProduct.featured_until)
            if (featuredUntil > new Date()) {
                return NextResponse.json({
                    error: 'Product is already featured',
                    featured_until: typedProduct.featured_until
                }, { status: 400 })
            }
        }

        // Create Razorpay order
        const orderResponse = await fetch('https://api.razorpay.com/v1/orders', {
            method: 'POST',
            headers: {
                'Authorization': `Basic ${Buffer.from(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`).toString('base64')}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                amount: FEATURED_PRICE,
                currency: 'INR',
                receipt: `feat_${product_id.slice(0, 8)}_${Date.now()}`.slice(0, 40),
                notes: {
                    product_id,
                    user_id: user.id,
                    type: 'featured_product',
                },
            }),
        })

        if (!orderResponse.ok) {
            const errorData = await orderResponse.json()
            console.error('Razorpay error:', errorData)
            throw new Error(errorData?.error?.description || 'Failed to create order')
        }

        const order = await orderResponse.json()

        // Log the payment attempt
        await adminClient
            .from('featured_payments')
            .insert({
                product_id,
                founder_id: user.id,
                order_id: order.id,
                amount: FEATURED_PRICE,
                status: 'created',
                months_purchased: 1,
            } as never)

        return NextResponse.json({
            orderId: order.id,
            amount: order.amount,
            product_name: typedProduct.name,
        })

    } catch (error) {
        console.error('Feature product order error:', error)
        return NextResponse.json({
            error: error instanceof Error ? error.message : 'Failed to create order',
        }, { status: 500 })
    }
}
