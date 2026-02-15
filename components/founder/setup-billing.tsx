"use client"

import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { CreditCard, Shield, AlertCircle, Check, ExternalLink, Loader2, Crown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { SpotlightCard } from "@/components/ui/spotlight-card"
import { useAuth } from "@/components/auth-provider"

// Forever Pro users - exempt from billing
const FOREVER_PRO_EMAILS = [
    "aryansharma24112003@gmail.com"
]

interface BillingStatus {
    hasMandate: boolean
    mandateStatus: string | null
    unbilledAmount: number
    billingThreshold: number
}

export function SetupBilling() {
    const { user } = useAuth()
    const [status, setStatus] = useState<BillingStatus | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [error, setError] = useState("")

    // Check if user is Forever Pro
    const isForeverPro = user?.email && FOREVER_PRO_EMAILS.includes(user.email)

    // Fetch current billing status
    useEffect(() => {
        fetchStatus()
    }, [])

    const fetchStatus = async () => {
        try {
            const response = await fetch("/api/founders/billing/create-mandate")
            const data = await response.json()
            setStatus(data)
        } catch (err) {
            console.error("Failed to fetch billing status:", err)
        } finally {
            setIsLoading(false)
        }
    }

    const handleSetupMandate = async () => {
        setError("")
        setIsSubmitting(true)

        try {
            // Get user info from session/profile
            const profileRes = await fetch("/api/profile")
            const profile = await profileRes.json()

            const response = await fetch("/api/founders/billing/create-mandate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: profile.full_name || "Founder",
                    email: profile.email,
                    contact: profile.phone || "",
                }),
            })

            const data = await response.json()

            if (!response.ok) {
                throw new Error(data.error || "Failed to create mandate")
            }

            // Redirect to Razorpay authorization page
            if (data.authorizationUrl) {
                window.open(data.authorizationUrl, "_blank")
            }

            // Refresh status
            await fetchStatus()

        } catch (err) {
            setError(err instanceof Error ? err.message : "Something went wrong")
        } finally {
            setIsSubmitting(false)
        }
    }

    if (isLoading && !isForeverPro) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
        )
    }

    // Forever Pro - no billing required
    if (isForeverPro) {
        return (
            <SpotlightCard className="p-6">
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-yellow-500/20 to-amber-500/20 flex items-center justify-center">
                        <Crown className="w-6 h-6 text-yellow-500" />
                    </div>
                    <div>
                        <h3 className="font-light text-lg flex items-center gap-2">
                            Forever Pro
                            <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-500/10 text-yellow-500 border border-yellow-500/20">
                                ∞
                            </span>
                        </h3>
                        <p className="text-sm text-muted-foreground">Lifetime access, no billing required</p>
                    </div>
                </div>

                <div className="mt-4 p-4 rounded-lg bg-gradient-to-br from-yellow-500/5 to-amber-500/5 border border-yellow-500/10">
                    <div className="flex items-center gap-2 text-sm text-yellow-400 mb-2">
                        <Check className="w-4 h-4" />
                        Unlimited products
                    </div>
                    <div className="flex items-center gap-2 text-sm text-yellow-400 mb-2">
                        <Check className="w-4 h-4" />
                        No commission caps
                    </div>
                    <div className="flex items-center gap-2 text-sm text-yellow-400 mb-2">
                        <Check className="w-4 h-4" />
                        Priority support
                    </div>
                    <div className="flex items-center gap-2 text-sm text-yellow-400">
                        <Check className="w-4 h-4" />
                        All future features included
                    </div>
                </div>

                <p className="text-xs text-muted-foreground text-center mt-4">
                    🎉 You're a founding member of Black Index
                </p>
            </SpotlightCard>
        )
    }

    // Already has active mandate
    if (status?.hasMandate && status.mandateStatus === "active") {
        return (
            <SpotlightCard className="p-6">
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center">
                        <Check className="w-5 h-5 text-green-500" />
                    </div>
                    <div>
                        <h3 className="font-light text-lg">Billing Active</h3>
                        <p className="text-sm text-muted-foreground">Auto-debit mandate is set up</p>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mt-6">
                    <div className="p-4 rounded-lg bg-foreground/5 border border-border/30">
                        <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Unbilled Amount</p>
                        <p className="text-2xl font-light">₹{((status.unbilledAmount || 0) / 100).toLocaleString("en-IN")}</p>
                    </div>
                    <div className="p-4 rounded-lg bg-foreground/5 border border-border/30">
                        <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Billing Threshold</p>
                        <p className="text-2xl font-light">₹{((status.billingThreshold || 500000) / 100).toLocaleString("en-IN")}</p>
                    </div>
                </div>

                <p className="text-xs text-muted-foreground mt-4">
                    When your unbilled amount reaches the threshold, we'll send you a notification 24 hours before auto-debiting.
                </p>
            </SpotlightCard>
        )
    }

    // Pending mandate
    if (status?.hasMandate && status.mandateStatus === "pending") {
        return (
            <SpotlightCard className="p-6">
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-full bg-yellow-500/10 flex items-center justify-center">
                        <AlertCircle className="w-5 h-5 text-yellow-500" />
                    </div>
                    <div>
                        <h3 className="font-light text-lg">Authorization Pending</h3>
                        <p className="text-sm text-muted-foreground">Please complete the mandate authorization</p>
                    </div>
                </div>

                <Button
                    onClick={handleSetupMandate}
                    disabled={isSubmitting}
                    className="w-full h-12 mt-4 bg-foreground text-background hover:bg-foreground/90"
                >
                    {isSubmitting ? (
                        <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Processing...
                        </>
                    ) : (
                        <>
                            Complete Authorization
                            <ExternalLink className="w-4 h-4 ml-2" />
                        </>
                    )}
                </Button>
            </SpotlightCard>
        )
    }

    // No mandate - setup required
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
        >
            <SpotlightCard className="p-6">
                <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 rounded-full bg-foreground/5 flex items-center justify-center">
                        <CreditCard className="w-5 h-5 text-muted-foreground" />
                    </div>
                    <div>
                        <h3 className="font-light text-lg">Set Up Auto-Pay</h3>
                        <p className="text-sm text-muted-foreground">Authorize automatic commission settlements</p>
                    </div>
                </div>

                <div className="space-y-4 mb-6">
                    <div className="flex items-start gap-3 p-3 rounded-lg bg-foreground/5">
                        <Shield className="w-4 h-4 text-muted-foreground mt-0.5" />
                        <div>
                            <p className="text-sm font-light">Secure Mandate</p>
                            <p className="text-xs text-muted-foreground">Authorize Black Index to debit commissions up to ₹1,00,000/month</p>
                        </div>
                    </div>

                    <div className="flex items-start gap-3 p-3 rounded-lg bg-foreground/5">
                        <AlertCircle className="w-4 h-4 text-muted-foreground mt-0.5" />
                        <div>
                            <p className="text-sm font-light">24h Notice</p>
                            <p className="text-xs text-muted-foreground">You'll always receive notification before any debit (RBI compliant)</p>
                        </div>
                    </div>
                </div>

                {error && (
                    <p className="text-sm text-red-400 mb-4">{error}</p>
                )}

                <Button
                    onClick={handleSetupMandate}
                    disabled={isSubmitting}
                    className="w-full h-12 bg-foreground text-background hover:bg-foreground/90"
                >
                    {isSubmitting ? (
                        <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Setting up...
                        </>
                    ) : (
                        <>
                            Authorize Auto-Pay
                            <ExternalLink className="w-4 h-4 ml-2" />
                        </>
                    )}
                </Button>

                <p className="text-[10px] text-muted-foreground text-center mt-4">
                    Powered by Razorpay. Your payment details are secure and never stored on our servers.
                </p>
            </SpotlightCard>
        </motion.div>
    )
}
