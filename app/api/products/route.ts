import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, createAdminClient } from '@/lib/supabase-server'
import crypto from 'crypto'

const ALLOWED_CATEGORIES = ['b2b', 'ai_saas', 'devtools', 'marketing', 'creator_tools', 'other']

/**
 * GET /api/products — The Armoury (public Vault listing)
 * Reads from public_products: no webhook_secret, no columns that don't
 * belong in public, and ONLY certified products (verified_at IS NOT NULL —
 * the money pipe was proven before anyone can promote the product).
 */
export async function GET(request: NextRequest) {
    try {
        const admin = createAdminClient()

        const searchParams = request.nextUrl.searchParams
        const founderId = searchParams.get('founder_id')
        const category = searchParams.get('category')
        const search = searchParams.get('search')?.toLowerCase()

        // public_products is pre-filtered: is_active = true AND verified_at IS NOT NULL
        let query = admin
            .from('public_products' as never)
            .select(`
                id,
                name,
                description,
                logo_url,
                website_url,
                is_active,
                is_founders_choice,
                is_featured,
                featured_until,
                commission_config,
                max_cac_limit,
                category,
                price_inr,
                billing_type,
                verified_at,
                founder_id,
                created_at
            `)
            .order('created_at', { ascending: false })

        if (founderId) {
            query = query.eq('founder_id', founderId)
        }
        if (category && ALLOWED_CATEGORIES.includes(category)) {
            query = query.eq('category', category)
        }

        const { data: products, error } = await query

        if (error) {
            console.error('Failed to fetch products:', error)
            return NextResponse.json({ error: 'Failed to fetch products' }, { status: 500 })
        }

        // Merge founder display info (can't embed profiles through the view)
        const founderIds = [...new Set(((products as any[]) || []).map(p => p.founder_id).filter(Boolean))]
        let foundersById: Record<string, { id: string; full_name: string | null; avatar_url: string | null }> = {}
        if (founderIds.length > 0) {
            const { data: founders } = await admin
                .from('profiles')
                .select('id, full_name, avatar_url')
                .in('id', founderIds)
            for (const f of (founders as any[]) || []) {
                foundersById[f.id] = f
            }
        }

        let result = ((products as any[]) || []).map(p => ({
            ...p,
            profiles: foundersById[p.founder_id] || null,
        }))

        if (search) {
            result = result.filter(p =>
                p.name?.toLowerCase().includes(search) ||
                p.description?.toLowerCase().includes(search)
            )
        }

        return NextResponse.json({ products: result })

    } catch (error) {
        console.error('Error fetching products:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}

/**
 * POST /api/products — Create a new product (founder/admin only)
 *
 * Server-generated webhook secret (founders never supply secrets), real
 * commission bounds, validated category, structured pricing.
 *
 * Note: products are created ACTIVE (sellers can't see them until the
 * certification gate flips verified_at anyway) — the Vault only lists
 * products with a proven money pipe.
 */
export async function POST(request: NextRequest) {
    try {
        const supabase = await createServerSupabaseClient()

        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single()

        if (profileError || !profile) {
            return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
        }

        const userProfile = profile as { role: string }
        if (userProfile.role !== 'founder' && userProfile.role !== 'admin') {
            return NextResponse.json({
                error: 'Only founders can create products. Please upgrade your account.'
            }, { status: 403 })
        }

        const body = await request.json()
        const {
            name,
            description,
            logo_url,
            website_url,
            commission_config,
            max_cac_limit,
            category,
            price_inr,
            billing_type,
            meeting_commission_flat,
            cal_link,
        } = body

        // ---- Required fields ----
        if (!name || !website_url || !commission_config) {
            return NextResponse.json({
                error: 'name, website_url, and commission_config are required'
            }, { status: 400 })
        }

        if (typeof name !== 'string' || name.trim().length === 0 || name.length > 80) {
            return NextResponse.json({ error: 'name must be 1–80 characters' }, { status: 400 })
        }

        // ---- URL validation (every seller link redirects here) ----
        let parsedUrl: URL
        try {
            parsedUrl = new URL(/^https?:\/\//i.test(website_url) ? website_url : `https://${website_url}`)
        } catch {
            return NextResponse.json({ error: 'website_url is not a valid URL' }, { status: 400 })
        }
        if (parsedUrl.protocol !== 'https:' && !parsedUrl.hostname.includes('localhost')) {
            return NextResponse.json({ error: 'website_url must be https' }, { status: 400 })
        }

        // ---- Commission bounds (was: no bounds anywhere) ----
        const upfront = Number(commission_config.upfront_pct)
        const recurring = Number(commission_config.recurring_pct ?? 0)
        const months = Number(commission_config.max_recurring_months ?? 12)

        if (!Number.isFinite(upfront) || upfront < 1 || upfront > 100) {
            return NextResponse.json({ error: 'upfront_pct must be between 1 and 100' }, { status: 400 })
        }
        if (!Number.isFinite(recurring) || recurring < 0 || recurring > 100) {
            return NextResponse.json({ error: 'recurring_pct must be between 0 and 100' }, { status: 400 })
        }
        if (!Number.isInteger(months) || months < 1 || months > 36) {
            return NextResponse.json({ error: 'max_recurring_months must be 1–36' }, { status: 400 })
        }
        if (max_cac_limit != null && (!Number.isFinite(Number(max_cac_limit)) || max_cac_limit < 1000 || max_cac_limit > 10_000_000)) {
            return NextResponse.json({ error: 'max_cac_limit must be ₹10–₹1,00,000 (in paise)' }, { status: 400 })
        }
        if (category != null && !ALLOWED_CATEGORIES.includes(category)) {
            return NextResponse.json({ error: `category must be one of: ${ALLOWED_CATEGORIES.join(', ')}` }, { status: 400 })
        }
        if (billing_type != null && !['one_time', 'subscription'].includes(billing_type)) {
            return NextResponse.json({ error: 'billing_type must be one_time or subscription' }, { status: 400 })
        }
        if (price_inr != null && (!Number.isFinite(Number(price_inr)) || price_inr < 0)) {
            return NextResponse.json({ error: 'price_inr must be a non-negative number (paise)' }, { status: 400 })
        }

        // ---- Service (Cal.com) vertical: flat per-meeting commission + booking link ----
        if (meeting_commission_flat != null && meeting_commission_flat !== '') {
            const flat = Number(meeting_commission_flat)
            if (!Number.isInteger(flat) || flat < 100 || flat > 100_000_000) {
                return NextResponse.json({ error: 'meeting_commission_flat must be ₹1–₹10,00,000 (in paise)' }, { status: 400 })
            }
        }
        if (cal_link != null && cal_link.trim() !== '') {
            let calUrl: URL
            try {
                calUrl = new URL(cal_link)
            } catch {
                return NextResponse.json({ error: 'cal_link is not a valid URL' }, { status: 400 })
            }
            if (calUrl.protocol !== 'https:') {
                return NextResponse.json({ error: 'cal_link must be https' }, { status: 400 })
            }
        }

        const webhookSecret = crypto.randomBytes(32).toString('hex')

        const { data: product, error: insertError } = await supabase
            .from('products')
            .insert({
                founder_id: user.id,
                name: name.trim(),
                description,
                logo_url,
                website_url: parsedUrl.toString(),
                commission_config: {
                    type: 'hybrid',
                    upfront_pct: upfront,
                    recurring_pct: recurring,
                    max_recurring_months: months,
                },
                max_cac_limit: max_cac_limit ?? null,
                webhook_secret: webhookSecret,
                category: category || 'other',
                price_inr: price_inr ?? null,
                billing_type: billing_type || 'subscription',
                meeting_commission_flat: meeting_commission_flat != null && meeting_commission_flat !== ''
                    ? Number(meeting_commission_flat)
                    : null,
                cal_link: cal_link && cal_link.trim() !== '' ? cal_link.trim() : null,
            } as never)
            .select()
            .single()

        if (insertError) {
            console.error('Failed to create product:', insertError)
            return NextResponse.json({ error: 'Failed to create product' }, { status: 500 })
        }

        return NextResponse.json({
            product,
            webhook_secret: webhookSecret,
            message: 'Product created. Save your webhook secret — it will not be shown again (use rotate-secret if lost).',
        }, { status: 201 })

    } catch (error) {
        console.error('Error creating product:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
