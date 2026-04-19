"use client"

import { useState, useEffect } from "react"
import { CreditCard, Shield, Check, ExternalLink, Loader2, Crown, Wallet, Plus, Globe, MapPin } from "lucide-react"
import { Button } from "@/components/ui/button"
import { SpotlightCard } from "@/components/ui/spotlight-card"
import { useAuth } from "@/components/auth-provider"
import { toast } from "sonner"

const FOREVER_PRO_EMAILS = ["aryansharma24112003@gmail.com"]

export function SetupBilling() {
    const { user, profile, refreshProfile } = useAuth()
    const [region, setRegion] = useState<'india' | 'international'>('india')
    
    const [isLoading, setIsLoading] = useState(false)
    const [isSubmittingDeposit, setIsSubmittingDeposit] = useState(false)
    const [isConnectingRazorpay, setIsConnectingRazorpay] = useState(false)
    const [isDepositingWallet, setIsDepositingWallet] = useState(false)

    // REAL STATE WIRED TO DATABASE
    const [depositPaid, setDepositPaid] = useState(false)
    const [walletBalance, setWalletBalance] = useState(0)
    const [razorpayConnected, setRazorpayConnected] = useState(false)

    useEffect(() => {
        if (profile) {
            setDepositPaid(!!(profile as any).security_deposit_paid)
            setWalletBalance(Number((profile as any).wallet_balance) || 0)
            setRazorpayConnected(!!(profile as any).razorpay_account_id)
        }
    }, [profile])

    const isForeverPro = user?.email && FOREVER_PRO_EMAILS.includes(user.email)

    const loadRazorpay = async () => {
        return new Promise((resolve) => {
            if ((window as any).Razorpay) resolve(true)
            const script = document.createElement("script")
            script.src = "https://checkout.razorpay.com/v1/checkout.js"
            script.onload = () => resolve(true)
            script.onerror = () => resolve(false)
            document.body.appendChild(script)
        })
    }

    const handleDepositWallet = async () => {
        if (!user) return
        setIsDepositingWallet(true)
        const currency = region === 'india' ? 'INR' : 'USD'
        
        try {
            const res = await fetch("/api/founders/wallet", { 
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ user_id: user.id, currency })
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || "Failed to initiate deposit")

            // Lemon Squeezy (International) Flow
            if (data.checkoutUrl) {
                window.location.href = data.checkoutUrl
                return
            }

            // Razorpay (India) Flow
            const isLoaded = await loadRazorpay()
            if (!isLoaded) throw new Error("Razorpay SDK failed to load")

            const options = {
                key: data.key_id,
                amount: data.amount,
                currency: "INR",
                name: "Black Index",
                description: "Wallet Deposit",
                order_id: data.order_id,
                handler: async function (response: any) {
                    const verifyRes = await fetch("/api/founders/wallet/verify", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            razorpay_order_id: response.razorpay_order_id,
                            razorpay_payment_id: response.razorpay_payment_id,
                            razorpay_signature: response.razorpay_signature,
                            user_id: user.id
                        })
                    })
                    const verifyData = await verifyRes.json()
                    if (!verifyRes.ok) throw new Error("Verification failed")
                    toast.success("Wallet deposited successfully!")
                    await refreshProfile()
                },
                prefill: { email: user.email },
                theme: { color: "#10b981" },
            }

            const rzp = new (window as any).Razorpay(options)
            rzp.open()
        } catch (err: any) {
            toast.error(err.message || "Failed to deposit wallet")
        } finally {
            setIsDepositingWallet(false)
        }
    }

    if (isForeverPro) {
        return (
            <SpotlightCard className="p-6">
                <div className="flex items-start gap-4">
                    <Crown className="w-8 h-8 text-yellow-500" />
                    <div>
                        <h3 className="text-xl font-light">Forever Pro Founder</h3>
                        <p className="text-sm text-muted-foreground font-light">You have unlimited, deposit-free access.</p>
                    </div>
                </div>
            </SpotlightCard>
        )
    }

    return (
        <div className="space-y-6">
            {/* Region Toggle */}
            <div className="flex p-1 bg-foreground/5 rounded-xl border border-border/30 w-fit">
                <button 
                    onClick={() => setRegion('india')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-all ${region === 'india' ? 'bg-background shadow text-foreground' : 'text-muted-foreground'}`}
                >
                    <MapPin className="w-4 h-4" /> India (INR)
                </button>
                <button 
                    onClick={() => setRegion('international')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-all ${region === 'international' ? 'bg-background shadow text-foreground' : 'text-muted-foreground'}`}
                >
                    <Globe className="w-4 h-4" /> Global (USD)
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Auto-Split Tier */}
                <SpotlightCard className={`p-6 ${region === 'international' ? 'opacity-50 pointer-events-none' : ''}`}>
                    <div className="flex items-start gap-4 mb-6">
                        <CreditCard className="w-8 h-8 text-blue-400" />
                        <div>
                            <h3 className="text-lg font-light">Tier 1: Auto-Split</h3>
                            <p className="text-sm text-muted-foreground font-light">
                                Connect Razorpay Route to automate commissions. <br/>
                                <span className="text-blue-400 text-xs font-semibold">Available in India Only</span>
                            </p>
                        </div>
                    </div>
                    <Button variant="outline" className="w-full" disabled={region === 'international' || razorpayConnected}>
                        {razorpayConnected ? "Razorpay Connected" : "Connect Razorpay Route"}
                    </Button>
                </SpotlightCard>

                {/* Pre-Paid Wallet Tier */}
                <SpotlightCard className="p-6">
                    <div className="flex items-start gap-4 mb-6">
                        <Wallet className="w-8 h-8 text-emerald-400" />
                        <div>
                            <h3 className="text-lg font-light">Tier 2: Pre-Paid Wallet</h3>
                            <p className="text-sm text-muted-foreground font-light">
                                For Lemon Squeezy / Gumroad users. Pre-fund a wallet to pay Warlords.
                            </p>
                        </div>
                    </div>
                    <div className="bg-foreground/5 rounded-lg p-4 mb-4">
                        <p className="text-xs text-muted-foreground uppercase">Wallet Balance</p>
                        <p className="text-2xl font-light">
                            {region === 'india' ? `₹${(walletBalance / 100).toLocaleString('en-IN')}` : `$${(walletBalance / 100).toFixed(2)}`}
                        </p>
                    </div>
                    <Button onClick={handleDepositWallet} disabled={isDepositingWallet} className="w-full">
                        {isDepositingWallet ? "Processing..." : `Deposit ${region === 'india' ? '₹10,000' : '$120'}`}
                    </Button>
                </SpotlightCard>
            </div>
        </div>
    )
}
