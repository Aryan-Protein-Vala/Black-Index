import { createAdminClient } from '@/lib/supabase-server'

/**
 * DB-backed sliding-window rate limiter (no external deps).
 * Returns true if the request is ALLOWED.
 */
export async function checkRateLimit(
    key: string,
    limit: number,
    windowSeconds: number
): Promise<boolean> {
    try {
        const supabase = createAdminClient()
        const { data, error } = await supabase.rpc('check_rate_limit' as never, {
            p_key: key,
            p_limit: limit,
            p_window_secs: windowSeconds,
        } as never)

        if (error) {
            // Fail open but log — a broken limiter must not take the product down
            console.error('[RATE LIMIT] check failed, allowing:', error)
            return true
        }
        return data === true
    } catch (err) {
        console.error('[RATE LIMIT] error, allowing:', err)
        return true
    }
}
