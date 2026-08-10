import { createAdminClient } from '@/lib/supabase-server'
import { sendEmail } from '@/lib/email'
import { saleRecordedEmail, founderSaleEmail } from '@/lib/email-templates'
import { checkVelocityLimits } from '@/lib/velocity-limits'
import { emailsMatch } from '@/lib/anti-fraud'

/**
 * Shared webhook processor for all payment providers.
 *
 * Money path is ONE atomic SQL RPC (record_conversion): customer upsert,
 * billing_count, tx insert (idempotent), wallet debit, seller escrow credit,
 * platform fee ledger — all-or-nothing. JS only does pre-checks (product,
 * link, self-referral, velocity) and post-effects (notifications, emails),
 * which are safe to retry.
 *
 * Billing model: prepaid wallet ONLY. Every founder is a wallet founder.
 * (Auto-split / Route metering was deleted — see FINAL_BACKEND_FIX_LIST 1.2.)
 */

interface ConversionData {
    productId: string
    refId: string
    externalCustomerId: string
    externalTransactionId: string
    amount: number // in INR paise (already FX-converted at the route edge)
    customerEmail: string
    provider: 'razorpay' | 'stripe' | 'gumroad' | 'lemonsqueezy' | 'paypal' | 'custom' | 'cashfree' | 'phonepe' | 'payu' | 'instamojo' | 'ccavenue' | 'shopflo'
    rawPayload?: any
    currency?: string
    amountMinor?: number // original minor units (e.g. USD cents)
    fxRate?: number
}

interface ProcessOptions {
    /** simulate-sale: skip velocity limits (self-test fire drill) */
    isTest?: boolean
}

export interface ProcessResult {
    success: boolean
    message: string
    transactionId?: string
    commission?: number
    error?: string
    /** internal detail for simulate-sale reversal — never exposed to clients */
    _internal?: {
        grossCommission: number
        fee: number
        netCommission: number
        billingStatus: string
        isNewCustomer: boolean
        billingCount: number
    }
}

export async function processConversion(
    data: ConversionData,
    options: ProcessOptions = {}
): Promise<ProcessResult> {
    const supabase = createAdminClient()

    try {
        const {
            productId,
            refId,
            externalCustomerId,
            externalTransactionId,
            amount,
            customerEmail,
            provider,
            rawPayload,
            currency = 'INR',
            amountMinor,
            fxRate = 1,
        } = data

        // ================================================
        // STEP 1: VALIDATE PRODUCT + LINK (pre-checks)
        // ================================================
        const { data: product, error: productError } = await supabase
            .from('products')
            .select('id, founder_id, is_active')
            .eq('id', productId)
            .single()

        if (productError || !product) {
            return { success: false, message: 'Product not found', error: 'PRODUCT_NOT_FOUND' }
        }

        const typedProduct = product as { id: string; founder_id: string; is_active: boolean }

        const { data: link, error: linkError } = await supabase
            .from('links')
            .select('id, seller_id, product_id, seller:profiles(email)')
            .eq('id', refId)
            .single()

        if (linkError || !link) {
            return { success: false, message: 'Invalid referral link', error: 'INVALID_REF_ID' }
        }

        const typedLink = link as {
            id: string
            seller_id: string
            product_id: string
            seller: { email: string } | null
        }

        if (typedLink.product_id !== productId) {
            return { success: false, message: 'Referral link does not match product', error: 'PRODUCT_MISMATCH' }
        }

        // ================================================
        // STEP 2: SELF-REFERRAL CHECK
        // (normalized: catches seller+test@gmail.com vs seller@gmail.com)
        // ================================================
        if (!options.isTest && emailsMatch(typedLink.seller?.email, customerEmail)) {
            return { success: false, message: 'Self-referral blocked', error: 'SELF_REFERRAL' }
        }

        // ================================================
        // STEP 3: VELOCITY LIMITS (skipped for simulations)
        // ================================================
        if (!options.isTest) {
            try {
                const velocityCheck = await checkVelocityLimits(
                    supabase,
                    typedProduct.founder_id,
                    typedLink.seller_id,
                    productId,
                    amount
                )
                if (!velocityCheck.allowed) {
                    console.warn(`[VELOCITY] Blocked: ${velocityCheck.reason}`)
                    return {
                        success: false,
                        message: `Rate limit exceeded: ${velocityCheck.reason}`,
                        error: 'VELOCITY_LIMIT'
                    }
                }
            } catch (velError) {
                console.error('[VELOCITY] Check failed, proceeding:', velError)
            }
        }

        // ================================================
        // STEP 4: THE ATOMIC MONEY PATH (SQL RPC)
        // ================================================
        const { data: rpcResult, error: rpcError } = await supabase.rpc('record_conversion' as never, {
            p_product_id: productId,
            p_link_id: typedLink.id,
            p_seller_id: typedLink.seller_id,
            p_external_customer_id: externalCustomerId,
            p_external_transaction_id: externalTransactionId,
            p_amount: amount,
            p_currency: currency,
            p_amount_minor: amountMinor ?? amount,
            p_fx_rate: fxRate,
        } as never)

        if (rpcError) {
            console.error('record_conversion RPC failed:', rpcError)
            return { success: false, message: 'Failed to record transaction', error: 'TX_INSERT_FAILED' }
        }

        const result = rpcResult as {
            ok: boolean
            error?: string
            duplicate?: boolean
            recurring_limit?: boolean
            max_months?: number
            transaction_id?: string
            commission?: number
            gross_commission?: number
            fee?: number
            billing_status?: string
            is_new_customer?: boolean
            billing_count?: number
        }

        if (!result.ok) {
            const messages: Record<string, string> = {
                PRODUCT_NOT_FOUND: 'Product not found',
                PRODUCT_INACTIVE: 'Product is not active',
            }
            return {
                success: false,
                message: messages[result.error || ''] || 'Conversion rejected',
                error: result.error,
            }
        }

        if (result.duplicate) {
            return { success: true, message: 'Already processed', transactionId: result.transaction_id }
        }

        if (result.recurring_limit) {
            console.log(`[WEBHOOK] Recurring limit reached for customer on product ${productId}`)
            return {
                success: true,
                message: `Recurring commission limit reached (${result.max_months} months). Sale recorded but no commission paid.`,
                error: 'RECURRING_LIMIT_REACHED',
            }
        }

        const netCommission = result.commission || 0
        const isNewCustomer = !!result.is_new_customer
        const billingCount = result.billing_count || 1
        const billingStatus = result.billing_status || 'wallet_insufficient'

        // ================================================
        // STEP 5: NOTIFICATIONS (post-effects, safe to retry)
        // ================================================
        try {
            const { data: productInfo } = await supabase
                .from('products')
                .select('name')
                .eq('id', productId)
                .single()

            const productName = ((productInfo as any)?.name as string) || 'Product'

            if (billingStatus === 'wallet_insufficient') {
                // FOUNDER ALERT: a sale happened but the wallet couldn't cover commission.
                // Digest-style: only email once per 24h per founder.
                const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
                const { count } = await supabase
                    .from('notifications')
                    .select('*', { count: 'exact', head: true })
                    .eq('user_id', typedProduct.founder_id)
                    .eq('type', 'wallet_insufficient')
                    .gte('created_at', dayAgo)

                await supabase.from('notifications').insert({
                    user_id: typedProduct.founder_id,
                    type: 'wallet_insufficient',
                    title: '⚠️ Sale missed — wallet empty',
                    message: `A sale just came in on ${productName} but your wallet couldn't cover the commission. Top up and the seller gets paid automatically.`,
                    metadata: { product_id: productId, transaction_id: result.transaction_id },
                    read: false,
                } as never)

                if (!count || count === 0) {
                    const { data: founderRow } = await supabase
                        .from('profiles')
                        .select('email, full_name')
                        .eq('id', typedProduct.founder_id)
                        .single()
                    const f = founderRow as { email: string; full_name: string } | null
                    if (f?.email) {
                        await sendEmail({
                            to: f.email,
                            subject: 'Action needed: your BlackIndex wallet missed a sale',
                            html: `<p>Hi ${f.full_name || ''},</p><p>A sale just came in on <b>${productName}</b> but your commission wallet couldn't cover it. <b>Top up your wallet</b> and queued commissions pay out automatically.</p><p>— Black Index</p>`,
                        })
                    }
                }
            } else {
                // Seller celebration notification
                await supabase.from('notifications').insert({
                    user_id: typedLink.seller_id,
                    type: 'new_sale',
                    title: `New sale: ₹${(netCommission / 100).toLocaleString('en-IN')} earned!`,
                    message: `You earned ₹${(netCommission / 100).toLocaleString('en-IN')} from a ${productName} sale${isNewCustomer ? '' : ` (recurring month ${billingCount})`}. Funds will be available in 30 days.`,
                    metadata: { commission: netCommission, product_name: productName, is_recurring: !isNewCustomer, billing_month: billingCount },
                    read: false,
                } as never)

                // Email seller
                const sellerEmailAddr = typedLink.seller?.email
                if (sellerEmailAddr) {
                    const { data: sellerProfile } = await supabase
                        .from('profiles')
                        .select('full_name')
                        .eq('id', typedLink.seller_id)
                        .single()
                    const sellerName = ((sellerProfile as any)?.full_name as string) || ''
                    await sendEmail({
                        to: sellerEmailAddr,
                        subject: `New sale: ₹${(netCommission / 100).toLocaleString('en-IN')} earned!`,
                        html: saleRecordedEmail(sellerName, productName, netCommission, !isNewCustomer, billingCount),
                    })
                }

                // Email founder
                const { data: founderData } = await supabase
                    .from('profiles')
                    .select('email, full_name')
                    .eq('id', typedProduct.founder_id)
                    .single()
                const typedFounderNotif = founderData as { email: string; full_name: string } | null
                if (typedFounderNotif?.email) {
                    await sendEmail({
                        to: typedFounderNotif.email,
                        subject: `New sale on ${productName}`,
                        html: founderSaleEmail(typedFounderNotif.full_name, productName, amount, netCommission),
                    })
                }
            }
        } catch (notifError) {
            console.error('[WEBHOOK] Notification error (non-fatal):', notifError)
        }

        // ================================================
        // STEP 6: LOG WEBHOOK
        // ================================================
        await supabase
            .from('webhook_logs')
            .insert({
                product_id: productId,
                event_type: options.isTest ? 'simulated_sale' : 'conversion',
                payload: rawPayload || data,
                status: 'success',
                error_message: null,
                ip_address: `${provider}-webhook`,
            } as never)

        return {
            success: true,
            message: `Conversion recorded${!isNewCustomer ? ` (recurring month ${billingCount})` : ''}${billingStatus === 'wallet_insufficient' ? ' (queued — founder wallet empty)' : ''}`,
            transactionId: result.transaction_id,
            commission: netCommission,
            _internal: {
                grossCommission: result.gross_commission || 0,
                fee: result.fee || 0,
                netCommission,
                billingStatus,
                isNewCustomer,
                billingCount,
            },
        }

    } catch (error) {
        console.error('Webhook processing error:', error)
        return {
            success: false,
            message: 'Internal error',
            error: error instanceof Error ? error.message : 'UNKNOWN_ERROR'
        }
    }
}

// ============================================================
// REFUNDS (MNY-6)
// Clawback order: seller pending first (escrow still locked = safe),
// remainder tracked as negative pending (future earnings absorb it).
// Founder wallet is re-credited; platform fee ledger goes negative.
// ============================================================
interface RefundData {
    productId: string
    /** any of these can identify the original sale's external_transaction_id */
    externalTransactionIdCandidates: string[]
    refundExternalId: string
    amount: number // INR paise refunded
    provider: string
    rawPayload?: any
}

export async function processRefund(data: RefundData): Promise<ProcessResult> {
    const supabase = createAdminClient()

    try {
        const { productId, externalTransactionIdCandidates, refundExternalId, amount, provider, rawPayload } = data

        // Idempotency: have we already processed this refund?
        const { data: existingRefund } = await supabase
            .from('transactions')
            .select('id')
            .eq('external_transaction_id', refundExternalId)
            .maybeSingle()
        if (existingRefund) {
            return { success: true, message: 'Refund already processed' }
        }

        // Find the original sale
        const candidates = externalTransactionIdCandidates.filter(Boolean)
        const { data: saleRows } = await supabase
            .from('transactions')
            .select('id, seller_id, product_id, commission_amount, platform_fee, billing_status, status, type')
            .eq('product_id', productId)
            .eq('type', 'sale')
            .in('external_transaction_id', candidates)
            .neq('status', 'refunded')
            .limit(1)

        const sale = (saleRows as any[])?.[0]
        if (!sale) {
            await supabase.from('webhook_logs').insert({
                product_id: productId,
                event_type: 'refund_unmatched',
                payload: rawPayload || data,
                status: 'failed',
                error_message: `No matching sale for refund ${refundExternalId} (tried: ${candidates.join(', ')})`,
                ip_address: `${provider}-webhook`,
            } as never)
            return { success: true, message: 'No matching sale found — logged for review' }
        }

        if (sale.billing_status !== 'billed') {
            // Seller was never credited; nothing to claw back
            await supabase.from('transactions').update({ status: 'refunded' } as never).eq('id', sale.id)
            return { success: true, message: 'Sale was unbilled — marked refunded, no clawback needed' }
        }

        const net = sale.commission_amount || 0
        const fee = sale.platform_fee || 0
        const gross = net + fee

        // Founder lookup for wallet re-credit
        const { data: product } = await supabase
            .from('products')
            .select('founder_id')
            .eq('id', productId)
            .single()
        const founderId = (product as any)?.founder_id as string

        // Claw back from seller pending (may go negative = debt against future earnings)
        const { data: seller } = await supabase
            .from('profiles')
            .select('pending_balance')
            .eq('id', sale.seller_id)
            .single()
        const currentPending = (seller as any)?.pending_balance || 0
        await supabase
            .from('profiles')
            .update({ pending_balance: currentPending - net } as never)
            .eq('id', sale.seller_id)

        // Re-credit founder wallet
        const { data: founder } = await supabase
            .from('profiles')
            .select('wallet_balance')
            .eq('id', founderId)
            .single()
        await supabase
            .from('profiles')
            .update({ wallet_balance: ((founder as any)?.wallet_balance || 0) + gross } as never)
            .eq('id', founderId)

        // Negative fee ledger entry
        await supabase.from('platform_revenue').insert({
            transaction_id: sale.id,
            product_id: productId,
            founder_id: founderId,
            seller_id: sale.seller_id,
            amount: -fee,
        } as never)

        // Mark original sale + insert refund record
        await supabase.from('transactions').update({ status: 'refunded' } as never).eq('id', sale.id)
        await supabase.from('transactions').insert({
            type: 'refund',
            status: 'refunded',
            product_id: productId,
            seller_id: sale.seller_id,
            sale_amount: -amount,
            commission_amount: -net,
            platform_fee: -fee,
            external_transaction_id: refundExternalId,
            refund_of: sale.id,
        } as never)

        // Notify both sides
        await supabase.from('notifications').insert({
            user_id: sale.seller_id,
            type: 'refund',
            title: 'Sale refunded',
            message: `A sale was refunded. ₹${(net / 100).toLocaleString('en-IN')} was deducted from your pending balance.`,
            metadata: { sale_id: sale.id, refund_id: refundExternalId },
            read: false,
        } as never)
        await supabase.from('notifications').insert({
            user_id: founderId,
            type: 'refund',
            title: 'Refund processed',
            message: `A sale was refunded (₹${(amount / 100).toLocaleString('en-IN')}). Your wallet was re-credited the commission.`,
            metadata: { sale_id: sale.id, refund_id: refundExternalId },
            read: false,
        } as never)

        await supabase.from('webhook_logs').insert({
            product_id: productId,
            event_type: 'refund',
            payload: rawPayload || data,
            status: 'success',
            error_message: null,
            ip_address: `${provider}-webhook`,
        } as never)

        return { success: true, message: 'Refund processed' }
    } catch (error) {
        console.error('Refund processing error:', error)
        return {
            success: false,
            message: 'Refund processing failed',
            error: error instanceof Error ? error.message : 'UNKNOWN_ERROR',
        }
    }
}
