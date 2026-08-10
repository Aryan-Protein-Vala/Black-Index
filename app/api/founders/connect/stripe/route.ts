import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import crypto from 'crypto'

/**
 * GET — Redirect founder to Stripe Connect OAuth
 */
export async function GET(request: NextRequest) {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const founderId = user.id

    const clientId = process.env.STRIPE_CONNECT_CLIENT_ID
    // Using SUPABASE_SERVICE_ROLE_KEY as a fallback state secret since it is guaranteed to be secret and present
    const stateSecret = process.env.STRIPE_STATE_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY 
    
    if (!clientId || !stateSecret) {
        return NextResponse.json({ error: 'Stripe Connect not configured' }, { status: 500 })
    }

    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL || 'https://blackindex.in'}/api/founders/connect/stripe/callback`

    // Generate a secure state parameter: HMAC(founderId, secret) + "." + founderId
    const signature = crypto.createHmac('sha256', stateSecret).update(founderId).digest('hex')
    const secureState = `${founderId}.${signature}`

    const oauthUrl = new URL('https://connect.stripe.com/oauth/authorize')
    oauthUrl.searchParams.set('response_type', 'code')
    oauthUrl.searchParams.set('client_id', clientId)
    oauthUrl.searchParams.set('scope', 'read_write')
    oauthUrl.searchParams.set('redirect_uri', redirectUri)
    oauthUrl.searchParams.set('state', secureState) // Secure signed state

    return NextResponse.redirect(oauthUrl.toString())
}
