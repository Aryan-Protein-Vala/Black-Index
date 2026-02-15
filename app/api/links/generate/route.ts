import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

/**
 * API endpoint for sellers to generate referral links for products
 * POST /api/links/generate
 * 
 * Body: { product_id: string, custom_slug?: string }
 * Returns: { link: Link, url: string }
 */
export async function POST(request: NextRequest) {
    try {
        const supabase = await createServerSupabaseClient()

        // Get the current user
        const { data: { user }, error: authError } = await supabase.auth.getUser()

        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // Parse request body
        const body = await request.json()
        const { product_id, custom_slug } = body

        if (!product_id) {
            return NextResponse.json({ error: 'product_id is required' }, { status: 400 })
        }

        // Check if product exists and is active
        const { data: product, error: productError } = await supabase
            .from('products')
            .select('id, name, is_active')
            .eq('id', product_id)
            .single()

        if (productError || !product) {
            return NextResponse.json({ error: 'Product not found' }, { status: 404 })
        }

        const typedProduct = product as { is_active: boolean }
        if (!typedProduct.is_active) {
            return NextResponse.json({ error: 'Product is not available for promotion' }, { status: 400 })
        }

        // Generate slug - use custom or generate unique one
        const slug = custom_slug || generateSlug(user.id, product_id)

        // Check if user already has a link for this product
        const { data: existingLink } = await supabase
            .from('links')
            .select('id, slug')
            .eq('seller_id', user.id)
            .eq('product_id', product_id)
            .single()

        if (existingLink) {
            // Return existing link
            const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://blackindex.in'
            const typedLink = existingLink as { id: string; slug: string }
            return NextResponse.json({
                link: existingLink,
                url: `${baseUrl}/ref/${typedLink.slug}`,
                message: 'Existing link returned'
            })
        }

        // Create new link
        const { data: newLink, error: insertError } = await supabase
            .from('links')
            .insert({
                seller_id: user.id,
                product_id: product_id,
                slug: slug,
            } as never)
            .select()
            .single()

        if (insertError) {
            // If slug already exists, try with a random suffix
            if (insertError.code === '23505') {
                const uniqueSlug = `${slug}-${Math.random().toString(36).substring(2, 6)}`
                const { data: retryLink, error: retryError } = await supabase
                    .from('links')
                    .insert({
                        seller_id: user.id,
                        product_id: product_id,
                        slug: uniqueSlug,
                    } as never)
                    .select()
                    .single()

                if (retryError) {
                    console.error('Failed to create link:', retryError)
                    return NextResponse.json({ error: 'Failed to create link' }, { status: 500 })
                }

                const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://blackindex.in'
                const typedRetryLink = retryLink as { slug: string }
                return NextResponse.json({
                    link: retryLink,
                    url: `${baseUrl}/ref/${typedRetryLink.slug}`,
                })
            }

            console.error('Failed to create link:', insertError)
            return NextResponse.json({ error: 'Failed to create link' }, { status: 500 })
        }

        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://blackindex.in'
        const typedNewLink = newLink as { slug: string }
        return NextResponse.json({
            link: newLink,
            url: `${baseUrl}/ref/${typedNewLink.slug}`,
        })

    } catch (error) {
        console.error('Error generating link:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}

/**
 * Generate a short, readable slug
 */
function generateSlug(userId: string, productId: string): string {
    // Take first 4 chars of user id + first 4 chars of product id + random suffix
    const userPart = userId.replace(/-/g, '').substring(0, 4)
    const productPart = productId.replace(/-/g, '').substring(0, 4)
    const randomPart = Math.random().toString(36).substring(2, 6)
    return `${userPart}${productPart}${randomPart}`.toLowerCase()
}

/**
 * GET /api/links/generate
 * Get all links for the current user
 */
export async function GET() {
    try {
        const supabase = await createServerSupabaseClient()

        // Get the current user
        const { data: { user }, error: authError } = await supabase.auth.getUser()

        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // Get all links for this user
        const { data: links, error } = await supabase
            .from('links')
            .select(`
        *,
        products (
          id,
          name,
          logo_url,
          commission_config
        )
      `)
            .eq('seller_id', user.id)
            .order('created_at', { ascending: false })

        if (error) {
            console.error('Failed to fetch links:', error)
            return NextResponse.json({ error: 'Failed to fetch links' }, { status: 500 })
        }

        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://blackindex.in'
        type LinkType = { slug: string;[key: string]: any }
        const linksWithUrls = ((links || []) as LinkType[]).map(link => ({
            ...link,
            url: `${baseUrl}/ref/${link.slug}`,
        }))

        return NextResponse.json({ links: linksWithUrls })

    } catch (error) {
        console.error('Error fetching links:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
