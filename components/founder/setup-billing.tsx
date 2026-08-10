"use client"

import { useState, useEffect } from "react"
import { CreditCard, Shield, Check, ExternalLink, Loader2, Crown, Wallet, Plus, Globe, MapPin, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { SpotlightCard } from "@/components/ui/spotlight-card"
import { useAuth } from "@/components/auth-provider"
import { toast } from "sonner"

const FOREVER_PRO_EMAILS = ["aryansharma24112003@gmail.com"]

export function SetupBilling() {
    const { user, profile, refreshProfile } = useAuth()
    const [region, setRegion] = useState<'india' | 'international'>('india')
    
    const [isLoading, setIsLoading] = useState(false)
    const [isDepositingWallet, setIsDepositingWallet] = useState(false)
    const [walletBalance, setWalletBalance] = useState(0)
    const [topupAmount, setTopupAmount] = useState("1000")

    // For statement table
    const [transactions, setTransactions] = useState<any[]>([])

    useEffect(() => {
        if (profile) {
            setWalletBalance(Number((profile as any).wallet_balance) || 0)
            fetchStatements()
        }
    }, [profile])

    const fetchStatements = async () => {
        if (!user) return
        try {
            const supabase = (await import("@/lib/supabase")).createClient()
            const { data } = await supabase
                .from("transactions")
                .select("*")
                .eq("founder_id", user.id)
                .order("created_at", { ascending: false })
                .limit(20)
            if (data) setTransactions(data)
        } catch (e) {
            console.error("Failed to fetch statements", e)
        }
    }

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

    const USD_TO_INR = 84 // Or get from your FX env/lib

    const handleDepositWallet = async () => {
        if (!user) return
        const depositAmount = parseFloat(topupAmount)
        if (isNaN(depositAmount) || depositAmount < 0) {
            toast.error(region === 'india' ? "Minimum deposit is ₹0" : "Minimum deposit is $0")
            return
        }
        setIsDepositingWallet(true)
        const currency = region === 'india' ? 'INR' : 'USD'
        
        try {
            const res = await fetch("/api/founders/wallet", { 
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ user_id: user.id, currency, amount: depositAmount })
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
                    await fetchStatements()
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
                {/* Pre-Paid Wallet Tier - Front and Center */}
                <SpotlightCard className="p-6 md:col-span-2 lg:col-span-1 border-green-500/30">
                    <div className="flex items-start gap-4 mb-6">
                        <Wallet className="w-8 h-8 text-emerald-400" />
                        <div>
                            <h3 className="text-lg font-light">Platform Wallet</h3>
                            <p className="text-sm text-muted-foreground font-light">
                                Fund your wallet to auto-pay your Warlords.
                            </p>
                        </div>
                    </div>
                    <div className="bg-foreground/5 rounded-lg p-4 mb-4">
                        <p className="text-xs text-muted-foreground uppercase">Wallet Balance</p>
                        <p className="text-3xl font-light">
                            {region === 'india' 
                                ? `₹${(walletBalance / 100).toLocaleString('en-IN')}` 
                                : `$${(walletBalance / (100 * USD_TO_INR)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                        </p>
                        {walletBalance < 50000 && (
                            <p className="text-xs text-red-400 mt-2 flex items-center gap-1">
                                <AlertCircle className="w-3 h-3" /> Low balance warning: products auto-pause if balance falls below their max commission
                            </p>
                        )}
                    </div>
                    <div className="space-y-2 mb-3">
                        <Label htmlFor="topup-amount" className="text-xs text-muted-foreground">
                            Deposit Amount ({region === 'india' ? '₹' : '$'})
                        </Label>
                        <Input
                            id="topup-amount"
                            type="number"
                            min={0}
                            max={region === 'india' ? 500000 : 5000}
                            step={region === 'india' ? 100 : 1}
                            value={topupAmount}
                            onChange={(e) => setTopupAmount(e.target.value)}
                            className="h-11 bg-input/30"
                        />
                        <p className="text-[10px] text-muted-foreground">
                            Min {region === 'india' ? '₹0' : '$0'} · Max {region === 'india' ? '₹5,00,000' : '$5,000'}
                        </p>
                    </div>
                    <Button onClick={handleDepositWallet} disabled={isDepositingWallet} className="w-full bg-emerald-500 text-black hover:bg-emerald-600">
                        {isDepositingWallet ? "Processing..." : `Add Funds (${region === 'india' ? '₹' : '$'}${topupAmount || '—'})`}
                    </Button>
                </SpotlightCard>

                {/* Auto-Split Tier */}
                <SpotlightCard className="p-6 opacity-50 relative overflow-hidden">
                    <div className="absolute top-4 right-4 bg-foreground/10 text-foreground text-[10px] px-2 py-1 rounded font-medium tracking-wide">
                        COMING SOON
                    </div>
                    <div className="flex items-start gap-4 mb-6">
                        <CreditCard className="w-8 h-8 text-blue-400" />
                        <div>
                            <h3 className="text-lg font-light text-muted-foreground">Auto-Split at Checkout</h3>
                            <p className="text-sm text-muted-foreground/50 font-light">
                                Connect Razorpay Route to split commissions automatically.
                            </p>
                        </div>
                    </div>
                    <Button 
                        variant="outline" 
                        className="w-full opacity-50 cursor-not-allowed" 
                        disabled
                    >
                        Connect Razorpay Route
                    </Button>
                </SpotlightCard>
            </div>

            {/* Statements View */}
            <SpotlightCard className="p-6">
                <h3 className="text-lg font-light mb-4">Ledger Statements</h3>
                {transactions.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No transactions yet.</p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="text-xs text-muted-foreground uppercase border-b border-border/50">
                                <tr>
                                    <th className="pb-3 font-medium">Date</th>
                                    <th className="pb-3 font-medium">Type</th>
                                    <th className="pb-3 font-medium text-right">Amount</th>
                                    <th className="pb-3 font-medium">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border/20">
                                {transactions.map(tx => (
                                    <tr key={tx.id} className="hover:bg-foreground/[0.02]">
                                        <td className="py-3 font-light text-muted-foreground">
                                            {new Date(tx.created_at).toLocaleDateString()}
                                        </td>
                                        <td className="py-3 capitalize">
                                            {tx.type}
                                        </td>
                                        <td className={`py-3 text-right ${tx.type === 'deposit' ? 'text-green-400' : 'text-red-400'}`}>
                                            {tx.type === 'deposit' ? '+' : '-'}₹{(Math.abs(tx.commission_amount || tx.sale_amount || 0) / 100).toLocaleString('en-IN')}
                                        </td>
                                        <td className="py-3">
                                            <span className={`px-2 py-1 text-[10px] rounded ${
                                                tx.billing_status === 'billed' || tx.status === 'paid' ? 'bg-green-500/10 text-green-400' :
                                                tx.billing_status === 'wallet_insufficient' ? 'bg-yellow-500/10 text-yellow-400' :
                                                'bg-foreground/10 text-muted-foreground'
                                            }`}>
                                                {tx.billing_status === 'wallet_insufficient' ? 'Queued — pays out automatically on top-up' : tx.billing_status || tx.status || 'Success'}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </SpotlightCard>
        </div>
    )
}
