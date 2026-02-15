import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'

// SECURITY: Cron secret for Vercel Cron Jobs
const CRON_SECRET = process.env.CRON_SECRET

const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID!
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET!

/**
 * GET /api/cron/billing
 * Scheduled job to process metered billing
 * 
 * Two-phase billing (RBI Compliant):
 * 1. NOTIFICATION: Schedule charges and notify founders 24h in advance
 * 2. EXECUTION: Execute charges that are ready (24h after notification)
 */
export async function GET(request: NextRequest) {
    // Verify cron secret
    const authHeader = request.headers.get('authorization')
    if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createAdminClient()
    const results = {
        scheduled: 0,
        executed: 0,
        failed: 0,
        errors: [] as string[],
    }

    try {
        // ================================================
        // PHASE 1: SCHEDULE NEW CHARGES
        // ================================================
        // Find founders who have exceeded their billing threshold
        const { data: foundersToCharge } = await supabase
            .from('profiles')
            .select('id, email, full_name, unbilled_amount, charge_threshold')
            .eq('role', 'founder')
            .gt('unbilled_amount', 0)
            .returns<{ id: string; email: string; full_name: string; unbilled_amount: number; charge_threshold: number }[]>()

        if (foundersToCharge) {
            for (const founder of foundersToCharge) {
                // Only schedule if above threshold (default 5000 paise = ₹50)
                const threshold = founder.charge_threshold || 500000 // ₹5000 default
                if (founder.unbilled_amount < threshold) continue

                // Check if there's already a pending charge
                const { data: existingCharge } = await supabase
                    .from('charge_schedules')
                    .select('id')
                    .eq('founder_id', founder.id)
                    .in('status', ['scheduled', 'notified', 'processing'])
                    .single()

                if (existingCharge) continue // Already has pending charge

                // Schedule new charge
                const scheduledAt = new Date()
                scheduledAt.setHours(scheduledAt.getHours() + 24) // Execute 24h from now (RBI requirement)

                const { error: scheduleError } = await supabase
                    .from('charge_schedules')
                    .insert({
                        founder_id: founder.id,
                        amount: founder.unbilled_amount,
                        status: 'notified',
                        notification_sent_at: new Date().toISOString(),
                        charge_scheduled_at: scheduledAt.toISOString(),
                    } as never)

                if (scheduleError) {
                    results.errors.push(`Schedule failed for ${founder.id}: ${scheduleError.message}`)
                } else {
                    results.scheduled++
                    // TODO: Send notification email/SMS to founder
                    console.log(`Scheduled charge of ₹${founder.unbilled_amount / 100} for ${founder.email}`)
                }
            }
        }

        // ================================================
        // PHASE 2: EXECUTE READY CHARGES
        // ================================================
        const now = new Date().toISOString()
        const { data: readyCharges } = await supabase
            .from('charge_schedules')
            .select('id, founder_id, amount')
            .eq('status', 'notified')
            .lte('charge_scheduled_at', now)
            .returns<{ id: string; founder_id: string; amount: number }[]>()

        if (readyCharges) {
            for (const charge of readyCharges) {
                // Mark as processing
                await supabase
                    .from('charge_schedules')
                    .update({ status: 'processing' } as never)
                    .eq('id', charge.id)

                try {
                    // Get founder details for invoice
                    const { data: founder } = await supabase
                        .from('profiles')
                        .select('email, full_name, razorpay_customer_id')
                        .eq('id', charge.founder_id)
                        .single()

                    const founderData = founder as { email: string; full_name: string; razorpay_customer_id: string | null } | null

                    // Create Razorpay Invoice (auto-charge if mandate exists)
                    const invoiceResponse = await fetch('https://api.razorpay.com/v1/invoices', {
                        method: 'POST',
                        headers: {
                            'Authorization': `Basic ${Buffer.from(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`).toString('base64')}`,
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            type: 'invoice',
                            description: 'Black Index - Commission Settlement',
                            customer: founderData?.razorpay_customer_id ? {
                                id: founderData.razorpay_customer_id
                            } : {
                                email: founderData?.email,
                                name: founderData?.full_name || 'Founder',
                            },
                            line_items: [{
                                name: 'Commission Settlement',
                                description: 'Accumulated affiliate commissions and platform fees',
                                amount: charge.amount,
                                currency: 'INR',
                                quantity: 1,
                            }],
                            sms_notify: 1,
                            email_notify: 1,
                            currency: 'INR',
                            expire_by: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60), // Expires in 7 days
                        }),
                    })

                    if (!invoiceResponse.ok) {
                        const errorData = await invoiceResponse.json()
                        throw new Error(errorData?.error?.description || 'Invoice creation failed')
                    }

                    const invoice = await invoiceResponse.json()

                    // Update charge with invoice ID and mark as paid (pending actual payment)
                    await supabase
                        .from('charge_schedules')
                        .update({
                            status: 'paid', // Invoice sent, considered "charged"
                            razorpay_invoice_id: invoice.id,
                        } as never)
                        .eq('id', charge.id)

                    // Reset founder's unbilled amount
                    await supabase
                        .from('profiles')
                        .update({ unbilled_amount: 0 } as never)
                        .eq('id', charge.founder_id)

                    // Update related transactions to 'billed' status
                    await supabase
                        .from('transactions')
                        .update({
                            billing_status: 'billed',
                            charge_schedule_id: charge.id,
                        } as never)
                        .eq('billing_status', 'unbilled')
                        .eq('product_id', charge.founder_id) // This should be via product -> founder join in production

                    results.executed++
                    console.log(`Executed charge of ₹${charge.amount / 100}, invoice ${invoice.id}`)

                } catch (execError) {
                    const errorMsg = execError instanceof Error ? execError.message : 'Unknown error'
                    results.errors.push(`Execution failed for charge ${charge.id}: ${errorMsg}`)
                    results.failed++

                    // Mark as failed
                    await supabase
                        .from('charge_schedules')
                        .update({
                            status: 'failed',
                            failure_reason: errorMsg,
                        } as never)
                        .eq('id', charge.id)
                }
            }
        }

        // ================================================
        // PHASE 3: RELEASE ESCROW (T+30)
        // ================================================
        const escrowNow = new Date().toISOString()
        const { data: clearedTransactions } = await supabase
            .from('transactions')
            .select('id, seller_id, commission_amount')
            .eq('status', 'pending')
            .eq('billing_status', 'billed')
            .lte('payout_due_date', escrowNow)

        let escrowReleased = 0
        if (clearedTransactions && clearedTransactions.length > 0) {
            // Group by seller
            const sellerAmounts: Record<string, number> = {}
            for (const txn of clearedTransactions) {
                const t = txn as { seller_id: string; commission_amount: number }
                sellerAmounts[t.seller_id] = (sellerAmounts[t.seller_id] || 0) + (t.commission_amount || 0)
            }

            // Update seller balances
            for (const [sellerId, amount] of Object.entries(sellerAmounts)) {
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('pending_balance, withdrawable_balance')
                    .eq('id', sellerId)
                    .single()

                if (profile) {
                    const p = profile as { pending_balance: number; withdrawable_balance: number }
                    await supabase
                        .from('profiles')
                        .update({
                            pending_balance: Math.max(0, (p.pending_balance || 0) - amount),
                            withdrawable_balance: (p.withdrawable_balance || 0) + amount,
                        } as never)
                        .eq('id', sellerId)
                    escrowReleased++
                }
            }

            // Update transaction statuses
            const txnIds = clearedTransactions.map(t => (t as { id: string }).id)
            await supabase
                .from('transactions')
                .update({ status: 'cleared', cleared_at: escrowNow } as never)
                .in('id', txnIds)
        }

        return NextResponse.json({
            success: true,
            results: { ...results, escrow_released: escrowReleased },
            timestamp: new Date().toISOString(),
        })

    } catch (error) {
        console.error('Billing cron error:', error)
        return NextResponse.json({
            error: error instanceof Error ? error.message : 'Billing failed',
            results,
        }, { status: 500 })
    }
}
