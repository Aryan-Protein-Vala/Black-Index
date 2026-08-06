import { Resend } from 'resend'

let resend: Resend | null = null

function getResend(): Resend {
    if (!resend) {
        resend = new Resend(process.env.RESEND_API_KEY || 'dummy_key_for_build')
    }
    return resend
}

const FROM_EMAIL = 'Black Index <noreply@blackindex.in>'

interface SendEmailParams {
    to: string
    subject: string
    html: string
}

export async function sendEmail({ to, subject, html }: SendEmailParams) {
    // Every send attempt is logged to email_logs for debugging + audit.
    const log = async (success: boolean, providerId?: string, error?: string) => {
        try {
            const { createAdminClient } = await import('@/lib/supabase-server')
            const admin = createAdminClient()
            await admin.from('email_logs').insert({
                recipient: to,
                subject,
                success,
                provider_id: providerId || null,
                error: error || null,
            } as never)
        } catch {
            // logging must never break the caller
        }
    }

    if (!process.env.RESEND_API_KEY) {
        console.log('[EMAIL] RESEND_API_KEY not set, skipping email to', to)
        await log(false, undefined, 'RESEND_API_KEY not configured')
        return { success: false, error: 'RESEND_API_KEY not configured' }
    }

    try {
        const { data, error } = await getResend().emails.send({
            from: FROM_EMAIL,
            to,
            subject,
            html,
        })

        if (error) {
            console.error('[EMAIL] Failed to send:', error)
            await log(false, undefined, error.message)
            return { success: false, error: error.message }
        }

        console.log('[EMAIL] Sent to', to, '— ID:', data?.id)
        await log(true, data?.id)
        return { success: true, id: data?.id }
    } catch (err) {
        console.error('[EMAIL] Error:', err)
        const msg = err instanceof Error ? err.message : 'Unknown error'
        await log(false, undefined, msg)
        return { success: false, error: msg }
    }
}
