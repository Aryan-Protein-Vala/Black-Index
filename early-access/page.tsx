"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { ArrowRight, Check, Users, Zap, Shield, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Logo } from "@/components/logo"
import { SpotlightCard } from "@/components/ui/spotlight-card"

const stats = [
    { value: "10K", label: "Target Signups", icon: Users },
    { value: "0%", label: "Platform Fee (Early)", icon: Zap },
    { value: "100%", label: "Secure Payouts", icon: Shield },
]

const features = [
    "Performance-based sales network",
    "Founders list products, Warlords drive sales",
    "Transparent commission structure",
    "Secure escrow with T+30 payouts",
    "Real-time analytics dashboard",
    "Early access = founder benefits",
]

export default function EarlyAccessPage() {
    const [email, setEmail] = useState("")
    const [name, setName] = useState("")
    const [role, setRole] = useState<"founder" | "warlord" | "">("")
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [isSubmitted, setIsSubmitted] = useState(false)
    const [error, setError] = useState("")
    const [waitlistPosition, setWaitlistPosition] = useState<number | null>(null)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError("")

        if (!email || !name || !role) {
            setError("Please fill in all fields")
            return
        }

        setIsSubmitting(true)

        try {
            const response = await fetch("/early-access/api/signup", {
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
        <div className="min-h-screen bg-background relative overflow-hidden">
            {/* Grain overlay */}
            <div className="grain-overlay" />

            {/* Gradient background */}
            <div className="absolute inset-0 bg-gradient-to-b from-purple-500/5 via-transparent to-transparent" />

            {/* Content */}
            <div className="relative z-10 max-w-6xl mx-auto px-6 py-12">
                {/* Header */}
                <motion.header
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6 }}
                    className="flex items-center justify-between mb-20"
                >
                    <Logo showText={true} />
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
                        <span className="text-xs text-muted-foreground font-light tracking-wide">Early Access</span>
                    </div>
                </motion.header>

                {/* Hero */}
                <div className="grid lg:grid-cols-2 gap-16 items-center">
                    {/* Left - Content */}
                    <motion.div
                        initial={{ opacity: 0, x: -40 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.8, delay: 0.2 }}
                    >
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.3 }}
                            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-purple-500/10 border border-purple-500/20 mb-6"
                        >
                            <span className="text-xs text-purple-400 font-light">🚀 Launching Soon</span>
                        </motion.div>

                        <h1 className="text-4xl md:text-5xl lg:text-6xl font-light tracking-tight leading-[1.1] mb-6">
                            <span className="block">Black Index</span>
                            <span className="block text-muted-foreground">The Sales Network.</span>
                        </h1>

                        <p className="text-lg text-muted-foreground font-light mb-8 max-w-md">
                            Where products meet performance. Founders list, Warlords sell, everyone wins.
                            Join early and unlock exclusive benefits.
                        </p>

                        {/* Features */}
                        <div className="grid grid-cols-2 gap-3 mb-8">
                            {features.map((feature, i) => (
                                <motion.div
                                    key={i}
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: 0.5 + i * 0.1 }}
                                    className="flex items-center gap-2"
                                >
                                    <Check className="w-4 h-4 text-green-400 flex-shrink-0" />
                                    <span className="text-xs text-muted-foreground font-light">{feature}</span>
                                </motion.div>
                            ))}
                        </div>

                        {/* Stats */}
                        <div className="flex gap-6">
                            {stats.map((stat, i) => (
                                <motion.div
                                    key={stat.label}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.8 + i * 0.1 }}
                                    className="text-center"
                                >
                                    <stat.icon className="w-5 h-5 text-purple-400 mx-auto mb-2" />
                                    <p className="text-2xl font-light tracking-tight">{stat.value}</p>
                                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{stat.label}</p>
                                </motion.div>
                            ))}
                        </div>
                    </motion.div>

                    {/* Right - Signup Form */}
                    <motion.div
                        initial={{ opacity: 0, x: 40 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.8, delay: 0.4 }}
                    >
                        <SpotlightCard className="p-8">
                            {isSubmitted ? (
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.9 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    className="text-center py-8"
                                >
                                    <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-6">
                                        <Check className="w-8 h-8 text-green-400" />
                                    </div>
                                    <h3 className="text-2xl font-light mb-2">You're In!</h3>
                                    <p className="text-muted-foreground font-light mb-6">
                                        You're #{waitlistPosition} on the waitlist.
                                    </p>
                                    <div className="p-4 rounded-lg bg-purple-500/10 border border-purple-500/20">
                                        <p className="text-sm text-purple-400 font-light">
                                            ✨ Early access members get 0% platform fees for the first 3 months
                                        </p>
                                    </div>
                                </motion.div>
                            ) : (
                                <>
                                    <h2 className="text-xl font-light tracking-tight mb-2">Get Early Access</h2>
                                    <p className="text-sm text-muted-foreground font-light mb-6">
                                        Be among the first 10,000 to join Black Index
                                    </p>

                                    <form onSubmit={handleSubmit} className="space-y-4">
                                        <div>
                                            <label className="text-xs text-muted-foreground mb-2 block">Your Name</label>
                                            <Input
                                                type="text"
                                                placeholder="Your name"
                                                value={name}
                                                onChange={(e) => setName(e.target.value)}
                                                className="h-12 bg-background/50 border-border/50 text-sm font-light focus:border-purple-500/50"
                                            />
                                        </div>

                                        <div>
                                            <label className="text-xs text-muted-foreground mb-2 block">Email Address</label>
                                            <Input
                                                type="email"
                                                placeholder="you@example.com"
                                                value={email}
                                                onChange={(e) => setEmail(e.target.value)}
                                                className="h-12 bg-background/50 border-border/50 text-sm font-light focus:border-purple-500/50"
                                            />
                                        </div>

                                        <div>
                                            <label className="text-xs text-muted-foreground mb-2 block">I want to be a...</label>
                                            <div className="grid grid-cols-2 gap-3">
                                                <button
                                                    type="button"
                                                    onClick={() => setRole("founder")}
                                                    className={`p-4 rounded-lg border text-center transition-all ${role === "founder"
                                                        ? "bg-purple-500/10 border-purple-500/50 text-purple-400"
                                                        : "bg-background/30 border-border/30 text-muted-foreground hover:border-border/50"
                                                        }`}
                                                >
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
                                                    <p className="text-sm font-light">Warlord</p>
                                                    <p className="text-[10px] text-muted-foreground mt-1">Sell & earn</p>
                                                </button>
                                            </div>
                                        </div>

                                        {error && (
                                            <p className="text-xs text-red-400">{error}</p>
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

                {/* Footer */}
                <motion.footer
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 1 }}
                    className="mt-20 text-center"
                >
                    <p className="text-xs text-muted-foreground font-light">
                        © 2024 Black Index. All rights reserved.
                    </p>
                </motion.footer>
            </div>
        </div>
    )
}
