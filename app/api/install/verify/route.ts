import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'
import { checkRateLimit } from '@/lib/rate-limit'
import crypto from 'crypto'

/**
 * POST /api/install/verify
 * Auth: install token (per-product, NOT the webhook secret)
 *
 * Site-scan verification — the load-bearing piece for BOTH the npx CLI and
 * no-code founders (Framer/Carrd/Webflow paste-snippet users).
 * Server fetches the product's website_url and checks the track.js snippet
 * is live with the right data-product attribute.
 */
export async function POST(request: NextRequest) {
    try {
        const authHeader = request.headers.get('authorization')
        const token = authHeader?.replace(/^Bearer\s+/i, '').trim()

        if (!token) {
            return NextResponse.json({ error: 'Missing install token (Authorization: Bearer …)' }, { status: 401 })
        }

        const tokenHash = crypto.createHash('sha256').update(token).digest('hex')
        const admin = createAdminClient()

        const { data: tokenRow } = await admin
            .from('install_tokens')
            .select('id, product_id, revoked_at')
            .eq('token_hash', tokenHash)
            .maybeSingle()

        if (!tokenRow || (tokenRow as any).revoked_at) {
            return NextResponse.json({ error: 'Invalid or revoked token' }, { status: 401 })
        }

        const productId = (tokenRow as any).product_id as string

        if (!(await checkRateLimit(`install-verify:${productId}`, 10, 3600))) {
            return NextResponse.json({ error: 'Verification rate limit reached' }, { status: 429 })
        }

        const { data: product } = await admin
            .from('products')
            .select('id, website_url, script_detected_at')
            .eq('id', productId)
            .single()

        if (!product) {
            return NextResponse.json({ error: 'Product not found' }, { status: 404 })
        }

        let websiteUrl = (product as { website_url: string }).website_url
        if (!/^https?:\/\//i.test(websiteUrl)) {
            websiteUrl = 'https://' + websiteUrl
        }

        // ---- Fetch + scan the founder's site ----
        let html: string
        try {
            const res = await fetch(websiteUrl, {
                headers: { 'user-agent': 'BlackIndex-Verifier/1.0' },
                signal: AbortSignal.timeout(10_000),
                redirect: 'follow',
            })
            html = await res.text()
        } catch (fetchErr) {
            return NextResponse.json({
                verified: false,
                stage: 'fetch',
                error: `Could not reach ${websiteUrl}. Is the site up?`,
            }, { status: 200 })
        }

        const scriptRe = /<script[^>]+src=["']https?:\/\/[^"']*blackindex[^"']*\/track\.js["'][^>]*>/i
        const tagMatch = html.match(scriptRe)

        if (!tagMatch) {
            return NextResponse.json({
                verified: false,
                stage: 'scan',
                error: 'track.js script tag not found on the page. Install: <script src="https://blackindex.in/track.js" data-product="' + productId + '"></script>',
            }, { status: 200 })
        }

        const tag = tagMatch[0]
        const productAttr = tag.match(/data-product=["']([^"']+)["']/i)?.[1]

        if (productAttr !== productId) {
            return NextResponse.json({
                verified: false,
                stage: 'scan',
                error: `Script tag found but data-product="${productAttr ?? 'missing'}" — expected "${productId}".`,
            }, { status: 200 })
        }

        await admin
            .from('products')
            .update({ script_detected_at: new Date().toISOString() } as never)
            .eq('id', productId)

        return NextResponse.json({
            verified: true,
            stage: 'complete',
            message: 'track.js detected on your site. Next: send a test webhook (handshake), then run a simulated sale.',
        })

    } catch (error) {
        console.error('Install verify error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
