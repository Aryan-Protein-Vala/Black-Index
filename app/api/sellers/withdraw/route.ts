import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, createAdminClient } from '@/lib/supabase-server'
import { createContact, createFundAccount, createPayout } from '@/lib/razorpay'
import { sendEmail } from '@/lib/email'
import { payoutSentEmail } from '@/lib/email-templates'
import { checkRateLimit } from '@/lib/rate-limit'
import { MINIMUM_WITHDRAWAL, WITHDRAWAL_RATE_LIMIT_PER_MIN } from '@/lib/constants'

/**
 * POST /api/sellers/withdraw
 * Initiate withdrawal of cleared funds to the user's UPI.
 *
 * Fixes vs the old version:
 * - SELL-2: no more `role === 'warlord'` gate — anyone (incl. founders who
 *   earned commissions) can withdraw their own cleared balance
 * - Idempotency: client sends `Idempotency-Key`; double-submit = 409
 * - Rate limit: 1 withdrawal attempt / minute / user
 * - The RazorpayX payout id is stored on the tx row so the payouts webhook
 *   can auto-refund on failure
 */
export async function POST(request: NextRequest) {
    try {
        const supabase = await createServerSupabaseClient()
        const { data: { user }, error: authError } = await supabase.auth.getUser()

        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        if (!(await checkRateLimit(`withdraw:${user.id}`, WITHDRAWAL_RATE_LIMIT_PER_MIN, 60))) {
            return NextResponse.json({ error: 'Slow down — one withdrawal per minute' }, { status: 429 })
        }

        const adminClient = createAdminClient()

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

        const body = await request.json()
        const { amount, upiVpa } = body
        const idempotencyKey = request.headers.get('idempotency-key') || body.idempotency_key || null

        if (!amount || amount < MINIMUM_WITHDRAWAL) {
            return NextResponse.json({
                error: `Minimum withdrawal is ₹${MINIMUM_WITHDRAWAL / 100}`,
            }, { status: 400 })
        }

        if (amount > profileData.withdrawable_balance) {
            return NextResponse.json({
                error: 'Insufficient withdrawable balance',
                available: profileData.withdrawable_balance,
            }, { status: 400 })
        }

        if (!idempotencyKey) {
            return NextResponse.json({ error: 'Idempotency-Key header is required' }, { status: 400 })
        }

        // Idempotency: this exact request already processed?
        const wdRef = `wd:${user.id}:${idempotencyKey}`
        const { data: existing } = await adminClient
            .from('transactions')
            .select('id, provider_payout_id, created_at')
            .eq('external_transaction_id', wdRef)
            .maybeSingle()
        if (existing) {
            return NextResponse.json({
                error: 'This withdrawal was already submitted',
                transaction_id: (existing as any).id,
                payout_id: (existing as any).provider_payout_id,
            }, { status: 409 })
        }

        // Get or create fund account
        let fundAccountId = profileData.razorpay_fund_account_id
        const vpa = upiVpa || profileData.upi_vpa

        if (!vpa) {
            return NextResponse.json({
                error: 'Please provide your UPI VPA (e.g., username@upi)',
            }, { status: 400 })
        }

        if (!/^[a-zA-Z0-9._-]{2,}@[a-zA-Z]{2,}$/.test(vpa)) {
            return NextResponse.json({ error: 'Invalid UPI VPA format' }, { status: 400 })
        }

        if (!fundAccountId) {
            const contact = await createContact({
                name: profileData.full_name || 'Seller',
                email: user.email || '',
                contact: '',
                type: 'vendor',
                referenceId: user.id,
            })

            const fundAccount = await createFundAccount({
                contactId: contact.id,
                upiVpa: vpa,
            })

            fundAccountId = fundAccount.id

            await adminClient
                .from('profiles')
                .update({
                    razorpay_fund_account_id: fundAccountId,
                    upi_vpa: vpa,
                } as never)
                .eq('id', user.id)
        }

        // STEP 1: Atomically deduct balance AND create 'processing' transaction
        const txExternalId = wdRef || `wd:${user.id}:${Date.now()}`
        const { data: transactionId, error: rpcError } = await adminClient.rpc('initiate_withdrawal_atomic' as never, {
            p_seller_id: user.id,
            p_amount: amount,
            p_external_tx_id: txExternalId
        } as never)

        if (rpcError) {
            return NextResponse.json({
                error: 'Withdrawal failed — insufficient balance or processing error',
            }, { status: 409 })
        }

        // STEP 2: Create payout via RazorpayX
        let payout
        try {
            payout = await createPayout({
                fundAccountId,
                amount,
                purpose: 'payout',
                referenceId: txExternalId, // Tie directly to our internal ref
            })
        } catch (payoutError) {
            console.error('Payout creation failed, restoring balance:', payoutError)
            
            // Restore balance and mark transaction as failed
            await adminClient.rpc('process_payout', {
                p_seller_id: user.id,
                p_amount: -amount // process_payout subtracts, so negative restores it
            })

            await adminClient
                .from('transactions')
                .update({ status: 'failed' } as never)
                .eq('id', transactionId as string)

            return NextResponse.json({
                error: 'Payout creation failed. Balance has been restored.',
            }, { status: 500 })
        }

        // STEP 3: Update transaction to 'paid' with provider info
        const { error: txUpdateError } = await adminClient
            .from('transactions')
            .update({
                status: 'paid',
                provider_payout_id: payout.id,
            } as never)
            .eq('id', transactionId as string)

        if (txUpdateError) {
            console.error('Failed to update transaction after successful payout', txUpdateError)
            // We don't return error here because the payout actually succeeded. 
            // The RazorpayX webhook will eventually true it up if needed.
        }

        // STEP 4: Confirmation email (template existed; was never wired)
        if (user.email) {
            try {
                await sendEmail({
                    to: user.email,
                    subject: `Payout initiated: ₹${(amount / 100).toLocaleString('en-IN')}`,
                    html: payoutSentEmail(profileData.full_name || '', amount),
                })
            } catch (e) {
                console.error('Payout email failed (non-fatal):', e)
            }
        }

        const newBalance = profileData.withdrawable_balance - amount

        return NextResponse.json({
            success: true,
            payoutId: payout.id,
            amount,
            status: payout.status,
            newBalance,
            message: 'Withdrawal initiated successfully. If it fails, your balance is restored automatically.',
        })

    } catch (error) {
        console.error('Withdraw error:', error)
        return NextResponse.json({
            error: error instanceof Error ? error.message : 'Withdrawal failed',
        }, { status: 500 })
    }
}

/**
 * GET /api/sellers/withdraw — eligibility + balance info
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
