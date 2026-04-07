import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'

/**
 * POST — Submit a fraud report
 * GET — Get user's own fraud reports
 */

export async function POST(request: NextRequest) {
    const supabase = createAdminClient()
    const body = await request.json()
    const { reporter_id, product_id, founder_id, evidence_url, description } = body

    if (!reporter_id || !product_id || !evidence_url) {
        return NextResponse.json({ error: 'Missing required fields (reporter_id, product_id, evidence_url)' }, { status: 400 })
    }

    const { data, error } = await supabase
        .from('fraud_reports')
        .insert({
            reporter_id,
            product_id,
            founder_id: founder_id || null,
            evidence_url,
            description: description || null,
            status: 'pending',
        } as never)
        .select()
        .single()

    if (error) {
        console.error('Failed to create fraud report:', error)
        return NextResponse.json({ error: 'Failed to submit report' }, { status: 500 })
    }

    // Notify admin (in-app)
    await supabase.from('notifications').insert({
        user_id: reporter_id,
        type: 'fraud_report_submitted',
        title: 'Fraud Report Submitted',
        message: 'Your fraud report has been submitted and will be reviewed within 48 hours. If verified, you will receive the ₹2,500 bounty.',
        metadata: { report_id: (data as any).id, product_id },
        read: false,
    } as never)

    return NextResponse.json({
        success: true,
        message: 'Fraud report submitted. You will be notified of the outcome.',
        report_id: (data as any).id,
    })
}

export async function GET(request: NextRequest) {
    const supabase = createAdminClient()
    const userId = request.nextUrl.searchParams.get('user_id')

    if (!userId) {
        return NextResponse.json({ error: 'Missing user_id' }, { status: 400 })
    }

    const { data, error } = await supabase
        .from('fraud_reports')
        .select('*')
        .eq('reporter_id', userId)
        .order('created_at', { ascending: false })

    if (error) {
        return NextResponse.json({ error: 'Failed to fetch reports' }, { status: 500 })
    }

    return NextResponse.json({ reports: data })
}
