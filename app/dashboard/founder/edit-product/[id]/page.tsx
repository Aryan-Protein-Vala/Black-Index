"use client"

import { useState, useEffect } from "react"
import { useRouter, useParams } from "next/navigation"
import { motion } from "framer-motion"
import { ArrowLeft, Loader2, Save, KeyRound, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { SpotlightCard } from "@/components/ui/spotlight-card"
import Link from "next/link"
import { useAuth } from "@/components/auth-provider"
import { createClient } from "@/lib/supabase"
import { toast } from "sonner"

export default function EditProductPage() {
    const router = useRouter()
    const params = useParams()
    const productId = params.id as string
    const { user } = useAuth()

    const [isLoading, setIsLoading] = useState(true)
    const [isSaving, setIsSaving] = useState(false)
    const [isRotating, setIsRotating] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState(false)

    // Form fields
    const [name, setName] = useState("")
    const [websiteUrl, setWebsiteUrl] = useState("")
    const [description, setDescription] = useState("")
    const [category, setCategory] = useState("b2b")
    const [priceInr, setPriceInr] = useState("")
    const [billingType, setBillingType] = useState<"one_time" | "subscription">("subscription")
    
    const [upfrontPct, setUpfrontPct] = useState("30")
    const [recurringPct, setRecurringPct] = useState("0")
    const [maxRecurringMonths, setMaxRecurringMonths] = useState("12")
    const [maxCacLimit, setMaxCacLimit] = useState("")
    const [isActive, setIsActive] = useState(true)
    const [autoPaused, setAutoPaused] = useState(false)
    // Service (Cal.com) + Shopify verticals
    const [calLink, setCalLink] = useState("")
    const [meetingCommissionFlat, setMeetingCommissionFlat] = useState("")
    const [shopifySecret, setShopifySecret] = useState("")
    const [isSavingShopify, setIsSavingShopify] = useState(false)
    const [webhookSecret, setWebhookSecret] = useState("")
    const [isSavingWebhookSecret, setIsSavingWebhookSecret] = useState(false)

    const categories = [
        { id: "ai_saas", label: "AI SaaS" },
        { id: "b2b", label: "B2B" },
        { id: "devtools", label: "DevTools" },
        { id: "marketing", label: "Marketing" },
        { id: "creator_tools", label: "Creator Tools" },
        { id: "other", label: "Other" },
    ]

    useEffect(() => {
        async function fetchProduct() {
            if (!user || !productId) return

            const supabase = createClient()
            const { data, error } = await supabase
                .from("products")
                .select("id, name, description, logo_url, website_url, is_active, auto_paused, category, price_inr, billing_type, commission_config, max_cac_limit, cal_link, meeting_commission_flat")
                .eq("id", productId)
                .eq("founder_id", user.id)
                .single()

            if (error || !data) {
                setError("Product not found or you don't have permission")
                setIsLoading(false)
                return
            }

            const pd = data as any
            setName(pd.name)
            setWebsiteUrl(pd.website_url)
            setDescription(pd.description || "")
            setCategory(pd.category || "other")
            setPriceInr(pd.price_inr ? String(pd.price_inr / 100) : "")
            setBillingType(pd.billing_type || "subscription")
            setIsActive(pd.is_active)
            setAutoPaused(pd.auto_paused || false)

            const config = pd.commission_config as any
            if (config) {
                setUpfrontPct(String(config.upfront_pct || 30))
                setRecurringPct(String(config.recurring_pct || 0))
                setMaxRecurringMonths(String(config.max_recurring_months || 12))
            }

            if (pd.max_cac_limit) {
                setMaxCacLimit(String(pd.max_cac_limit / 100))
            }

            if (pd.cal_link) setCalLink(pd.cal_link)
            if (pd.meeting_commission_flat) {
                setMeetingCommissionFlat(String(pd.meeting_commission_flat / 100))
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
            const upfront = parseInt(upfrontPct)
            const recurring = billingType === "subscription" ? parseInt(recurringPct) : 0
            const months = billingType === "subscription" ? parseInt(maxRecurringMonths) : 1
            const maxCac = maxCacLimit ? parseInt(maxCacLimit) * 100 : null

            if (upfront < 1 || upfront > 100) throw new Error("Upfront commission must be 1-100%")
            if (recurring < 0 || recurring > 100) throw new Error("Recurring commission must be 0-100%")
            if (months < 1 || months > 36) throw new Error("Months must be 1-36")
            if (maxCac && (maxCac < 1000 || maxCac > 10000000)) throw new Error("Max CAC must be between ₹10 and ₹1,00,000")
            if (priceInr && parseInt(priceInr) < 0) throw new Error("Price cannot be negative")

            const supabase = createClient()
            const commissionConfig = {
                type: "hybrid",
                upfront_pct: upfront,
                recurring_pct: recurring,
                max_recurring_months: months,
            }

            const { error: updateError } = await supabase
                .from("products")
                .update({
                    name,
                    website_url: websiteUrl,
                    description: description || null,
                    category,
                    price_inr: priceInr ? parseInt(priceInr) * 100 : null,
                    billing_type: billingType,
                    commission_config: commissionConfig,
                    max_cac_limit: maxCac,
                    is_active: isActive,
                    cal_link: calLink || null,
                    meeting_commission_flat: meetingCommissionFlat
                        ? Math.round(parseFloat(meetingCommissionFlat) * 100)
                        : null,
                } as never)
                .eq("id", productId)

            if (updateError) throw updateError

            setSuccess(true)
            toast.success("Product updated successfully!")
            setTimeout(() => {
                router.push("/dashboard/founder")
            }, 1500)

        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to update product")
        } finally {
            setIsSaving(false)
        }
    }

    const rotateSecret = async () => {
        if (!confirm("Are you sure you want to rotate the webhook secret? Your current integrations will break until you update them.")) return
        
        setIsRotating(true)
        try {
            const response = await fetch(`/api/products/${productId}/rotate-secret`, {
                method: "POST",
            })
            const data = await response.json()
            if (!response.ok) throw new Error(data.error || "Failed to rotate")
            
            toast.success("Secret rotated! New secret: " + data.webhook_secret, { duration: 10000 })
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Failed to rotate")
        } finally {
            setIsRotating(false)
        }
    }

    const saveShopifySecret = async () => {
        if (!shopifySecret.trim()) {
            toast.error("Enter the Shopify webhook secret first")
            return
        }
        setIsSavingShopify(true)
        try {
            const response = await fetch(`/api/products/${productId}/shopify-secret`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ secret: shopifySecret.trim() }),
            })
            const data = await response.json()
            if (!response.ok) throw new Error(data.error || "Failed to save Shopify secret")
            toast.success("Shopify webhook secret saved!")
            setShopifySecret("")
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Failed to save Shopify secret")
        } finally {
            setIsSavingShopify(false)
        }
    }

    const saveWebhookSecret = async () => {
        if (!webhookSecret.trim()) {
            toast.error("Enter the webhook secret first")
            return
        }
        setIsSavingWebhookSecret(true)
        try {
            const response = await fetch(`/api/products/${productId}/webhook-secret`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ secret: webhookSecret.trim() }),
            })
            const data = await response.json()
            if (!response.ok) throw new Error(data.error || "Failed to save webhook secret")
            toast.success("Webhook secret updated!")
            setWebhookSecret("")
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Failed to save webhook secret")
        } finally {
            setIsSavingWebhookSecret(false)
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
        <div className="min-h-screen bg-background flex flex-col items-center py-12 px-6">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full max-w-2xl space-y-6"
            >
                <Link href="/dashboard/founder" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-4">
                    <ArrowLeft className="w-4 h-4" />
                    Back to Dashboard
                </Link>

                <div className="flex justify-between items-center">
                    <div>
                        <h1 className="text-3xl font-light tracking-tight mb-2">Edit Product</h1>
                        <p className="text-muted-foreground font-light">Update your product details</p>
                    </div>
                    <Button onClick={rotateSecret} variant="outline" disabled={isRotating}>
                        {isRotating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <KeyRound className="w-4 h-4 mr-2" />}
                        Rotate Secret
                    </Button>
                </div>

                {autoPaused && (
                    <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-center gap-3">
                        <AlertCircle className="w-5 h-5" />
                        <p><strong>Auto-paused:</strong> wallet fell below ₹500 — top up and products auto-resume.</p>
                    </div>
                )}

                {error && (
                    <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                        {error}
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
                                <Label htmlFor="description">Description *</Label>
                                <textarea
                                    id="description"
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    placeholder="Detailed description of your product"
                                    className="w-full h-32 px-3 py-2 bg-input/30 border border-border/50 rounded-lg text-sm font-light focus:border-foreground/30 focus:outline-none resize-none"
                                    required
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="category">Category</Label>
                                    <select
                                        id="category"
                                        value={category}
                                        onChange={(e) => setCategory(e.target.value)}
                                        className="w-full h-12 px-3 bg-input/30 border border-border/50 rounded-lg text-sm font-light focus:border-foreground/30 focus:outline-none"
                                    >
                                        {categories.map(c => (
                                            <option key={c.id} value={c.id} className="bg-background text-foreground">{c.label}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="billing_type">Billing Type</Label>
                                    <select
                                        id="billing_type"
                                        value={billingType}
                                        onChange={(e) => setBillingType(e.target.value as "one_time" | "subscription")}
                                        className="w-full h-12 px-3 bg-input/30 border border-border/50 rounded-lg text-sm font-light focus:border-foreground/30 focus:outline-none"
                                    >
                                        <option value="one_time" className="bg-background text-foreground">One-time</option>
                                        <option value="subscription" className="bg-background text-foreground">Subscription</option>
                                    </select>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="price_inr">Price (₹)</Label>
                                <Input
                                    id="price_inr"
                                    type="number"
                                    value={priceInr}
                                    onChange={(e) => setPriceInr(e.target.value)}
                                    placeholder="e.g. 4999"
                                    className="h-12 bg-input/30"
                                />
                            </div>

                            <div className="flex items-center gap-3 py-2">
                                <button
                                    type="button"
                                    onClick={() => setIsActive(!isActive)}
                                    disabled={autoPaused}
                                    className={`relative w-12 h-6 rounded-full transition-colors ${isActive ? "bg-green-500" : "bg-muted"} ${autoPaused ? "opacity-50 cursor-not-allowed" : ""}`}
                                >
                                    <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${isActive ? "left-7" : "left-1"}`} />
                                </button>
                                <span className="text-sm font-light">
                                    {isActive ? "Active - Visible to sellers" : "Paused - Hidden from sellers"}
                                </span>
                            </div>
                        </div>
                    </SpotlightCard>

                    <SpotlightCard className="p-6">
                        <h3 className="text-lg font-light mb-1">Commission Structure</h3>
                        <p className="text-xs text-yellow-500/80 mb-4">Warning: Any changes apply to FUTURE sales only.</p>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="upfront">Upfront Commission (%)</Label>
                                <Input
                                    id="upfront"
                                    type="number"
                                    value={upfrontPct}
                                    onChange={(e) => setUpfrontPct(e.target.value)}
                                    className="h-12 bg-input/30"
                                    min="1" max="100"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="recurring">Recurring Commission (%)</Label>
                                <Input
                                    id="recurring"
                                    type="number"
                                    value={recurringPct}
                                    onChange={(e) => setRecurringPct(e.target.value)}
                                    className="h-12 bg-input/30 disabled:opacity-50"
                                    min="0" max="100"
                                    disabled={billingType === "one_time"}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="months">Max Recurring Months</Label>
                                <Input
                                    id="months"
                                    type="number"
                                    value={maxRecurringMonths}
                                    onChange={(e) => setMaxRecurringMonths(e.target.value)}
                                    className="h-12 bg-input/30 disabled:opacity-50"
                                    min="1" max="36"
                                    disabled={billingType === "one_time"}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="cac">Max CAC (₹) - Optional</Label>
                                <Input
                                    id="cac"
                                    type="number"
                                    value={maxCacLimit}
                                    onChange={(e) => setMaxCacLimit(e.target.value)}
                                    className="h-12 bg-input/30"
                                    min="10" max="100000"
                                />
                            </div>
                        </div>
                    </SpotlightCard>

                    <SpotlightCard className="p-6">
                        <h3 className="text-lg font-light mb-1">Service / Per-Meeting (Cal.com)</h3>
                        <p className="text-xs text-muted-foreground mb-4">
                            Sell consulting or services. Sellers book meetings on your Cal.com link; you pay a flat commission per completed meeting (escrow releases 48h after the meeting).
                        </p>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2 col-span-2">
                                <Label htmlFor="cal_link">Cal.com Booking Link</Label>
                                <Input
                                    id="cal_link"
                                    type="url"
                                    value={calLink}
                                    onChange={(e) => setCalLink(e.target.value)}
                                    placeholder="https://cal.com/yourname/consultation"
                                    className="h-12 bg-input/30"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="meeting_flat">Flat Commission per Meeting (₹)</Label>
                                <Input
                                    id="meeting_flat"
                                    type="number"
                                    value={meetingCommissionFlat}
                                    onChange={(e) => setMeetingCommissionFlat(e.target.value)}
                                    className="h-12 bg-input/30"
                                    min="1"
                                />
                            </div>
                        </div>
                    </SpotlightCard>

                    <SpotlightCard className="p-6">
                        <h3 className="text-lg font-light mb-1">Provider Webhook Secret</h3>
                        <p className="text-xs text-muted-foreground mb-4">
                            For Razorpay / Shopflo / Lemon Squeezy: keep the secret shown at creation.<br/>
                            For Stripe: paste your endpoint signing secret (<code className="text-xs bg-muted/50 px-1 rounded">whsec_...</code>).<br/>
                            For Cashfree / PhonePe / PayU / Instamojo / CCAvenue: paste your API Secret, Salt Key, or Working Key here.
                        </p>
                        <div className="flex items-end gap-3">
                            <div className="space-y-2 flex-1">
                                <Label htmlFor="webhook_secret">Webhook Signing Secret</Label>
                                <Input
                                    id="webhook_secret"
                                    type="password"
                                    value={webhookSecret}
                                    onChange={(e) => setWebhookSecret(e.target.value)}
                                    placeholder="whsec_... or your secret"
                                    className="h-12 bg-input/30"
                                />
                            </div>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={saveWebhookSecret}
                                disabled={isSavingWebhookSecret}
                                className="h-12"
                            >
                                {isSavingWebhookSecret ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <KeyRound className="w-4 h-4 mr-2" />}
                                Save Secret
                            </Button>
                        </div>
                    </SpotlightCard>

                    <SpotlightCard className="p-6">
                        <h3 className="text-lg font-light mb-1">Shopify (Physical Products)</h3>
                        <p className="text-xs text-muted-foreground mb-4">
                            Paste your Shopify app's webhook secret here to enable physical-product tracking (14-day escrow).
                        </p>
                        <div className="flex items-end gap-3">
                            <div className="space-y-2 flex-1">
                                <Label htmlFor="shopify_secret">Shopify HMAC Secret</Label>
                                <Input
                                    id="shopify_secret"
                                    type="password"
                                    value={shopifySecret}
                                    onChange={(e) => setShopifySecret(e.target.value)}
                                    placeholder="shpss_... from your Shopify app"
                                    className="h-12 bg-input/30"
                                />
                            </div>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={saveShopifySecret}
                                disabled={isSavingShopify}
                                className="h-12"
                            >
                                {isSavingShopify ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <KeyRound className="w-4 h-4 mr-2" />}
                                Save Secret
                            </Button>
                        </div>
                    </SpotlightCard>

                    <Button
                        type="submit"
                        disabled={isSaving || !name || !websiteUrl || !description}
                        className="w-full h-12 bg-foreground text-background hover:bg-foreground/90"
                    >
                        {isSaving ? (
                            <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving...</>
                        ) : (
                            <><Save className="w-4 h-4 mr-2" /> Save Changes</>
                        )}
                    </Button>
                </form>
            </motion.div>
        </div>
    )
}
