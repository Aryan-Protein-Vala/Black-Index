import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import crypto from 'crypto'

/**
 * API endpoint for listing products (The Armoury)
 * GET /api/products - Get all active products for sellers
 */
export async function GET(request: NextRequest) {
    try {
        const supabase = await createServerSupabaseClient()

        // Get query params for filtering
        const searchParams = request.nextUrl.searchParams
        const onlyActive = searchParams.get('active') !== 'false'
        const founderId = searchParams.get('founder_id')

        let query = supabase
            .from('products')
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
        created_at,
        profiles!products_founder_id_fkey (
          id,
          full_name,
          avatar_url
        )
      `)
            .order('created_at', { ascending: false })

        if (onlyActive) {
            query = query.eq('is_active', true)
        }

        if (founderId) {
            query = query.eq('founder_id', founderId)
        }

        const { data: products, error } = await query

        if (error) {
            console.error('Failed to fetch products:', error)
            return NextResponse.json({ error: 'Failed to fetch products' }, { status: 500 })
        }

        return NextResponse.json({ products })

    } catch (error) {
        console.error('Error fetching products:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}

/**
 * POST /api/products - Create a new product (Founder only)
 * 
 * Body: {
 *   name: string,
 *   description?: string,
 *   logo_url?: string,
 *   website_url: string,
 *   commission_config: CommissionConfig,
 *   max_cac_limit?: number
 * }
 */
export async function POST(request: NextRequest) {
    try {
        const supabase = await createServerSupabaseClient()

        // Get the current user
        const { data: { user }, error: authError } = await supabase.auth.getUser()

        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // Check if user is a founder
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

        // Parse request body
        const body = await request.json()
        const { name, description, logo_url, website_url, commission_config, max_cac_limit } = body

        // Validate required fields
        if (!name || !website_url || !commission_config) {
            return NextResponse.json({
                error: 'name, website_url, and commission_config are required'
            }, { status: 400 })
        }

        // Validate commission_config structure
        if (!commission_config.type || !commission_config.upfront_pct) {
            return NextResponse.json({
                error: 'commission_config must include type and upfront_pct'
            }, { status: 400 })
        }

        // Generate webhook secret (32 bytes = 64 hex characters)
        const webhookSecret = crypto.randomBytes(32).toString('hex')

        // Create product
        const { data: product, error: insertError } = await supabase
            .from('products')
            .insert({
                founder_id: user.id,
                name,
                description,
                logo_url,
                website_url,
                commission_config,
                max_cac_limit,
                webhook_secret: webhookSecret,
            } as never)
            .select()
            .single()

        if (insertError) {
            console.error('Failed to create product:', insertError)
            return NextResponse.json({ error: 'Failed to create product' }, { status: 500 })
        }

        // Return product with webhook secret (only shown once!)
        return NextResponse.json({
            product,
            webhook_secret: webhookSecret,
            message: 'Product created successfully. Save your webhook secret - it will not be shown again!'
        }, { status: 201 })

    } catch (error) {
        console.error('Error creating product:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
