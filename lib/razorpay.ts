/**
 * Razorpay API Utility
 * Handles all Razorpay API interactions for Black Index
 * 
 * ┌─────────────────────────────────────────────────────────────────┐
 * │ SECURITY: THIS FILE MUST ONLY BE USED IN SERVER-SIDE CODE      │
 * │ - Contains RAZORPAY_KEY_SECRET (never expose to client)        │
 * │ - Contains RAZORPAYX_ACCOUNT_NUMBER (never expose to client)   │
 * │ - All payment operations MUST happen server-side               │
 * │ - Only import this in /app/api/* routes or server components   │
 * └─────────────────────────────────────────────────────────────────┘
 */

// SECURITY: These secrets are server-side only (no NEXT_PUBLIC_ prefix)
// They are NEVER bundled into client-side JavaScript
const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID!
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET!

const RAZORPAY_BASE_URL = 'https://api.razorpay.com/v1'

// Basic auth header for Razorpay
function getAuthHeader(): string {
    const credentials = Buffer.from(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`).toString('base64')
    return `Basic ${credentials}`
}

// Generic API call
async function razorpayRequest<T>(
    endpoint: string,
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE' = 'GET',
    body?: object
): Promise<T> {
    const response = await fetch(`${RAZORPAY_BASE_URL}${endpoint}`, {
        method,
        headers: {
            'Authorization': getAuthHeader(),
            'Content-Type': 'application/json',
        },
        body: body ? JSON.stringify(body) : undefined,
    })

    if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error?.description || 'Razorpay API error')
    }

    return response.json()
}

// ============ CUSTOMERS ============

interface RazorpayCustomer {
    id: string
    name: string
    email: string
    contact: string
}

export async function createCustomer(data: {
    name: string
    email: string
    contact: string
}): Promise<RazorpayCustomer> {
    return razorpayRequest('/customers', 'POST', data)
}

export async function getCustomer(customerId: string): Promise<RazorpayCustomer> {
    return razorpayRequest(`/customers/${customerId}`)
}

// ============ SUBSCRIPTIONS (Mandates) ============

interface RazorpaySubscription {
    id: string
    plan_id: string
    customer_id: string
    status: 'created' | 'authenticated' | 'active' | 'pending' | 'halted' | 'cancelled' | 'completed' | 'expired'
    short_url: string
    total_count: number
    paid_count: number
}

// Plan for metered/on-demand billing
const METERED_PLAN_ID = process.env.RAZORPAY_METERED_PLAN_ID // Create this in Razorpay Dashboard

export async function createSubscription(data: {
    customerId: string
    planId?: string
    totalCount?: number
    notes?: Record<string, string>
}): Promise<RazorpaySubscription> {
    return razorpayRequest('/subscriptions', 'POST', {
        plan_id: data.planId || METERED_PLAN_ID,
        customer_id: data.customerId,
        total_count: data.totalCount || 120, // Max 10 years monthly
        customer_notify: 1,
        notes: data.notes,
    })
}

export async function getSubscription(subscriptionId: string): Promise<RazorpaySubscription> {
    return razorpayRequest(`/subscriptions/${subscriptionId}`)
}

export async function cancelSubscription(subscriptionId: string): Promise<RazorpaySubscription> {
    return razorpayRequest(`/subscriptions/${subscriptionId}/cancel`, 'POST')
}

// ============ INVOICES (Charging against Mandate) ============

interface RazorpayInvoice {
    id: string
    subscription_id: string
    amount: number
    status: 'draft' | 'issued' | 'partially_paid' | 'paid' | 'cancelled' | 'expired'
    payment_id: string | null
    short_url: string
}

export async function createInvoice(data: {
    subscriptionId: string
    amount: number // In paise
    description: string
}): Promise<RazorpayInvoice> {
    return razorpayRequest('/invoices', 'POST', {
        type: 'invoice',
        subscription_id: data.subscriptionId,
        line_items: [{
            name: 'Commission Settlement',
            description: data.description,
            amount: data.amount,
            currency: 'INR',
            quantity: 1,
        }],
        sms_notify: 1,
        email_notify: 1,
    })
}

export async function getInvoice(invoiceId: string): Promise<RazorpayInvoice> {
    return razorpayRequest(`/invoices/${invoiceId}`)
}

// ============ RAZORPAYX PAYOUTS ============

const RAZORPAYX_ACCOUNT_NUMBER = process.env.RAZORPAYX_ACCOUNT_NUMBER

interface RazorpayXFundAccount {
    id: string
    contact_id: string
    account_type: 'vpa' | 'bank_account'
    active: boolean
}

interface RazorpayXPayout {
    id: string
    fund_account_id: string
    amount: number
    status: 'queued' | 'pending' | 'processing' | 'processed' | 'reversed' | 'cancelled' | 'rejected'
    utr: string | null
}

// Create a fund account for UPI payouts
export async function createFundAccount(data: {
    contactId: string
    upiVpa: string
}): Promise<RazorpayXFundAccount> {
    return razorpayRequest('/fund_accounts', 'POST', {
        contact_id: data.contactId,
        account_type: 'vpa',
        vpa: {
            address: data.upiVpa,
        },
    })
}

// Create a RazorpayX contact (linked to seller profile)
interface RazorpayXContact {
    id: string
    name: string
    email: string
    contact: string
    type: string
}

export async function createContact(data: {
    name: string
    email: string
    contact: string
    type?: string
    referenceId?: string
}): Promise<RazorpayXContact> {
    return razorpayRequest('/contacts', 'POST', {
        name: data.name,
        email: data.email,
        contact: data.contact,
        type: data.type || 'vendor',
        reference_id: data.referenceId,
    })
}

// Execute payout to seller
export async function createPayout(data: {
    fundAccountId: string
    amount: number // In paise
    purpose: string
    referenceId: string
}): Promise<RazorpayXPayout> {
    return razorpayRequest('/payouts', 'POST', {
        account_number: RAZORPAYX_ACCOUNT_NUMBER,
        fund_account_id: data.fundAccountId,
        amount: data.amount,
        currency: 'INR',
        mode: 'UPI',
        purpose: data.purpose,
        reference_id: data.referenceId,
        narration: 'Black Index Payout',
    })
}

export async function getPayout(payoutId: string): Promise<RazorpayXPayout> {
    return razorpayRequest(`/payouts/${payoutId}`)
}

// ============ WEBHOOK VERIFICATION ============

import crypto from 'crypto'

export function verifyWebhookSignature(
    body: string,
    signature: string,
    secret: string
): boolean {
    const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(body)
        .digest('hex')

    const bufSig = Buffer.from(signature)
    const bufExpected = Buffer.from(expectedSignature)

    if (bufSig.length !== bufExpected.length) {
        return false
    }

    return crypto.timingSafeEqual(bufSig, bufExpected)
}
