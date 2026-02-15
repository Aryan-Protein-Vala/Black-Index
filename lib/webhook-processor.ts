import { createAdminClient } from '@/lib/supabase-server'

/**
 * Shared webhook processor for all payment providers
 * Handles the common logic after provider-specific parsing
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
            commission_config: { upfront_pct: number; recurring_pct?: number }
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
        // ================================================
        let isNewCustomer = false
        const { data: existingCustomer } = await supabase
            .from('customers')
            .select('id')
            .eq('product_id', productId)
            .eq('external_customer_id', externalCustomerId)
            .single()

        if (!existingCustomer) {
            isNewCustomer = true
            await supabase
                .from('customers')
                .insert({
                    product_id: productId,
                    seller_id: typedLink.seller_id,
                    external_customer_id: externalCustomerId,
                } as never)
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
        // STEP 7: INSERT TRANSACTION
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
            } as never)
            .select()
            .single()

        if (txError) {
            console.error('Failed to create transaction:', txError)
            return { success: false, message: 'Failed to record transaction', error: 'TX_INSERT_FAILED' }
        }

        // ================================================
        // STEP 8: CREDIT SELLER (ESCROW)
        // ================================================
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

        // ================================================
        // STEP 9: LOG WEBHOOK
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
            message: 'Conversion recorded',
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
