import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, createAdminClient } from '@/lib/supabase-server'
import { checkRateLimit } from '@/lib/rate-limit'

/**
 * POST — Upload product logo (SEC-6: was ZERO auth — any stranger could
 * overwrite any product's logo with anything)
 *
 * Now: session required + product ownership enforced + magic-byte sniffing
 * (client-provided content_type is never trusted) + 2MB cap + rate limit.
 */

const MAGIC: Record<string, { ext: string; mime: string }> = {
    '89504e47': { ext: 'png', mime: 'image/png' },
    ffd8ff: { ext: 'jpg', mime: 'image/jpeg' },
    '52494646': { ext: 'webp', mime: 'image/webp' }, // RIFF…WEBP (checked further below)
    '47494638': { ext: 'gif', mime: 'image/gif' },
}

function sniffImage(buffer: Buffer): { ext: string; mime: string } | null {
    const hex = buffer.subarray(0, 12).toString('hex')
    if (hex.startsWith('89504e47')) return MAGIC['89504e47']
    if (hex.startsWith('ffd8ff')) return MAGIC['ffd8ff']
    if (hex.startsWith('47494638')) return MAGIC['47494638']
    if (hex.startsWith('52494646') && hex.includes('57454250', 8)) return MAGIC['52494646'] // RIFF..WEBP
    return null
}

export async function POST(request: NextRequest) {
    try {
        const sessionClient = await createServerSupabaseClient()
        const { data: { user }, error: authError } = await sessionClient.auth.getUser()
        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        if (!(await checkRateLimit(`upload-logo:${user.id}`, 20, 3600))) {
            return NextResponse.json({ error: 'Upload limit reached' }, { status: 429 })
        }

        const body = await request.json()
        const { product_id, image_data } = body

        if (!product_id || !image_data) {
            return NextResponse.json({ error: 'Missing product_id or image_data' }, { status: 400 })
        }

        const supabase = createAdminClient()

        // Ownership: you can only set logos on YOUR products
        const { data: product, error: productError } = await supabase
            .from('products')
            .select('id, founder_id')
            .eq('id', product_id)
            .single()

        if (productError || !product) {
            return NextResponse.json({ error: 'Product not found' }, { status: 404 })
        }
        if ((product as { founder_id: string }).founder_id !== user.id) {
            return NextResponse.json({ error: 'Not your product' }, { status: 403 })
        }

        const buffer = Buffer.from(image_data, 'base64')

        if (buffer.length > 2 * 1024 * 1024) {
            return NextResponse.json({ error: 'Image too large (max 2MB)' }, { status: 400 })
        }

        const sniffed = sniffImage(buffer)
        if (!sniffed) {
            return NextResponse.json({ error: 'File is not a valid image (png/jpg/webp/gif)' }, { status: 400 })
        }

        const storagePath = `logos/${user.id}/${product_id}.${sniffed.ext}`

        const { error: uploadError } = await supabase.storage
            .from('product-logos')
            .upload(storagePath, buffer, {
                contentType: sniffed.mime,
                upsert: true,
            })

        if (uploadError) {
            console.error('Failed to upload logo:', uploadError)
            return NextResponse.json({ error: 'Failed to upload image' }, { status: 500 })
        }

        const { data: urlData } = supabase.storage
            .from('product-logos')
            .getPublicUrl(storagePath)

        const logoUrl = urlData.publicUrl

        const { error: updateError } = await supabase
            .from('products')
            .update({ logo_url: logoUrl } as never)
            .eq('id', product_id)

        if (updateError) {
            console.error('Failed to update product logo:', updateError)
            return NextResponse.json({ error: 'Failed to update product' }, { status: 500 })
        }

        return NextResponse.json({ success: true, logo_url: logoUrl })

    } catch (error) {
        console.error('Logo upload error:', error)
        return NextResponse.json({
            error: error instanceof Error ? error.message : 'Internal error'
        }, { status: 500 })
    }
}
