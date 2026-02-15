"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/components/auth-provider"
import { Loader2 } from "lucide-react"

/**
 * Dashboard Router
 * Now routes everyone to the unified dashboard at /dashboard/seller
 * The unified dashboard handles both seller + founder features
 */
export default function DashboardRouter() {
  const router = useRouter()
  const { user, isLoading } = useAuth()

  useEffect(() => {
    if (isLoading) return

    if (!user) {
      router.replace("/login")
      return
    }

    // Everyone goes to the unified dashboard
    router.replace("/dashboard/seller")
  }, [user, isLoading, router])

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center">
        <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-muted-foreground" />
        <p className="text-sm text-muted-foreground font-light">Loading your dashboard...</p>
      </div>
    </div>
  )
}
