import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'
import crypto from 'crypto'
import { sendEmail } from '@/lib/email'

const CRON_SECRET = process.env.CRON_SECRET

export async function GET(request: NextRequest, { params }: { params: Promise<{ txId: string }> }) {
    const { txId } = await params
    const url = new URL(request.url)
    const choice = url.searchParams.get('choice')
    const token = url.searchParams.get('token')

    if (!choice || !token || !['yes', 'no'].includes(choice)) {
        return new NextResponse('Invalid request', { status: 400 })
    }

    const expectedToken = crypto.createHmac('sha256', CRON_SECRET || '').update(`${txId}|${choice}`).digest('hex')
    const expectedBuf = Buffer.from(expectedToken)
    const actualBuf = Buffer.from(token)
    
    if (expectedBuf.length !== actualBuf.length || !crypto.timingSafeEqual(expectedBuf, actualBuf)) {
        return new NextResponse('Invalid token', { status: 401 })
    }

    const supabase = createAdminClient()
    
    const { data: tx } = await supabase
        .from('transactions')
        .select('id, seller_id, commission_amount, status, confirmed_by_buyer')
        .eq('id', txId)
        .single()

    const t = tx as any;
    if (!t || t.status !== 'pending' || t.confirmed_by_buyer) {
        return new NextResponse('Transaction already processed', { status: 400 })
    }

    if (choice === 'yes') {
        await supabase.from('transactions').update({ confirmed_by_buyer: true } as never).eq('id', txId)
        await supabase.rpc('release_cleared_funds' as never, { p_seller_id: t.seller_id, p_amount: t.commission_amount } as never)
        
        await supabase.from('notifications').insert({
            user_id: t.seller_id,
            type: 'queue_settled',
            title: 'Meeting Confirmed',
            message: 'Meeting confirmed — funds released.',
            read: false
        } as never)

        return new NextResponse('Thank you! Meeting confirmed. You can close this window.', { status: 200 })
    } else {
        await supabase.from('transactions').update({ status: 'disputed' } as never).eq('id', txId)
        
        const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim())
        if (ADMIN_EMAILS[0]) {
            await sendEmail({
                to: ADMIN_EMAILS[0],
                subject: 'ACTION REQUIRED: Meeting Disputed',
                html: `<p>Transaction ${txId} was disputed by the buyer.</p>`
            })
        }
        
        return new NextResponse('Meeting disputed. Our admins have been notified and will review.', { status: 200 })
    }
}
