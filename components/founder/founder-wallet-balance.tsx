"use client"

import { useState, useEffect } from "react"
import { Wallet } from "lucide-react"
import { createClient } from "@/lib/supabase"
import { formatCurrency } from "@/hooks/use-dashboard-data"

export function FounderWalletBalance() {
    const [balance, setBalance] = useState<number>(0)
    const supabase = createClient()

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
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const { data } = await supabase
            .from("profiles")
            .select("wallet_balance")
            .eq("id", user.id)
            .single()

        if (data) {
            setBalance(Number((data as any).wallet_balance) || 0)
        }
    }

    return (
        <div className="flex items-center gap-2 bg-foreground/[0.02] border border-border/50 rounded-full px-3 py-1">
            <Wallet className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-xs font-medium">{formatCurrency(balance)}</span>
        </div>
    )
}
