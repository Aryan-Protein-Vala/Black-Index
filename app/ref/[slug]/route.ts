import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'

interface RouteParams {
    params: Promise<{ slug: string }>
}

interface LinkWithProduct {
    id: string
    seller_id: string
    product_id: string
    clicks: number | null
    products: {
        website_url: string
        is_active: boolean
    } | null
}

/**
 * THE SPINE - Referral Link Redirect Handler
 * 
 * When a target hits /ref/[slug], we:
 * 1. Index Lookup: Find the product.website_url and seller.id from the links table
 * 2. Signal Log: Increment clicks (async/fire-and-forget)
 * 3. Payload Attachment: Construct destination URL with tracking ID
 * 4. Redirect: 307 Temporary Redirect to the Founder's site
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
    const { slug } = await params

    if (!slug) {
        return NextResponse.json({ error: 'Missing slug' }, { status: 400 })
    }

    try {
        const supabase = createAdminClient()

        // 1. Index Lookup - Find the link and associated product
        const { data, error: linkError } = await supabase
            .from('links')
            .select(`
                id,
                seller_id,
                product_id,
                clicks,
                products (
                    website_url,
                    is_active
                )
            `)
            .eq('slug', slug)
            .single()

        const link = data as unknown as LinkWithProduct | null

        if (linkError || !link) {
            console.error('Link not found:', slug, linkError)
            return NextResponse.json({ error: 'Link not found' }, { status: 404 })
        }

        // Check if product is active
        const product = link.products
        if (!product || !product.is_active) {
            return NextResponse.json({ error: 'Product is not available' }, { status: 404 })
        }

        // Validate website URL
        let websiteUrl = product.website_url
        if (!websiteUrl) {
            console.error('No website URL for product:', link.product_id)
            return NextResponse.json({ error: 'Product URL not configured' }, { status: 500 })
        }

        // Ensure URL has protocol
        if (!websiteUrl.startsWith('http://') && !websiteUrl.startsWith('https://')) {
            websiteUrl = 'https://' + websiteUrl
        }

        // 2. Signal Log - Increment clicks (fire-and-forget, don't block redirect)
        const newClicks = (link.clicks || 0) + 1
        supabase.from('links').update({ clicks: newClicks } as any).eq('id', link.id).then(() => { }).catch(() => { })

        // 3. Payload Attachment - Construct destination URL with ref_id
        try {
            const destinationUrl = new URL(websiteUrl)
            destinationUrl.searchParams.set('ref_id', link.id)

            // 4. Redirect - 307 Temporary Redirect
            return NextResponse.redirect(destinationUrl.toString(), 307)
        } catch (urlError) {
            console.error('Invalid URL:', websiteUrl, urlError)
            // If URL is invalid, try simple redirect
            const fallbackUrl = websiteUrl.includes('?')
                ? `${websiteUrl}&ref_id=${link.id}`
                : `${websiteUrl}?ref_id=${link.id}`
            return NextResponse.redirect(fallbackUrl, 307)
        }

    } catch (error) {
        console.error('Error processing referral link:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
