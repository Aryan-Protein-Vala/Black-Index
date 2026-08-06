import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, createAdminClient } from '@/lib/supabase-server'
import { checkRateLimit } from '@/lib/rate-limit'

/**
 * POST — Submit a fraud report (SEC-5: was ZERO auth; anyone could file
 * reports as anyone and read anyone's reports via ?user_id=)
 * GET  — Get your OWN fraud reports
 */

export async function POST(request: NextRequest) {
    const sessionClient = await createServerSupabaseClient()
    const { data: { user }, error: authError } = await sessionClient.auth.getUser()
    if (authError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!(await checkRateLimit(`fraud-report:${user.id}`, 5, 86400))) {
        return NextResponse.json({ error: 'Report limit reached (5/day)' }, { status: 429 })
    }

    const body = await request.json()
    const { product_id, founder_id, evidence_url, description } = body

    if (!product_id || !evidence_url) {
        return NextResponse.json({ error: 'Missing required fields (product_id, evidence_url)' }, { status: 400 })
    }

    const supabase = createAdminClient()
    const { data, error } = await supabase
        .from('fraud_reports')
        .insert({
            reporter_id: user.id, // always the session user — never trust the body
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

    await supabase.from('notifications').insert({
        user_id: user.id,
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

export async function GET() {
    const sessionClient = await createServerSupabaseClient()
    const { data: { user }, error: authError } = await sessionClient.auth.getUser()
    if (authError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createAdminClient()
    const { data, error } = await supabase
        .from('fraud_reports')
        .select('*')
        .eq('reporter_id', user.id) // own reports only, from the session
        .order('created_at', { ascending: false })

    if (error) {
        return NextResponse.json({ error: 'Failed to fetch reports' }, { status: 500 })
    }

    return NextResponse.json({ reports: data })
}
