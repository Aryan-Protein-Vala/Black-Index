import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'

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
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
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
                    // Get founder details for settlement
                    const { data: founder } = await supabase
                        .from('profiles')
                        .select('email, full_name, razorpay_customer_id, wallet_balance')
                        .eq('id', charge.founder_id)
                        .single()

                    const founderData = founder as { email: string; full_name: string; razorpay_customer_id: string | null; wallet_balance: number } | null

                    // SETTLEMENT LOGIC
                    // Fallback to Wallet Deduction if Razorpay Customer ID is missing
                    if (!founderData?.razorpay_customer_id) {
                        const currentBalance = founderData?.wallet_balance || 0
                        
                        if (currentBalance >= charge.amount) {
                            // Sufficient funds in wallet - Atomic deduction to prevent race conditions
                            const { error: deductError } = await supabase
                                .from('profiles')
                                .update({
                                    wallet_balance: currentBalance - charge.amount,
                                    unbilled_amount: 0,
                                    last_charge_date: new Date().toISOString()
                                } as never)
                                .eq('id', charge.founder_id)
                                .gte('wallet_balance', charge.amount) // Atomic: only deduct if still sufficient

                            if (deductError) {
                                throw new Error('Wallet balance changed during deduction (concurrent update)')
                            }

                            await supabase
                                .from('charge_schedules')
                                .update({
                                    status: 'paid',
                                    payment_method: 'wallet'
                                } as never)
                                .eq('id', charge.id)

                            results.executed++
                            continue // Move to next charge
                        } else {
                            throw new Error('Insufficient wallet balance for settlement')
                        }
                    }

                    // Otherwise, Proceed with Razorpay Invoice (Auto-charge if mandate exists)
                    const invoiceResponse = await fetch('https://api.razorpay.com/v1/invoices', {
                        method: 'POST',
                        headers: {
                            'Authorization': `Basic ${Buffer.from(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`).toString('base64')}`,
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            type: 'invoice',
                            description: 'Black Index - Commission Settlement',
                            customer: {
                                id: founderData.razorpay_customer_id
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
                            expire_by: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60),
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
                            payment_method: 'razorpay_invoice'
                        } as never)
                        .eq('id', charge.id)

                    // Reset founder's unbilled amount
                    await supabase
                        .from('profiles')
                        .update({ unbilled_amount: 0 } as never)
                        .eq('id', charge.founder_id)

                        // Update related transactions to 'billed' status
                        // Join through products table to find transactions for this founder's products
                        const { data: founderProducts } = await supabase
                            .from('products')
                            .select('id')
                            .eq('founder_id', charge.founder_id)

                        if (founderProducts && founderProducts.length > 0) {
                            const productIds = founderProducts.map((p: any) => p.id)
                            await supabase
                                .from('transactions')
                                .update({
                                    billing_status: 'billed',
                                    charge_schedule_id: charge.id,
                                } as never)
                                .eq('billing_status', 'unbilled')
                                .in('product_id', productIds)
                        }

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

        // NOTE: Escrow release is handled by the dedicated /api/cron/release-escrow cron job.
        // Do NOT duplicate it here.

        return NextResponse.json({
            success: true,
            results,
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
