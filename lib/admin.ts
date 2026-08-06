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
