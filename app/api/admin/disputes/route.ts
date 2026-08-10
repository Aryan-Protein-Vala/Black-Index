import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'
import { requireAdmin } from '@/lib/admin'

/**
 * POST /api/admin/disputes
 * The trust-system workflow. Actions:
 *   - confirm_fraud: fraud report → confirmed (feeds trust tiers + blacklist)
 *   - dismiss_fraud: fraud report → dismissed (never counts toward tiers)
 *   - release_tx:    disputed tx → cleared, pay the seller (dispute dismissed)
 *   - refund_tx:     disputed tx → refund flow (dispute upheld)
 *
 * confirm_fraud with sellerId also inserts a blacklist row (the Guillotine,
 * manually).
 */
export async function POST(request: NextRequest) {
    const auth = await requireAdmin()
    if (!auth.ok) return auth.response
    const adminId = auth.userId

    const supabase = createAdminClient()
    const body = await request.json()
    const { action } = body

    try {
        if (action === 'confirm_fraud') {
            const { reportId, sellerId, productId, displayName, productName } = body
            if (!reportId) return NextResponse.json({ error: 'reportId required' }, { status: 400 })

            const { data: report } = await supabase
                .from('fraud_reports')
                .select('id, status, product_id, founder_id')
                .eq('id', reportId)
                .single()
            const r = report as any
            if (!r) return NextResponse.json({ error: 'Fraud report not found' }, { status: 404 })
            if (r.status === 'confirmed') return NextResponse.json({ error: 'Already confirmed' }, { status: 409 })

            await supabase.from('fraud_reports').update({
                status: 'confirmed',
                resolved_at: new Date().toISOString(),
                resolution_notes: 'Confirmed by admin review',
            } as never).eq('id', reportId)

            // Optionally blacklist the offending party
            let blacklisted = false
            if (sellerId) {
                const pid = productId || r.product_id
                const { data: existing } = await supabase
                    .from('blacklist')
                    .select('id')
                    .eq('profile_id', sellerId)
                    .maybeSingle()
                if (!existing) {
                    await supabase.from('blacklist').insert({
                        profile_id: sellerId,
                        product_id: pid,
                        display_name: displayName || 'Seller',
                        product_name: productName || null,
                        offense_code: 'fraud',
                        note: 'Confirmed fraud by admin review',
                        created_by: adminId,
                    } as never)
                    blacklisted = true
                }
            }

            await supabase.from('admin_actions').insert({
                admin_id: adminId,
                action: 'confirm_fraud',
                target_type: 'fraud_report',
                target_id: reportId,
                note: `Fraud confirmed${blacklisted ? ' — seller blacklisted' : ''}`,
            } as never)

            return NextResponse.json({ success: true, blacklisted })
        }

        if (action === 'dismiss_fraud') {
            const { reportId } = body
            if (!reportId) return NextResponse.json({ error: 'reportId required' }, { status: 400 })

            const { data: report } = await supabase.from('fraud_reports').select('id, status').eq('id', reportId).single()
            if (!report) return NextResponse.json({ error: 'Fraud report not found' }, { status: 404 })
            if ((report as any).status === 'dismissed') return NextResponse.json({ error: 'Already dismissed' }, { status: 409 })

            await supabase.from('fraud_reports').update({
                status: 'dismissed',
                resolved_at: new Date().toISOString(),
                resolution_notes: 'Dismissed by admin review — no fraud found',
            } as never).eq('id', reportId)

            await supabase.from('admin_actions').insert({
                admin_id: adminId,
                action: 'dismiss_fraud',
                target_type: 'fraud_report',
                target_id: reportId,
                note: 'Fraud report dismissed',
            } as never)

            return NextResponse.json({ success: true })
        }

        if (action === 'release_tx') {
            const { transactionId } = body
            if (!transactionId) return NextResponse.json({ error: 'transactionId required' }, { status: 400 })

            const { data: tx } = await supabase
                .from('transactions')
                .select('id, status, seller_id, commission_amount')
                .eq('id', transactionId)
                .single()
            const t = tx as any
            if (!t) return NextResponse.json({ error: 'Transaction not found' }, { status: 404 })
            if (t.status !== 'disputed') return NextResponse.json({ error: 'Transaction is not disputed' }, { status: 409 })

            const { error: rpcError } = await supabase.rpc('release_cleared_funds' as never, {
                p_seller_id: t.seller_id,
                p_amount: t.commission_amount,
            } as never)
            if (rpcError) throw rpcError

            await supabase.from('transactions').update({
                status: 'cleared',
                confirmed_by_buyer: true,
                cleared_at: new Date().toISOString(),
            } as never).eq('id', transactionId)

            await supabase.from('admin_actions').insert({
                admin_id: adminId,
                action: 'release_tx',
                target_type: 'transaction',
                target_id: transactionId,
                note: 'Disputed transaction released to seller after admin review',
            } as never)

            await supabase.from('notifications').insert({
                user_id: t.seller_id,
                type: 'queue_settled',
                title: 'Dispute resolved in your favour',
                message: 'A disputed transaction was released to you after admin review.',
                read: false,
            } as never)

            return NextResponse.json({ success: true, message: 'Disputed transaction released to seller' })
        }

        if (action === 'refund_tx') {
            const { transactionId, blacklistSeller, sellerDisplayName } = body
            if (!transactionId) return NextResponse.json({ error: 'transactionId required' }, { status: 400 })

            const { data: tx } = await supabase
                .from('transactions')
                .select('id, status, seller_id, commission_amount, platform_fee, product_id')
                .eq('id', transactionId)
                .single()
            const t = tx as any
            if (!t) return NextResponse.json({ error: 'Transaction not found' }, { status: 404 })
            if (t.status !== 'disputed') return NextResponse.json({ error: 'Transaction is not disputed' }, { status: 409 })

            // Claw back (if billed)
            const gross = (t.commission_amount || 0) + (t.platform_fee || 0)
            const { data: seller } = await supabase.from('profiles').select('pending_balance').eq('id', t.seller_id).single()
            await supabase.from('profiles').update({
                pending_balance: ((seller as any)?.pending_balance || 0) - (t.commission_amount || 0),
            } as never).eq('id', t.seller_id)

            const { data: product } = await supabase.from('products').select('founder_id').eq('id', t.product_id).single()
            const founderId = (product as any)?.founder_id as string
            if (founderId) {
                const { data: founder } = await supabase.from('profiles').select('wallet_balance').eq('id', founderId).single()
                await supabase.from('profiles').update({
                    wallet_balance: ((founder as any)?.wallet_balance || 0) + gross,
                } as never).eq('id', founderId)
            }

            await supabase.from('platform_revenue').insert({
                transaction_id: t.id,
                product_id: t.product_id,
                founder_id: founderId || null,
                seller_id: t.seller_id,
                amount: -(t.platform_fee || 0),
            } as never)

            await supabase.from('transactions').update({ status: 'refunded' } as never).eq('id', transactionId)
            await supabase.from('transactions').insert({
                type: 'refund',
                status: 'refunded',
                product_id: t.product_id,
                seller_id: t.seller_id,
                sale_amount: 0,
                commission_amount: -(t.commission_amount || 0),
                platform_fee: -(t.platform_fee || 0),
                external_transaction_id: `admin_refund_${transactionId}_${Date.now()}`,
                refund_of: transactionId,
            } as never)

            if (blacklistSeller) {
                const { data: existing } = await supabase
                    .from('blacklist')
                    .select('id')
                    .eq('profile_id', t.seller_id)
                    .maybeSingle()
                if (!existing) {
                    await supabase.from('blacklist').insert({
                        profile_id: t.seller_id,
                        product_id: t.product_id,
                        display_name: sellerDisplayName || 'Seller',
                        offense_code: 'fraud',
                        note: 'Dispute upheld — blacklisted by admin',
                        created_by: adminId,
                    } as never)
                }
            }

            await supabase.from('admin_actions').insert({
                admin_id: adminId,
                action: 'refund_tx',
                target_type: 'transaction',
                target_id: transactionId,
                note: `Disputed transaction refunded${blacklistSeller ? ' — seller blacklisted' : ''}`,
            } as never)

            await supabase.from('notifications').insert({
                user_id: t.seller_id,
                type: 'refund',
                title: 'Dispute upheld — sale refunded',
                message: 'A disputed transaction was refunded after admin review. Any pending commission was clawed back.',
                read: false,
            } as never)

            return NextResponse.json({ success: true, message: 'Disputed transaction refunded' })
        }

        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 })
    } catch (error) {
        console.error('Admin dispute action error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
