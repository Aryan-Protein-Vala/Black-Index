import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'
import { sendEmail } from '@/lib/email'
import { walletLowEmail } from '@/lib/email-templates'

/**
 * Wallet Check Cron Job
 * GET /api/cron/wallet-check
 * 
 * Runs daily to auto-pause products for Tier 2 founders with empty wallets.
 * 
 * Vercel Cron: Every day at 2 AM IST
 * cron: "30 20 * * *" (20:30 UTC = 2:00 IST)
 */

export async function GET(request: NextRequest) {
    // Verify cron secret
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createAdminClient()

    console.log('[WALLET CHECK] Starting cron job')

    try {
        // Find Tier 2 founders (no stripe_connect_id AND no razorpay_account_id)
        // whose wallet_balance is 0
        const { data: founders, error: fetchError } = await supabase
            .from('profiles')
            .select('id, email, full_name, wallet_balance')
            .eq('role', 'founder')
            .is('stripe_connect_id', null)
            .is('razorpay_account_id', null)
            .lte('wallet_balance', 0)

        if (fetchError) {
            console.error('[WALLET CHECK] Failed to fetch founders:', fetchError)
            return NextResponse.json({ error: 'Failed to fetch founders' }, { status: 500 })
        }

        if (!founders || founders.length === 0) {
            console.log('[WALLET CHECK] No founders with empty wallets')
            return NextResponse.json({ message: 'No action needed', paused: 0 })
        }

        let pausedProducts = 0
        let notifiedFounders = 0

        for (const founder of founders) {
            const typedFounder = founder as { id: string; email: string; full_name: string; wallet_balance: number }

            // Pause all active products for this founder
            const { data: updatedProducts, error: updateError } = await supabase
                .from('products')
                .update({ is_active: false } as never)
                .eq('founder_id', typedFounder.id)
                .eq('is_active', true)
                .select('id')

            if (!updateError && updatedProducts) {
                pausedProducts += updatedProducts.length

                if (updatedProducts.length > 0) {
                    console.log(`[WALLET CHECK] Paused ${updatedProducts.length} products for founder ${typedFounder.id}`)

                    // Notify founder
                    await supabase.from('notifications').insert({
                        user_id: typedFounder.id,
                        type: 'wallet_empty',
                        title: 'Products Paused — Wallet Empty',
                        message: `Your commission wallet is empty. ${updatedProducts.length} product(s) have been paused. Deposit funds to reactivate.`,
                        metadata: { paused_products: updatedProducts.length },
                        read: false,
                    } as never)

                    // Send email
                    if (typedFounder.email) {
                        try {
                            await sendEmail({
                                to: typedFounder.email,
                                subject: 'Products Paused — Wallet Empty',
                                html: walletLowEmail(typedFounder.full_name, typedFounder.wallet_balance),
                            })
                            notifiedFounders++
                        } catch (emailErr) {
                            console.error('[WALLET CHECK] Email failed for', typedFounder.id, emailErr)
                        }
                    }
                }
            }
        }

        console.log('[WALLET CHECK] Completed:', { pausedProducts, notifiedFounders })

        return NextResponse.json({
            success: true,
            message: 'Wallet check completed',
            founders_checked: founders.length,
            products_paused: pausedProducts,
            founders_notified: notifiedFounders,
        })

    } catch (error) {
        console.error('[WALLET CHECK] Cron job failed:', error)
        return NextResponse.json({
            error: error instanceof Error ? error.message : 'Internal error'
        }, { status: 500 })
    }
}

export async function POST(request: NextRequest) {
    return GET(request)
}
