import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, createAdminClient } from '@/lib/supabase-server'
import { createClient } from '@supabase/supabase-js'
import { isAdminEmail } from '@/lib/admin'

export async function GET(request: NextRequest) {
    try {
        // Verify admin access
        const supabase = await createServerSupabaseClient()
        const { data: { user }, error: authError } = await supabase.auth.getUser()

        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        if (!isAdminEmail(user.email)) {
            return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
        }

        // Use admin client to bypass RLS and get all data
        const adminClient = createAdminClient()

        // Fetch all products — NEVER expose signing secrets to any client, admin included
        const { data: products, error: productsError } = await adminClient
            .from('products')
            .select('id, founder_id, name, description, logo_url, website_url, is_active, is_featured, is_founders_choice, featured_until, commission_config, max_cac_limit, category, price_inr, billing_type, verified_at, script_detected_at, auto_paused, settlement_mode, created_at')
            .order('created_at', { ascending: false })

        if (productsError) {
            console.error('Failed to fetch products:', productsError)
        }

        // Fetch all profiles — mask payout identity + connected accounts; keep ops-relevant balances
        const { data: profiles, error: profilesError } = await adminClient
            .from('profiles')
            .select('id, role, username, full_name, avatar_url, pending_balance, withdrawable_balance, total_earnings, wallet_balance, security_deposit_paid, created_at')
            .order('created_at', { ascending: false })

        if (profilesError) {
            console.error('Failed to fetch profiles:', profilesError)
        }

        // Also try to fetch auth users to get emails
        // Use Supabase Admin API to list all users
        const supabaseAdmin = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!,
            { auth: { autoRefreshToken: false, persistSession: false } }
        )

        let authUsers: { id: string; email: string }[] = []
        try {
            const { data: authData, error: authListError } = await supabaseAdmin.auth.admin.listUsers()
            if (!authListError && authData?.users) {
                authUsers = authData.users.map(u => ({ id: u.id, email: u.email || '' }))
            }
        } catch (err) {
            console.error('Failed to fetch auth users:', err)
        }

        // Merge emails into profiles
        type ProfileType = { id: string; email?: string;[key: string]: any }
        const usersWithEmails = ((profiles || []) as ProfileType[]).map(profile => {
            const authUser = authUsers.find(u => u.id === profile.id)
            return {
                ...profile,
                email: profile.email || authUser?.email || 'No email'
            }
        })

        return NextResponse.json({
            products: products || [],
            users: usersWithEmails
        })

    } catch (error) {
        console.error('Admin data fetch error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}

