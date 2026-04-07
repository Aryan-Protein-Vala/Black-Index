import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'

/**
 * GET — Redirect founder to Razorpay Route account linking
 * POST — Save Razorpay account ID manually (until OAuth is available)
 */

export async function GET(request: NextRequest) {
    const founderId = request.nextUrl.searchParams.get('founder_id')

    if (!founderId) {
        return NextResponse.json({ error: 'Missing founder_id' }, { status: 400 })
    }

    // Razorpay Route doesn't have a standard OAuth like Stripe Connect.
    // Instead, you create a linked account via API.
    // For now, we'll use a manual flow where founders enter their account ID.
    return NextResponse.json({
        message: 'Razorpay Route setup',
        instructions: 'Contact support@blackindex.in to set up your Razorpay Route account, or enter your Razorpay Account ID below.',
        docs: 'https://razorpay.com/docs/route/',
    })
}

export async function POST(request: NextRequest) {
    const supabase = createAdminClient()
    const body = await request.json()
    const { user_id, razorpay_account_id } = body

    if (!user_id || !razorpay_account_id) {
        return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Validate format (Razorpay account IDs start with 'acc_')
    if (!razorpay_account_id.startsWith('acc_')) {
        return NextResponse.json({ error: 'Invalid Razorpay Account ID format (should start with acc_)' }, { status: 400 })
    }

    const { error } = await supabase
        .from('profiles')
        .update({ razorpay_account_id } as never)
        .eq('id', user_id)

    if (error) {
        return NextResponse.json({ error: 'Failed to save account ID' }, { status: 500 })
    }

    return NextResponse.json({ success: true, message: 'Razorpay Route account linked' })
}
