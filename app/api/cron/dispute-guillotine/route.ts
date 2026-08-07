import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'
import { sendEmail } from '@/lib/email'

const CRON_SECRET = process.env.CRON_SECRET

export async function GET(request: Request) {
    if (request.headers.get('Authorization') !== `Bearer ${CRON_SECRET}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createAdminClient()

    try {
        const { data: stats } = await supabase
            .from('seller_service_stats')
            .select('*')
            
        let bannedCount = 0
        
        if (stats) {
            for (const seller of stats as any[]) {
                if (seller.total_services >= 5 && seller.dispute_rate > 0.30) {
                    
                    // Check if already banned
                    const { data: existing } = await supabase
                        .from('blacklist')
                        .select('id')
                        .eq('profile_id', seller.seller_id)
                        .single()
                        
                    if (!existing) {
                        const { data: profile } = await supabase.from('profiles').select('email, full_name, username').eq('id', seller.seller_id).single()
                        
                        await supabase.from('blacklist').insert({
                            entity_type: 'seller',
                            profile_id: seller.seller_id,
                            display_name: (profile as any)?.username || (profile as any)?.full_name || 'Seller',
                            offense_code: 'other',
                            note: 'Auto-ban: >30% of meetings disputed/fake',
                            created_by: seller.seller_id // system
                        } as never)
                        
                        await supabase.from('notifications').insert({
                            user_id: seller.seller_id,
                            type: 'system',
                            title: 'Account under review',
                            message: 'Your escrow is frozen pending review due to high dispute rates.',
                            read: false
                        } as never)
                        
                        const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim())
                        if (ADMIN_EMAILS[0]) {
                            await sendEmail({
                                to: ADMIN_EMAILS[0],
                                subject: 'Auto-Ban triggered for Seller',
                                html: `<p>Seller ${(profile as any)?.email} banned due to >30% dispute rate.</p>`
                            })
                        }
                        
                        bannedCount++
                    }
                }
            }
        }

        return NextResponse.json({ success: true, bannedCount })
    } catch (error) {
        console.error('Guillotine cron error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
