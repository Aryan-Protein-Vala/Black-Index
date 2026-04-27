import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, createAdminClient } from '@/lib/supabase-server'

export async function POST(request: NextRequest) {
    try {
        const supabase = await createServerSupabaseClient()
        const { data: { user }, error: authError } = await supabase.auth.getUser()

        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { tourType } = await request.json()

        if (tourType !== 'seller' && tourType !== 'founder') {
            return NextResponse.json({ error: 'Invalid tour type' }, { status: 400 })
        }

        const columnToUpdate = tourType === 'seller' ? 'has_seen_seller_tour' : 'has_seen_founder_tour'

        // SECURITY: Use admin client to bypass RLS since users cannot update their own profile columns directly
        const adminClient = createAdminClient()
        const { error: updateError } = await adminClient
            .from('profiles')
            .update({ [columnToUpdate]: true } as never)
            .eq('id', user.id)

        if (updateError) {
            console.error('Failed to update tour status:', updateError)
            return NextResponse.json({ error: 'Database error' }, { status: 500 })
        }

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('Onboarding update error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
