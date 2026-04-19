"use client"

import { motion } from "framer-motion"
import { ArrowLeft, BookOpen, Code, Terminal, Webhook, Shield, CheckCircle2, Copy, Check, ArrowUpRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { SpotlightCard } from "@/components/ui/spotlight-card"
import { FadeInSection } from "@/components/ui/fade-in-section"
import { Logo } from "@/components/logo"
import Link from "next/link"
import { useState } from "react"
import { toast } from "sonner"

export default function IntegrationDocsPage() {
    const [copied, setCopied] = useState<string | null>(null)

    const handleCopy = (text: string, id: string) => {
        navigator.clipboard.writeText(text)
        setCopied(id)
        toast.success("Copied to clipboard")
        setTimeout(() => setCopied(null), 2000)
    }

    return (
        <div className="min-h-screen bg-background text-foreground selection:bg-purple-500/30">
            {/* Simple Top Nav */}
            <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border/30 bg-background/80 backdrop-blur-md">
                <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
                    <Link href="/">
                        <Logo showText={true} />
                    </Link>
                    <Link href="/dashboard/founder">
                        <Button variant="ghost" size="sm" className="text-xs font-light text-muted-foreground hover:text-foreground">
                            <ArrowLeft className="w-3 h-3 mr-2" />
                            Back to Dashboard
                        </Button>
                    </Link>
                </div>
            </nav>

            <main className="pt-32 pb-24 px-6 md:px-12">
                <div className="max-w-4xl mx-auto">
                    {/* Hero Section */}
                    <FadeInSection>
                        <div className="mb-20">
                            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 text-[10px] uppercase tracking-[0.2em] mb-6">
                                <BookOpen className="w-3 h-3" />
                                Integration Protocol
                            </div>
                            <h1 className="text-4xl md:text-6xl font-light tracking-tighter mb-8 bg-gradient-to-r from-foreground to-foreground/40 bg-clip-text text-transparent">
                                The Performance Layer <br className="hidden md:block" />
                                Integration Guide
                            </h1>
                            <p className="text-lg text-muted-foreground font-light leading-relaxed max-w-2xl">
                                Connect your SaaS product to the Black Index network. Our trustless architecture 
                                ensures every sales conversion is attributed and rewarded instantly.
                            </p>
                        </div>
                    </FadeInSection>

                    <div className="space-y-32">
                        {/* Step 1 */}
                        <FadeInSection>
                            <section id="step-1" className="space-y-8">
                                <div className="space-y-2">
                                    <span className="text-xs font-mono text-purple-400 opacity-60">01 / Frontend</span>
                                    <h2 className="text-3xl font-light tracking-tight">The Integration Protocol</h2>
                                </div>
                                <p className="text-muted-foreground font-light leading-relaxed text-lg">
                                    Add our lightweight tracking script to your product's landing page and checkout page.
                                    This script automatically captures the <code className="text-purple-400 font-mono">ref_id</code> from the URL, persists it in a first-party cookie, and handles attribution logic.
                                </p>
                                
                                <SpotlightCard className="p-8 group">
                                    <div className="flex items-center justify-between mb-4">
                                        <div className="flex items-center gap-2">
                                            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                            <span className="text-[10px] font-mono text-muted-foreground tracking-widest uppercase">Global Track.js Tag</span>
                                        </div>
                                        <button 
                                            onClick={() => handleCopy('<script src="https://blackindex.in/track.js"></script>', 'script')}
                                            className="text-muted-foreground hover:text-foreground transition-colors p-2 rounded-lg bg-foreground/5"
                                        >
                                            {copied === 'script' ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                                        </button>
                                    </div>
                                    <div className="p-6 rounded-xl bg-black/60 border border-white/5 overflow-x-auto shadow-2xl">
                                        <code className="text-sm text-emerald-400 font-mono">
                                            {`<script src="https://blackindex.in/track.js"></script>`}
                                        </code>
                                    </div>
                                </SpotlightCard>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="p-6 rounded-2xl border border-white/5 bg-foreground/[0.02] transition-colors hover:bg-foreground/[0.04]">
                                        <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                                            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                                            URL Persistence
                                        </h4>
                                        <p className="text-sm font-light text-muted-foreground leading-relaxed">
                                            The script detects <code className="text-foreground">?ref=...</code> parameters and locks them into secure, first-party storage.
                                        </p>
                                    </div>
                                    <div className="p-6 rounded-2xl border border-white/5 bg-foreground/[0.02] transition-colors hover:bg-foreground/[0.04]">
                                        <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                                            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                                            Zero Latency
                                        </h4>
                                        <p className="text-sm font-light text-muted-foreground leading-relaxed">
                                            Our script is asynchronously loaded (2kb) and has zero impact on your Core Web Vitals or LCP.
                                        </p>
                                    </div>
                                </div>
                            </section>
                        </FadeInSection>

                        {/* Step 2 */}
                        <FadeInSection>
                            <section id="step-2" className="space-y-8">
                                <div className="space-y-2">
                                    <span className="text-xs font-mono text-blue-400 opacity-60">02 / Backend</span>
                                    <h2 className="text-3xl font-light tracking-tight">Identity Locking</h2>
                                </div>
                                <p className="text-muted-foreground font-light leading-relaxed text-lg">
                                    For recurring SaaS products, you must pass the <code className="text-blue-400 font-mono">ref_id</code> to your payment provider's metadata. 
                                    This allows Black Index to lock the Warlord to the customer identity for long-term attribution.
                                </p>
                                
                                <SpotlightCard className="p-8">
                                    <div className="flex items-center justify-between mb-4">
                                        <div className="flex items-center gap-2">
                                            <Terminal className="w-4 h-4 text-muted-foreground" />
                                            <span className="text-[10px] font-mono text-muted-foreground tracking-widest uppercase">Node.js / Stripe Logic</span>
                                        </div>
                                        <button 
                                            onClick={() => handleCopy('subscription_data: { metadata: { ref_id: req.cookies.ref_id } }', 'backend')}
                                            className="text-muted-foreground hover:text-foreground transition-colors p-2 rounded-lg bg-foreground/5"
                                        >
                                            {copied === 'backend' ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                                        </button>
                                    </div>
                                    <div className="p-6 rounded-xl bg-black/60 border border-white/5 overflow-x-auto shadow-2xl">
                                        <code className="text-sm text-blue-400 font-mono leading-relaxed">
{`const referralId = req.cookies.ref_id // Read from cookie

const session = await stripe.checkout.sessions.create({
  // ... other checkout settings
  subscription_data: {
    metadata: {
       // Identity Locking Protocol
      ref_id: referralId 
    }
  }
});`}
                                        </code>
                                    </div>
                                </SpotlightCard>

                                <div className="p-6 rounded-2xl border border-red-500/10 bg-red-500/5 flex gap-6 items-start">
                                    <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center shrink-0">
                                        <Shield className="w-5 h-5 text-red-400" />
                                    </div>
                                    <div>
                                        <p className="text-md text-red-400 font-medium mb-1">Critical Requirement</p>
                                        <p className="text-sm text-red-400/80 font-light leading-relaxed">
                                            If you do not pass this metadata, the platform will verify the first payment but will 
                                            fail to attribute future renewals. <b>Lifetime commissions will be lost.</b>
                                        </p>
                                    </div>
                                </div>
                            </section>
                        </FadeInSection>

                        {/* Step 3 */}
                        <FadeInSection>
                            <section id="step-3" className="space-y-8">
                                <div className="space-y-2">
                                    <span className="text-xs font-mono text-amber-400 opacity-60">03 / Infrastructure</span>
                                    <h2 className="text-3xl font-light tracking-tight">The Pulse (Webhooks)</h2>
                                </div>
                                <p className="text-muted-foreground font-light leading-relaxed text-lg">
                                    Configure your payment provider to send events to our webhook endpoints. This provides the "Pulse" 
                                    that informs the network of successful captures and renewals.
                                </p>
                                
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    <div className="p-8 rounded-3xl border border-white/5 bg-foreground/[0.02] space-y-6">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center">
                                                <Webhook className="w-5 h-5 text-purple-400" />
                                            </div>
                                            <h3 className="text-md font-medium">Signature Verification</h3>
                                        </div>
                                        <p className="text-sm text-muted-foreground font-light leading-relaxed">
                                            Every payload is cross-referenced with your <b>Webhook Signing Secret</b>. We reject all unverified requests to ensure 100% data integrity and prevent fraudulent commission requests.
                                        </p>
                                    </div>

                                    <div className="p-8 rounded-3xl border border-white/5 bg-foreground/[0.02] space-y-6">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                                                <ArrowUpRight className="w-5 h-5 text-emerald-400" />
                                            </div>
                                            <h3 className="text-md font-medium">Real-time Payouts</h3>
                                        </div>
                                        <p className="text-sm text-muted-foreground font-light leading-relaxed">
                                            Once the event is captured and verified, funds are automatically split. Warlords receive their commissions instantly, and your ledger is updated in real-time.
                                        </p>
                                    </div>
                                </div>
                                
                                <div className="p-8 rounded-3xl border border-white/5 bg-black/20">
                                    <h4 className="text-[10px] font-mono uppercase tracking-[0.3em] text-muted-foreground mb-6">Required Webhook Events</h4>
                                    <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                                        {[
                                            { name: 'checkout.session.completed', provider: 'Stripe' },
                                            { name: 'invoice.paid', provider: 'Stripe' },
                                            { name: 'payment.captured', provider: 'Razorpay' },
                                            { name: 'order.paid', provider: 'Razorpay' },
                                            { name: 'order_created', provider: 'Lemon Squeezy' }
                                        ].map(event => (
                                            <li key={event.name} className="flex flex-col gap-1 group">
                                                <span className="text-emerald-400 font-mono text-xs">{event.name}</span>
                                                <span className="text-[10px] text-muted-foreground font-light uppercase tracking-widest">{event.provider}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            </section>
                        </FadeInSection>
                    </div>

                    <FadeInSection>
                        <div className="mt-40 pt-20 border-t border-white/10 text-center space-y-12">
                            <div className="space-y-4">
                                <h3 className="text-3xl font-light tracking-tight">System Ready.</h3>
                                <p className="text-muted-foreground font-light">Your integration is now connected to the global sales surface.</p>
                            </div>
                            <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
                                <Link href="/dashboard/founder">
                                    <Button className="h-14 px-10 bg-foreground text-background hover:bg-foreground/90 font-normal transition-all hover:scale-105">
                                        Go to Dashboard
                                    </Button>
                                </Link>
                                <Button variant="ghost" className="h-14 px-10 font-light border border-white/5 hover:bg-white/5 transition-all">
                                    Speak to an Engineer
                                </Button>
                            </div>
                        </div>
                    </FadeInSection>
                </div>
            </main>

            <footer className="py-12 border-t border-white/5 text-center">
                <p className="text-[10px] font-mono text-muted-foreground tracking-[0.5em] uppercase">Black Index Protocol Documentation</p>
            </footer>
        </div>
    )
}
