import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, createAdminClient } from '@/lib/supabase-server'

/**
 * Test Webhook / Integration Preflight
 * GET + POST /api/webhooks/test/[productId]
 *
 * The old version's "signature check" compared an HMAC to ITSELF
 * (timingSafeEqual(x, x)) — a tautology that could never fail, while
 * founders' real integrations silently 401d. That check is deleted.
 * What a preflight can HONESTLY verify without a real provider event:
 *
 * 1. product exists & is yours, secret configured, active
 * 2. at least one affiliate link exists
 * 3. RECENT REAL EVENTS: what actually arrived at your webhook endpoint
 *    lately (from webhook_logs — signature verification happens on the
 *    real route; 401s mean your secrets don't match)
 * 4. tracking script + certification state
 *
 * Real proof = The Gauntlet:
 *   L0 → send "Test Webhook" from Razorpay dashboard, watch recent_events
 *   L1 → POST /api/products/[id]/simulate-sale
 *   L2 → make a real ₹1 purchase through a seller link
 */
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ productId: string }> }
) {
    const { productId } = await params
    const supabase = await createServerSupabaseClient()
    const adminSupabase = createAdminClient()

    try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { data: product, error: productError } = await supabase
            .from('products')
            .select('id, name, founder_id, webhook_secret, is_active, verified_at, script_detected_at')
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
            verified_at: string | null
            script_detected_at: string | null
        }

        if (typedProduct.founder_id !== user.id) {
            return NextResponse.json({ error: 'Not your product' }, { status: 403 })
        }

        const checks: Record<string, { passed: boolean; message: string }> = {}

        checks.webhook_secret = typedProduct.webhook_secret
            ? { passed: true, message: 'Webhook signing secret is configured.' }
            : { passed: false, message: 'No webhook signing secret. Rotate one via product settings.' }

        checks.product_active = typedProduct.is_active
            ? { passed: true, message: 'Product is active and accepting conversions.' }
            : { passed: false, message: 'Product is not active. Check wallet balance / pause state.' }

        const { data: links } = await supabase
            .from('links')
            .select('id, slug')
            .eq('product_id', productId)
            .limit(1)

        checks.affiliate_links = links && links.length > 0
            ? { passed: true, message: `Affiliate link exists: /ref/${(links[0] as any).slug}` }
            : { passed: false, message: 'No affiliate links yet. A seller needs to generate one (or create a test link as a seller).' }

        checks.tracking_script = typedProduct.script_detected_at
            ? { passed: true, message: `track.js detected on your site (${typedProduct.script_detected_at}).` }
            : { passed: false, message: 'track.js not detected on your site yet. Without it, clicks can\'t be attributed to sellers.' }

        checks.certified = typedProduct.verified_at
            ? { passed: true, message: `Money pipe verified (${typedProduct.verified_at}). Product can be listed in the Vault.` }
            : { passed: false, message: 'Not certified yet — no real signed conversion has landed. Run The Gauntlet (L0 → L1 → L2).' }

        // REAL recent events — the honest signal (401s here = secret mismatch)
        const { data: logs } = await adminSupabase
            .from('webhook_logs')
            .select('event_type, status, error_message, created_at')
            .eq('product_id', productId)
            .order('created_at', { ascending: false })
            .limit(5)

        await adminSupabase.from('webhook_logs').insert({
            product_id: productId,
            event_type: 'preflight',
            payload: { checks, tested_by: user.id },
            status: 'test',
        } as never)

        const allPassed = Object.values(checks).every(c => c.passed)
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://blackindex.in'
        const webhookUrl = `${baseUrl}/api/webhooks/razorpay/${productId}`

        return NextResponse.json({
            success: allPassed,
            status: allPassed ? 'verified' : 'issues_found',
            message: allPassed
                ? 'All preflight checks passed.'
                : 'Issues found — see checks.',
            checks,
            recent_events: logs || [],
            webhook_url: webhookUrl,
            gauntlet: [
                `L0: Send "Test Webhook" from your Razorpay dashboard to ${webhookUrl} — then re-run this preflight and look for the event in recent_events. A 401 there = secret mismatch.`,
                'L1: POST /api/products/' + productId + '/simulate-sale — runs the full money path with ₹1 and reverses it.',
                'L2: Make a real ₹1 purchase through your own seller link — sets verified_at and unlocks Vault listing.',
            ],
        })

    } catch (error) {
        console.error('Preflight error:', error)
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : 'Internal error'
        }, { status: 500 })
    }
}

export async function GET(
    request: NextRequest,
    ctx: { params: Promise<{ productId: string }> }
) {
    return POST(request, ctx)
}
