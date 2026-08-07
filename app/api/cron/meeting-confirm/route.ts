import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'
import { sendEmail } from '@/lib/email'
import crypto from 'crypto'

const CRON_SECRET = process.env.CRON_SECRET
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://blackindex.in'

export async function GET(request: Request) {
    if (request.headers.get('Authorization') !== `Bearer ${CRON_SECRET}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createAdminClient()

    try {
        // 1. Auto-confirm meetings older than 48h after start
        const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()
        const { data: autoConfirmTxs } = await supabase
            .from('transactions')
            .select('id, seller_id, commission_amount, external_customer_id')
            .eq('vertical', 'service')
            .eq('status', 'pending')
            .eq('confirmed_by_buyer', false)
            .lt('meeting_start_at', fortyEightHoursAgo)

        if (autoConfirmTxs && autoConfirmTxs.length > 0) {
            for (const tx of autoConfirmTxs as any[]) {
                await supabase.from('transactions').update({ confirmed_by_buyer: true } as never).eq('id', tx.id)
                await supabase.rpc('release_cleared_funds' as never, { p_seller_id: tx.seller_id, p_amount: tx.commission_amount } as never)
                
                // Notify
                await supabase.from('notifications').insert({
                    user_id: tx.seller_id,
                    type: 'queue_settled',
                    title: 'Meeting Auto-Confirmed',
                    message: `Meeting with ${tx.external_customer_id} auto-confirmed (48h). Funds released.`,
                    read: false
                } as never)
            }
        }

        // 2. Send confirmation emails for meetings that just passed their start time
        const nowStr = new Date().toISOString()
        const { data: requireConfirmTxs } = await supabase
            .from('transactions')
            .select('id, external_customer_id, products(name)')
            .eq('vertical', 'service')
            .eq('status', 'pending')
            .eq('confirmed_by_buyer', false)
            .lt('meeting_start_at', nowStr)
            .gte('meeting_start_at', fortyEightHoursAgo)
            
        // In reality we'd need a flag to ensure we only send the email once.
        // Let's assume we use a metadata flag for email_sent
        const txsToEmail = (requireConfirmTxs || []).filter((tx: any) => !tx.metadata?.email_sent)
        
        let sentCount = 0
        for (const tx of txsToEmail as any[]) {
            const yesToken = crypto.createHmac('sha256', CRON_SECRET || '').update(`${tx.id}|yes`).digest('hex')
            const noToken = crypto.createHmac('sha256', CRON_SECRET || '').update(`${tx.id}|no`).digest('hex')
            
            const yesUrl = `${APP_URL}/api/meetings/confirm/${tx.id}?choice=yes&token=${yesToken}`
            const noUrl = `${APP_URL}/api/meetings/confirm/${tx.id}?choice=no&token=${noToken}`

            await sendEmail({
                to: tx.external_customer_id,
                subject: `Did your meeting for ${tx.products?.name} happen?`,
                html: `
                    <p>Hi there,</p>
                    <p>We hope you had a great meeting regarding ${tx.products?.name}. Please confirm if the meeting took place so we can pay the affiliate who referred you.</p>
                    <p><a href="${yesUrl}" style="padding: 10px 20px; background: #10b981; color: white; text-decoration: none; border-radius: 5px;">Yes, it happened</a></p>
                    <p><br><a href="${noUrl}" style="color: #ef4444; text-decoration: underline;">No, it did not happen or I want to dispute</a></p>
                `
            })
            
            const existingMeta = tx.metadata || {}
            await supabase.from('transactions').update({ metadata: { ...existingMeta, email_sent: true } } as never).eq('id', tx.id)
            sentCount++
        }

        return NextResponse.json({ 
            success: true, 
            autoConfirmed: autoConfirmTxs?.length || 0,
            emailsSent: sentCount
        })
    } catch (error) {
        console.error('Meeting confirm cron error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
