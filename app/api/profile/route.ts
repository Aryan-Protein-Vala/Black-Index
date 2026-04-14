import { createAdminClient, createServerSupabaseClient } from '@/lib/supabase-server'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

/**
 * GET profile
 * SECURITY: This endpoint now requires authentication.
 * Users can ONLY retrieve their OWN profile to prevent enumeration attacks.
 * The userId param is for backwards compatibility but is validated against auth.
 */
export async function GET(request: Request) {
    const url = new URL(request.url)
    const requestedUserId = url.searchParams.get('userId')

    // SECURITY: Require authentication for profile access
    const supabase = await createServerSupabaseClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // SECURITY: Users can only access their OWN profile
    // If userId is provided, it MUST match the authenticated user
    const userId = requestedUserId || user.id
    if (userId !== user.id) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const adminClient = createAdminClient()

    try {
        const { data, error } = await adminClient
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .single()

        if (error) {
            // Profile doesn't exist - return default (only for OWN profile)
            return NextResponse.json({
                id: userId,
                role: 'warlord',
                full_name: null,
                pending_balance: 0,
                withdrawable_balance: 0,
                total_earnings: 0
            })
        }

        return NextResponse.json(data)
    } catch (err) {
        return NextResponse.json({
            id: userId,
            role: 'warlord'
        })
    }
}

// PATCH - Update profile fields
export async function PATCH(request: NextRequest) {
    try {
        const supabase = await createServerSupabaseClient()
        const { data: { user }, error: authError } = await supabase.auth.getUser()

        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const body = await request.json()
        const { full_name, username } = body

        const adminClient = createAdminClient()

        // Update profile
        const { data, error } = await adminClient
            .from('profiles')
            .update({
                ...(full_name !== undefined && { full_name }),
                ...(username !== undefined && { username }),
            } as never)
            .eq('id', user.id)
            .select()
            .single()

        if (error) {
            console.error('Failed to update profile:', error)
            return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 })
        }

        return NextResponse.json(data)
    } catch (error) {
        console.error('Profile update error:', error)
        return NextResponse.json({ error: 'Update failed' }, { status: 500 })
    }
}
