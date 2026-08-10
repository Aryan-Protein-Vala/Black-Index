import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'
import { sendEmail } from '@/lib/email'
import { escrowReleasedEmail } from '@/lib/email-templates'

/**
 * Escrow Release Cron Job
 * POST /api/cron/release-escrow
 * 
 * Runs daily to move funds from pending → withdrawable after T+30 escrow period.
 * 
 * Vercel Cron: Every day at 6 AM IST
 * cron: "30 0 * * *"
 */

export async function GET(request: NextRequest) {
    // Verify cron secret
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createAdminClient()
    const now = new Date().toISOString()

    console.log('[ESCROW RELEASE] Starting cron job at', now)

    try {
        // ================================================
        // STEP 1: Find transactions ready for release
        // ================================================
        const { data: clearedTransactions, error: fetchError } = await supabase
            .from('transactions')
            .select('id, seller_id, commission_amount, product_id')
            .eq('status', 'pending')
            .eq('billing_status', 'billed')
            .lte('payout_due_date', now)

        if (fetchError) {
            console.error('[ESCROW RELEASE] Failed to fetch transactions:', fetchError)
            return NextResponse.json({ error: 'Failed to fetch transactions' }, { status: 500 })
        }

        if (!clearedTransactions || clearedTransactions.length === 0) {
            console.log('[ESCROW RELEASE] No transactions ready for release')
            return NextResponse.json({ 
                message: 'No transactions to release',
                released: 0
            })
        }

        console.log('[ESCROW RELEASE] Found', clearedTransactions.length, 'transactions to release')

        // ================================================
        // STEP 3: Process transactions atomically
        // ================================================
        let successCount = 0
        let totalReleased = 0

        for (const txn of clearedTransactions as any[]) {
            try {
                // Call atomic RPC: updates transaction status AND credits seller wallet inside a single lock
                const { error: rpcError } = await supabase.rpc('release_transaction_escrow' as never, {
                    p_transaction_id: txn.id
                } as never)

                if (rpcError) {
                    console.error('[ESCROW RELEASE] RPC failed for transaction', txn.id, rpcError.message)
                    continue
                }

                successCount++
                totalReleased += (txn.commission_amount || 0)
                console.log('[ESCROW RELEASE] Released ₹', (txn.commission_amount || 0) / 100, 'for seller', txn.seller_id)

                // Optional: Send email notification. We might group emails per seller later, 
                // but for now, we'll send it per transaction or skip to avoid spam.
                // We'll skip sending an email for every transaction here to avoid spamming the seller, 
                // or we could aggregate them. Let's aggregate for emails.
            } catch (err) {
                console.error('[ESCROW RELEASE] Error processing transaction', txn.id, err)
            }
        }

        console.log('[ESCROW RELEASE] Completed:', {
            transactions: successCount,
            totalReleased: totalReleased / 100 // Convert paise to rupees
        })

        return NextResponse.json({
            success: true,
            message: 'Escrow release completed',
            sellers_updated: successCount,
            transactions_cleared: successCount,
            total_released: totalReleased / 100 // ₹
        })

    } catch (error) {
        console.error('[ESCROW RELEASE] Cron job failed:', error)
        return NextResponse.json({
            error: error instanceof Error ? error.message : 'Internal error'
        }, { status: 500 })
    }
}

// Also support POST for manual triggers
export async function POST(request: NextRequest) {
    return GET(request)
}
