import { NextResponse } from 'next/server'
import { createServerSupabaseClient, createAdminClient } from '@/lib/supabase-server'

/**
 * POST /api/founders/upgrade
 * Instantly upgrade a user to Founder status (Free for 2026 promo)
 */
export async function POST() {
    try {
        const supabase = await createServerSupabaseClient()
        const { data: { user }, error: authError } = await supabase.auth.getUser()

        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const adminClient = createAdminClient()

        // Check current role
        const { data: profile } = await adminClient
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single()

        if ((profile as any)?.role === 'founder') {
            return NextResponse.json({ error: 'Already a founder' }, { status: 400 })
        }

        // Grant access directly
        const { error: updateError } = await adminClient
            .from('profiles')
            .update({ role: 'founder' } as never)
            .eq('id', user.id)

        if (updateError) {
            console.error('Failed to upgrade user:', updateError)
            return NextResponse.json({ error: 'Failed to upgrade' }, { status: 500 })
        }

        return NextResponse.json({ success: true, message: 'Successfully upgraded to Founder!' })

    } catch (error) {
        console.error('Upgrade error:', error)
        return NextResponse.json({
            error: error instanceof Error ? error.message : 'Failed to upgrade',
        }, { status: 500 })
    }
}
