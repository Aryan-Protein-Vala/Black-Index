import { Metadata } from "next"

export const metadata: Metadata = {
    title: "Integration Guide | Black Index",
    description: "How to integrate your SaaS product with Black Index.",
}

export default function IntegrationPage() {
    return (
        <div className="max-w-4xl mx-auto py-12 px-6">
            <h1 className="text-4xl font-light mb-8">Integration Guide</h1>
            
            <section className="mb-12">
                <h2 className="text-2xl font-light mb-4">1. Frontend Tracking</h2>
                <p className="text-muted-foreground mb-4">
                    Install our lightweight tracking script on your website. This script looks for the <code>ref_id</code> query parameter and stores it in the user's <code>localStorage</code> under the key <code>bi_ref_id</code> for 30 days.
                </p>
                <div className="bg-foreground/5 p-4 rounded-lg border border-border/50 font-mono text-sm overflow-x-auto mb-4">
                    <code>&lt;script src="https://blackindex.in/track.js" data-product="YOUR_PRODUCT_ID" defer&gt;&lt;/script&gt;</code>
                </div>
                <p className="text-muted-foreground text-sm">
                    <strong>Note:</strong> Warlords share links to <code>blackindex.in/ref/slug</code>, which instantly redirects to your site appending <code>?ref_id=LINK_UUID</code>.
                </p>
            </section>

            <section className="mb-12">
                <h2 className="text-2xl font-light mb-4">2. Passing the Ref ID</h2>
                <p className="text-muted-foreground mb-4">
                    When a user makes a purchase, read <code>localStorage.getItem('bi_ref_id')</code> and pass it to your payment provider as metadata or client_reference_id.
                </p>
            </section>

            <section className="mb-12">
                <h2 className="text-2xl font-light mb-4">3. Webhook Setup (Backend)</h2>
                <p className="text-muted-foreground mb-4">
                    Configure your payment provider to send events to your unique Black Index webhook URL. 
                    <br/><strong>Crucial:</strong> Use the exact events listed below. Organic sales (without a ref ID) are gracefully accepted, logged as <code>unattributed_sale</code>, and return 200 OK.
                </p>

                <div className="space-y-6">
                    <div className="p-6 border border-border/30 rounded-lg">
                        <h3 className="font-medium text-lg mb-2">Stripe</h3>
                        <p className="text-sm text-muted-foreground mb-2">Required events:</p>
                        <ul className="list-disc pl-5 text-sm text-muted-foreground space-y-1">
                            <li><code>invoice.paid</code> (for subscriptions)</li>
                            <li><code>payment_intent.succeeded</code> (for one-time)</li>
                        </ul>
                        <p className="text-sm text-red-400 mt-2"><strong>WARNING:</strong> DO NOT enable <code>checkout.session.completed</code> — it will double-count commissions.</p>
                    </div>

                    <div className="p-6 border border-border/30 rounded-lg">
                        <h3 className="font-medium text-lg mb-2">Razorpay</h3>
                        <p className="text-sm text-muted-foreground mb-2">Required events:</p>
                        <ul className="list-disc pl-5 text-sm text-muted-foreground space-y-1">
                            <li><code>payment.captured</code></li>
                        </ul>
                    </div>

                    <div className="p-6 border border-border/30 rounded-lg">
                        <h3 className="font-medium text-lg mb-2">Lemon Squeezy</h3>
                        <p className="text-sm text-muted-foreground mb-2">Required events:</p>
                        <ul className="list-disc pl-5 text-sm text-muted-foreground space-y-1">
                            <li><code>order_created</code></li>
                            <li><code>subscription_payment_success</code></li>
                            <li><code>order_refunded</code> (triggers auto-clawback)</li>
                        </ul>
                    </div>

                    <div className="p-6 border border-border/30 rounded-lg">
                        <h3 className="font-medium text-lg mb-2">PayPal</h3>
                        <p className="text-sm text-muted-foreground mb-2">Required events:</p>
                        <ul className="list-disc pl-5 text-sm text-muted-foreground space-y-1">
                            <li><code>PAYMENT.SALE.COMPLETED</code> or <code>PAYMENT.CAPTURE.COMPLETED</code></li>
                        </ul>
                    </div>
                </div>
            </section>

            <section className="mb-12">
                <h2 className="text-2xl font-light mb-4">4. Refunds & Security</h2>
                <p className="text-muted-foreground mb-2">
                    <strong>Refund Auto-Clawback:</strong> If a refund event is received, the system will automatically claw back the commission from the Warlord's pending balance.
                </p>
                <p className="text-muted-foreground mb-2">
                    <strong>New Security Endpoints:</strong>
                </p>
                <ul className="list-disc pl-5 text-sm text-muted-foreground space-y-1 mb-4">
                    <li><code>POST /api/products/[id]/simulate-sale</code> - Test your setup without moving real money.</li>
                    <li><code>POST /api/products/[id]/rotate-secret</code> - Rotate your webhook secret if compromised.</li>
                    <li><code>POST /api/install/verify</code> - Verify the tracking script is installed correctly.</li>
                </ul>
            </section>
        </div>
    )
}
