import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, createAdminClient } from '@/lib/supabase-server'
import { isAdminEmail } from '@/lib/admin'

/**
 * POST /api/admin/products
 * Admin actions: toggle active, delete products
 */
export async function POST(request: NextRequest) {
    try {
        // Use server client with cookies to get user
        const authClient = await createServerSupabaseClient()
        const { data: { user } } = await authClient.auth.getUser()

        if (!user || !isAdminEmail(user.email)) {
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
                // SOFT delete: hide from listings + null out sensitive fields,
                // but KEEP the row so financial transactions keep their FK and
                // the audit trail survives (hard-deleting transactions would
                // destroy escrow history required for accounting/compliance).
                const { error } = await supabase
                    .from('products')
                    .update({
                        is_active: false,
                        name: `[DELETED] ${typedProduct.name}`,
                        description: null,
                        website_url: `https://blackindex.in/deleted/${productId}`,
                        verified_at: null,
                        auto_paused: true,
                    } as never)
                    .eq('id', productId)

                if (error) throw error

                return NextResponse.json({
                    success: true,
                    message: `Product "${typedProduct.name}" removed from listings (records preserved)`
                })
            }

            case 'certify': {
                // Manual certification: proves the money pipe (used when a
                // founder verified via an offline/manual proof, or a webhook
                // sale predates verified_at). Sets verified_at so the product
                // appears in the public Vault.
                const { data: productRow } = await supabase
                    .from('products')
                    .select('id, name, verified_at')
                    .eq('id', productId)
                    .single()
                const pr = productRow as any

                if (pr?.verified_at) {
                    return NextResponse.json({
                        success: true,
                        message: 'Product already certified',
                        verified_at: pr.verified_at,
                    })
                }

                const { error } = await supabase
                    .from('products')
                    .update({ verified_at: new Date().toISOString(), is_active: true, auto_paused: false } as never)
                    .eq('id', productId)

                if (error) throw error

                return NextResponse.json({
                    success: true,
                    message: `Product "${typedProduct.name}" certified — now visible in the Vault`
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
