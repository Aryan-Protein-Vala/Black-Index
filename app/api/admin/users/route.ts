import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'
import { requireAdmin } from '@/lib/admin'

/**
 * POST /api/admin/users
 * User management. Actions:
 *   - set_role:       founder | warlord
 *   - adjust_balance: credit/debit pending/withdrawable/wallet (paise),
 *                     logged to admin_actions with before/after values
 */
export async function POST(request: NextRequest) {
    const auth = await requireAdmin()
    if (!auth.ok) return auth.response
    const adminId = auth.userId

    const supabase = createAdminClient()
    const body = await request.json()
    const { action, userId } = body

    if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 })

    try {
        const { data: profile } = await supabase
            .from('profiles')
            .select('id, role, pending_balance, withdrawable_balance, wallet_balance, full_name')
            .eq('id', userId)
            .single()
        const p = profile as any
        if (!p) return NextResponse.json({ error: 'User not found' }, { status: 404 })

        if (action === 'set_role') {
            const { role } = body
            if (!['founder', 'warlord'].includes(role)) {
                return NextResponse.json({ error: 'role must be founder or warlord' }, { status: 400 })
            }

            const { error } = await supabase.from('profiles').update({ role } as never).eq('id', userId)
            if (error) throw error

            await supabase.from('admin_actions').insert({
                admin_id: adminId,
                action: 'set_role',
                target_type: 'profile',
                target_id: userId,
                note: `Role changed: ${p.role} → ${role}`,
            } as never)

            return NextResponse.json({ success: true, role })
        }

        if (action === 'adjust_balance') {
            const { field, delta, note } = body
            if (!['pending_balance', 'withdrawable_balance', 'wallet_balance'].includes(field)) {
                return NextResponse.json({ error: 'field must be pending_balance, withdrawable_balance, or wallet_balance' }, { status: 400 })
            }
            const amountDelta = Number(delta)
            if (!Number.isInteger(amountDelta) || amountDelta === 0) {
                return NextResponse.json({ error: 'delta must be a non-zero integer (paise)' }, { status: 400 })
            }

            const before = p[field] || 0
            const after = before + amountDelta
            // Withdrawable/wallet can never go negative; pending may (debt from clawbacks)
            if (after < 0 && field !== 'pending_balance') {
                return NextResponse.json({ error: 'Resulting balance would be negative' }, { status: 400 })
            }

            const { error } = await supabase
                .from('profiles')
                .update({ [field]: after } as never)
                .eq('id', userId)
            if (error) throw error

            await supabase.from('admin_actions').insert({
                admin_id: adminId,
                action: 'adjust_balance',
                target_type: 'profile',
                target_id: userId,
                note: note || `Balance adjustment`,
                metadata: { field, before, after, delta: amountDelta },
            } as never)

            return NextResponse.json({ success: true, field, before, after })
        }

        if (action === 'send_message') {
            const { title, message } = body
            if (!message || message.trim() === '') {
                return NextResponse.json({ error: 'Message content is required' }, { status: 400 })
            }

            const notifTitle = title?.trim() || "Message from Admin"
            const notifMessage = message.trim()

            // 1. Insert into notifications
            const { error: notifError } = await supabase.from('notifications').insert({
                user_id: userId,
                type: 'admin_message',
                title: notifTitle,
                message: notifMessage,
                read: false,
                metadata: { sender_id: adminId }
            } as never)
            if (notifError) throw notifError

            // 2. Log admin action
            await supabase.from('admin_actions').insert({
                admin_id: adminId,
                action: 'send_message',
                target_type: 'profile',
                target_id: userId,
                note: `Sent message to user. Title: ${notifTitle}`,
                metadata: { title: notifTitle, message: notifMessage },
            } as never)

            return NextResponse.json({ success: true, title: notifTitle })
        }

        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 })
    } catch (error) {
        console.error('Admin user action error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
