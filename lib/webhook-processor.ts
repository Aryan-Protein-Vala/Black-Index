import { createAdminClient } from '@/lib/supabase-server'
import { sendEmail } from '@/lib/email'
import { saleRecordedEmail, founderSaleEmail } from '@/lib/email-templates'
import { checkVelocityLimits } from '@/lib/velocity-limits'

/**
 * Shared webhook processor for all payment providers
 * Handles the common logic after provider-specific parsing
 * 
 * SaaS Pivot: Now supports recurring commissions with billing_count
 * enforcement and max_recurring_months cutoff.
 */

interface ConversionData {
    productId: string
    refId: string
    externalCustomerId: string
    externalTransactionId: string
    amount: number // in paise
    customerEmail: string
    provider: 'razorpay' | 'stripe' | 'gumroad' | 'lemonsqueezy' | 'paypal' | 'custom'
    rawPayload?: any
}

interface ProcessResult {
    success: boolean
    message: string
    transactionId?: string
    commission?: number
    error?: string
}

export async function processConversion(data: ConversionData): Promise<ProcessResult> {
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
            rawPayload
        } = data

        // ================================================
        // STEP 1: VALIDATE PRODUCT
        // ================================================
        const { data: product, error: productError } = await supabase
            .from('products')
            .select('id, founder_id, commission_config, max_cac_limit, is_active')
            .eq('id', productId)
            .single()

        if (productError || !product) {
            return { success: false, message: 'Product not found', error: 'PRODUCT_NOT_FOUND' }
        }

        const typedProduct = product as {
            id: string
            founder_id: string
            commission_config: {
                upfront_pct: number
                recurring_pct?: number
                max_recurring_months?: number
            }
            max_cac_limit: number | null
            is_active: boolean
        }

        if (!typedProduct.is_active) {
            return { success: false, message: 'Product is not active', error: 'PRODUCT_INACTIVE' }
        }

        // ================================================
        // STEP 2: FIND THE LINK (ref_id)
        // ================================================
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

        // Verify link is for this product
        if (typedLink.product_id !== productId) {
            return { success: false, message: 'Referral link does not match product', error: 'PRODUCT_MISMATCH' }
        }

        // ================================================
        // STEP 3: SELF-REFERRAL CHECK
        // ================================================
        const sellerEmail = typedLink.seller?.email?.toLowerCase()
        if (sellerEmail && customerEmail && sellerEmail === customerEmail.toLowerCase()) {
            return { success: false, message: 'Self-referral blocked', error: 'SELF_REFERRAL' }
        }

        // ================================================
        // STEP 3.5: VELOCITY LIMIT CHECK (Fraud Prevention)
        // ================================================
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
            // Don't block transactions if velocity check fails — log and continue
            console.error('[VELOCITY] Check failed, proceeding:', velError)
        }

        // ================================================
        // STEP 4: IDEMPOTENCY CHECK
        // ================================================
        const { data: existingTx } = await supabase
            .from('transactions')
            .select('id')
            .eq('external_transaction_id', externalTransactionId)
            .single()

        if (existingTx) {
            return {
                success: true,
                message: 'Already processed',
                transactionId: (existingTx as { id: string }).id
            }
        }

        // ================================================
        // STEP 5: CHECK IF NEW OR RECURRING CUSTOMER
        // + ENFORCE max_recurring_months
        // ================================================
        let isNewCustomer = false
        let currentBillingCount = 0

        const { data: existingCustomer } = await supabase
            .from('customers')
            .select('id, billing_count')
            .eq('product_id', productId)
            .eq('external_customer_id', externalCustomerId)
            .single()

        if (!existingCustomer) {
            // NEW customer — first purchase
            isNewCustomer = true
            currentBillingCount = 1

            await supabase
                .from('customers')
                .insert({
                    product_id: productId,
                    seller_id: typedLink.seller_id,
                    external_customer_id: externalCustomerId,
                    status: 'active',
                    billing_count: 1,
                } as never)
        } else {
            // RECURRING customer — check billing limit
            const typedCustomer = existingCustomer as { id: string; billing_count: number }
            currentBillingCount = (typedCustomer.billing_count || 0) + 1

            const maxMonths = typedProduct.commission_config.max_recurring_months || 12

            if (typedCustomer.billing_count >= maxMonths) {
                // Commission limit reached — record the sale but don't pay commission
                console.log(`[WEBHOOK] Recurring limit reached for customer ${externalCustomerId} on product ${productId}. Billing count: ${typedCustomer.billing_count}, max: ${maxMonths}`)
                return {
                    success: true,
                    message: `Recurring commission limit reached (${maxMonths} months). Sale recorded but no commission paid.`,
                    error: 'RECURRING_LIMIT_REACHED'
                }
            }

            // Increment billing count
            await supabase
                .from('customers')
                .update({
                    billing_count: currentBillingCount,
                    status: 'active', // Re-activate if they were churned
                } as never)
                .eq('id', typedCustomer.id)
        }

        // ================================================
        // STEP 6: CALCULATE COMMISSION
        // ================================================
        const config = typedProduct.commission_config
        let commissionPct = isNewCustomer ? config.upfront_pct : (config.recurring_pct || 0)
        let commissionAmount = Math.floor((amount * commissionPct) / 100)

        // Enforce max CAC limit
        if (typedProduct.max_cac_limit && commissionAmount > typedProduct.max_cac_limit) {
            commissionAmount = typedProduct.max_cac_limit
        }

        // Platform fee: 5%
        const platformFee = Math.floor((commissionAmount * 5) / 100)
        const netCommission = commissionAmount - platformFee

        // ================================================
        // STEP 7: DEDUCT FROM FOUNDER WALLET (Tier 2 founders)
        // ================================================
        const { data: founderProfile } = await supabase
            .from('profiles')
            .select('stripe_connect_id, razorpay_account_id, wallet_balance')
            .eq('id', typedProduct.founder_id)
            .single()

        const typedFounder = founderProfile as {
            stripe_connect_id: string | null
            razorpay_account_id: string | null
            wallet_balance: number
        } | null

        const isTier2 = typedFounder && !typedFounder.stripe_connect_id && !typedFounder.razorpay_account_id
        let billingStatus: string = 'unbilled'

        if (isTier2) {
            if ((typedFounder.wallet_balance || 0) >= commissionAmount) {
                // Deduct from wallet
                await supabase
                    .from('profiles')
                    .update({
                        wallet_balance: (typedFounder.wallet_balance || 0) - commissionAmount,
                    } as never)
                    .eq('id', typedProduct.founder_id)
                billingStatus = 'billed'
            } else {
                // Insufficient wallet — record sale but flag
                billingStatus = 'wallet_insufficient'
                console.warn(`[WEBHOOK] Founder ${typedProduct.founder_id} has insufficient wallet balance for commission. Balance: ${typedFounder.wallet_balance}, Required: ${commissionAmount}`)
            }
        }

        // ================================================
        // STEP 8: INSERT TRANSACTION
        // ================================================
        const payoutDueDate = new Date()
        payoutDueDate.setDate(payoutDueDate.getDate() + 30)

        const { data: transaction, error: txError } = await supabase
            .from('transactions')
            .insert({
                type: 'sale',
                status: 'pending',
                product_id: productId,
                seller_id: typedLink.seller_id,
                link_id: typedLink.id,
                sale_amount: amount,
                commission_amount: netCommission,
                platform_fee: platformFee,
                external_customer_id: externalCustomerId,
                external_transaction_id: externalTransactionId,
                payout_due_date: payoutDueDate.toISOString(),
                is_recurring: !isNewCustomer,
                billing_status: billingStatus,
            } as never)
            .select()
            .single()

        if (txError) {
            console.error('Failed to create transaction:', txError)
            return { success: false, message: 'Failed to record transaction', error: 'TX_INSERT_FAILED' }
        }

        // ================================================
        // STEP 9: CREDIT SELLER (ESCROW)
        // Only if billing was successful (Tier 1 auto-split or Tier 2 wallet deducted)
        // ================================================
        if (billingStatus !== 'wallet_insufficient') {
            const { error: rpcError } = await supabase.rpc('lock_commission_funds' as any, {
                p_seller_id: typedLink.seller_id,
                p_amount: netCommission,
            } as any)

            if (rpcError) {
                // Fallback manual update
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('pending_balance, total_earnings')
                    .eq('id', typedLink.seller_id)
                    .single()

                if (profile) {
                    const typedProfile = profile as { pending_balance: number; total_earnings: number }
                    await supabase
                        .from('profiles')
                        .update({
                            pending_balance: (typedProfile.pending_balance || 0) + netCommission,
                            total_earnings: (typedProfile.total_earnings || 0) + netCommission,
                        } as never)
                        .eq('id', typedLink.seller_id)
                }
            }
        }

        // ================================================
        // STEP 10: SEND NOTIFICATIONS
        // ================================================
        try {
            // Get product name for notification
            const { data: productInfo } = await supabase
                .from('products')
                .select('name')
                .eq('id', productId)
                .single()

            const productName = ((productInfo as any)?.name as string) || 'Product'

            // In-app notification for seller
            await supabase.from('notifications').insert({
                user_id: typedLink.seller_id,
                type: 'new_sale',
                title: `New sale: ₹${(netCommission / 100).toLocaleString('en-IN')} earned!`,
                message: `You earned ₹${(netCommission / 100).toLocaleString('en-IN')} from a ${productName} sale${isNewCustomer ? '' : ` (recurring month ${currentBillingCount})`}. Funds will be available in 30 days.`,
                metadata: { commission: netCommission, product_name: productName, is_recurring: !isNewCustomer, billing_month: currentBillingCount },
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
                    html: saleRecordedEmail(sellerName, productName, netCommission, !isNewCustomer, currentBillingCount),
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
        } catch (notifError) {
            // Don't fail the transaction if notification fails
            console.error('[WEBHOOK] Notification error (non-fatal):', notifError)
        }

        // ================================================
        // STEP 11: LOG WEBHOOK
        // ================================================
        await supabase
            .from('webhook_logs')
            .insert({
                product_id: productId,
                payload: rawPayload || data,
                status: 'success',
                error_message: null,
                ip_address: 'provider-webhook',
            } as never)

        return {
            success: true,
            message: `Conversion recorded${!isNewCustomer ? ` (recurring month ${currentBillingCount})` : ''}`,
            transactionId: (transaction as { id: string }).id,
            commission: netCommission,
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
