"use client"

import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { CreditCard, Shield, AlertCircle, Check, ExternalLink, Loader2, Crown, Wallet, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { SpotlightCard } from "@/components/ui/spotlight-card"
import { useAuth } from "@/components/auth-provider"
import { toast } from "sonner"

// Forever Pro users - exempt from billing
const FOREVER_PRO_EMAILS = [
    "aryansharma24112003@gmail.com"
]

export function SetupBilling() {
    const { user } = useAuth()
    const [isLoading, setIsLoading] = useState(false)
    const [isSubmittingDeposit, setIsSubmittingDeposit] = useState(false)
    const [isConnectingStripe, setIsConnectingStripe] = useState(false)
    const [isConnectingRazorpay, setIsConnectingRazorpay] = useState(false)
    const [isDepositingWallet, setIsDepositingWallet] = useState(false)

    // Dummy state for UI demonstration (will be wired to real API later)
    const [depositPaid, setDepositPaid] = useState(false)
    const [walletBalance, setWalletBalance] = useState(0)
    const [stripeConnected, setStripeConnected] = useState(false)
    const [razorpayConnected, setRazorpayConnected] = useState(false)

    // Check if user is Forever Pro
    const isForeverPro = user?.email && FOREVER_PRO_EMAILS.includes(user.email)

    const handlePayDeposit = async () => {
        setIsSubmittingDeposit(true)
        // Simulate API call
        setTimeout(() => {
            setDepositPaid(true)
            toast.success("Security deposit of ₹5,000 paid successfully!")
            setIsSubmittingDeposit(false)
        }, 1500)
    }

    const handleConnectStripe = async () => {
        setIsConnectingStripe(true)
        // Simulate API call
        setTimeout(() => {
            setStripeConnected(true)
            toast.success("Stripe Connect account linked successfully!")
            setIsConnectingStripe(false)
        }, 1500)
    }

    const handleConnectRazorpay = async () => {
        setIsConnectingRazorpay(true)
        // Simulate API call
        setTimeout(() => {
            setRazorpayConnected(true)
            toast.success("Razorpay Route account linked successfully!")
            setIsConnectingRazorpay(false)
        }, 1500)
    }

    const handleDepositWallet = async () => {
        setIsDepositingWallet(true)
        // Simulate API call
        setTimeout(() => {
            setWalletBalance(prev => prev + 1000000) // ₹10,000 in paise
            toast.success("₹10,000 deposited to your commission wallet!")
            setIsDepositingWallet(false)
        }, 1500)
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
                <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl bg-yellow-500/10 flex items-center justify-center border border-yellow-500/20 shrink-0">
                        <Crown className="w-6 h-6 text-yellow-500" />
                    </div>
                    <div>
                        <h3 className="text-xl font-light mb-2">Forever Pro Founder</h3>
                        <p className="text-sm text-muted-foreground font-light leading-relaxed">
                            Your account is permanently exempted from security deposits and platform fees. 
                            You have unlimited access to Black Index.
                        </p>
                    </div>
                </div>
            </SpotlightCard>
        )
    }

    return (
        <div className="space-y-6">
            {/* Step 1: Security Deposit */}
            <SpotlightCard className="p-6 border-yellow-500/20">
                <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4">
                        <div className="w-10 h-10 rounded-lg bg-yellow-500/10 flex items-center justify-center border border-yellow-500/20 shrink-0">
                            <Shield className="w-5 h-5 text-yellow-500" />
                        </div>
                        <div>
                            <h3 className="text-lg font-light mb-1">Step 1: Security Deposit</h3>
                            <p className="text-sm text-muted-foreground font-light mb-4">
                                A refundable security deposit of ₹5,000 is required to list products on the network. 
                                This prevents fraud and ensures only serious founders join. Refundable upon account closure.
                            </p>
                            
                            {depositPaid ? (
                                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-500/10 text-green-400 border border-green-500/20 text-sm font-light">
                                    <Check className="w-4 h-4" />
                                    Deposit Paid
                                </div>
                            ) : (
                                <Button 
                                    onClick={handlePayDeposit} 
                                    disabled={isSubmittingDeposit}
                                    className="bg-yellow-500 text-black hover:bg-yellow-600 font-medium"
                                >
                                    {isSubmittingDeposit ? (
                                        <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Processing...</>
                                    ) : (
                                        "Pay Security Deposit"
                                    )}
                                </Button>
                            )}
                        </div>
                    </div>
                </div>
            </SpotlightCard>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Step 2: Tier 1 (Automated Split) */}
                <SpotlightCard className="p-6">
                    <div className="flex items-start gap-4 mb-6">
                        <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center border border-blue-500/20 shrink-0">
                            <CreditCard className="w-5 h-5 text-blue-400" />
                        </div>
                        <div>
                            <h3 className="text-lg font-light mb-1">Tier 1: Auto-Split</h3>
                            <p className="text-sm text-muted-foreground font-light">
                                Connect your payment gateway for automated 70/30 commission splits. No upfront wallet funding needed.
                            </p>
                        </div>
                    </div>

                    <div className="space-y-3">
                        <Button 
                            onClick={handleConnectStripe} 
                            disabled={isConnectingStripe || stripeConnected}
                            variant="outline" 
                            className="w-full justify-between"
                        >
                            <span className="flex items-center gap-2">
                                <span className="font-semibold text-[#635BFF]">stripe</span>
                                {stripeConnected ? "Connected" : "Connect Stripe"}
                            </span>
                            {stripeConnected ? <Check className="w-4 h-4 text-green-400" /> : <ExternalLink className="w-4 h-4 opacity-50" />}
                        </Button>

                        <Button 
                            onClick={handleConnectRazorpay} 
                            disabled={isConnectingRazorpay || razorpayConnected}
                            variant="outline" 
                            className="w-full justify-between"
                        >
                            <span className="flex items-center gap-2">
                                <span className="font-semibold text-[#02042B]">Razorpay</span> Route
                            </span>
                            {razorpayConnected ? <Check className="w-4 h-4 text-green-400" /> : <ExternalLink className="w-4 h-4 opacity-50" />}
                        </Button>
                    </div>
                </SpotlightCard>

                {/* Step 3: Tier 2 (Pre-Paid Wallet) */}
                <SpotlightCard className="p-6">
                    <div className="flex items-start gap-4 mb-6">
                        <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20 shrink-0">
                            <Wallet className="w-5 h-5 text-emerald-400" />
                        </div>
                        <div>
                            <h3 className="text-lg font-light mb-1">Tier 2: Pre-Paid Wallet</h3>
                            <p className="text-sm text-muted-foreground font-light">
                                For Gumroad/Lemon Squeezy users. Pre-fund a wallet to pay commissions. If balance hits ₹0, products are paused.
                            </p>
                        </div>
                    </div>

                    <div className="bg-foreground/5 rounded-lg p-4 mb-4 border border-border/30">
                        <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Wallet Balance</p>
                        <p className="text-2xl font-light">₹{(walletBalance / 100).toLocaleString('en-IN')}</p>
                    </div>

                    <Button 
                        onClick={handleDepositWallet} 
                        disabled={isDepositingWallet}
                        className="w-full"
                    >
                        {isDepositingWallet ? (
                             <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Processing...</>
                        ) : (
                            <><Plus className="w-4 h-4 mr-2" /> Deposit ₹10,000</>
                        )}
                    </Button>
                </SpotlightCard>
            </div>
        </div>
    )
}
