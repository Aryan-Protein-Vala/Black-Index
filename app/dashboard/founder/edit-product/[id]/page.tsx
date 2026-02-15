"use client"

import { useState, useEffect } from "react"
import { useRouter, useParams } from "next/navigation"
import { motion } from "framer-motion"
import { ArrowLeft, Loader2, Save, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { SpotlightCard } from "@/components/ui/spotlight-card"
import Link from "next/link"
import { useAuth } from "@/components/auth-provider"
import { createClient } from "@/lib/supabase"

export default function EditProductPage() {
    const router = useRouter()
    const params = useParams()
    const productId = params.id as string
    const { user } = useAuth()

    const [isLoading, setIsLoading] = useState(true)
    const [isSaving, setIsSaving] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState(false)

    // Form fields
    const [name, setName] = useState("")
    const [websiteUrl, setWebsiteUrl] = useState("")
    const [description, setDescription] = useState("")
    const [upfrontPct, setUpfrontPct] = useState("30")
    const [recurringPct, setRecurringPct] = useState("15")
    const [maxRecurringMonths, setMaxRecurringMonths] = useState("12")
    const [maxCacLimit, setMaxCacLimit] = useState("")
    const [isActive, setIsActive] = useState(true)

    // Load product data
    useEffect(() => {
        async function fetchProduct() {
            if (!user || !productId) return

            const supabase = createClient()
            // SECURITY: Only select non-sensitive fields - webhook_secret must NEVER be returned to client
            const { data, error } = await supabase
                .from("products")
                .select("id, name, description, logo_url, website_url, is_active, is_founders_choice, commission_config, max_cac_limit, created_at, settlement_mode")
                .eq("id", productId)
                .eq("founder_id", user.id)
                .single()

            if (error || !data) {
                setError("Product not found or you don't have permission")
                setIsLoading(false)
                return
            }

            setName(data.name)
            setWebsiteUrl(data.website_url)
            setDescription(data.description || "")
            setIsActive(data.is_active)

            const config = data.commission_config as any
            if (config) {
                setUpfrontPct(String(config.upfront_pct || 30))
                setRecurringPct(String(config.recurring_pct || 0))
                setMaxRecurringMonths(String(config.max_recurring_months || 12))
            }

            if (data.max_cac_limit) {
                setMaxCacLimit(String(data.max_cac_limit / 100))
            }

            setIsLoading(false)
        }

        if (user) {
            fetchProduct()
        }
    }, [user, productId])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!user || !productId) return

        setIsSaving(true)
        setError(null)

        try {
            const supabase = createClient()

            const commissionConfig = {
                type: "hybrid" as const,
                upfront_pct: parseInt(upfrontPct) || 30,
                recurring_pct: parseInt(recurringPct) || 0,
                max_recurring_months: parseInt(maxRecurringMonths) || 12,
            }

            const { error: updateError } = await supabase
                .from("products")
                .update({
                    name,
                    website_url: websiteUrl,
                    description: description || null,
                    commission_config: commissionConfig,
                    max_cac_limit: maxCacLimit ? parseInt(maxCacLimit) * 100 : null,
                    is_active: isActive,
                } as any)
                .eq("id", productId)

            if (updateError) throw updateError

            setSuccess(true)
            setTimeout(() => {
                router.push("/dashboard/founder")
            }, 1500)

        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to update product")
        } finally {
            setIsSaving(false)
        }
    }

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-background flex items-center justify-center p-6">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full max-w-2xl"
            >
                <Link href="/dashboard/founder" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-8">
                    <ArrowLeft className="w-4 h-4" />
                    Back to Dashboard
                </Link>

                <h1 className="text-3xl font-light tracking-tight mb-2">Edit Product</h1>
                <p className="text-muted-foreground font-light mb-8">
                    Update your product details
                </p>

                {error && (
                    <div className="mb-6 p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                        {error}
                    </div>
                )}

                {success && (
                    <div className="mb-6 p-4 rounded-lg bg-green-500/10 border border-green-500/20 text-green-400 text-sm">
                        Product updated successfully! Redirecting...
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-6">
                    <SpotlightCard className="p-6">
                        <h3 className="text-lg font-light mb-4">Basic Info</h3>

                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="name">Product Name *</Label>
                                <Input
                                    id="name"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder="e.g. NEETGenius"
                                    className="h-12 bg-input/30"
                                    required
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="website">Website URL *</Label>
                                <Input
                                    id="website"
                                    value={websiteUrl}
                                    onChange={(e) => setWebsiteUrl(e.target.value)}
                                    placeholder="https://yourproduct.com"
                                    className="h-12 bg-input/30"
                                    required
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="description">Description</Label>
                                <textarea
                                    id="description"
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    placeholder="Detailed description of your product"
                                    className="w-full h-32 px-3 py-2 bg-input/30 border border-border/50 rounded-lg text-sm font-light focus:border-foreground/30 focus:outline-none resize-none"
                                />
                            </div>

                            <div className="flex items-center gap-3 py-2">
                                <button
                                    type="button"
                                    onClick={() => setIsActive(!isActive)}
                                    className={`relative w-12 h-6 rounded-full transition-colors ${isActive ? "bg-green-500" : "bg-muted"
                                        }`}
                                >
                                    <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${isActive ? "left-7" : "left-1"
                                        }`} />
                                </button>
                                <span className="text-sm font-light">
                                    {isActive ? "Active - Visible to sellers" : "Paused - Hidden from sellers"}
                                </span>
                            </div>
                        </div>
                    </SpotlightCard>

                    <SpotlightCard className="p-6">
                        <h3 className="text-lg font-light mb-4">Commission Structure</h3>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="upfront">Upfront Commission (%)</Label>
                                <Input
                                    id="upfront"
                                    type="number"
                                    value={upfrontPct}
                                    onChange={(e) => setUpfrontPct(e.target.value)}
                                    placeholder="30"
                                    className="h-12 bg-input/30"
                                />
                                <p className="text-xs text-muted-foreground">First-time customer</p>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="recurring">Recurring Commission (%)</Label>
                                <Input
                                    id="recurring"
                                    type="number"
                                    value={recurringPct}
                                    onChange={(e) => setRecurringPct(e.target.value)}
                                    placeholder="15"
                                    className="h-12 bg-input/30"
                                />
                                <p className="text-xs text-muted-foreground">Repeat purchase</p>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="months">Max Recurring Months</Label>
                                <Input
                                    id="months"
                                    type="number"
                                    value={maxRecurringMonths}
                                    onChange={(e) => setMaxRecurringMonths(e.target.value)}
                                    placeholder="12"
                                    className="h-12 bg-input/30"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="cac">Max CAC (₹)</Label>
                                <Input
                                    id="cac"
                                    type="number"
                                    value={maxCacLimit}
                                    onChange={(e) => setMaxCacLimit(e.target.value)}
                                    placeholder="Optional"
                                    className="h-12 bg-input/30"
                                />
                                <p className="text-xs text-muted-foreground">Cap per sale</p>
                            </div>
                        </div>
                    </SpotlightCard>

                    <div className="flex gap-4">
                        <Button
                            type="submit"
                            disabled={isSaving || !name || !websiteUrl}
                            className="flex-1 h-12 bg-foreground text-background hover:bg-foreground/90"
                        >
                            {isSaving ? (
                                <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    Saving...
                                </>
                            ) : (
                                <>
                                    <Save className="w-4 h-4 mr-2" />
                                    Save Changes
                                </>
                            )}
                        </Button>
                    </div>
                </form>
            </motion.div>
        </div>
    )
}
