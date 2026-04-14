"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Loader2, DollarSign, ArrowRight, AlertCircle, Building2 } from "lucide-react"
import { toast } from "sonner"
import { useAuth } from "@/components/auth-provider"

export function PayoutPopover({ balance }: { balance: number }) {
    const { user } = useAuth()
    const [isOpen, setIsOpen] = useState(false)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [upiId, setUpiId] = useState("")

    const handleWithdraw = async () => {
        if (!upiId) {
            toast.error("Please enter a valid UPI ID or bank account number.")
            return
        }

        setIsSubmitting(true)
        // Simulate API call for now until backend is wired
        setTimeout(() => {
            setIsSubmitting(false)
            setIsOpen(false)
            toast.success("Withdrawal request submitted! It will be reviewed and processed within 24-48 hours.")
        }, 1500)
    }

    const withdrawable = balance / 100

    return (
        <div className="relative">
            <Button
                onClick={() => setIsOpen(!isOpen)}
                variant="outline"
                className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition-all font-medium flex items-center gap-2"
            >
                <DollarSign className="w-4 h-4" />
                Withdraw Funds
            </Button>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        className="absolute right-0 top-full mt-2 w-[320px] bg-[#141414] border border-[#2a2a2a] rounded-xl overflow-hidden shadow-2xl z-50 p-5"
                    >
                        <h3 className="text-lg font-light mb-1">Request Payout</h3>
                        <p className="text-xs text-muted-foreground mb-4">
                            Available to withdraw: <span className="text-white font-medium">₹{withdrawable.toLocaleString('en-IN')}</span>
                        </p>

                        <div className="space-y-4">
                            {withdrawable < 1000 ? (
                                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-start gap-2">
                                    <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                                    <p className="text-xs text-red-400 leading-relaxed">
                                        Minimum withdrawal amount is ₹1,000. Keep hustling!
                                    </p>
                                </div>
                            ) : (
                                <>
                                    <div className="space-y-2">
                                        <label className="text-xs text-muted-foreground uppercase tracking-wider">UPI ID or Bank Details</label>
                                        <div className="flex bg-input/30 rounded-lg border border-border/50 items-center px-3 focus-within:border-foreground/30 transition-colors">
                                            <Building2 className="w-4 h-4 text-muted-foreground mr-2" />
                                            <input 
                                                value={upiId}
                                                onChange={(e) => setUpiId(e.target.value)}
                                                placeholder="user@upi or a/c number"
                                                className="w-full h-10 bg-transparent text-sm font-light focus:outline-none"
                                            />
                                        </div>
                                    </div>

                                    <Button
                                        onClick={handleWithdraw}
                                        disabled={isSubmitting || !upiId}
                                        className="w-full h-10 bg-emerald-500 text-black hover:bg-emerald-600 font-medium"
                                    >
                                        {isSubmitting ? (
                                            <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Processing...</>
                                        ) : (
                                            <>Submit Request <ArrowRight className="w-4 h-4 ml-1" /></>
                                        )}
                                    </Button>

                                    <p className="text-[10px] text-muted-foreground text-center">
                                        Payouts are processed every Friday for security reasons.
                                    </p>
                                </>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}
