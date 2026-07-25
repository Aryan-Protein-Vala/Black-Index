"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { X, Crown, Check, Loader2, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { SpotlightCard } from "@/components/ui/spotlight-card"

interface BecomeSellerModalProps {
    isOpen: boolean
    onClose: () => void
    onSuccess: () => void
}

const SELLER_PRICING = {
    price: "Free", // Free for 2026
    features: [
        "List unlimited products",
        "Set your own commission rates",
        "Access to Warlord network",
        "Real-time sales dashboard",
        "Secure escrow protection",
        "Priority support",
    ]
}

export function BecomeSellerModal({ isOpen, onClose, onSuccess }: BecomeSellerModalProps) {
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState("")

    const handlePayment = async () => {
        setIsLoading(true)
        setError("")

        try {
            // Direct upgrade (Free for 2026)
            const response = await fetch("/api/founders/upgrade", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
            })

            const data = await response.json()

            if (!response.ok) {
                throw new Error(data.error || "Failed to upgrade")
            }

            onSuccess()
            onClose()

        } catch (err) {
            setError(err instanceof Error ? err.message : "Something went wrong")
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-[100] flex items-center justify-center p-4"
                >
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
                    />

                    {/* Modal */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                        className="relative w-full max-w-md"
                    >
                        <SpotlightCard className="p-6 relative overflow-hidden">
                            {/* Close button */}
                            <button
                                onClick={onClose}
                                className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>

                            {/* Header */}
                            <div className="text-center mb-6">
                                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-amber-500/20 to-yellow-600/20 flex items-center justify-center mx-auto mb-4">
                                    <Crown className="w-8 h-8 text-amber-500" />
                                </div>
                                <h2 className="text-2xl font-light tracking-tight">Become a Seller</h2>
                                <p className="text-sm text-muted-foreground mt-2">
                                    Unlock the power to list your own products
                                </p>
                            </div>

                            {/* Pricing */}
                            <div className="text-center mb-6">
                                <div className="inline-flex items-baseline gap-1">
                                    <span className="text-4xl font-light text-amber-500">Free</span>
                                    <span className="text-muted-foreground text-sm">for 2026</span>
                                </div>
                                <p className="text-xs text-muted-foreground mt-1">No credit card required</p>
                            </div>

                            {/* Features */}
                            <ul className="space-y-3 mb-6">
                                {SELLER_PRICING.features.map((feature, i) => (
                                    <li key={i} className="flex items-center gap-3 text-sm font-light">
                                        <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                                        <span>{feature}</span>
                                    </li>
                                ))}
                            </ul>

                            {error && (
                                <div className="flex items-center gap-2 text-red-400 text-sm mb-4">
                                    <AlertCircle className="w-4 h-4" />
                                    {error}
                                </div>
                            )}

                            {/* CTA */}
                            <Button
                                onClick={handlePayment}
                                disabled={isLoading}
                                className="w-full h-12 bg-gradient-to-r from-amber-500 to-yellow-600 text-black font-medium hover:from-amber-400 hover:to-yellow-500 transition-all"
                            >
                                {isLoading ? (
                                    <>
                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                        Processing...
                                    </>
                                ) : (
                                    <>
                                        <Crown className="w-4 h-4 mr-2" />
                                        Upgrade Now
                                    </>
                                )}
                            </Button>

                            <p className="text-[10px] text-muted-foreground text-center mt-4">
                                Limited time offer — Access ends Dec 31, 2026
                            </p>
                        </SpotlightCard>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    )
}
