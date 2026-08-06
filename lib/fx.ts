/**
 * FX conversion: provider minor units → INR paise.
 *
 * Rates come from env so ops can refresh without a deploy:
 *   FX_USD_INR=86  FX_EUR_INR=93  FX_GBP_INR=110
 * Unknown currencies are treated as 1:1 with a loud warning (bad, but visible).
 */

export interface FxResult {
    amountInPaise: number
    fxRate: number
    currency: string
}

export function convertMinorToINRPaise(
    amountMinor: number,
    currency: string | null | undefined
): FxResult {
    const cur = (currency || 'INR').toUpperCase()

    if (cur === 'INR') {
        return { amountInPaise: Math.round(amountMinor), fxRate: 1, currency: cur }
    }

    const envKey = `FX_${cur}_INR`
    const fallback: Record<string, number> = { USD: 86, EUR: 93, GBP: 110 }
    const rate = Number(process.env[envKey]) || fallback[cur]

    if (!rate) {
        console.warn(`[FX] Unknown currency ${cur} — treating as 1:1. Set ${envKey} in env!`)
        return { amountInPaise: Math.round(amountMinor), fxRate: 1, currency: cur }
    }

    return { amountInPaise: Math.round(amountMinor * rate), fxRate: rate, currency: cur }
}
