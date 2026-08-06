"use client"

import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { Wallet, ArrowRight, AlertCircle, Check, Loader2, Clock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { SpotlightCard } from "@/components/ui/spotlight-card"

interface WithdrawStatus {
    withdrawableBalance: number
    pendingBalance: number
    minimumWithdrawal: number
    canWithdraw: boolean
    hasUpi: boolean
}

export function WithdrawFunds() {
    const [status, setStatus] = useState<WithdrawStatus | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [fetchError, setFetchError] = useState(false)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [upiVpa, setUpiVpa] = useState("")
    const [amount, setAmount] = useState("")
    const [error, setError] = useState("")
    const [success, setSuccess] = useState(false)

    useEffect(() => {
        fetchStatus()
    }, [])

    const fetchStatus = async () => {
        setIsLoading(true)
        setFetchError(false)
        try {
            const response = await fetch("/api/sellers/withdraw")
            if (!response.ok) throw new Error("Failed to fetch")
            const data = await response.json()
            setStatus(data)
        } catch (err) {
            console.error("Failed to fetch withdraw status:", err)
            setFetchError(true)
        } finally {
            setIsLoading(false)
        }
    }

    const handleWithdraw = async () => {
        setError("")
        setIsSubmitting(true)

        try {
            const withdrawAmount = parseFloat(amount) * 100 // Convert to paise

            if (withdrawAmount > (status?.withdrawableBalance || 0)) {
                throw new Error("Amount exceeds withdrawable balance")
            }

            const upiPattern = /^[a-zA-Z0-9._-]{2,}@[a-zA-Z]{2,}$/
            if (!status?.hasUpi && !upiPattern.test(upiVpa)) {
                throw new Error("Invalid UPI VPA format")
            }

            const response = await fetch("/api/sellers/withdraw", {
                method: "POST",
                headers: { 
                    "Content-Type": "application/json",
                    "Idempotency-Key": crypto.randomUUID()
                },
                body: JSON.stringify({
                    amount: withdrawAmount,
                    upiVpa: upiVpa || undefined,
                }),
            })

            const data = await response.json()

            if (!response.ok) {
                throw new Error(data.error || "Withdrawal failed")
            }

            setSuccess(true)
            setAmount("")
            await fetchStatus()

        } catch (err) {
            setError(err instanceof Error ? err.message : "Something went wrong")
        } finally {
            setIsSubmitting(false)
        }
    }

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
        )
    }

    if (fetchError) {
        return (
            <div className="flex flex-col items-center justify-center py-12 space-y-4">
                <AlertCircle className="w-8 h-8 text-red-500" />
                <p className="text-muted-foreground">Failed to load balance</p>
                <Button onClick={fetchStatus} variant="outline" size="sm">Retry</Button>
            </div>
        )
    }

    const withdrawableRupees = (status?.withdrawableBalance || 0) / 100
    const pendingRupees = (status?.pendingBalance || 0) / 100
    const minWithdrawal = (status?.minimumWithdrawal || 100000) / 100

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="space-y-6"
        >
            {/* Balance Cards */}
            <div className="grid md:grid-cols-2 gap-4">
                <SpotlightCard className="p-6">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center">
                            <Wallet className="w-5 h-5 text-green-500" />
                        </div>
                        <div>
                            <p className="text-xs text-muted-foreground uppercase tracking-wider">Withdrawable</p>
                            <p className="text-2xl font-light">₹{withdrawableRupees.toLocaleString("en-IN")}</p>
                        </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                        Cleared commissions ready for withdrawal
                    </p>
                </SpotlightCard>

                <SpotlightCard className="p-6">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 rounded-full bg-yellow-500/10 flex items-center justify-center">
                            <Clock className="w-5 h-5 text-yellow-500" />
                        </div>
                        <div>
                            <p className="text-xs text-muted-foreground uppercase tracking-wider">Pending</p>
                            <p className="text-2xl font-light">₹{pendingRupees.toLocaleString("en-IN")}</p>
                        </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                        In escrow (T+30 clearing period)
                    </p>
                </SpotlightCard>
            </div>

            {/* Withdraw Form */}
            <SpotlightCard className="p-6">
                <h3 className="text-lg font-light mb-6">Withdraw Funds</h3>

                {success ? (
                    <div className="text-center py-8">
                        <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-4">
                            <Check className="w-8 h-8 text-green-500" />
                        </div>
                        <p className="text-lg font-light mb-2">Withdrawal Initiated!</p>
                        <p className="text-sm text-muted-foreground mb-4">
                            Funds will be credited to your UPI within minutes.
                        </p>
                        <Button
                            onClick={() => setSuccess(false)}
                            variant="outline"
                            className="border-border/50"
                        >
                            Make Another Withdrawal
                        </Button>
                    </div>
                ) : (
                    <>
                        {!status?.canWithdraw ? (
                            <div className="text-center py-8">
                                <AlertCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                                <p className="text-muted-foreground">
                                    Minimum withdrawal is ₹{minWithdrawal.toLocaleString("en-IN")}
                                </p>
                                <p className="text-sm text-muted-foreground mt-2">
                                    You need ₹{(minWithdrawal - withdrawableRupees).toLocaleString("en-IN")} more to withdraw.
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <div>
                                    <label className="text-xs text-muted-foreground mb-2 block">Amount (₹)</label>
                                    <Input
                                        type="number"
                                        placeholder={`Min ₹${minWithdrawal}`}
                                        value={amount}
                                        onChange={(e) => setAmount(e.target.value)}
                                        max={withdrawableRupees}
                                        className="h-12 bg-background/50 border-border/50 text-lg font-light"
                                    />
                                    <div className="flex justify-between mt-1">
                                        <span className="text-xs text-muted-foreground">
                                            Min: ₹{minWithdrawal.toLocaleString("en-IN")}
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() => setAmount(withdrawableRupees.toString())}
                                            className="text-xs text-foreground hover:underline"
                                        >
                                            Withdraw All
                                        </button>
                                    </div>
                                </div>

                                {!status.hasUpi && (
                                    <div>
                                        <label className="text-xs text-muted-foreground mb-2 block">UPI ID</label>
                                        <Input
                                            type="text"
                                            placeholder="yourname@upi"
                                            value={upiVpa}
                                            onChange={(e) => setUpiVpa(e.target.value)}
                                            className="h-12 bg-background/50 border-border/50"
                                        />
                                    </div>
                                )}

                                {error && (
                                    <p className="text-sm text-red-400">{error}</p>
                                )}

                                <Button
                                    onClick={handleWithdraw}
                                    disabled={isSubmitting || !amount || parseFloat(amount) < minWithdrawal}
                                    className="w-full h-12 bg-foreground text-background hover:bg-foreground/90"
                                >
                                    {isSubmitting ? (
                                        <>
                                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                            Processing...
                                        </>
                                    ) : (
                                        <>
                                            Withdraw ₹{amount || "0"}
                                            <ArrowRight className="w-4 h-4 ml-2" />
                                        </>
                                    )}
                                </Button>

                                <p className="text-[10px] text-muted-foreground text-center">
                                    Powered by RazorpayX. Funds typically arrive within minutes.
                                </p>
                            </div>
                        )}
                    </>
                )}
            </SpotlightCard>
        </motion.div>
    )
}
