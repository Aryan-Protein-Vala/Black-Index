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
    if (!process.env.RESEND_API_KEY) {
        console.log('[EMAIL] RESEND_API_KEY not set, skipping email to', to)
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
            return { success: false, error: error.message }
        }

        console.log('[EMAIL] Sent to', to, '— ID:', data?.id)
        return { success: true, id: data?.id }
    } catch (err) {
        console.error('[EMAIL] Error:', err)
        return { success: false, error: err instanceof Error ? err.message : 'Unknown error' }
    }
}
