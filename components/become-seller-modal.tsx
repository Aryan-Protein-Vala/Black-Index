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
    price: 100, // ₹100/month discounted from 500
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
            // Fetch Razorpay config from server
            const configRes = await fetch("/api/config/razorpay")
            const configData = await configRes.json()
            
            if (!configRes.ok || !configData.keyId) {
                throw new Error("Payment system unavailable")
            }

            // Create Razorpay order
            const response = await fetch("/api/founders/upgrade", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
            })

            const data = await response.json()

            if (!response.ok) {
                throw new Error(data.error || "Failed to create order")
            }

            // Open Razorpay checkout
            const options = {
                key: configData.keyId,
                amount: SELLER_PRICING.price * 100, // In paise
                currency: "INR",
                name: "Black Index",
                description: "Become a Seller - Onboarding Fee",
                order_id: data.orderId,
                handler: async function (response: any) {
                    // Verify payment
                    const verifyRes = await fetch("/api/founders/upgrade/verify", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            razorpay_order_id: response.razorpay_order_id,
                            razorpay_payment_id: response.razorpay_payment_id,
                            razorpay_signature: response.razorpay_signature,
                        }),
                    })

                    if (verifyRes.ok) {
                        onSuccess()
                        onClose()
                    } else {
                        setError("Payment verification failed")
                    }
                },
                prefill: {
                    email: data.email,
                    contact: data.phone || "",
                },
                theme: {
                    color: "#000000",
                },
            }

            // @ts-ignore - Razorpay is loaded via script
            const razorpay = new window.Razorpay(options)
            razorpay.open()

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
                                <div className="inline-flex items-baseline gap-2">
                                    <span className="text-2xl text-muted-foreground line-through decoration-red-500/50">₹500</span>
                                    <span className="text-4xl font-light text-green-400">₹{SELLER_PRICING.price}</span>
                                </div>
                                <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-500/10 text-green-400 text-xs font-medium">
                                    🎉 Launch Special Discount
                                </div>
                                <p className="text-xs text-muted-foreground mt-3">One-time onboarding fee</p>
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
                                Secure payment powered by Razorpay
                            </p>
                        </SpotlightCard>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    )
}
