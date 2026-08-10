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
            .select('id, founder_id, name, description, logo_url, website_url, is_active, is_featured, is_founders_choice, featured_until, commission_config, max_cac_limit, category, price_inr, billing_type, verified_at, script_detected_at, auto_paused, settlement_mode, trust_tier, created_at')
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

        // ============================================================
        // BACK-OFFICE DATA (best-effort; failures are non-fatal per block)
        // ============================================================

        // ---- Stats ----
        const stats: Record<string, number> = {}
        try {
            const { data: feeRows } = await adminClient.from('platform_revenue').select('amount')
            stats.platform_fee_revenue = ((feeRows as any[]) || []).reduce((s, r) => s + (r.amount || 0), 0)

            const { data: balances } = await adminClient.from('profiles').select('pending_balance, withdrawable_balance, wallet_balance, role')
            const b = (balances as any[]) || []
            stats.escrow_held = b.reduce((s, p) => s + (p.pending_balance || 0), 0)
            stats.seller_withdrawable = b.reduce((s, p) => s + (p.withdrawable_balance || 0), 0)
            stats.founder_wallets = b.filter(p => p.role === 'founder').reduce((s, p) => s + (p.wallet_balance || 0), 0)

            const { count: saleCount } = await adminClient.from('transactions').select('*', { count: 'exact', head: true }).eq('type', 'sale')
            stats.total_sales = saleCount || 0

            const { count: disputedCount } = await adminClient.from('transactions').select('*', { count: 'exact', head: true }).eq('status', 'disputed')
            stats.disputed_txs = disputedCount || 0

            const { count: fraudPending } = await adminClient.from('fraud_reports').select('*', { count: 'exact', head: true }).in('status', ['pending', 'verified'])
            stats.fraud_pending = fraudPending || 0

            const { count: blacklistCount } = await adminClient.from('blacklist').select('*', { count: 'exact', head: true })
            stats.blacklisted = blacklistCount || 0

            stats.users = usersWithEmails.length
            stats.products = (products || []).length
        } catch (err) {
            console.error('Failed to compute stats:', err)
        }

        // ---- Transactions (recent 300) ----
        let transactions: any[] = []
        try {
            const { data: txData } = await adminClient
                .from('transactions')
                .select('id, type, status, billing_status, vertical, sale_amount, commission_amount, platform_fee, external_customer_id, external_transaction_id, payout_due_date, confirmed_by_buyer, meeting_start_at, refund_of, created_at, seller:profiles!transactions_seller_id_fkey(full_name, email), products(name, founder:profiles!products_founder_id_fkey(full_name, email))')
                .order('created_at', { ascending: false })
                .limit(300)
            transactions = (txData as any[]) || []
        } catch (err) {
            console.error('Failed to fetch transactions:', err)
        }

        // ---- Disputed transactions + evidence (signed URLs) ----
        let disputes: any[] = []
        try {
            const { data: disputedTxs } = await adminClient
                .from('transactions')
                .select('id, status, billing_status, vertical, sale_amount, commission_amount, external_customer_id, meeting_start_at, created_at, seller:profiles!transactions_seller_id_fkey(full_name, email), products(name, founder:profiles!products_founder_id_fkey(full_name, email))')
                .eq('status', 'disputed')
                .order('created_at', { ascending: false })
                .limit(100)

            const withEvidence = []
            for (const tx of (disputedTxs as any[]) || []) {
                const { data: evidenceRows } = await adminClient
                    .from('dispute_evidence')
                    .select('id, file_url, note, uploaded_by, created_at')
                    .eq('transaction_id', tx.id)
                    .order('created_at', { ascending: false })

                const evidence = []
                for (const ev of (evidenceRows as any[]) || []) {
                    const { data: signed } = await adminClient.storage
                        .from('dispute-evidence')
                        .createSignedUrl(ev.file_url, 60 * 60 * 24 * 7)
                    evidence.push({ ...ev, url: signed?.signedUrl || null })
                }
                withEvidence.push({ ...tx, evidence })
            }
            disputes = withEvidence
        } catch (err) {
            console.error('Failed to fetch disputes:', err)
        }

        // ---- Fraud report queue ----
        let fraudReports: any[] = []
        try {
            const { data: reports } = await adminClient
                .from('fraud_reports')
                .select('id, reporter_id, founder_id, product_id, evidence_url, description, status, resolution_notes, bounty_paid, created_at, products(name)')
                .order('created_at', { ascending: false })
                .limit(100)
            fraudReports = (reports as any[]) || []
        } catch (err) {
            console.error('Failed to fetch fraud reports:', err)
        }

        // ---- Blacklist ----
        let blacklist: any[] = []
        try {
            const { data: bl } = await adminClient
                .from('blacklist')
                .select('id, profile_id, product_id, display_name, product_name, offense_code, note, created_by, created_at')
                .order('created_at', { ascending: false })
                .limit(200)
            blacklist = (bl as any[]) || []
        } catch (err) {
            console.error('Failed to fetch blacklist:', err)
        }

        return NextResponse.json({
            products: products || [],
            users: usersWithEmails,
            stats,
            transactions,
            disputes,
            fraudReports,
            blacklist,
        })

    } catch (error) {
        console.error('Admin data fetch error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
