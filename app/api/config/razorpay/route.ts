import { NextResponse } from 'next/server'

/**
 * GET /api/config/razorpay
 * Returns the Razorpay public key for client-side checkout
 * This keeps the key server-side while still allowing client access
 */
export async function GET() {
    const razorpayKeyId = process.env.RAZORPAY_KEY_ID

    if (!razorpayKeyId) {
        return NextResponse.json({ error: 'Payment configuration missing' }, { status: 500 })
    }

    return NextResponse.json({
        keyId: razorpayKeyId
    })
}
