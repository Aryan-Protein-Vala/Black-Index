import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'
import { createInvoice } from '@/lib/razorpay'

/**
 * POST /api/cron/execute-charges
 * 
 * Cron job to execute scheduled charges after 24h notification period (RBI compliance)
 * Should be called hourly via Vercel Cron or similar
 * 
 * Security: Uses CRON_SECRET for authentication
 */
export async function POST(request: NextRequest) {
    try {
        // Verify cron secret
        const authHeader = request.headers.get('authorization')
        if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const supabase = createAdminClient()
        const now = new Date().toISOString()

        // Find charges that are ready to execute
        const { data: charges, error: chargesError } = await supabase
            .from('charges')
            .select('*')
            .eq('status', 'notified')
            .lte('scheduled_execution_at', now)

        if (chargesError) {
            console.error('Failed to fetch charges:', chargesError)
            return NextResponse.json({ error: 'Failed to fetch charges' }, { status: 500 })
        }

        if (!charges || charges.length === 0) {
            return NextResponse.json({ message: 'No charges to execute', processed: 0 })
        }

        const results = {
            processed: 0,
            successful: 0,
            failed: 0,
            errors: [] as string[],
        }

        for (const chargeRow of charges) {
            const charge = chargeRow as {
                id: string
                founder_id: string
                amount: number
                status: string
            }

            try {
                // Mark as processing
                await supabase
                    .from('charges')
                    .update({ status: 'processing' } as never)
                    .eq('id', charge.id)

                // Get founder's Razorpay subscription ID
                const { data: founder } = await supabase
                    .from('profiles')
                    .select('razorpay_subscription_id, full_name, unbilled_amount')
                    .eq('id', charge.founder_id)
                    .single()

                const founderData = founder as {
                    razorpay_subscription_id: string | null
                    full_name: string | null
                    unbilled_amount: number
                } | null

                if (!founderData?.razorpay_subscription_id) {
                    throw new Error('No mandate found for founder')
                }

                // Create Razorpay Invoice (this triggers the actual debit)
                const invoice = await createInvoice({
                    subscriptionId: founderData.razorpay_subscription_id,
                    amount: charge.amount,
                    description: `Commission settlement for ${founderData.full_name || 'Founder'}`,
                })

                // Update charge with success
                await supabase
                    .from('charges')
                    .update({
                        status: 'paid',
                        razorpay_invoice_id: invoice.id,
                        razorpay_payment_id: invoice.payment_id,
                    } as never)
                    .eq('id', charge.id)

                // Reset founder's unbilled amount
                await supabase
                    .from('profiles')
                    .update({
                        unbilled_amount: 0,
                        last_charge_date: new Date().toISOString(),
                    } as never)
                    .eq('id', charge.founder_id)

                // Update related transactions to "pending" (escrow start)
                // These are transactions that were 'unbilled' and now become 'pending'
                await supabase
                    .from('transactions')
                    .update({
                        charge_id: charge.id,
                        status: 'pending',
                    } as never)
                    .eq('status', 'unbilled')
                    .eq('product_id', charge.founder_id) // This needs to be product-based

                results.successful++

            } catch (error) {
                console.error(`Failed to process charge ${charge.id}:`, error)

                // Mark charge as failed
                await supabase
                    .from('charges')
                    .update({
                        status: 'failed',
                        failure_reason: error instanceof Error ? error.message : 'Unknown error',
                    } as never)
                    .eq('id', charge.id)

                // Pause founder's products as safety mechanism
                await supabase
                    .from('products')
                    .update({ is_active: false } as never)
                    .eq('founder_id', charge.founder_id)

                // Update mandate status
                await supabase
                    .from('profiles')
                    .update({ mandate_status: 'failed' } as never)
                    .eq('id', charge.founder_id)

                results.failed++
                results.errors.push(`Charge ${charge.id}: ${error instanceof Error ? error.message : 'Unknown error'}`)
            }

            results.processed++
        }

        return NextResponse.json({
            message: 'Charge execution complete',
            ...results,
        })

    } catch (error) {
        console.error('Cron job error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}

// Also allow GET for manual testing (with same auth)
export async function GET(request: NextRequest) {
    return POST(request)
}
