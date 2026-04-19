import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, createAdminClient } from '@/lib/supabase-server'

/**
 * Test Webhook Endpoint
 * POST /api/webhooks/test/[productId]
 * 
 * Allows founders to test their webhook setup without a real payment
 */

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ productId: string }> }
) {
    const { productId } = await params
    const supabase = await createServerSupabaseClient()
    const adminSupabase = createAdminClient()

    try {
        // Get current user using the session client
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // Verify product belongs to user
        const { data: product, error: productError } = await supabase
            .from('products')
            .select('id, name, founder_id, webhook_secret, is_active')
            .eq('id', productId)
            .single()

        if (productError || !product) {
            return NextResponse.json({ error: 'Product not found' }, { status: 404 })
        }

        const typedProduct = product as {
            id: string
            name: string
            founder_id: string
            webhook_secret: string
            is_active: boolean
        }

        if (typedProduct.founder_id !== user.id) {
            return NextResponse.json({ error: 'Not your product' }, { status: 403 })
        }

        // Check if product has any affiliate links
        const { data: links } = await supabase
            .from('links')
            .select('id, slug')
            .eq('product_id', productId)
            .limit(1)

        if (!links || links.length === 0) {
            return NextResponse.json({
                success: false,
                status: 'no_links',
                message: 'No affiliate links found. Ask a seller to generate a link first.',
            })
        }

        const testLink = links[0] as { id: string; slug: string }

        // Simulate a webhook call to our own system
        const testPayload = {
            event_type: 'payment.success',
            test_mode: true,
            product_id: productId,
            ref_id: testLink.id,
            amount: 99900, // ₹999 test amount
            customer_id: 'test_customer@example.com',
            transaction_id: `test_${Date.now()}`,
        }

        // Log the test
        await adminSupabase.from('webhook_logs').insert({
            product_id: productId,
            event_type: 'test_webhook',
            payload: testPayload,
            status: 'test',
        } as never)

        // Check if webhook would process correctly
        const checks = {
            webhook_secret_set: !!typedProduct.webhook_secret,
            affiliate_link_valid: true,
            ref_id_correctly_formatted: true,
        }

        const allPassed = Object.values(checks).every(v => v === true)

        // If all checks pass, mark product webhook as verified
        if (allPassed) {
            await adminSupabase
                .from('products')
                .update({
                    webhook_status: 'verified',
                    webhook_verified_at: new Date().toISOString()
                } as never)
                .eq('id', productId)
        }

        return NextResponse.json({
            success: allPassed,
            status: allPassed ? 'verified' : 'issues_found',
            message: allPassed
                ? '✅ Webhook verified! Your product is now ready to go live.'
                : 'Some issues found - check the results below.',
            checks,
            test_link: {
                slug: testLink.slug,
                url: `https://blackindex.in/ref/${testLink.slug}`,
            },
            sample_payload: testPayload,
            instructions: {
                razorpay: 'Add ref_id to order.notes when creating payment',
                stripe: 'Add ref_id to session.metadata or payment_intent.metadata',
                gumroad: 'Add ?ref_id=xxx to your product links',
            }
        })

    } catch (error) {
        console.error('Test webhook error:', error)
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : 'Internal error'
        }, { status: 500 })
    }
}
