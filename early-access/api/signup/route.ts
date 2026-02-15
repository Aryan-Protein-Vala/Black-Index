import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'

/**
 * POST /early-access/api/signup
 * Register for early access waitlist
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { email, name, role } = body

        if (!email || !name || !role) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        if (!emailRegex.test(email)) {
            return NextResponse.json({ error: 'Invalid email format' }, { status: 400 })
        }

        // Validate role
        if (role !== 'founder' && role !== 'warlord') {
            return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
        }

        const supabase = createAdminClient()

        // Check if email already exists
        const { data: existing } = await supabase
            .from('early_access')
            .select('id, position')
            .eq('email', email.toLowerCase())
            .single()

        const existingData = existing as { id: string; position: number } | null
        if (existingData) {
            return NextResponse.json({
                message: 'Already registered',
                position: existingData.position
            })
        }

        // Get current count for position
        const { count } = await supabase
            .from('early_access')
            .select('*', { count: 'exact', head: true })

        const position = (count || 0) + 1

        // Insert new signup
        const { data, error } = await supabase
            .from('early_access')
            .insert({
                email: email.toLowerCase(),
                name,
                role,
                position,
            } as never)
            .select()
            .single()

        if (error) {
            console.error('Early access signup error:', error)
            return NextResponse.json({ error: 'Failed to register' }, { status: 500 })
        }

        return NextResponse.json({
            message: 'Successfully registered!',
            position,
        })

    } catch (error) {
        console.error('Early access error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}

/**
 * GET /early-access/api/signup
 * Get current waitlist count
 */
export async function GET() {
    try {
        const supabase = createAdminClient()

        const { count, error } = await supabase
            .from('early_access')
            .select('*', { count: 'exact', head: true })

        if (error) {
            return NextResponse.json({ error: 'Failed to get count' }, { status: 500 })
        }

        return NextResponse.json({
            count: count || 0,
            target: 10000,
            progress: Math.min(((count || 0) / 10000) * 100, 100).toFixed(1)
        })

    } catch (error) {
        console.error('Early access count error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
