/**
 * Admin authorization. No hardcoded emails in code —
 * set ADMIN_EMAILS="a@x.com,b@y.com" in env.
 */

export function isAdminEmail(email: string | null | undefined): boolean {
    if (!email) return false
    const list = (process.env.ADMIN_EMAILS || '')
        .split(',')
        .map(e => e.trim().toLowerCase())
        .filter(Boolean)
    return list.includes(email.toLowerCase())
}

/**
 * Verifies the request's session user is an admin (env ADMIN_EMAILS).
 * Returns { ok: true } or { ok: false, response } with an error response.
 */
export async function requireAdmin() {
    const { createServerSupabaseClient } = await import('@/lib/supabase-server')
    const supabase = await createServerSupabaseClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
        return { ok: false as const, response: NextResponseJson('Unauthorized', 401) }
    }
    if (!isAdminEmail(user.email)) {
        return { ok: false as const, response: NextResponseJson('Admin access required', 403) }
    }
    return { ok: true as const, userId: user.id }
}

import { NextResponse } from 'next/server'
function NextResponseJson(body: string, status: number) {
    return NextResponse.json({ error: body }, { status })
}
