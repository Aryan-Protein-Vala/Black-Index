import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'
import { requireAdmin } from '@/lib/admin'

/**
 * POST /api/admin/transactions
 * Admin money actions on transactions:
 *   - release_escrow: manually release a pending billed tx to the seller
 *   - mark_refunded:  admin refund (claw back, re-credit founder, fee ledger)
 *
 * Both are idempotent (guarded by tx status) and logged to admin_actions.
 */
export async function POST(request: NextRequest) {
    const auth = await requireAdmin()
    if (!auth.ok) return auth.response
    const adminId = auth.userId

    const supabase = createAdminClient()
    const body = await request.json()
    const { action, transactionId } = body

    if (!transactionId) {
        return NextResponse.json({ error: 'transactionId required' }, { status: 400 })
    }

    try {
        const { data: tx } = await supabase
            .from('transactions')
            .select('id, type, status, billing_status, seller_id, commission_amount, platform_fee, product_id')
            .eq('id', transactionId)
            .single()

        const t = tx as any
        if (!t) return NextResponse.json({ error: 'Transaction not found' }, { status: 404 })
        if (t.type !== 'sale') return NextResponse.json({ error: 'Only sale transactions can be released/refunded' }, { status: 400 })

        if (action === 'release_escrow') {
            if (t.status === 'cleared' || t.status === 'paid' || t.status === 'refunded') {
                return NextResponse.json({ error: `Transaction already ${t.status}` }, { status: 409 })
            }
            if (t.billing_status !== 'billed') {
                return NextResponse.json({ error: 'Transaction was never billed — nothing to release' }, { status: 400 })
            }

            const { error: rpcError } = await supabase.rpc('release_cleared_funds' as never, {
                p_seller_id: t.seller_id,
                p_amount: t.commission_amount,
            } as never)
            if (rpcError) throw rpcError

            await supabase.from('transactions').update({
                status: 'cleared',
                cleared_at: new Date().toISOString(),
            } as never).eq('id', transactionId)

            await supabase.from('admin_actions').insert({
                admin_id: adminId,
                action: 'release_escrow',
                target_type: 'transaction',
                target_id: transactionId,
                note: `Manual escrow release: ₹${(t.commission_amount / 100).toLocaleString('en-IN')} to seller`,
            } as never)

            await supabase.from('notifications').insert({
                user_id: t.seller_id,
                type: 'queue_settled',
                title: 'Escrow released (admin)',
                message: 'Your commission was released manually by an admin.',
                read: false,
            } as never)

            return NextResponse.json({ success: true, message: 'Escrow released' })
        }

        if (action === 'mark_refunded') {
            if (t.status === 'refunded') {
                return NextResponse.json({ error: 'Already refunded' }, { status: 409 })
            }

            const gross = (t.commission_amount || 0) + (t.platform_fee || 0)

            if (t.billing_status === 'billed') {
                // Claw back net from seller pending (may go negative = debt)
                const { data: seller } = await supabase.from('profiles').select('pending_balance').eq('id', t.seller_id).single()
                await supabase.from('profiles').update({
                    pending_balance: ((seller as any)?.pending_balance || 0) - (t.commission_amount || 0),
                } as never).eq('id', t.seller_id)

                // Re-credit founder wallet gross (net + fee)
                const { data: product } = await supabase.from('products').select('founder_id').eq('id', t.product_id).single()
                const founderId = (product as any)?.founder_id as string
                if (founderId) {
                    const { data: founder } = await supabase.from('profiles').select('wallet_balance').eq('id', founderId).single()
                    await supabase.from('profiles').update({
                        wallet_balance: ((founder as any)?.wallet_balance || 0) + gross,
                    } as never).eq('id', founderId)
                }

                // Negative fee ledger (keeps reconcile consistent)
                await supabase.from('platform_revenue').insert({
                    transaction_id: t.id,
                    product_id: t.product_id,
                    founder_id: founderId || null,
                    seller_id: t.seller_id,
                    amount: -(t.platform_fee || 0),
                } as never)
            }

            await supabase.from('transactions').update({ status: 'refunded' } as never).eq('id', transactionId)
            await supabase.from('transactions').insert({
                type: 'refund',
                status: 'refunded',
                product_id: t.product_id,
                seller_id: t.seller_id,
                sale_amount: -(t.sale_amount || 0),
                commission_amount: -(t.commission_amount || 0),
                platform_fee: -(t.platform_fee || 0),
                external_transaction_id: `admin_refund_${transactionId}_${Date.now()}`,
                refund_of: transactionId,
            } as never)

            await supabase.from('admin_actions').insert({
                admin_id: adminId,
                action: 'mark_refunded',
                target_type: 'transaction',
                target_id: transactionId,
                note: `Admin refund: ₹${(gross / 100).toLocaleString('en-IN')} (gross) re-credited to founder`,
            } as never)

            await supabase.from('notifications').insert({
                user_id: t.seller_id,
                type: 'refund',
                title: 'Sale refunded (admin)',
                message: 'A sale was refunded after review. Any pending commission was clawed back.',
                read: false,
            } as never)

            return NextResponse.json({ success: true, message: 'Transaction marked refunded' })
        }

        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 })
    } catch (error) {
        console.error('Admin transaction action error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
