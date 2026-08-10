/**
 * Email normalization for self-referral / collusion checks.
 *
 * Gmail-style providers treat dots and +tags as the same mailbox:
 *   seller+test@gmail.com === seller@gmail.com === s.e.l.l.e.r@gmail.com
 * A naive string compare lets a seller "buy" through their own link with a
 * sub-addressed alias and earn their own commission. Normalize before comparing.
 */

const DOT_PROVIDERS = new Set(['gmail.com', 'googlemail.com'])

export function normalizeEmail(email: string | null | undefined): string | null {
    if (!email) return null
    const trimmed = email.trim().toLowerCase()
    if (!trimmed.includes('@')) return trimmed

    const [localRaw, ...domainParts] = trimmed.split('@')
    const domain = domainParts.join('@').toLowerCase()
    if (!localRaw || !domain) return null

    let local = localRaw
    if (DOT_PROVIDERS.has(domain)) {
        // strip +tag (sub-addressing) and dots (gmail ignores them)
        local = local.split('+')[0].replace(/\./g, '')
    }
    return `${local}@${domain}`
}

export function emailsMatch(a: string | null | undefined, b: string | null | undefined): boolean {
    const na = normalizeEmail(a)
    const nb = normalizeEmail(b)
    if (!na || !nb) return false
    return na === nb
}
