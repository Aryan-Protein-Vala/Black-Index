import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'

/**
 * GET /api/blacklist
 * Public transparency feed for the /blacklist page.
 * Shows ONLY: display_name, product_name, offense_code, date.
 * (No entity column, no PII beyond the public display name.)
 */
export async function GET() {
    try {
        const supabase = createAdminClient()

        const { data, error } = await supabase
            .from('blacklist')
            .select('display_name, product_name, offense_code, created_at')
            .order('created_at', { ascending: false })
            .limit(200)

        if (error) {
            console.error('Blacklist fetch error:', error)
            return NextResponse.json({ error: 'Failed to fetch blacklist' }, { status: 500 })
        }

        return NextResponse.json({ entries: data || [] })
    } catch (error) {
        console.error('Blacklist API error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
