import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'
import { sendEmail } from '@/lib/email'

/**
 * Nightly Ledger Reconciliation Cron
 * GET /api/cron/reconcile
 *
 * Runs the money-invariant checks. If ANY of these fails you have a ledger
 * drift — alert the admin immediately; this is how you sleep at night.
 *
 * Checks:
 * 1. No negative balances (pending / withdrawable / wallet) — unless a
 *    refund clawback legitimately drove pending negative (flag for review).
 * 2. Fee ledger consistency: Σ platform_revenue.amount vs Σ fee on billed sales.
 * 3. Stale escrow: 'pending' + billed txs older than 45 days (escrow is T+30
 *    — anything much older is stuck).
 * 4. Queued wallet_insufficient sales older than 7 days (founder never topped up).
 */
export async function GET(request: NextRequest) {
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createAdminClient()
    const violations: string[] = []

    try {
        // ---- Check 1: negative balances ----
        const { data: negative } = await supabase
            .from('profiles')
            .select('id, email, pending_balance, withdrawable_balance, wallet_balance')
            .or('pending_balance.lt.0,withdrawable_balance.lt.0,wallet_balance.lt.0')

        for (const p of (negative as any[]) || []) {
            violations.push(
                `NEGATIVE BALANCE: ${p.email || p.id} — pending=${p.pending_balance}, withdrawable=${p.withdrawable_balance}, wallet=${p.wallet_balance}`
            )
        }

        // ---- Check 2: fee ledger consistency ----
        const { data: feeRows } = await supabase
            .from('platform_revenue')
            .select('amount')
        const ledgerSum = ((feeRows as any[]) || []).reduce((s, r) => s + (r.amount || 0), 0)

        const { data: billedTx } = await supabase
            .from('transactions')
            .select('platform_fee')
            .eq('type', 'sale')
            .neq('billing_status', 'wallet_insufficient')
        const txFeeSum = ((billedTx as any[]) || []).reduce((s, r) => s + (r.platform_fee || 0), 0)

        // Refunds subtract via negative ledger rows; original fee rows remain on tx.
        // Drift beyond ₹1 (100 paise) = something is double-booking or missing.
        const { data: refundTx } = await supabase
            .from('transactions')
            .select('platform_fee')
            .eq('type', 'refund')
        const refundFeeSum = ((refundTx as any[]) || []).reduce((s, r) => s + Math.abs(r.platform_fee || 0), 0)

        const expected = txFeeSum - refundFeeSum
        if (Math.abs(ledgerSum - expected) > 100) {
            violations.push(`FEE LEDGER DRIFT: platform_revenue Σ=${ledgerSum} paise vs expected Σ=${expected} paise (sales ${txFeeSum} − refunds ${refundFeeSum})`)
        }

        // ---- Check 3: stale escrow ----
        const staleDate = new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString()
        const { count: staleEscrow } = await supabase
            .from('transactions')
            .select('*', { count: 'exact', head: true })
            .eq('type', 'sale')
            .eq('status', 'pending')
            .eq('billing_status', 'billed')
            .lt('payout_due_date', staleDate)

        if (staleEscrow && staleEscrow > 0) {
            violations.push(`STALE ESCROW: ${staleEscrow} billed sales pending >45 days (escrow is T+30) — release cron may be broken`)
        }

        // ---- Check 4: old queued sales ----
        const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
        const { count: oldQueued } = await supabase
            .from('transactions')
            .select('*', { count: 'exact', head: true })
            .eq('billing_status', 'wallet_insufficient')
            .lt('created_at', weekAgo)

        if (oldQueued && oldQueued > 0) {
            violations.push(`UNSETTLED QUEUE: ${oldQueued} sales queued >7 days — sellers unpaid, founders unreachable`)
        }

        // ---- Check 5: refresh trust_tier column from live stats ----
        // The badge endpoint computes tiers on the fly from product_trust_stats;
        // this keeps the stored column fresh for fast reads (founder dashboard).
        let tierUpdated = 0
        try {
            const { data: stats } = await supabase
                .from('product_trust_stats' as never)
                .select('product_id, tier')

            for (const s of (stats as any[]) || []) {
                if (!s?.product_id) continue
                const { error: tierErr } = await supabase
                    .from('products')
                    .update({ trust_tier: s.tier } as never)
                    .eq('id', s.product_id)
                if (!tierErr) tierUpdated++
            }
        } catch (tierErr) {
            console.error('[RECONCILE] trust-tier refresh failed (non-fatal):', tierErr)
        }

        console.log('[RECONCILE] complete', { violations: violations.length, tiers_refreshed: tierUpdated })

        if (violations.length > 0) {
            const adminEmails = (process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim()).filter(Boolean)
            for (const to of adminEmails) {
                await sendEmail({
                    to,
                    subject: `🚨 BlackIndex ledger drift: ${violations.length} violation(s)`,
                    html: `<h3>Nightly reconciliation found issues:</h3><ul>${violations.map(v => `<li><code>${v}</code></li>`).join('')}</ul>`,
                })
            }
        }

        return NextResponse.json({
            ok: violations.length === 0,
            violations,
            ledger_sum_paise: ledgerSum,
            expected_sum_paise: expected,
        })

    } catch (error) {
        console.error('[RECONCILE] failed:', error)
        return NextResponse.json({ error: 'Reconciliation failed' }, { status: 500 })
    }
}

export async function POST(request: NextRequest) {
    return GET(request)
}
