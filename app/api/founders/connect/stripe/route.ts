import { NextRequest, NextResponse } from 'next/server'

/**
 * GET — Redirect founder to Stripe Connect OAuth
 */
export async function GET(request: NextRequest) {
    const founderId = request.nextUrl.searchParams.get('founder_id')

    if (!founderId) {
        return NextResponse.json({ error: 'Missing founder_id' }, { status: 400 })
    }

    const clientId = process.env.STRIPE_CONNECT_CLIENT_ID
    if (!clientId) {
        return NextResponse.json({ error: 'Stripe Connect not configured' }, { status: 500 })
    }

    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL || 'https://blackindex.in'}/api/founders/connect/stripe/callback`

    const oauthUrl = new URL('https://connect.stripe.com/oauth/authorize')
    oauthUrl.searchParams.set('response_type', 'code')
    oauthUrl.searchParams.set('client_id', clientId)
    oauthUrl.searchParams.set('scope', 'read_write')
    oauthUrl.searchParams.set('redirect_uri', redirectUri)
    oauthUrl.searchParams.set('state', founderId) // CSRF + founder identification

    return NextResponse.redirect(oauthUrl.toString())
}
