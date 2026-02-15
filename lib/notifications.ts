import { SupabaseClient } from '@supabase/supabase-js'

/**
 * Notification Helpers for Black Index
 * 
 * Handles RBI-compliant pre-debit notifications and other alerts
 */

interface ChargeNotificationData {
    founderId: string
    amount: number
    scheduledAt: Date
    transactionsCount: number
}

interface PayoutNotificationData {
    sellerId: string
    amount: number
    payoutId: string
}

/**
 * Send 24h pre-debit notification to founder (RBI Compliance)
 */
export async function sendPreDebitNotification(
    supabase: SupabaseClient,
    data: ChargeNotificationData
): Promise<{ success: boolean; error?: string }> {
    try {
        // Get founder details
        const { data: founder, error: founderError } = await supabase
            .from('profiles')
            .select('email, full_name, phone')
            .eq('id', data.founderId)
            .single()

        if (founderError || !founder) {
            return { success: false, error: 'Founder not found' }
        }

        const typedFounder = founder as { email: string; full_name: string; phone: string | null }
        const amountInRupees = data.amount / 100
        const scheduledDate = data.scheduledAt.toLocaleDateString('en-IN', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        })

        // Log notification (in production, integrate with email service like Resend/SendGrid)
        console.log('[NOTIFICATION] Pre-debit notification:', {
            to: typedFounder.email,
            type: 'PRE_DEBIT_24H',
            amount: amountInRupees,
            scheduledAt: scheduledDate,
        })

        // Store notification record
        await supabase.from('notifications').insert({
            user_id: data.founderId,
            type: 'pre_debit',
            title: `Upcoming charge: ₹${amountInRupees.toLocaleString('en-IN')}`,
            message: `We will charge ₹${amountInRupees.toLocaleString('en-IN')} from your autopay on ${scheduledDate}. This covers ${data.transactionsCount} commission payouts.`,
            metadata: {
                amount: data.amount,
                scheduled_at: data.scheduledAt.toISOString(),
                transactions_count: data.transactionsCount,
            },
            read: false,
        } as never)

        // In production, send actual email here:
        // await sendEmail({
        //     to: typedFounder.email,
        //     subject: `Black Index - Upcoming charge of ₹${amountInRupees}`,
        //     template: 'pre-debit-notification',
        //     data: { ... }
        // })

        return { success: true }
    } catch (error) {
        console.error('[NOTIFICATION] Failed to send pre-debit notification:', error)
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
}

/**
 * Send charge failure notification to founder
 */
export async function sendChargeFailureNotification(
    supabase: SupabaseClient,
    founderId: string,
    amount: number,
    reason: string,
    retryCount: number
): Promise<void> {
    const { data: founder } = await supabase
        .from('profiles')
        .select('email, full_name')
        .eq('id', founderId)
        .single()

    const typedFounder = founder as { email: string; full_name: string } | null
    const amountInRupees = amount / 100

    console.log('[NOTIFICATION] Charge failure:', {
        to: typedFounder?.email,
        amount: amountInRupees,
        reason,
        retryCount,
    })

    // Store notification
    await supabase.from('notifications').insert({
        user_id: founderId,
        type: 'charge_failed',
        title: 'Payment failed',
        message: retryCount < 3
            ? `We couldn't charge ₹${amountInRupees.toLocaleString('en-IN')}. We'll retry automatically. Reason: ${reason}`
            : `Payment of ₹${amountInRupees.toLocaleString('en-IN')} failed after multiple attempts. Please update your payment method.`,
        metadata: { amount, reason, retry_count: retryCount },
        read: false,
    } as never)
}

/**
 * Send payout success notification to seller
 */
export async function sendPayoutNotification(
    supabase: SupabaseClient,
    data: PayoutNotificationData
): Promise<void> {
    const { data: seller } = await supabase
        .from('profiles')
        .select('email, full_name')
        .eq('id', data.sellerId)
        .single()

    const typedSeller = seller as { email: string; full_name: string } | null
    const amountInRupees = data.amount / 100

    console.log('[NOTIFICATION] Payout sent:', {
        to: typedSeller?.email,
        amount: amountInRupees,
    })

    await supabase.from('notifications').insert({
        user_id: data.sellerId,
        type: 'payout_sent',
        title: `₹${amountInRupees.toLocaleString('en-IN')} sent to your account`,
        message: `Your payout of ₹${amountInRupees.toLocaleString('en-IN')} has been sent. It should arrive within 2-4 hours.`,
        metadata: { amount: data.amount, payout_id: data.payoutId },
        read: false,
    } as never)
}

/**
 * Send new sale notification to seller
 */
export async function sendNewSaleNotification(
    supabase: SupabaseClient,
    sellerId: string,
    productName: string,
    commission: number
): Promise<void> {
    const amountInRupees = commission / 100

    await supabase.from('notifications').insert({
        user_id: sellerId,
        type: 'new_sale',
        title: `New sale: ₹${amountInRupees.toLocaleString('en-IN')} earned!`,
        message: `You earned ₹${amountInRupees.toLocaleString('en-IN')} from a ${productName} sale. Funds will be available in 30 days.`,
        metadata: { commission, product_name: productName },
        read: false,
    } as never)
}
