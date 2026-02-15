import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'

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
        // STEP 2: Group by seller for batch updates
        // ================================================
        const sellerAmounts: Record<string, number> = {}
        
        for (const txn of clearedTransactions) {
            const sellerId = txn.seller_id
            const amount = txn.commission_amount || 0
            sellerAmounts[sellerId] = (sellerAmounts[sellerId] || 0) + amount
        }

        // ================================================
        // STEP 3: Update each seller's balance
        // ================================================
        let successCount = 0
        let totalReleased = 0

        for (const [sellerId, amount] of Object.entries(sellerAmounts)) {
            try {
                // Get current balances
                const { data: profile, error: profileError } = await supabase
                    .from('profiles')
                    .select('pending_balance, withdrawable_balance')
                    .eq('id', sellerId)
                    .single()

                if (profileError || !profile) {
                    console.error('[ESCROW RELEASE] Failed to get profile for', sellerId)
                    continue
                }

                const typedProfile = profile as { pending_balance: number; withdrawable_balance: number }

                // Move from pending to withdrawable
                const { error: updateError } = await supabase
                    .from('profiles')
                    .update({
                        pending_balance: Math.max(0, (typedProfile.pending_balance || 0) - amount),
                        withdrawable_balance: (typedProfile.withdrawable_balance || 0) + amount,
                    } as never)
                    .eq('id', sellerId)

                if (updateError) {
                    console.error('[ESCROW RELEASE] Failed to update balance for', sellerId, updateError)
                    continue
                }

                successCount++
                totalReleased += amount
                console.log('[ESCROW RELEASE] Released ₹', amount / 100, 'for seller', sellerId)
            } catch (err) {
                console.error('[ESCROW RELEASE] Error updating seller', sellerId, err)
            }
        }

        // ================================================
        // STEP 4: Update transaction statuses
        // ================================================
        const transactionIds = clearedTransactions.map(t => t.id)
        
        const { error: txUpdateError } = await supabase
            .from('transactions')
            .update({ 
                status: 'cleared',
                cleared_at: now 
            } as never)
            .in('id', transactionIds)

        if (txUpdateError) {
            console.error('[ESCROW RELEASE] Failed to update transaction statuses:', txUpdateError)
        }

        console.log('[ESCROW RELEASE] Completed:', {
            sellers: successCount,
            transactions: transactionIds.length,
            totalReleased: totalReleased / 100 // Convert paise to rupees
        })

        return NextResponse.json({
            success: true,
            message: 'Escrow release completed',
            sellers_updated: successCount,
            transactions_cleared: transactionIds.length,
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
