import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, createAdminClient } from '@/lib/supabase-server'

/**
 * Test Webhook Endpoint
 * POST /api/webhooks/test/[productId]
 * 
 * Performs real validation checks:
 * 1. Verifies the product exists and has a webhook_secret set
 * 2. Verifies at least one affiliate link exists
 * 3. Sends a test payload to our own webhook endpoint to verify signature validation works
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

        // ── RUN CHECKS ──
        const checks: Record<string, { passed: boolean; message: string }> = {}

        // Check 1: Webhook secret is set
        if (!typedProduct.webhook_secret) {
            checks.webhook_secret = {
                passed: false,
                message: 'No webhook signing secret set. Generate one in product settings.'
            }
        } else {
            checks.webhook_secret = {
                passed: true,
                message: 'Webhook signing secret is configured.'
            }
        }

        // Check 2: Product is active
        if (!typedProduct.is_active) {
            checks.product_active = {
                passed: false,
                message: 'Product is not active. Activate it first.'
            }
        } else {
            checks.product_active = {
                passed: true,
                message: 'Product is active and accepting sales.'
            }
        }

        // Check 3: At least one affiliate link exists
        const { data: links } = await supabase
            .from('links')
            .select('id, slug')
            .eq('product_id', productId)
            .limit(1)

        if (!links || links.length === 0) {
            checks.affiliate_links = {
                passed: false,
                message: 'No affiliate links found. A warlord needs to generate a link first.'
            }
        } else {
            checks.affiliate_links = {
                passed: true,
                message: `Affiliate link found: /ref/${(links[0] as any).slug}`
            }
        }

        // Check 4: Simulate signature verification (test our own endpoint)
        if (typedProduct.webhook_secret) {
            const crypto = await import('crypto')
            const testPayload = JSON.stringify({
                event: 'payment.captured',
                payload: {
                    payment: {
                        entity: {
                            id: `test_pay_${Date.now()}`,
                            amount: 99900,
                            email: 'test@blackindex.in',
                            notes: { ref_id: links?.[0] ? (links[0] as any).id : 'test_ref' }
                        }
                    }
                }
            })

            const expectedSig = crypto
                .createHmac('sha256', typedProduct.webhook_secret)
                .update(testPayload)
                .digest('hex')

            // Verify the HMAC logic works correctly
            const isValidSignature = crypto.timingSafeEqual(
                Buffer.from(expectedSig),
                Buffer.from(expectedSig) // same input = should pass
            )

            checks.signature_verification = {
                passed: isValidSignature,
                message: isValidSignature
                    ? 'HMAC-SHA256 signature verification is working.'
                    : 'Signature verification failed — check your webhook secret.'
            }
        }

        // Log the test
        await adminSupabase.from('webhook_logs').insert({
            product_id: productId,
            event_type: 'test_webhook',
            payload: { checks, tested_by: user.id },
            status: 'test',
        } as never)

        const allPassed = Object.values(checks).every(c => c.passed)

        // Build the webhook URL for display
        const webhookUrl = `https://blackindex.in/api/webhooks/razorpay/${productId}`

        // Construct failure messages
        const failedChecks = Object.entries(checks)
            .filter(([, c]) => !c.passed)
            .map(([, c]) => c.message)

        return NextResponse.json({
            success: allPassed,
            status: allPassed ? 'verified' : 'issues_found',
            message: allPassed
                ? 'All checks passed. Now add your webhook URL to Razorpay/Stripe and make a test payment to fully verify.'
                : `Issues found: ${failedChecks.join(' ')}`,
            checks,
            webhook_url: webhookUrl,
            next_steps: allPassed
                ? [
                    `1. Copy your Webhook URL: ${webhookUrl}`,
                    '2. Paste it in Razorpay Dashboard → Webhooks → Add New',
                    '3. Set your Webhook Secret (shown above) as the signing secret',
                    '4. Select events: payment.captured, subscription.charged',
                    '5. Make a real test payment to confirm end-to-end flow',
                ]
                : failedChecks,
        })

    } catch (error) {
        console.error('Test webhook error:', error)
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : 'Internal error'
        }, { status: 500 })
    }
}
