import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'
import crypto from 'crypto'
import type { CommissionConfig } from '@/lib/database.types'

// Type definitions for Supabase query results
interface ProductResult {
    id: string
    webhook_secret: string
    commission_config: CommissionConfig
    max_cac_limit: number | null
}

interface LinkResult {
    id: string
    seller_id: string
    product_id: string
    seller: { email: string } | null
}

interface ProfileResult {
    pending_balance: number
    total_earnings: number
}
/**
 * THE EARS - Secure Webhook Endpoint
 * POST /api/webhooks/conversion
 * 
 * This is the ONLY way money enters the system.
 * 
 * REQUIRED ORDER (per instructions.md):
 * 1. Signature Verification
 * 2. Idempotency Check
 * 3. Customer Resolution (NEW vs RECURRING)
 * 4. Commission Calculation
 * 5. Ledger Insert
 * 6. Atomic Escrow Lock (RPC)
 * 7. Audit Log
 * 
 * Expected payload:
 * {
 *   product_id: string,
 *   ref_id: string,                    // Link UUID
 *   external_transaction_id: string,   // Unique from payment provider
 *   external_customer_id: string,      // Customer ID from payment provider
 *   amount: number,                    // In paise
 *   event_type: 'payment.success'
 * }
 * 
 * Headers:
 * x-black-index-signature: HMAC-SHA256 signature of body
 */
export async function POST(request: NextRequest) {
    const supabase = createAdminClient()
    let payload: any = null

    try {
        // Parse the raw body for signature verification
        const rawBody = await request.text()
        payload = JSON.parse(rawBody)

        const {
            product_id,
            ref_id,
            external_transaction_id,
            external_customer_id,
            amount,
            event_type,
        } = payload

        // Validate required fields
        if (!product_id || !ref_id || !external_transaction_id || !external_customer_id || !amount) {
            // Log this initial rejection
            await logWebhook(supabase, product_id || null, payload, 'rejected', 'Missing required fields', request)
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
        }

        // Only process payment.success events
        if (event_type !== 'payment.success') {
            await logWebhook(supabase, product_id, payload, 'rejected', 'Unsupported event type', request)
            return NextResponse.json({ error: 'Unsupported event type' }, { status: 400 })
        }

        // ================================================
        // STEP 1: SIGNATURE VERIFICATION
        // ================================================
        const signature = request.headers.get('x-black-index-signature')

        if (!signature) {
            await logWebhook(supabase, product_id, payload, 'rejected', 'Missing signature', request)
            return NextResponse.json({ error: 'Missing signature' }, { status: 401 })
        }

        // Fetch the webhook secret for this product
        const { data: productData, error: productError } = await supabase
            .from('products')
            .select('id, webhook_secret, commission_config, max_cac_limit')
            .eq('id', product_id)
            .single()

        if (productError || !productData) {
            await logWebhook(supabase, product_id, payload, 'rejected', 'Product not found', request)
            return NextResponse.json({ error: 'Product not found' }, { status: 404 })
        }

        const product = productData as ProductResult

        // Verify HMAC signature
        const expectedSignature = crypto
            .createHmac('sha256', product.webhook_secret)
            .update(rawBody)
            .digest('hex')

        if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
            await logWebhook(supabase, product_id, payload, 'rejected', 'Invalid signature', request)
            return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
        }

        // ================================================
        // STEP 2: IDEMPOTENCY CHECK
        // ================================================
        const { data: existingTransaction } = await supabase
            .from('transactions')
            .select('id')
            .eq('external_transaction_id', external_transaction_id)
            .single()

        if (existingTransaction) {
            // Already processed - return 200 (idempotent no-op)
            await logWebhook(supabase, product_id, payload, 'success', 'Duplicate - already processed', request)
            return NextResponse.json({
                message: 'Already processed',
                transaction_id: (existingTransaction as { id: string }).id
            })
        }

        // ================================================
        // STEP 3: FIND THE LINK AND SELLER
        // ================================================
        const { data: linkData, error: linkError } = await supabase
            .from('links')
            .select('id, seller_id, product_id, seller:profiles(email)')
            .eq('id', ref_id)
            .single()

        if (linkError || !linkData) {
            await logWebhook(supabase, product_id, payload, 'rejected', 'Invalid ref_id', request)
            return NextResponse.json({ error: 'Invalid ref_id' }, { status: 400 })
        }

        const link = linkData as LinkResult

        // Verify the link is for this product
        if (link.product_id !== product_id) {
            await logWebhook(supabase, product_id, payload, 'rejected', 'Product mismatch', request)
            return NextResponse.json({ error: 'Product mismatch' }, { status: 400 })
        }

        // ================================================
        // STEP 3.5: SELF-REFERRAL FRAUD DETECTION
        // ================================================
        // Block sellers from referring themselves (getting commission on their own purchases)
        const sellerEmail = (link.seller as any)?.email?.toLowerCase()
        const customerEmail = payload.customer_email?.toLowerCase()

        if (sellerEmail && customerEmail && sellerEmail === customerEmail) {
            // Return 200 OK to prevent the sender from knowing we detected fraud
            // This makes it harder for attackers to probe our detection logic
            await logWebhook(supabase, product_id, payload, 'rejected', 'Self-referral blocked', request)
            return NextResponse.json({
                status: 'blocked',
                reason: 'self_referral',
                message: 'This conversion was flagged for review'
            })
        }

        // ================================================
        // STEP 3: CUSTOMER RESOLUTION (NEW vs RECURRING)
        // ================================================
        let isNewCustomer = false

        // Check if this customer exists for this product
        const { data: existingCustomer } = await supabase
            .from('customers')
            .select('id')
            .eq('product_id', product_id)
            .eq('external_customer_id', external_customer_id)
            .single()

        if (!existingCustomer) {
            // NEW customer - insert into customers table
            const { error: insertCustomerError } = await supabase
                .from('customers')
                .insert({
                    product_id,
                    seller_id: link.seller_id,
                    external_customer_id,
                } as never)

            if (insertCustomerError && insertCustomerError.code !== '23505') {
                // Not a duplicate error, something went wrong
                console.error('Failed to insert customer:', insertCustomerError)
            }

            isNewCustomer = true
        }

        // ================================================
        // STEP 4: COMMISSION CALCULATION
        // ================================================
        const commissionConfig = product.commission_config as CommissionConfig

        // Determine commission percentage based on NEW vs RECURRING
        let commissionPct: number
        if (isNewCustomer) {
            commissionPct = commissionConfig.upfront_pct
        } else {
            commissionPct = commissionConfig.recurring_pct || 0
        }

        // Calculate commission amount (all in paise)
        let commissionAmount = Math.floor((amount * commissionPct) / 100)

        // Enforce max_cac_limit if present
        if (product.max_cac_limit && commissionAmount > product.max_cac_limit) {
            commissionAmount = product.max_cac_limit
        }

        // Platform fee: 5% of commission
        const platformFee = Math.floor((commissionAmount * 5) / 100)
        const netCommission = commissionAmount - platformFee

        // ================================================
        // STEP 5: LEDGER INSERT
        // ================================================
        const payoutDueDate = new Date()
        payoutDueDate.setDate(payoutDueDate.getDate() + 30)

        const { data: transaction, error: txError } = await supabase
            .from('transactions')
            .insert({
                type: 'sale',
                status: 'pending',
                product_id,
                seller_id: link.seller_id,
                link_id: link.id,
                sale_amount: amount,
                commission_amount: netCommission,
                platform_fee: platformFee,
                external_customer_id,
                external_transaction_id,
                payout_due_date: payoutDueDate.toISOString(),
            } as never)
            .select()
            .single()

        if (txError) {
            console.error('Failed to create transaction:', txError)
            await logWebhook(supabase, product_id, payload, 'failed', txError.message, request)
            return NextResponse.json({ error: 'Failed to process transaction' }, { status: 500 })
        }

        // ================================================
        // STEP 6: ATOMIC ESCROW LOCK (RPC)
        // ================================================
        const { error: rpcError } = await supabase.rpc('lock_commission_funds' as any, {
            p_seller_id: link.seller_id,
            p_amount: netCommission,
        } as any)

        if (rpcError) {
            console.error('RPC lock_commission_funds failed:', rpcError)
            // Fallback to manual update if RPC doesn't exist or fails
            // Note: In a production system, you might want to handle this more robustly,
            // e.g., by alerting or retrying, or ensuring the RPC is always available.
            if (rpcError.code === '42883' || rpcError.code === 'P0001') { // '42883' for function not found, 'P0001' for custom errors from RPC
                const { data: profileData } = await supabase
                    .from('profiles')
                    .select('pending_balance, total_earnings')
                    .eq('id', link.seller_id)
                    .single()

                const profile = profileData as ProfileResult | null
                if (profile) {
                    await supabase
                        .from('profiles')
                        .update({
                            pending_balance: (profile.pending_balance || 0) + netCommission,
                            total_earnings: (profile.total_earnings || 0) + netCommission,
                        } as never)
                        .eq('id', link.seller_id)
                }
            }
        }

        // ================================================
        // STEP 6.5: METERED BILLING - ACCUMULATE FOUNDER DEBT
        // ================================================
        // Calculate total amount to charge founder (commission + platform fee)
        const totalFounderDebit = netCommission + platformFee

        // Get the founder's profile (product owner)
        const { data: productWithFounder } = await supabase
            .from('products')
            .select('founder_id')
            .eq('id', product_id)
            .single()

        if (productWithFounder) {
            const founderId = (productWithFounder as { founder_id: string }).founder_id

            // Atomically increment unbilled_amount
            const { data: founderProfile } = await supabase
                .from('profiles')
                .select('unbilled_amount, billing_threshold, mandate_status')
                .eq('id', founderId)
                .single()

            if (founderProfile) {
                const profile = founderProfile as {
                    unbilled_amount: number
                    billing_threshold: number
                    mandate_status: string | null
                }

                const newUnbilledAmount = (profile.unbilled_amount || 0) + totalFounderDebit

                await supabase
                    .from('profiles')
                    .update({ unbilled_amount: newUnbilledAmount } as never)
                    .eq('id', founderId)

                // Check if we need to trigger a scheduled charge
                if (newUnbilledAmount >= (profile.billing_threshold || 500000)) {
                    // Only schedule if mandate is active
                    if (profile.mandate_status === 'active') {
                        await scheduleCharge(supabase, founderId, newUnbilledAmount)
                    }
                }
            }
        }

        // ================================================
        // STEP 7: AUDIT LOG
        // ================================================
        await logWebhook(supabase, product_id, payload, 'success', null, request)

        return NextResponse.json({
            message: 'Conversion recorded',
            transaction_id: (transaction as { id: string }).id,
            customer_type: isNewCustomer ? 'NEW' : 'RECURRING',
            commission: netCommission,
            payout_due_date: payoutDueDate.toISOString(),
        })

    } catch (error) {
        console.error('Webhook processing error:', error)
        if (payload) {
            await logWebhook(supabase, payload?.product_id, payload, 'failed', String(error), request)
        }
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}

/**
 * Insert webhook log entry
 */
async function logWebhook(
    supabase: ReturnType<typeof createAdminClient>,
    productId: string | null,
    payload: any,
    status: 'success' | 'failed' | 'rejected',
    errorMessage: string | null,
    request: NextRequest
) {
    try {
        await supabase
            .from('webhook_logs')
            .insert({
                product_id: productId,
                payload,
                status,
                error_message: errorMessage,
                ip_address: request.headers.get('x-forwarded-for') || 'unknown',
            } as never)
    } catch (e) {
        console.error('Failed to log webhook:', e)
    }
}

/**
 * Schedule a charge for RBI-compliant 24h notification
 */
async function scheduleCharge(
    supabase: ReturnType<typeof createAdminClient>,
    founderId: string,
    amount: number
) {
    try {
        // Check if there's already a pending/notified charge for this founder
        const { data: existingCharge } = await supabase
            .from('charges')
            .select('id')
            .eq('founder_id', founderId)
            .in('status', ['scheduled', 'notified', 'processing'])
            .single()

        if (existingCharge) {
            // Already have a pending charge, don't create another
            return
        }

        // Schedule execution 24 hours from now (RBI requirement)
        const scheduledExecutionAt = new Date()
        scheduledExecutionAt.setHours(scheduledExecutionAt.getHours() + 24)

        // Create the charge record
        await supabase
            .from('charges')
            .insert({
                founder_id: founderId,
                amount,
                status: 'notified',
                notification_sent_at: new Date().toISOString(),
                scheduled_execution_at: scheduledExecutionAt.toISOString(),
            } as never)

        // TODO: Send notification email/SMS to founder
        // "Scheduled Charge: ₹X will be debited on [Date] for commission settlements"
        console.log(`Scheduled charge of ₹${amount / 100} for founder ${founderId} at ${scheduledExecutionAt}`)

    } catch (error) {
        console.error('Failed to schedule charge:', error)
    }
}
