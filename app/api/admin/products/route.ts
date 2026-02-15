import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, createAdminClient } from '@/lib/supabase-server'

// Admin emails - only these users can access admin API
const ADMIN_EMAILS = [
    "aryansharma24112003@gmail.com"
]

/**
 * POST /api/admin/products
 * Admin actions: toggle active, delete products
 */
export async function POST(request: NextRequest) {
    try {
        // Use server client with cookies to get user
        const authClient = await createServerSupabaseClient()
        const { data: { user } } = await authClient.auth.getUser()

        if (!user || !ADMIN_EMAILS.includes(user.email || '')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // Use admin client for database operations (bypasses RLS)
        const supabase = createAdminClient()

        const body = await request.json()
        const { action, productId } = body

        if (!productId) {
            return NextResponse.json({ error: 'Product ID required' }, { status: 400 })
        }

        // Get product first
        const { data: product, error: fetchError } = await supabase
            .from('products')
            .select('id, name, is_active, is_founders_choice')
            .eq('id', productId)
            .single()

        if (fetchError || !product) {
            return NextResponse.json({ error: 'Product not found' }, { status: 404 })
        }

        const typedProduct = product as { id: string; name: string; is_active: boolean; is_founders_choice: boolean }

        switch (action) {
            case 'toggle_active': {
                const { error } = await supabase
                    .from('products')
                    .update({ is_active: !typedProduct.is_active } as never)
                    .eq('id', productId)

                if (error) throw error

                return NextResponse.json({
                    success: true,
                    message: `Product ${typedProduct.is_active ? 'paused' : 'activated'}`,
                    is_active: !typedProduct.is_active
                })
            }

            case 'toggle_founders_choice': {
                const { error } = await supabase
                    .from('products')
                    .update({ is_founders_choice: !typedProduct.is_founders_choice } as never)
                    .eq('id', productId)

                if (error) throw error

                return NextResponse.json({
                    success: true,
                    message: `Founder's Choice ${typedProduct.is_founders_choice ? 'removed' : 'added'}`,
                    is_founders_choice: !typedProduct.is_founders_choice
                })
            }

            case 'delete': {
                // First delete related links
                await supabase
                    .from('links')
                    .delete()
                    .eq('product_id', productId)

                // Delete related transactions
                await supabase
                    .from('transactions')
                    .delete()
                    .eq('product_id', productId)

                // Then delete the product
                const { error } = await supabase
                    .from('products')
                    .delete()
                    .eq('id', productId)

                if (error) throw error

                return NextResponse.json({
                    success: true,
                    message: `Product "${typedProduct.name}" deleted`
                })
            }

            default:
                return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
        }

    } catch (error) {
        console.error('Admin products API error:', error)
        return NextResponse.json({
            error: error instanceof Error ? error.message : 'Internal error'
        }, { status: 500 })
    }
}
