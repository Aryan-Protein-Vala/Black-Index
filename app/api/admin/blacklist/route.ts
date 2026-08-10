import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'
import { requireAdmin } from '@/lib/admin'

/**
 * POST /api/admin/blacklist
 * Manual blacklist management (the Guillotine cron auto-adds; admins
 * can add/remove by hand). Actions: add | remove.
 */
export async function POST(request: NextRequest) {
    const auth = await requireAdmin()
    if (!auth.ok) return auth.response
    const adminId = auth.userId

    const supabase = createAdminClient()
    const body = await request.json()
    const { action } = body

    try {
        if (action === 'add') {
            const { profile_id, product_id, display_name, product_name, offense_code, note } = body
            if (!display_name || !offense_code) {
                return NextResponse.json({ error: 'display_name and offense_code are required' }, { status: 400 })
            }
            if (!['dispute_rate', 'fraud', 'chargeback', 'other'].includes(offense_code)) {
                return NextResponse.json({ error: 'Invalid offense_code' }, { status: 400 })
            }

            const { data, error } = await supabase.from('blacklist').insert({
                profile_id: profile_id || null,
                product_id: product_id || null,
                display_name,
                product_name: product_name || null,
                offense_code,
                note: note || 'Manually added by admin',
                created_by: adminId,
            } as never).select().single()

            if (error) throw error

            await supabase.from('admin_actions').insert({
                admin_id: adminId,
                action: 'blacklist_add',
                target_type: 'profile',
                target_id: profile_id || null,
                note: `Blacklisted "${display_name}" (${offense_code})`,
            } as never)

            return NextResponse.json({ success: true, entry: data })
        }

        if (action === 'remove') {
            const { id } = body
            if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

            const { data: entry } = await supabase.from('blacklist').select('display_name').eq('id', id).single()
            if (!entry) return NextResponse.json({ error: 'Blacklist entry not found' }, { status: 404 })

            const { error } = await supabase.from('blacklist').delete().eq('id', id)
            if (error) throw error

            await supabase.from('admin_actions').insert({
                admin_id: adminId,
                action: 'blacklist_remove',
                target_type: 'blacklist',
                target_id: id,
                note: `Removed "${(entry as any).display_name}" from blacklist`,
            } as never)

            return NextResponse.json({ success: true, message: 'Removed from blacklist' })
        }

        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 })
    } catch (error) {
        console.error('Admin blacklist action error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
