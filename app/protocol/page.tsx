"use client"

import { motion } from "framer-motion"
import { ArrowRight, Package, Shield, Zap, TrendingUp, Users, Lock, Webhook, Coins, Sword, Crown } from "lucide-react"
import { SpotlightCard } from "@/components/ui/spotlight-card"
import { FadeInSection } from "@/components/ui/fade-in-section"
import { Footer } from "@/components/sections/footer"
import Link from "next/link"
import { Button } from "@/components/ui/button"

export default function ProtocolPage() {
    return (
        <div className="relative min-h-screen bg-background">
            {/* Grain overlay */}
            <div className="grain-overlay" />

            {/* Header/Nav Spacer */}
            <div className="absolute top-6 left-6 z-50">
                <Link href="/">
                    <Button variant="ghost" className="text-muted-foreground hover:text-foreground">
                        ← Back to Home
                    </Button>
                </Link>
            </div>

            <main className="max-w-5xl mx-auto px-6 py-24 pt-32">
                <FadeInSection>
                    <div className="mb-20">
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.5 }}
                            className="flex items-center gap-3 mb-6"
                        >
                            <div className="w-12 h-px bg-muted-foreground/30" />
                            <span className="text-xs font-mono tracking-widest text-muted-foreground uppercase">The Master Document</span>
                        </motion.div>
                        <motion.h1
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.5, delay: 0.1 }}
                            className="text-5xl md:text-7xl font-light tracking-tight mb-8"
                        >
                            The Protocol.
                        </motion.h1>
                        <motion.p
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.5, delay: 0.2 }}
                            className="text-xl text-muted-foreground font-light max-w-2xl leading-relaxed text-balance"
                        >
                            Black Index is not an affiliate network. It is the distribution layer of India.
                            We connect Founders with Warlords through a performance-only, trustless financial engine.
                        </motion.p>
                    </div>
                </FadeInSection>

                {/* Section 1: The Core Identity */}
                <FadeInSection>
                    <section className="mb-32">
                        <h2 className="text-3xl font-light mb-12 tracking-tight flex items-center gap-4">
                            <Crown className="w-8 h-8 text-muted-foreground" />
                            Two Sides of the Coin
                        </h2>
                        
                        <div className="grid md:grid-cols-2 gap-8">
                            <SpotlightCard className="p-8">
                                <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center mb-6">
                                    <Package className="w-6 h-6 text-blue-400" />
                                </div>
                                <h3 className="text-2xl font-light mb-4">The Founder</h3>
                                <p className="text-sm text-muted-foreground font-light mb-6 leading-relaxed">
                                    You have a product, but distribution is hard. Ad spend is burning cash, and organic growth is slow. 
                                    You need sales, but you only want to pay when a sale actually happens.
                                </p>
                                <ul className="space-y-3">
                                    <li className="flex items-center gap-3 text-sm font-light text-muted-foreground">
                                        <div className="w-1.5 h-1.5 rounded-full bg-blue-400/50" /> No upfront CAC
                                    </li>
                                    <li className="flex items-center gap-3 text-sm font-light text-muted-foreground">
                                        <div className="w-1.5 h-1.5 rounded-full bg-blue-400/50" /> Infinite scalable sales team
                                    </li>
                                </ul>
                            </SpotlightCard>

                            <SpotlightCard className="p-8">
                                <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center mb-6">
                                    <Sword className="w-6 h-6 text-emerald-400" />
                                </div>
                                <h3 className="text-2xl font-light mb-4">The Warlord (Seller)</h3>
                                <p className="text-sm text-muted-foreground font-light mb-6 leading-relaxed">
                                    You have an audience, a network, or a talent for closing deals. You don't want to build a SaaS from scratch. 
                                    You want to promote high-converting products and earn recurring revenue.
                                </p>
                                <ul className="space-y-3">
                                    <li className="flex items-center gap-3 text-sm font-light text-muted-foreground">
                                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-400/50" /> Recurring "salary" payouts
                                    </li>
                                    <li className="flex items-center gap-3 text-sm font-light text-muted-foreground">
                                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-400/50" /> Zero customer support
                                    </li>
                                </ul>
                            </SpotlightCard>
                        </div>

                        <div className="mt-8 p-6 rounded-2xl bg-foreground/5 border border-border/30">
                            <h4 className="text-lg font-medium mb-2 flex items-center gap-2">
                                <Users className="w-5 h-5 text-purple-400" /> Can I be both? (Dogfooding)
                            </h4>
                            <p className="text-sm text-muted-foreground font-light leading-relaxed">
                                Absolutely. We call this Dogfooding. A Founder can list their own product to get sales, while simultaneously 
                                acting as a Warlord by promoting other complementary products in The Vault to their existing customer base.
                                It creates a powerful, compounding revenue stream.
                            </p>
                        </div>
                    </section>
                </FadeInSection>

                {/* Section 2: The Flow Diagram */}
                <FadeInSection>
                    <section className="mb-32">
                        <h2 className="text-3xl font-light mb-12 tracking-tight flex items-center gap-4">
                            <Zap className="w-8 h-8 text-muted-foreground" />
                            The Mechanism
                        </h2>

                        <SpotlightCard className="p-8 md:p-16 overflow-hidden">
                            <div className="flex flex-col md:flex-row items-center justify-between gap-8 max-w-3xl mx-auto">
                                
                                <div className="text-center group">
                                    <div className="w-20 h-20 rounded-2xl bg-foreground/5 border border-border/50 flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                                        <Package className="w-8 h-8 text-foreground/80" />
                                    </div>
                                    <h4 className="font-medium text-sm">Founder</h4>
                                    <p className="text-xs text-muted-foreground mt-1">Lists Product</p>
                                </div>

                                <div className="hidden md:flex flex-col items-center flex-1">
                                    <span className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2">Bounty Assigned</span>
                                    <div className="w-full h-px bg-gradient-to-r from-transparent via-foreground/30 to-transparent relative">
                                        <ArrowRight className="absolute right-0 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground/30" />
                                    </div>
                                </div>
                                <ArrowRight className="md:hidden w-6 h-6 text-muted-foreground rotate-90 my-2" />

                                <div className="text-center group">
                                    <div className="w-24 h-24 rounded-3xl bg-foreground text-background flex items-center justify-center mx-auto mb-4 shadow-[0_0_30px_rgba(255,255,255,0.1)] group-hover:scale-110 transition-transform">
                                        <Lock className="w-10 h-10" />
                                    </div>
                                    <h4 className="font-medium text-sm">Black Index</h4>
                                    <p className="text-xs text-muted-foreground mt-1">The Trust Engine</p>
                                </div>

                                <div className="hidden md:flex flex-col items-center flex-1">
                                    <span className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2">Tracking ID Gen</span>
                                    <div className="w-full h-px bg-gradient-to-r from-transparent via-foreground/30 to-transparent relative">
                                        <ArrowRight className="absolute right-0 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground/30" />
                                    </div>
                                </div>
                                <ArrowRight className="md:hidden w-6 h-6 text-muted-foreground rotate-90 my-2" />

                                <div className="text-center group">
                                    <div className="w-20 h-20 rounded-2xl bg-foreground/5 border border-border/50 flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                                        <Sword className="w-8 h-8 text-foreground/80" />
                                    </div>
                                    <h4 className="font-medium text-sm">Warlord</h4>
                                    <p className="text-xs text-muted-foreground mt-1">Drives Sales</p>
                                </div>

                            </div>
                        </SpotlightCard>
                    </section>
                </FadeInSection>

                {/* Section 3: The Engine */}
                <FadeInSection>
                    <section className="mb-32">
                        <h2 className="text-3xl font-light mb-12 tracking-tight flex items-center gap-4">
                            <TrendingUp className="w-8 h-8 text-muted-foreground" />
                            Hybrid Commission Engine
                        </h2>
                        <p className="text-lg text-muted-foreground font-light mb-12">
                            We replaced standard 10% affiliate links with a flexible Hybrid Incentive Model designed to create long-term alignment between founders and sellers.
                        </p>

                        <div className="overflow-x-auto rounded-2xl border border-border/30 bg-black/20">
                            <table className="w-full text-left text-sm font-light">
                                <thead className="border-b border-border/30 bg-foreground/5">
                                    <tr>
                                        <th className="p-6 font-medium text-muted-foreground">Tier Structure</th>
                                        <th className="p-6 font-medium text-muted-foreground">The Setup</th>
                                        <th className="p-6 font-medium text-muted-foreground">The Impact</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border/30">
                                    <tr className="hover:bg-foreground/5 transition-colors">
                                        <td className="p-6">
                                            <div className="flex items-center gap-2">
                                                <Zap className="w-4 h-4 text-yellow-500" />
                                                <span className="font-medium text-foreground">Activation Bonus (The Hook)</span>
                                            </div>
                                        </td>
                                        <td className="p-6 text-muted-foreground">Founder Defined (e.g. 20-50%)</td>
                                        <td className="p-6 text-muted-foreground">High upfront payout for the first month's revenue. Designed to provide instant cash flow and motivation for Warlords.</td>
                                    </tr>
                                    <tr className="hover:bg-foreground/5 transition-colors">
                                        <td className="p-6">
                                            <div className="flex items-center gap-2">
                                                <Coins className="w-4 h-4 text-emerald-500" />
                                                <span className="font-medium text-foreground">∞ Royalty Mode (Retention)</span>
                                            </div>
                                        </td>
                                        <td className="p-6 text-muted-foreground">Founder Defined (e.g. 10-20%)</td>
                                        <td className="p-6 text-muted-foreground">Recurring monthly commission. This creates a stable "salary" for Warlords, ensuring they stay focused on your product's long-term growth.</td>
                                    </tr>
                                    <tr className="hover:bg-foreground/5 transition-colors">
                                        <td className="p-6">
                                            <div className="flex items-center gap-2">
                                                <Package className="w-4 h-4 text-blue-500" />
                                                <span className="font-medium text-foreground">One-Time Bounties</span>
                                            </div>
                                        </td>
                                        <td className="p-6 text-muted-foreground">Founder Defined (e.g. 30-70%)</td>
                                        <td className="p-6 text-muted-foreground">Perfect for one-off lifetime deals, software templates, or professional services.</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>

                        <div className="mt-12 p-8 rounded-2xl border border-border/30 bg-foreground/5">
                            <h3 className="text-xl font-medium mb-4 flex items-center gap-2">
                                <Coins className="w-5 h-5 text-emerald-400" />
                                How Commissions are Set
                            </h3>
                            <div className="grid md:grid-cols-2 gap-8 text-sm font-light text-muted-foreground leading-relaxed">
                                <div className="space-y-4">
                                    <p>
                                        Founders have absolute control over their commission structures. When listing a product, you define the <span className="text-foreground">Activation Bonus</span>, the <span className="text-foreground">Recurring Percentage</span>, and the <span className="text-foreground">Duration</span> of the royalty.
                                    </p>
                                    <p>
                                        This allow founders to calculate their CAC (Customer Acquisition Cost) with 100% precision. You only pay for what you earn.
                                    </p>
                                </div>
                                <div className="space-y-4">
                                    <p>
                                        Warlords choose which products to promote based on these metrics. Higher commissions attract more "Elite" sellers, while recurring royalties build a loyal, long-term sales force for your brand.
                                    </p>
                                    <p>
                                        The platform fee is a flat 5% on top of the transaction value, which covers the trustless tracking, automated split logic, and secure payouts.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </section>
                </FadeInSection>

                {/* Section 4: Metered Billing & Anti-Fraud */}
                <FadeInSection>
                    <section className="mb-32">
                        <h2 className="text-3xl font-light mb-12 tracking-tight flex items-center gap-4">
                            <Shield className="w-8 h-8 text-muted-foreground" />
                            Financial Architecture & The Vault
                        </h2>
                        
                        <div className="grid md:grid-cols-2 gap-8">
                            <SpotlightCard className="p-8">
                                <h3 className="text-xl font-medium mb-6 flex items-center gap-3">
                                    <Webhook className="w-5 h-5 text-purple-400" />
                                    Metered Billing (RBI Compliant)
                                </h3>
                                <div className="space-y-4">
                                    <p className="text-sm text-muted-foreground font-light leading-relaxed">
                                        RBI e-Mandate rules require a 24-hour pre-debit notification. To comply, we use an "Unbilled Ledger".
                                    </p>
                                    <ul className="space-y-4 mt-6">
                                        <li className="flex gap-4">
                                            <div className="w-6 h-6 shrink-0 rounded-full bg-foreground/10 flex items-center justify-center text-xs font-mono">1</div>
                                            <p className="text-sm font-light text-muted-foreground"><span className="text-foreground">Accumulation:</span> Sales generate commission debt added to the founder's Unbilled Ledger.</p>
                                        </li>
                                        <li className="flex gap-4">
                                            <div className="w-6 h-6 shrink-0 rounded-full bg-foreground/10 flex items-center justify-center text-xs font-mono">2</div>
                                            <p className="text-sm font-light text-muted-foreground"><span className="text-foreground">The Trigger:</span> When the ledger hits ₹5,000 or 7 days pass, an invoice is generated.</p>
                                        </li>
                                        <li className="flex gap-4">
                                            <div className="w-6 h-6 shrink-0 rounded-full bg-foreground/10 flex items-center justify-center text-xs font-mono">3</div>
                                            <p className="text-sm font-light text-muted-foreground"><span className="text-foreground">Execution:</span> 24 hours later, the Razorpay Mandate auto-deducts the amount, crediting the sellers.</p>
                                        </li>
                                    </ul>
                                </div>
                            </SpotlightCard>

                            <SpotlightCard className="p-8">
                                <h3 className="text-xl font-medium mb-6 flex items-center gap-3">
                                    <Lock className="w-5 h-5 text-red-400" />
                                    The "Anti-Fraud" Vault
                                </h3>
                                <div className="space-y-6">
                                    <div>
                                        <h4 className="text-sm font-medium text-foreground mb-2">T+30 Escrow Lock</h4>
                                        <p className="text-xs text-muted-foreground font-light">
                                            Funds sit in "Pending" state for 30 days. If the end customer refunds the product, the commission is automatically clawed back via webhook.
                                        </p>
                                    </div>
                                    <div>
                                        <h4 className="text-sm font-medium text-foreground mb-2">Self-Referral Kill Switch</h4>
                                        <p className="text-xs text-muted-foreground font-light">
                                            If a seller buys a product using their own link to get a "discount", the system detects the fuzzy email match and sets commission to 0.
                                        </p>
                                    </div>
                                    <div>
                                        <h4 className="text-sm font-medium text-foreground mb-2">The "Serious Player" Threshold</h4>
                                        <p className="text-xs text-muted-foreground font-light">
                                            Minimum withdrawal is ₹3,000. This mathematically stops discount hackers, as their money is stuck until they earn significantly more.
                                        </p>
                                    </div>
                                </div>
                            </SpotlightCard>
                        </div>
                    </section>
                </FadeInSection>

                {/* Section 5: Integration */}
                <FadeInSection>
                    <section className="mb-20">
                        <h2 className="text-3xl font-light mb-12 tracking-tight flex items-center gap-4">
                            <Webhook className="w-8 h-8 text-muted-foreground" />
                            Integration Tiers
                        </h2>

                        <div className="overflow-x-auto rounded-2xl border border-border/30 bg-black/20">
                            <table className="w-full text-left text-sm font-light">
                                <thead className="border-b border-border/30 bg-foreground/5">
                                    <tr>
                                        <th className="p-6 font-medium text-muted-foreground">Tier</th>
                                        <th className="p-6 font-medium text-muted-foreground">Target Profile</th>
                                        <th className="p-6 font-medium text-muted-foreground">Method</th>
                                        <th className="p-6 font-medium text-muted-foreground">Tech Spec</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border/30">
                                    <tr className="hover:bg-foreground/5 transition-colors">
                                        <td className="p-6 font-mono text-emerald-400">Tier 1</td>
                                        <td className="p-6 text-foreground">SaaS / Web Apps</td>
                                        <td className="p-6 text-muted-foreground">Automated Webhook</td>
                                        <td className="p-6 text-muted-foreground">Founder adds our URL to Stripe/Razorpay. We listen for <code className="text-xs bg-foreground/10 px-1 py-0.5 rounded">payment_succeeded</code>.</td>
                                    </tr>
                                    <tr className="hover:bg-foreground/5 transition-colors">
                                        <td className="p-6 font-mono text-yellow-400">Tier 2</td>
                                        <td className="p-6 text-foreground">Services / High Ticket</td>
                                        <td className="p-6 text-muted-foreground">Pre-Paid Wallet</td>
                                        <td className="p-6 text-muted-foreground">Founder pre-loads a wallet. Manual or webhook reporting triggers automated deductions.</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </section>
                </FadeInSection>

            </main>

            <Footer />
        </div>
    )
}
