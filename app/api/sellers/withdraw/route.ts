import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, createAdminClient } from '@/lib/supabase-server'
import { createContact, createFundAccount, createPayout } from '@/lib/razorpay'

const MINIMUM_WITHDRAWAL = 100000 // ₹1,000 in paise

/**
 * POST /api/sellers/withdraw
 * Initiate withdrawal of cleared funds to seller's UPI
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

        // Get seller profile
        const { data: profile, error: profileError } = await adminClient
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single()

        if (profileError || !profile) {
            return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
        }

        const profileData = profile as {
            id: string
            role: string
            full_name: string | null
            withdrawable_balance: number
            razorpay_fund_account_id: string | null
            upi_vpa: string | null
        }

        // Verify user is a warlord (seller)
        if (profileData.role !== 'warlord') {
            return NextResponse.json({ error: 'Only Warlords can withdraw' }, { status: 403 })
        }

        const body = await request.json()
        const { amount, upiVpa } = body

        // Validate amount
        if (!amount || amount < MINIMUM_WITHDRAWAL) {
            return NextResponse.json({
                error: `Minimum withdrawal is ₹${MINIMUM_WITHDRAWAL / 100}`,
            }, { status: 400 })
        }

        // Check sufficient balance
        if (amount > profileData.withdrawable_balance) {
            return NextResponse.json({
                error: 'Insufficient withdrawable balance',
                available: profileData.withdrawable_balance,
            }, { status: 400 })
        }

        // Get or create fund account
        let fundAccountId = profileData.razorpay_fund_account_id
        const vpa = upiVpa || profileData.upi_vpa

        if (!vpa) {
            return NextResponse.json({
                error: 'Please provide your UPI VPA (e.g., username@upi)',
            }, { status: 400 })
        }

        // Create RazorpayX contact and fund account if not exists
        if (!fundAccountId) {
            // First create a contact
            const contact = await createContact({
                name: profileData.full_name || 'Warlord',
                email: user.email || '',
                contact: '', // Would need phone number
                type: 'vendor',
                referenceId: user.id,
            })

            // Then create fund account
            const fundAccount = await createFundAccount({
                contactId: contact.id,
                upiVpa: vpa,
            })

            fundAccountId = fundAccount.id

            // Save fund account ID and UPI VPA
            await adminClient
                .from('profiles')
                .update({
                    razorpay_fund_account_id: fundAccountId,
                    upi_vpa: vpa,
                } as never)
                .eq('id', user.id)
        }

        // STEP 1: Atomically deduct balance BEFORE initiating payout
        // This prevents double-spend if concurrent withdrawals are attempted
        const { data: payoutResult, error: rpcError } = await adminClient.rpc('process_payout' as any, {
            p_seller_id: user.id,
            p_amount: amount,
        } as any)

        if (rpcError || payoutResult === false) {
            // Fallback: try direct deduction with guard
            const { error: deductError } = await adminClient
                .from('profiles')
                .update({
                    withdrawable_balance: profileData.withdrawable_balance - amount,
                } as never)
                .eq('id', user.id)
                .gte('withdrawable_balance', amount) // Guard: only deduct if still sufficient

            if (deductError) {
                return NextResponse.json({
                    error: 'Withdrawal failed — balance may have changed',
                }, { status: 409 })
            }
        }

        // STEP 2: Create payout via RazorpayX
        let payout
        try {
            payout = await createPayout({
                fundAccountId,
                amount,
                purpose: 'payout',
                referenceId: `withdrawal_${user.id}_${Date.now()}`,
            })
        } catch (payoutError) {
            // Payout failed — RESTORE the balance
            console.error('Payout creation failed, restoring balance:', payoutError)
            await adminClient
                .from('profiles')
                .update({
                    withdrawable_balance: profileData.withdrawable_balance,
                } as never)
                .eq('id', user.id)

            return NextResponse.json({
                error: 'Payout creation failed. Balance has been restored.',
            }, { status: 500 })
        }

        const newBalance = profileData.withdrawable_balance - amount

        // STEP 3: Create transaction record
        await adminClient
            .from('transactions')
            .insert({
                type: 'payout',
                status: 'paid',
                seller_id: user.id,
                sale_amount: amount,
                commission_amount: amount,
                platform_fee: 0,
            } as never)

        return NextResponse.json({
            success: true,
            payoutId: payout.id,
            amount,
            status: payout.status,
            newBalance,
            message: 'Withdrawal initiated successfully',
        })

    } catch (error) {
        console.error('Withdraw error:', error)
        return NextResponse.json({
            error: error instanceof Error ? error.message : 'Withdrawal failed',
        }, { status: 500 })
    }
}

/**
 * GET /api/sellers/withdraw
 * Get withdrawal eligibility and balance info
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
            .select('withdrawable_balance, pending_balance, upi_vpa, razorpay_fund_account_id')
            .eq('id', user.id)
            .single()

        const profileData = profile as {
            withdrawable_balance: number
            pending_balance: number
            upi_vpa: string | null
            razorpay_fund_account_id: string | null
        } | null

        return NextResponse.json({
            withdrawableBalance: profileData?.withdrawable_balance || 0,
            pendingBalance: profileData?.pending_balance || 0,
            minimumWithdrawal: MINIMUM_WITHDRAWAL,
            canWithdraw: (profileData?.withdrawable_balance || 0) >= MINIMUM_WITHDRAWAL,
            hasUpi: !!profileData?.upi_vpa,
            hasFundAccount: !!profileData?.razorpay_fund_account_id,
        })

    } catch (error) {
        console.error('Get withdraw status error:', error)
        return NextResponse.json({ error: 'Failed to get status' }, { status: 500 })
    }
}
