/**
 * Canonical money/config constants. Single source of truth.
 * All amounts in paise unless stated otherwise.
 */

// Withdrawals
export const MINIMUM_WITHDRAWAL = 100_000 // ₹1,000
export const WITHDRAWAL_RATE_LIMIT_PER_MIN = 1

// Founder wallet thresholds (wallet-only billing model)
export const LOW_BALANCE_WARN = 200_000 // ₹2,000 — warn founder
export const PAUSE_BALANCE_THRESHOLD = 50_000 // ₹500 — auto-pause products below this

// Platform
export const PLATFORM_FEE_PCT = 5
export const ESCROW_DAYS = 30

// Payouts / webhooks
export const RAZORPAYX_WEBHOOK_SECRET = process.env.RAZORPAYX_WEBHOOK_SECRET
