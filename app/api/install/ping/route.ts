import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'
import { checkRateLimit } from '@/lib/rate-limit'

/**
 * GET /api/install/ping?product=<id>
 * Beacon fired by track.js on first load. Marks `script_detected_at`.
 * Unauthenticated by design (fired from arbitrary founder sites) but
 * write-limited to a single timestamp and rate-limited per product,
 * so abuse potential is a wrong timestamp on your own product page.
 */
export async function GET(request: NextRequest) {
    const productId = request.nextUrl.searchParams.get('product')

    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-store',
    }

    if (!productId || !/^[0-9a-f-]{36}$/i.test(productId)) {
        return NextResponse.json({ error: 'bad product id' }, { status: 400, headers })
    }

    if (!(await checkRateLimit(`install-ping:${productId}`, 30, 3600))) {
        return NextResponse.json({ ok: true }, { headers }) // swallow — beacons never error
    }

    try {
        const admin = createAdminClient()
        await admin
            .from('products')
            .update({ script_detected_at: new Date().toISOString() } as never)
            .eq('id', productId)
            .is('script_detected_at', null)
    } catch (e) {
        console.error('[INSTALL PING] failed:', e)
    }

    return NextResponse.json({ ok: true }, { headers })
}

export async function OPTIONS() {
    return NextResponse.json({}, {
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
        },
    })
}
