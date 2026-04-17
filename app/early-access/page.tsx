"use client"

import { useState, useEffect, useRef } from "react"
import { motion, useInView, useSpring, useTransform } from "framer-motion"
import { ArrowRight, Check, MousePointer2, Globe, Zap, Shield, Users, Loader2, Package, TrendingUp } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Logo } from "@/components/logo"
import { SpotlightCard } from "@/components/ui/spotlight-card"

// Animated number component - counts from 0 to target without overshooting
function AnimatedNumber({ value, prefix = "" }: { value: number; prefix?: string }) {
    const ref = useRef(null)
    const isInView = useInView(ref, { once: true })
    const spring = useSpring(0, { 
        stiffness: 100, 
        damping: 25,
        restDelta: 100 
    })
    const display = useTransform(spring, (current) => {
        // Clamp to not exceed target value
        const clamped = Math.min(Math.floor(current), value)
        return `${prefix}${clamped.toLocaleString("en-IN")}`
    })
    const [displayValue, setDisplayValue] = useState(`${prefix}0`)

    useEffect(() => {
        if (isInView) {
            spring.set(value)
        }
    }, [isInView, spring, value])

    useEffect(() => {
        return display.on("change", (latest) => {
            setDisplayValue(latest)
        })
    }, [display])

    return <span ref={ref} className="tabular-nums">{displayValue}</span>
}

// How it works steps
const steps = [
    {
        title: "Choose an Offer",
        caption: "Browse curated products from top founders in The Vault",
        icon: MousePointer2,
    },
    {
        title: "Sell Anywhere",
        caption: "Your network, your way — social, email, DMs, content",
        icon: Globe,
    },
    {
        title: "Earn Automatically",
        caption: "Commission hits your wallet instantly on every sale",
        icon: Zap,
    },
]

// Features for founders vs warlords
const founderFeatures = [
    "List your product in The Vault",
    "Set your own commission rates",
    "Pay only for results, not promises",
    "Real-time sales dashboard",
    "Secure escrow protection",
]

const warlordFeatures = [
    "Access to curated product offers",
    "High commission rates set by founders",
    "Instant payout (T+30 escrow)",
    "Your own referral links",
    "Performance analytics",
]

export default function EarlyAccessPage() {
    const [email, setEmail] = useState("")
    const [name, setName] = useState("")
    const [role, setRole] = useState<"founder" | "warlord" | "">("")
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [isSubmitted, setIsSubmitted] = useState(false)
    const [error, setError] = useState("")
    const [waitlistPosition, setWaitlistPosition] = useState<number | null>(null)
    const [waitlistCount, setWaitlistCount] = useState(0)

    // Fetch current waitlist count
    useEffect(() => {
        fetch("/api/early-access/signup")
            .then(res => res.json())
            .then(data => setWaitlistCount(data.count || 0))
            .catch(() => { })
    }, [])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError("")

        if (!email || !name || !role) {
            setError("Please fill in all fields")
            return
        }

        setIsSubmitting(true)

        try {
            const response = await fetch("/api/early-access/signup", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, name, role }),
            })

            const data = await response.json()

            if (!response.ok) {
                throw new Error(data.error || "Something went wrong")
            }

            setWaitlistPosition(data.position)
            setIsSubmitted(true)
        } catch (err) {
            setError(err instanceof Error ? err.message : "Something went wrong")
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <div className="min-h-screen bg-background relative">
            {/* Grain overlay */}
            <div className="grain-overlay" />

            {/* Header */}
            <motion.header
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
                className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border/30"
            >
                <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
                    <Logo showText={true} />
                    <div className="flex items-center gap-4">
                        <div className="hidden sm:flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                            <span className="text-[10px] text-muted-foreground font-light tracking-wide">
                                {waitlistCount.toLocaleString()} joined
                            </span>
                        </div>
                        <a href="#join" className="text-xs font-light text-muted-foreground hover:text-foreground transition-colors">
                            Get Early Access
                        </a>
                    </div>
                </div>
            </motion.header>

            {/* Hero Section */}
            <section className="min-h-screen flex items-center justify-center px-6 pt-20">
                <div className="max-w-4xl text-center">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.2 }}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-foreground/5 border border-border/50 mb-8"
                    >
                        <span className="text-xs text-muted-foreground font-light tracking-wide">
                            🚀 Launching Soon — {10000 - waitlistCount} spots left
                        </span>
                    </motion.div>

                    <motion.h1
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6, delay: 0.3 }}
                        className="text-4xl md:text-6xl lg:text-7xl font-light tracking-tight leading-[1.1] mb-6"
                    >
                        Black Index
                        <br />
                        <span className="text-muted-foreground">The Sales Network.</span>
                    </motion.h1>

                    <motion.p
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, delay: 0.5 }}
                        className="text-lg md:text-xl font-light text-muted-foreground tracking-tight max-w-2xl mx-auto mb-10"
                    >
                        A marketplace where sales talent is rewarded <span className="text-foreground">instantly</span> and <span className="text-foreground">fairly.</span>
                        {" "}Founders list products, Warlords drive sales.
                    </motion.p>

                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, delay: 0.7 }}
                    >
                        <a href="#join">
                            <Button className="h-12 px-8 text-sm font-normal tracking-tight bg-foreground text-background hover:bg-foreground/90 transition-all duration-300 group shadow-[0_0_20px_rgba(255,255,255,0.05)] hover:shadow-[0_0_30px_rgba(255,255,255,0.1)]">
                                Join Early Access
                                <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform duration-300" />
                            </Button>
                        </a>
                    </motion.div>
                </div>
            </section>

            {/* Overview Section */}
            <section className="py-24 px-6">
                <div className="max-w-3xl mx-auto">
                    <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.5 }}
                        className="flex items-center gap-3 mb-8"
                    >
                        <div className="w-8 h-px bg-muted-foreground/30" />
                        <span className="text-xs font-medium tracking-widest text-muted-foreground uppercase">Overview</span>
                    </motion.div>
                    <motion.p
                        initial={{ opacity: 0, y: 30 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.6, delay: 0.1 }}
                        className="text-2xl md:text-3xl lg:text-4xl font-light tracking-tight leading-relaxed text-balance"
                    >
                        Black Index connects <span className="text-muted-foreground">founders</span> who need sales with{" "}
                        <span className="text-muted-foreground">Warlords</span> who close deals. No salaries, no overhead — just results.
                    </motion.p>
                </div>
            </section>

            {/* How It Works Section */}
            <section className="py-24 px-6">
                <div className="max-w-5xl mx-auto">
                    <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.5 }}
                        className="flex items-center gap-3 mb-16"
                    >
                        <div className="w-8 h-px bg-muted-foreground/30" />
                        <span className="text-xs font-medium tracking-widest text-muted-foreground uppercase">How It Works</span>
                    </motion.div>

                    <div className="grid md:grid-cols-3 gap-6">
                        {steps.map((step, index) => {
                            const Icon = step.icon
                            return (
                                <motion.div
                                    key={step.title}
                                    initial={{ opacity: 0, y: 30 }}
                                    whileInView={{ opacity: 1, y: 0 }}
                                    viewport={{ once: true }}
                                    transition={{ duration: 0.5, delay: index * 0.1 }}
                                >
                                    <SpotlightCard className="p-8 group h-full">
                                        <div className="absolute top-4 right-4 text-xs font-light text-muted-foreground/50">
                                            0{index + 1}
                                        </div>
                                        <Icon className="w-6 h-6 mb-8 text-muted-foreground group-hover:text-foreground transition-colors duration-300" />
                                        <h3 className="text-lg font-normal tracking-tight mb-2">{step.title}</h3>
                                        <p className="text-sm font-light text-muted-foreground">{step.caption}</p>
                                    </SpotlightCard>
                                </motion.div>
                            )
                        })}
                    </div>
                </div>
            </section>

            {/* Earnings Section */}
            <section className="py-24 px-6">
                <div className="max-w-4xl mx-auto text-center">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.5 }}
                        className="flex items-center justify-center gap-3 mb-16"
                    >
                        <div className="w-8 h-px bg-muted-foreground/30" />
                        <span className="text-xs font-medium tracking-widest text-muted-foreground uppercase">Potential Earnings</span>
                        <div className="w-8 h-px bg-muted-foreground/30" />
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        whileInView={{ opacity: 1, scale: 1 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.6, delay: 0.2 }}
                    >
                        <p className="text-4xl sm:text-6xl md:text-8xl lg:text-9xl font-light tracking-tighter">
                            <AnimatedNumber value={1000000} prefix="₹" />
                            <span className="text-muted-foreground">+</span>
                        </p>
                        <p className="mt-4 text-lg font-light text-muted-foreground tracking-tight">potential monthly earnings for top Warlords</p>
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.5, delay: 0.4 }}
                        className="mt-16 flex flex-wrap items-center justify-center gap-4 sm:gap-8 text-sm font-light text-muted-foreground"
                    >
                        <span className="flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-foreground/50" />
                            Up to 60% commission
                        </span>
                        <span className="flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-foreground/50" />
                            No earning caps
                        </span>
                        <span className="flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-foreground/50" />
                            T+30 payouts
                        </span>
                    </motion.div>
                </div>
            </section>

            {/* The Maths Section - This is the moat */}
            <section className="py-24 px-6">
                <div className="max-w-5xl mx-auto">
                    <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.5 }}
                        className="flex items-center gap-3 mb-16"
                    >
                        <div className="w-8 h-px bg-muted-foreground/30" />
                        <span className="text-xs font-medium tracking-widest text-muted-foreground uppercase">The Maths</span>
                    </motion.div>

                    <div className="grid md:grid-cols-2 gap-8">
                        {/* Warlord Math */}
                        <motion.div
                            initial={{ opacity: 0, y: 30 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.5 }}
                        >
                            <SpotlightCard className="p-8 h-full">
                                <div className="flex items-center gap-3 mb-6">
                                    <TrendingUp className="w-6 h-6 text-muted-foreground" />
                                    <h3 className="text-xl font-light tracking-tight">Warlord Earnings</h3>
                                </div>

                                <div className="space-y-6">
                                    <div className="p-4 rounded-lg bg-foreground/5 border border-border/30">
                                        <p className="text-sm text-muted-foreground font-light mb-3">Imagine you sell a product worth:</p>
                                        <div className="grid grid-cols-2 gap-4 text-center">
                                            <div>
                                                <p className="text-2xl font-light">₹1,000</p>
                                                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">/month subscription</p>
                                            </div>
                                            <div>
                                                <p className="text-2xl font-light">1,000</p>
                                                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">customers</p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between py-3 border-b border-border/30 gap-2">
                                            <span className="text-sm text-muted-foreground font-light shrink-0">First month (40%)</span>
                                            <span className="text-base sm:text-lg font-light text-foreground text-right">₹4,00,000</span>
                                        </div>
                                        <div className="flex items-center justify-between py-3 border-b border-border/30 gap-2">
                                            <span className="text-sm text-muted-foreground font-light shrink-0">Monthly (20%)</span>
                                            <span className="text-base sm:text-lg font-light text-foreground text-right">₹2,00,000</span>
                                        </div>
                                        <div className="flex items-center justify-between py-3 gap-2">
                                            <span className="text-sm font-light shrink-0">Year 1 Total</span>
                                            <span className="text-xl sm:text-2xl font-light text-foreground text-right">₹26,00,000</span>
                                        </div>
                                    </div>

                                    <p className="text-xs text-muted-foreground font-light text-center">
                                        Your customers keep paying → You keep earning. That's MRR for Warlords.
                                    </p>
                                    <div className="pt-4 border-t border-border/30 mt-4">
                                        <p className="text-sm font-light text-center text-foreground">Sell once, earn forever<span className="text-muted-foreground">*</span></p>
                                    </div>
                                </div>
                            </SpotlightCard>
                        </motion.div>

                        {/* Founder Math */}
                        <motion.div
                            initial={{ opacity: 0, y: 30 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.5, delay: 0.1 }}
                        >
                            <SpotlightCard className="p-8 h-full">
                                <div className="flex items-center gap-3 mb-6">
                                    <Package className="w-6 h-6 text-muted-foreground" />
                                    <h3 className="text-xl font-light tracking-tight">Founder Scale</h3>
                                </div>

                                <div className="space-y-6">
                                    <div className="p-4 rounded-lg bg-foreground/5 border border-border/30">
                                        <p className="text-sm text-muted-foreground font-light mb-3">Imagine you have:</p>
                                        <div className="grid grid-cols-2 gap-4 text-center">
                                            <div>
                                                <p className="text-2xl font-light">1,000</p>
                                                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Warlords selling</p>
                                            </div>
                                            <div>
                                                <p className="text-2xl font-light">10</p>
                                                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">sales each/month</p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between py-3 border-b border-border/30 gap-2">
                                            <span className="text-sm text-muted-foreground font-light shrink-0">Sales/month</span>
                                            <span className="text-base sm:text-lg font-light text-foreground text-right">10,000</span>
                                        </div>
                                        <div className="flex items-center justify-between py-3 border-b border-border/30 gap-2">
                                            <span className="text-sm text-muted-foreground font-light shrink-0">At ₹1,000/sale</span>
                                            <span className="text-base sm:text-lg font-light text-foreground text-right">₹1,00,00,000</span>
                                        </div>
                                        <div className="flex items-center justify-between py-3 gap-2">
                                            <span className="text-sm font-light shrink-0">Cost (20%)</span>
                                            <span className="text-xl sm:text-2xl font-light text-foreground text-right">₹20,00,000</span>
                                        </div>
                                    </div>

                                    <p className="text-xs text-muted-foreground font-light text-center">
                                        ₹1 Crore revenue for ₹20 Lakh CAC. No salaries. No overhead. Just results.
                                    </p>
                                    <div className="pt-4 border-t border-border/30 mt-4">
                                        <p className="text-sm font-light text-center text-foreground">1,000 salespeople. Zero payroll.</p>
                                    </div>
                                </div>
                            </SpotlightCard>
                        </motion.div>
                    </div>

                    <motion.p
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.5, delay: 0.3 }}
                        className="text-center text-lg font-light text-muted-foreground mt-12"
                    >
                        The network effect multiplies. <span className="text-foreground">Everyone wins.</span>
                    </motion.p>
                </div>
            </section>

            {/* Two Paths Section */}
            <section className="py-24 px-6">
                <div className="max-w-5xl mx-auto">
                    <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.5 }}
                        className="flex items-center gap-3 mb-16"
                    >
                        <div className="w-8 h-px bg-muted-foreground/30" />
                        <span className="text-xs font-medium tracking-widest text-muted-foreground uppercase">Two Paths</span>
                    </motion.div>

                    <div className="grid md:grid-cols-2 gap-8">
                        {/* Founder Card */}
                        <motion.div
                            initial={{ opacity: 0, y: 30 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.5 }}
                        >
                            <SpotlightCard className="p-8 h-full">
                                <div className="flex items-center gap-3 mb-6">
                                    <Package className="w-6 h-6 text-muted-foreground" />
                                    <h3 className="text-xl font-light tracking-tight">For Founders</h3>
                                </div>
                                <p className="text-sm text-muted-foreground font-light mb-6">
                                    List your product and let a network of motivated sellers drive revenue for you. Pay only when they deliver.
                                </p>
                                <ul className="space-y-3">
                                    {founderFeatures.map((feature, i) => (
                                        <li key={i} className="flex items-center gap-3 text-sm font-light">
                                            <Check className="w-4 h-4 text-foreground/50 flex-shrink-0" />
                                            <span>{feature}</span>
                                        </li>
                                    ))}
                                </ul>
                            </SpotlightCard>
                        </motion.div>

                        {/* Warlord Card */}
                        <motion.div
                            initial={{ opacity: 0, y: 30 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.5, delay: 0.1 }}
                        >
                            <SpotlightCard className="p-8 h-full">
                                <div className="flex items-center gap-3 mb-6">
                                    <TrendingUp className="w-6 h-6 text-muted-foreground" />
                                    <h3 className="text-xl font-light tracking-tight">For Warlords</h3>
                                </div>
                                <p className="text-sm text-muted-foreground font-light mb-6">
                                    Choose products you believe in, sell through your network, and earn commissions that match your hustle.
                                </p>
                                <ul className="space-y-3">
                                    {warlordFeatures.map((feature, i) => (
                                        <li key={i} className="flex items-center gap-3 text-sm font-light">
                                            <Check className="w-4 h-4 text-foreground/50 flex-shrink-0" />
                                            <span>{feature}</span>
                                        </li>
                                    ))}
                                </ul>
                            </SpotlightCard>
                        </motion.div>
                    </div>
                </div>
            </section>

            {/* Trust Section */}
            <section className="py-24 px-6">
                <div className="max-w-4xl mx-auto text-center">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.5 }}
                        className="flex items-center justify-center gap-3 mb-16"
                    >
                        <div className="w-8 h-px bg-muted-foreground/30" />
                        <span className="text-xs font-medium tracking-widest text-muted-foreground uppercase">Trust & Security</span>
                        <div className="w-8 h-px bg-muted-foreground/30" />
                    </motion.div>

                    <div className="grid md:grid-cols-3 gap-6">
                        {[
                            { icon: Shield, title: "Escrow Protection", desc: "Funds held securely until sale is verified" },
                            { icon: Users, title: "Verified Network", desc: "Only serious sellers, no spam" },
                            { icon: Zap, title: "Instant Tracking", desc: "Real-time analytics on every click and sale" },
                        ].map((item, i) => (
                            <motion.div
                                key={item.title}
                                initial={{ opacity: 0, y: 20 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ duration: 0.5, delay: i * 0.1 }}
                                className="text-center"
                            >
                                <item.icon className="w-8 h-8 text-muted-foreground mx-auto mb-4" />
                                <h4 className="text-base font-normal tracking-tight mb-2">{item.title}</h4>
                                <p className="text-sm text-muted-foreground font-light">{item.desc}</p>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Join Section */}
            <section id="join" className="py-24 px-6">
                <div className="max-w-xl mx-auto">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.5 }}
                    >
                        <SpotlightCard className="p-8">
                            {isSubmitted ? (
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.9 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    className="text-center py-8"
                                >
                                    <div className="w-16 h-16 rounded-full bg-foreground/5 flex items-center justify-center mx-auto mb-6">
                                        <Check className="w-8 h-8 text-foreground" />
                                    </div>
                                    <h3 className="text-2xl font-light mb-2">You're In!</h3>
                                    <p className="text-muted-foreground font-light mb-6">
                                        You're #{waitlistPosition} on the waitlist.
                                    </p>
                                    <p className="text-sm text-muted-foreground font-light">
                                        We'll email you when we launch. Early members get priority access.
                                    </p>
                                </motion.div>
                            ) : (
                                <>
                                    <div className="text-center mb-8">
                                        <h2 className="text-2xl font-light tracking-tight mb-2">Get Early Access</h2>
                                        <p className="text-sm text-muted-foreground font-light">
                                            Be among the first 10,000 to join Black Index
                                        </p>
                                    </div>

                                    <form onSubmit={handleSubmit} className="space-y-4">
                                        <div>
                                            <label className="text-xs text-muted-foreground mb-2 block">Your Name</label>
                                            <Input
                                                type="text"
                                                placeholder="Your name"
                                                value={name}
                                                onChange={(e) => setName(e.target.value)}
                                                className="h-12 bg-background/50 border-border/50 text-sm font-light focus:border-foreground/30"
                                            />
                                        </div>

                                        <div>
                                            <label className="text-xs text-muted-foreground mb-2 block">Email Address</label>
                                            <Input
                                                type="email"
                                                placeholder="you@example.com"
                                                value={email}
                                                onChange={(e) => setEmail(e.target.value)}
                                                className="h-12 bg-background/50 border-border/50 text-sm font-light focus:border-foreground/30"
                                            />
                                        </div>

                                        <div>
                                            <label className="text-xs text-muted-foreground mb-2 block">I want to be a...</label>
                                            <div className="grid grid-cols-2 gap-3">
                                                <button
                                                    type="button"
                                                    onClick={() => setRole("founder")}
                                                    className={`p-4 rounded-lg border text-center transition-all ${role === "founder"
                                                        ? "bg-foreground/10 border-foreground/50 text-foreground"
                                                        : "bg-background/30 border-border/30 text-muted-foreground hover:border-border/50"
                                                        }`}
                                                >
                                                    <Package className="w-5 h-5 mx-auto mb-2" />
                                                    <p className="text-sm font-light">Founder</p>
                                                    <p className="text-[10px] text-muted-foreground mt-1">List my product</p>
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setRole("warlord")}
                                                    className={`p-4 rounded-lg border text-center transition-all ${role === "warlord"
                                                        ? "bg-foreground/10 border-foreground/50 text-foreground"
                                                        : "bg-background/30 border-border/30 text-muted-foreground hover:border-border/50"
                                                        }`}
                                                >
                                                    <TrendingUp className="w-5 h-5 mx-auto mb-2" />
                                                    <p className="text-sm font-light">Warlord</p>
                                                    <p className="text-[10px] text-muted-foreground mt-1">Sell & earn</p>
                                                </button>
                                            </div>
                                        </div>

                                        {error && (
                                            <p className="text-xs text-red-400 text-center">{error}</p>
                                        )}

                                        <Button
                                            type="submit"
                                            disabled={isSubmitting}
                                            className="w-full h-12 text-sm font-light bg-foreground text-background hover:bg-foreground/90 transition-all group"
                                        >
                                            {isSubmitting ? (
                                                <>
                                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                                    Joining...
                                                </>
                                            ) : (
                                                <>
                                                    Join the Waitlist
                                                    <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />
                                                </>
                                            )}
                                        </Button>

                                        <p className="text-[10px] text-muted-foreground text-center">
                                            No spam, ever. We'll only email you when we launch.
                                        </p>
                                    </form>
                                </>
                            )}
                        </SpotlightCard>
                    </motion.div>
                </div>
            </section>

            <footer className="py-12 px-6 border-t border-border/30">
                <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
                    <Logo showText={true} />
                    <div className="text-center md:text-right">
                        <p className="text-xs text-muted-foreground font-light">
                            © 2024 Black Index. All rights reserved.
                        </p>
                        <p className="text-[10px] text-muted-foreground/60 mt-1">
                            <a href="/terms#recurring-commission" className="hover:text-foreground transition-colors">*See terms for recurring commission details</a>
                        </p>
                    </div>
                </div>
            </footer>
        </div>
    )
}
