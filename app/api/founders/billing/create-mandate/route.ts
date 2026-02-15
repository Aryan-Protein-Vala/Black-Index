import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, createAdminClient } from '@/lib/supabase-server'
import { createCustomer, createSubscription } from '@/lib/razorpay'

/**
 * POST /api/founders/billing/create-mandate
 * Creates a Razorpay subscription (mandate) for founder auto-debit
 */
export async function POST(request: NextRequest) {
    try {
        // Get authenticated user
        const supabase = await createServerSupabaseClient()
        const { data: { user }, error: authError } = await supabase.auth.getUser()

        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const adminClient = createAdminClient()

        // Get founder profile
        const { data: profile, error: profileError } = await adminClient
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single()

        if (profileError || !profile) {
            return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
        }

        // Verify user is a founder
        const profileData = profile as { role: string; razorpay_customer_id?: string; razorpay_subscription_id?: string }
        if (profileData.role !== 'founder') {
            return NextResponse.json({ error: 'Only founders can set up billing' }, { status: 403 })
        }

        // Check if mandate already exists
        if (profileData.razorpay_subscription_id) {
            return NextResponse.json({
                error: 'Mandate already exists',
                subscriptionId: profileData.razorpay_subscription_id,
            }, { status: 400 })
        }

        const body = await request.json()
        const { name, email, contact } = body

        if (!name || !email || !contact) {
            return NextResponse.json({ error: 'Missing required fields: name, email, contact' }, { status: 400 })
        }

        // Step 1: Create or get Razorpay Customer
        let customerId = profileData.razorpay_customer_id

        if (!customerId) {
            const customer = await createCustomer({ name, email, contact })
            customerId = customer.id

            // Save customer ID
            await adminClient
                .from('profiles')
                .update({ razorpay_customer_id: customerId } as never)
                .eq('id', user.id)
        }

        // Step 2: Create Subscription (Mandate)
        const subscription = await createSubscription({
            customerId,
            notes: {
                founder_id: user.id,
                type: 'metered_billing',
            },
        })

        // Step 3: Save subscription ID and status
        await adminClient
            .from('profiles')
            .update({
                razorpay_subscription_id: subscription.id,
                mandate_status: 'pending',
            } as never)
            .eq('id', user.id)

        // Return the short URL for the user to complete authorization
        return NextResponse.json({
            success: true,
            subscriptionId: subscription.id,
            authorizationUrl: subscription.short_url,
            message: 'Please complete mandate authorization',
        })

    } catch (error) {
        console.error('Create mandate error:', error)
        return NextResponse.json({
            error: error instanceof Error ? error.message : 'Failed to create mandate',
        }, { status: 500 })
    }
}

/**
 * GET /api/founders/billing/create-mandate
 * Get current mandate status
 */
export async function GET() {
    try {
        const supabase = await createServerSupabaseClient()
        const { data: { user }, error: authError } = await supabase.auth.getUser()

        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const adminClient = createAdminClient()

        const { data: profile } = await adminClient
            .from('profiles')
            .select('razorpay_subscription_id, mandate_status, unbilled_amount, billing_threshold')
            .eq('id', user.id)
            .single()

        const profileData = profile as {
            razorpay_subscription_id: string | null
            mandate_status: string | null
            unbilled_amount: number
            billing_threshold: number
        } | null

        return NextResponse.json({
            hasMandate: !!profileData?.razorpay_subscription_id,
            mandateStatus: profileData?.mandate_status || null,
            unbilledAmount: profileData?.unbilled_amount || 0,
            billingThreshold: profileData?.billing_threshold || 500000,
        })

    } catch (error) {
        console.error('Get mandate status error:', error)
        return NextResponse.json({ error: 'Failed to get status' }, { status: 500 })
    }
}
