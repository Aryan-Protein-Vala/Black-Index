import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, createAdminClient } from '@/lib/supabase-server'
import { processConversion } from '@/lib/webhook-processor'
import { checkRateLimit } from '@/lib/rate-limit'
import crypto from 'crypto'

/**
 * POST /api/products/[id]/simulate-sale
 *
 * THE GAUNTLET, LEVEL 1 — Synthetic sale. Owner-only, rate-limited.
 *
 * Fires a ₹1 payload through the REAL processConversion money path
 * (customer upsert → commission math → wallet debit → escrow credit →
 * fee ledger), asserts every effect happened, then fully REVERSES it
 * (balances restored, ledger rows + tx + customer rows deleted).
 *
 * Proves the entire downstream pipe without real money and without the
 * provider needing to cooperate. L0 = handshake, L1 = this, L2 = real ₹1.
 */
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id: productId } = await params
    const supabase = await createServerSupabaseClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!(await checkRateLimit(`simulate:${productId}`, 3, 3600))) {
        return NextResponse.json({ error: 'Simulation limit reached (3/hour per product)' }, { status: 429 })
    }

    const admin = createAdminClient()

    // Ownership
    const { data: product, error: productError } = await admin
        .from('products')
        .select('id, founder_id, name')
        .eq('id', productId)
        .single()

    if (productError || !product) {
        return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }
    if ((product as { founder_id: string }).founder_id !== user.id) {
        return NextResponse.json({ error: 'Not your product' }, { status: 403 })
    }

    // Pre-state balances for reversal
    const { data: founderBefore } = await admin
        .from('profiles')
        .select('wallet_balance')
        .eq('id', user.id)
        .single()

    // Find or create the hidden simulation link (seller = founder themselves)
    const simSlug = `sim-${crypto.randomBytes(4).toString('hex')}`
    const { data: simLink, error: linkError } = await admin
        .from('links')
        .insert({ seller_id: user.id, product_id: productId, slug: simSlug } as never)
        .select('id')
        .single()

    if (linkError || !simLink) {
        return NextResponse.json({ error: 'Failed to create simulation link' }, { status: 500 })
    }
    const simLinkId = (simLink as { id: string }).id

    const sim = {
        txId: `sim_tx_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
        customer: `sim_${crypto.randomBytes(3).toString('hex')}@sim.blackindex.local`,
        amount: 100, // ₹1
    }

    // ---- FIRE THROUGH THE REAL PATH ----
    const result = await processConversion({
        productId,
        refId: simLinkId,
        externalCustomerId: sim.customer,
        externalTransactionId: sim.txId,
        amount: sim.amount,
        customerEmail: sim.customer,
        provider: 'custom',
        rawPayload: { simulated: true, amount: sim.amount },
        currency: 'INR',
        amountMinor: sim.amount,
        fxRate: 1,
    }, { isTest: true })

    // ---- ASSERTIONS ----
    const checks: Record<string, { passed: boolean; detail?: string }> = {}

    checks.conversion_received = {
        passed: result.success,
        detail: result.success ? 'Money path executed' : result.message,
    }

    const { data: txRow } = result.transactionId
        ? await admin.from('transactions').select('id, billing_status, commission_amount').eq('id', result.transactionId).single()
        : { data: null as any }

    checks.transaction_row = {
        passed: !!txRow,
        detail: txRow ? `tx created, billing_status=${txRow.billing_status}` : 'no transaction row',
    }

    const { data: customerRow } = await admin
        .from('customers')
        .select('id, billing_count')
        .eq('product_id', productId)
        .eq('external_customer_id', sim.customer)
        .maybeSingle()
    checks.customer_tracked = { passed: !!customerRow, detail: customerRow ? 'customer row + billing_count created' : 'no customer row' }

    const billingStatus = result._internal?.billingStatus
    if (billingStatus === 'billed') {
        const { data: founderAfter } = await admin
            .from('profiles')
            .select('wallet_balance')
            .eq('id', user.id)
            .single()
        checks.wallet_debited = {
            passed:
                (founderAfter as any)?.wallet_balance ===
                (founderBefore as any)?.wallet_balance - (result._internal?.grossCommission || 0),
            detail: 'founder wallet debited exact gross commission',
        }
        const { data: feeRow } = await admin
            .from('platform_revenue')
            .select('id')
            .eq('transaction_id', result.transactionId!)
            .maybeSingle()
        checks.fee_ledger = { passed: !!feeRow, detail: 'platform fee row written' }
    } else {
        checks.wallet_debited = {
            passed: billingStatus === 'wallet_insufficient',
            detail: 'wallet empty — sale correctly queued as wallet_insufficient (top up and queued sellers get paid)',
        }
        checks.fee_ledger = { passed: true, detail: 'n/a — no money moved' }
    }

    // ---- FULL REVERSAL ----
    const reversalSteps: string[] = []
    try {
        if (billingStatus === 'billed' && result._internal) {
            const gross = result._internal.grossCommission
            const net = result._internal.netCommission
            if (gross > 0) {
                await admin
                    .from('profiles')
                    .update({ wallet_balance: (founderBefore as any)?.wallet_balance } as never)
                    .eq('id', user.id)
                reversalSteps.push('wallet restored')
            }
            if (net > 0) {
                const { data: sellerRow } = await admin
                    .from('profiles')
                    .select('pending_balance, total_earnings')
                    .eq('id', user.id)
                    .single()
                await admin
                    .from('profiles')
                    .update({
                        pending_balance: Math.max(0, ((sellerRow as any)?.pending_balance || 0) - net),
                        total_earnings: Math.max(0, ((sellerRow as any)?.total_earnings || 0) - net),
                    } as never)
                    .eq('id', user.id)
                reversalSteps.push('escrow restored')
            }
            await admin.from('platform_revenue').delete().eq('transaction_id', result.transactionId!)
            reversalSteps.push('fee ledger cleaned')
        }
        if (result.transactionId) {
            await admin.from('transactions').delete().eq('id', result.transactionId)
            reversalSteps.push('tx removed')
        }
        if (customerRow) {
            await admin.from('customers').delete().eq('id', (customerRow as any).id)
            reversalSteps.push('customer row removed')
        }
        // Clean sim echoes: the sim link itself (notifications from the sim
        // may already be delivered — acceptable, they're clearly test-shaped)
        await admin.from('links').delete().eq('id', simLinkId)
        reversalSteps.push('sim link removed')
    } catch (revErr) {
        console.error('[SIMULATE] Reversal incomplete:', revErr)
        checks.reversal = { passed: false, detail: `partial: ${reversalSteps.join(', ')}` }
    }
    if (!('reversal' in checks)) {
        checks.reversal = { passed: true, detail: reversalSteps.join(', ') || 'nothing to reverse' }
    }

    await admin.from('webhook_logs').insert({
        product_id: productId,
        event_type: 'simulated_sale',
        payload: { checks, sim },
        status: 'test',
        error_message: null,
        ip_address: 'simulate-sale',
    } as never)

    const allPassed = Object.values(checks).every(c => c.passed)

    return NextResponse.json({
        success: allPassed,
        level: 'L1',
        message: allPassed
            ? 'Simulation passed: the full money path works for this product. Next: run the real ₹1 certification.'
            : 'Simulation found issues — see checks.',
        checks,
    })
}
