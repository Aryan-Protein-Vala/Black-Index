/**
 * Email templates for Black Index
 * All templates return HTML strings for Resend
 */

const baseStyle = `
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    background-color: #0a0a0a;
    color: #e5e5e5;
    padding: 40px 20px;
`

const cardStyle = `
    background: #141414;
    border: 1px solid #2a2a2a;
    border-radius: 12px;
    padding: 32px;
    max-width: 560px;
    margin: 0 auto;
`

const headingStyle = `
    font-size: 20px;
    font-weight: 300;
    letter-spacing: -0.02em;
    margin: 0 0 16px;
    color: #ffffff;
`

const bodyStyle = `
    font-size: 14px;
    line-height: 1.7;
    color: #a3a3a3;
    margin: 0 0 24px;
`

const highlightStyle = `
    font-size: 28px;
    font-weight: 300;
    color: #ffffff;
    letter-spacing: -0.02em;
`

const footerStyle = `
    font-size: 11px;
    color: #525252;
    text-align: center;
    margin-top: 32px;
    padding-top: 16px;
    border-top: 1px solid #1a1a1a;
`

const buttonStyle = `
    display: inline-block;
    background: #ffffff;
    color: #0a0a0a;
    padding: 12px 24px;
    border-radius: 8px;
    text-decoration: none;
    font-size: 13px;
    font-weight: 500;
    letter-spacing: 0.02em;
`

function wrap(content: string): string {
    return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="${baseStyle}">
    <div style="${cardStyle}">
        ${content}
    </div>
</body>
</html>`
}

// ============================================
// SELLER EMAILS
// ============================================

export function saleRecordedEmail(sellerName: string, productName: string, commission: number, isRecurring: boolean, billingMonth?: number): string {
    const amount = (commission / 100).toLocaleString('en-IN')
    const recurringNote = isRecurring ? ` (recurring month ${billingMonth})` : ''

    return wrap(`
        <h1 style="${headingStyle}">New Sale 🎉</h1>
        <p style="${bodyStyle}">Hey ${sellerName || 'there'},</p>
        <p style="${bodyStyle}">A sale just came through on <strong>${productName}</strong>${recurringNote}.</p>
        <div style="text-align: center; margin: 24px 0;">
            <span style="${highlightStyle}">+₹${amount}</span>
            <p style="font-size: 12px; color: #525252; margin-top: 4px;">Commission earned</p>
        </div>
        <p style="${bodyStyle}">Funds will be available for withdrawal in 30 days (escrow period).</p>
        <div style="text-align: center; margin: 24px 0;">
            <a href="https://blackindex.in/dashboard/seller" style="${buttonStyle}">View Dashboard</a>
        </div>
        <p style="${footerStyle}">Black Index — The Sales Network of the Internet</p>
    `)
}

export function payoutSentEmail(sellerName: string, amount: number): string {
    const rupees = (amount / 100).toLocaleString('en-IN')

    return wrap(`
        <h1 style="${headingStyle}">Payout Sent 💰</h1>
        <p style="${bodyStyle}">Hey ${sellerName || 'there'},</p>
        <div style="text-align: center; margin: 24px 0;">
            <span style="${highlightStyle}">₹${rupees}</span>
            <p style="font-size: 12px; color: #525252; margin-top: 4px;">Has been sent to your account</p>
        </div>
        <p style="${bodyStyle}">The amount should arrive in your bank account within 2-4 hours.</p>
        <p style="${footerStyle}">Black Index — The Sales Network of the Internet</p>
    `)
}

export function escrowReleasedEmail(sellerName: string, amount: number): string {
    const rupees = (amount / 100).toLocaleString('en-IN')

    return wrap(`
        <h1 style="${headingStyle}">Funds Available ✅</h1>
        <p style="${bodyStyle}">Hey ${sellerName || 'there'},</p>
        <p style="${bodyStyle}">Your escrow period has ended and ₹${rupees} is now available for withdrawal.</p>
        <div style="text-align: center; margin: 24px 0;">
            <a href="https://blackindex.in/dashboard/seller" style="${buttonStyle}">Withdraw Now</a>
        </div>
        <p style="${footerStyle}">Black Index — The Sales Network of the Internet</p>
    `)
}

// ============================================
// FOUNDER EMAILS
// ============================================

export function founderSaleEmail(founderName: string, productName: string, saleAmount: number, commission: number): string {
    const sale = (saleAmount / 100).toLocaleString('en-IN')
    const comm = (commission / 100).toLocaleString('en-IN')

    return wrap(`
        <h1 style="${headingStyle}">New Sale on ${productName} 📊</h1>
        <p style="${bodyStyle}">Hey ${founderName || 'there'},</p>
        <p style="${bodyStyle}">A new sale was made through the Black Index network.</p>
        <div style="display: flex; gap: 24px; margin: 24px 0; text-align: center;">
            <div style="flex: 1;">
                <span style="font-size: 20px; color: #ffffff;">₹${sale}</span>
                <p style="font-size: 11px; color: #525252;">Sale Amount</p>
            </div>
            <div style="flex: 1;">
                <span style="font-size: 20px; color: #ffffff;">₹${comm}</span>
                <p style="font-size: 11px; color: #525252;">Commission</p>
            </div>
        </div>
        <div style="text-align: center; margin: 24px 0;">
            <a href="https://blackindex.in/dashboard/founder" style="${buttonStyle}">View Dashboard</a>
        </div>
        <p style="${footerStyle}">Black Index — The Sales Network of the Internet</p>
    `)
}

export function walletLowEmail(founderName: string, balance: number): string {
    const rupees = (balance / 100).toLocaleString('en-IN')

    return wrap(`
        <h1 style="${headingStyle}">Wallet Running Low ⚠️</h1>
        <p style="${bodyStyle}">Hey ${founderName || 'there'},</p>
        <p style="${bodyStyle}">Your commission wallet balance is <strong>₹${rupees}</strong>. If it hits zero, your products will be automatically paused.</p>
        <div style="text-align: center; margin: 24px 0;">
            <a href="https://blackindex.in/dashboard/founder?tab=billing" style="${buttonStyle}">Deposit Funds</a>
        </div>
        <p style="${footerStyle}">Black Index — The Sales Network of the Internet</p>
    `)
}

export function securityDepositReceiptEmail(founderName: string): string {
    return wrap(`
        <h1 style="${headingStyle}">Security Deposit Received ✅</h1>
        <p style="${bodyStyle}">Hey ${founderName || 'there'},</p>
        <p style="${bodyStyle}">Your ₹5,000 security deposit has been received. Your account is now fully activated.</p>
        <p style="${bodyStyle}"><strong>Refund Policy:</strong> This deposit is fully refundable upon account closure. Just email us at support@blackindex.in.</p>
        <div style="text-align: center; margin: 24px 0;">
            <a href="https://blackindex.in/dashboard/founder" style="${buttonStyle}">Go to Dashboard</a>
        </div>
        <p style="${footerStyle}">Black Index — The Sales Network of the Internet</p>
    `)
}
