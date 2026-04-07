import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'

/**
 * GET — Handle Stripe Connect OAuth callback
 * Exchanges authorization code for connected account ID
 */
export async function GET(request: NextRequest) {
    const code = request.nextUrl.searchParams.get('code')
    const founderId = request.nextUrl.searchParams.get('state')
    const error = request.nextUrl.searchParams.get('error')

    const dashboardUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://blackindex.in'}/dashboard/founder`

    if (error) {
        return NextResponse.redirect(`${dashboardUrl}?connect_error=${error}`)
    }

    if (!code || !founderId) {
        return NextResponse.redirect(`${dashboardUrl}?connect_error=missing_params`)
    }

    try {
        // Exchange code for connected account ID
        const response = await fetch('https://connect.stripe.com/oauth/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                grant_type: 'authorization_code',
                code,
                client_secret: process.env.STRIPE_SECRET_KEY!,
            }),
        })

        const data = await response.json()

        if (data.error) {
            console.error('Stripe Connect OAuth error:', data)
            return NextResponse.redirect(`${dashboardUrl}?connect_error=${data.error}`)
        }

        const stripeUserId = data.stripe_user_id

        // Save to founder's profile
        const supabase = createAdminClient()
        const { error: updateError } = await supabase
            .from('profiles')
            .update({ stripe_connect_id: stripeUserId } as never)
            .eq('id', founderId)

        if (updateError) {
            console.error('Failed to save Stripe Connect ID:', updateError)
            return NextResponse.redirect(`${dashboardUrl}?connect_error=save_failed`)
        }

        return NextResponse.redirect(`${dashboardUrl}?connect_success=stripe`)

    } catch (err) {
        console.error('Stripe Connect callback error:', err)
        return NextResponse.redirect(`${dashboardUrl}?connect_error=internal`)
    }
}
