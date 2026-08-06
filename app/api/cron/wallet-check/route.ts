import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'
import { sendEmail } from '@/lib/email'
import { walletLowEmail } from '@/lib/email-templates'
import { LOW_BALANCE_WARN, PAUSE_BALANCE_THRESHOLD } from '@/lib/constants'

/**
 * Wallet Health Cron
 * GET /api/cron/wallet-check — daily
 *
 * Wallet-only billing model: founders pre-fund commissions.
 *
 * TWO thresholds (the old version only acted at exactly ₹0, leaving a
 * dead zone where products stayed listed but sellers silently earned ₹0):
 *
 * 1. balance < LOW_BALANCE_WARN (₹2,000)  → warning email + notification (1/day digest)
 * 2. balance < PAUSE_BALANCE_THRESHOLD (₹500) → auto-pause products
 *    (auto_paused=true so top-ups can safely auto-resume ONLY these)
 *
 * Auto-resume happens in settle_queued_conversions on every wallet top-up.
 */
export async function GET(request: NextRequest) {
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createAdminClient()
    console.log('[WALLET CHECK] Starting cron job')

    try {
        const { data: founders, error: fetchError } = await supabase
            .from('profiles')
            .select('id, email, full_name, wallet_balance')
            .eq('role', 'founder')
            .lt('wallet_balance', LOW_BALANCE_WARN)

        if (fetchError) {
            console.error('[WALLET CHECK] Failed to fetch founders:', fetchError)
            return NextResponse.json({ error: 'Failed to fetch founders' }, { status: 500 })
        }

        if (!founders || founders.length === 0) {
            return NextResponse.json({ message: 'All wallets healthy', warned: 0, paused: 0 })
        }

        let warnedFounders = 0
        let pausedFounders = 0
        let pausedProducts = 0

        for (const raw of founders) {
            const founder = raw as { id: string; email: string; full_name: string; wallet_balance: number }
            const shouldPause = founder.wallet_balance < PAUSE_BALANCE_THRESHOLD
            const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

            if (shouldPause) {
                // Pause active products, tag as auto_paused (top-ups auto-resume these only)
                const { data: updatedProducts } = await supabase
                    .from('products')
                    .update({ is_active: false, auto_paused: true } as never)
                    .eq('founder_id', founder.id)
                    .eq('is_active', true)
                    .select('id')

                const count = updatedProducts?.length || 0
                if (count > 0) {
                    pausedFounders++
                    pausedProducts += count

                    await supabase.from('notifications').insert({
                        user_id: founder.id,
                        type: 'wallet_empty',
                        title: 'Products Paused — Wallet Empty',
                        message: `Your commission wallet balance (₹${(founder.wallet_balance / 100).toLocaleString('en-IN')}) is too low. ${count} product(s) paused. Top up — they'll resume automatically and queued sellers get paid.`,
                        metadata: { paused_products: count, wallet_balance: founder.wallet_balance },
                        read: false,
                    } as never)
                }
            } else {
                // Low-balance warning, digest-limited to 1/day
                const { count: recentWarn } = await supabase
                    .from('notifications')
                    .select('*', { count: 'exact', head: true })
                    .eq('user_id', founder.id)
                    .eq('type', 'wallet_low')
                    .gte('created_at', dayAgo)

                if (!recentWarn || recentWarn === 0) {
                    await supabase.from('notifications').insert({
                        user_id: founder.id,
                        type: 'wallet_low',
                        title: 'Wallet running low',
                        message: `Your commission wallet has ₹${(founder.wallet_balance / 100).toLocaleString('en-IN')} left. If it empties, products pause and sellers stop earning.`,
                        metadata: { wallet_balance: founder.wallet_balance },
                        read: false,
                    } as never)

                    if (founder.email) {
                        try {
                            await sendEmail({
                                to: founder.email,
                                subject: 'Your BlackIndex wallet is running low',
                                html: walletLowEmail(founder.full_name, founder.wallet_balance),
                            })
                        } catch (emailErr) {
                            console.error('[WALLET CHECK] Email failed for', founder.id, emailErr)
                        }
                    }
                    warnedFounders++
                }
            }
        }

        console.log('[WALLET CHECK] Completed:', { warnedFounders, pausedFounders, pausedProducts })

        return NextResponse.json({
            success: true,
            founders_checked: founders.length,
            warned: warnedFounders,
            paused_founders: pausedFounders,
            products_paused: pausedProducts,
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
