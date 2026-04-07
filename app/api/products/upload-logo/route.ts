import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'

/**
 * POST — Upload product logo
 * Accepts base64 image data, uploads to Supabase Storage
 */

export async function POST(request: NextRequest) {
    const supabase = createAdminClient()

    try {
        const body = await request.json()
        const { product_id, image_data, file_name, content_type } = body

        if (!product_id || !image_data) {
            return NextResponse.json({ error: 'Missing product_id or image_data' }, { status: 400 })
        }

        // Decode base64
        const buffer = Buffer.from(image_data, 'base64')

        // Validate size (max 2MB)
        if (buffer.length > 2 * 1024 * 1024) {
            return NextResponse.json({ error: 'Image too large (max 2MB)' }, { status: 400 })
        }

        const ext = file_name?.split('.').pop() || 'png'
        const storagePath = `logos/${product_id}.${ext}`

        // Upload to Supabase Storage
        const { error: uploadError } = await supabase.storage
            .from('product-logos')
            .upload(storagePath, buffer, {
                contentType: content_type || 'image/png',
                upsert: true, // Replace if exists
            })

        if (uploadError) {
            console.error('Failed to upload logo:', uploadError)
            return NextResponse.json({ error: 'Failed to upload image' }, { status: 500 })
        }

        // Get public URL
        const { data: urlData } = supabase.storage
            .from('product-logos')
            .getPublicUrl(storagePath)

        const logoUrl = urlData.publicUrl

        // Update product
        const { error: updateError } = await supabase
            .from('products')
            .update({ logo_url: logoUrl } as never)
            .eq('id', product_id)

        if (updateError) {
            console.error('Failed to update product logo:', updateError)
            return NextResponse.json({ error: 'Failed to update product' }, { status: 500 })
        }

        return NextResponse.json({
            success: true,
            logo_url: logoUrl,
        })

    } catch (error) {
        console.error('Logo upload error:', error)
        return NextResponse.json({
            error: error instanceof Error ? error.message : 'Internal error'
        }, { status: 500 })
    }
}
