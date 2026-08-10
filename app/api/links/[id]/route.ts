import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

/**
 * DELETE /api/links/[id]
 * Delete a specific link for the current user
 */
export async function DELETE(
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await context.params
        const supabase = await createServerSupabaseClient()
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }


        if (!id) {
            return NextResponse.json({ error: 'Link ID is required' }, { status: 400 })
        }

        // Delete the link where id = id AND seller_id = user.id (security)
        const { error } = await supabase
            .from('links')
            .delete()
            .eq('id', id)
            .eq('seller_id', user.id)

        if (error) {
            console.error('Failed to delete link:', error)
            return NextResponse.json({ error: 'Failed to delete link' }, { status: 500 })
        }

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('Error deleting link:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
