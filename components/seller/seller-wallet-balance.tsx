"use client"

import { useState, useEffect } from "react"
import { Wallet } from "lucide-react"
import { formatCurrency } from "@/hooks/use-dashboard-data"

export function SellerWalletBalance() {
    const [balance, setBalance] = useState<number>(0)

    useEffect(() => {
        fetchBalance()
        const interval = setInterval(fetchBalance, 60000)
        window.addEventListener("focus", fetchBalance)
        return () => {
            clearInterval(interval)
            window.removeEventListener("focus", fetchBalance)
        }
    }, [])

    const fetchBalance = async () => {
        try {
            const response = await fetch("/api/sellers/withdraw")
            if (!response.ok) return
            const data = await response.json()
            setBalance(data.withdrawableBalance || 0)
        } catch (err) {
            console.error("Failed to fetch balance", err)
        }
    }

    return (
        <div className="flex items-center gap-2 bg-foreground/[0.02] border border-border/50 rounded-full px-3 py-1">
            <Wallet className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-xs font-medium">{formatCurrency(balance)}</span>
        </div>
    )
}
