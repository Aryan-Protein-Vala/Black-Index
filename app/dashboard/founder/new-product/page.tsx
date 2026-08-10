"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { motion } from "framer-motion"
import { ArrowLeft, ArrowRight, Loader2, Shield, Copy, Check, CreditCard, ExternalLink } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { SpotlightCard } from "@/components/ui/spotlight-card"
import Link from "next/link"
import { useAuth } from "@/components/auth-provider"
import { createClient } from "@/lib/supabase"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

type PaymentProvider = "razorpay" | "stripe" | "lemonsqueezy" | "gumroad" | "paypal"

const paymentProviders = [
    { id: "razorpay" as const, name: "Razorpay", description: "Most popular in India", color: "blue" },
    { id: "stripe" as const, name: "Stripe", description: "Global payments", color: "purple" },
    { id: "lemonsqueezy" as const, name: "Lemon Squeezy", description: "Digital products & SaaS", color: "yellow" },
    { id: "gumroad" as const, name: "Gumroad", description: "Creators & digital goods", color: "pink" },
    { id: "paypal" as const, name: "PayPal", description: "International payments", color: "blue" },
]

export default function NewProductPage() {
    const router = useRouter()
    const { user } = useAuth()

    const [step, setStep] = useState<1 | 2>(1)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [createdProductId, setCreatedProductId] = useState<string | null>(null)
    const [webhookSecret, setWebhookSecret] = useState<string | null>(null)
    const [copied, setCopied] = useState<"secret" | "url" | null>(null)
    const [selectedProvider, setSelectedProvider] = useState<PaymentProvider | null>(null)

    // Form fields
    const [name, setName] = useState("")
    const [websiteUrl, setWebsiteUrl] = useState("")
    const [description, setDescription] = useState("")
        const [category, setCategory] = useState("b2b")
    const [priceInr, setPriceInr] = useState("")
    const [billingType, setBillingType] = useState<"one_time" | "subscription">("subscription")
        const [logoFile, setLogoFile] = useState<File | null>(null)
    const [logoPreview, setLogoPreview] = useState<string | null>(null)
        const [upfrontPct, setUpfrontPct] = useState("30")
    const [recurringPct, setRecurringPct] = useState("0")
    const [maxRecurringMonths, setMaxRecurringMonths] = useState("12")
    const [maxCacLimit, setMaxCacLimit] = useState("")
    // Service (Cal.com) vertical
    const [calLink, setCalLink] = useState("")
    const [meetingCommissionFlat, setMeetingCommissionFlat] = useState("")

    const categories = [
        { id: "ai_saas", label: "AI SaaS" },
        { id: "b2b", label: "B2B" },
        { id: "devtools", label: "DevTools" },
        { id: "marketing", label: "Marketing" },
        { id: "creator_tools", label: "Creator Tools" },
        { id: "other", label: "Other" },
    ]

    
    const handleCopy = async (text: string, type: "secret" | "url") => {
        await navigator.clipboard.writeText(text)
        setCopied(type)
        toast.success("Copied to clipboard!")
        setTimeout(() => setCopied(null), 2000)
    }

    const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return
        if (file.size > 2 * 1024 * 1024) {
            toast.error("Logo must be less than 2MB")
            return
        }
        setLogoFile(file)
        const reader = new FileReader()
        reader.onloadend = () => {
            setLogoPreview(reader.result as string)
        }
        reader.readAsDataURL(file)
    }

        const handleSubmit = async () => {
        if (!user) return

        setIsSubmitting(true)
        setError(null)

        try {
            let logoUrl = null
            if (logoFile) {
                const supabase = createClient()
                const fileExt = logoFile.name.split(".").pop()
                const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`
                const { error: uploadError } = await supabase.storage
                    .from("product-logos")
                    .upload(`${user.id}/${fileName}`, logoFile)

                if (uploadError) {
                    throw new Error("Failed to upload logo")
                }
                const { data: { publicUrl } } = supabase.storage
                    .from("product-logos")
                    .getPublicUrl(`${user.id}/${fileName}`)
                logoUrl = publicUrl
            }

            const response = await fetch("/api/products", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name,
                    description,
                    website_url: websiteUrl,
                    logo_url: logoUrl,
                    category,
                    price_inr: priceInr ? parseInt(priceInr) * 100 : null,
                    billing_type: billingType,
                    commission_config: {
                        upfront_pct: parseInt(upfrontPct),
                        recurring_pct: billingType === "subscription" ? parseInt(recurringPct) : 0,
                        max_recurring_months: billingType === "subscription" ? parseInt(maxRecurringMonths) : 1,
                    },
                    max_cac_limit: maxCacLimit ? parseInt(maxCacLimit) * 100 : null,
                    meeting_commission_flat: meetingCommissionFlat
                        ? Math.round(parseFloat(meetingCommissionFlat) * 100)
                        : null,
                    cal_link: calLink || null,
                })
            })

            const data = await response.json()
            if (!response.ok) throw new Error(data.error || "Failed to create product")

            setWebhookSecret(data.webhook_secret)
            setCreatedProductId(data.product.id)
            setStep(2)
        } catch (err) {
            console.error("Creation error:", err)
            setError(err instanceof Error ? err.message : "Something went wrong")
        } finally {
            setIsSubmitting(false)
        }
    }

    const getWebhookUrl = () => {
        if (!selectedProvider || !createdProductId) return ""
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://blackindex.in"
        return `${baseUrl}/api/webhooks/${selectedProvider}/${createdProductId}`
    }

    // Step 1: Product Details Form
    if (step === 1) {
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

                    <h1 className="text-3xl font-light tracking-tight mb-2">Product Details</h1>
                    <p className="text-muted-foreground font-light mb-8">
                        Tell us about your product
                    </p>

                    {error && (
                        <div className="mb-6 p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                            {error}
                        </div>
                    )}

                    <div className="space-y-6">
                        <div className="space-y-2">
                            <Label htmlFor="name">Product Name *</Label>
                            <Input
                                id="name"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="e.g. NEETGenius"
                                className="h-12 bg-input/30"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="logo">Product Logo</Label>
                            <div className="flex items-center gap-4">
                                {logoPreview && (
                                    <img src={logoPreview} alt="Logo Preview" className="w-12 h-12 rounded-lg object-cover border border-border/50" />
                                )}
                                <Input
                                    id="logo"
                                    type="file"
                                    accept="image/*"
                                    onChange={handleLogoChange}
                                    className="h-12 bg-input/30 cursor-pointer text-sm"
                                />
                            </div>
                            <p className="text-xs text-muted-foreground">Max size 2MB. Square image recommended.</p>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="website">Website URL *</Label>
                            <Input
                                id="website"
                                value={websiteUrl}
                                onChange={(e) => setWebsiteUrl(e.target.value)}
                                placeholder="https://yourproduct.com"
                                className="h-12 bg-input/30"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="description">Description *</Label>
                            <textarea
                                id="description"
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="Detailed description of your product. What does it do? Who is it for? What problem does it solve?"
                                className="w-full h-24 px-3 py-2 bg-input/30 border border-border/50 rounded-lg text-sm font-light focus:border-foreground/30 focus:outline-none resize-none"
                            />
                        </div>

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

                        <div className="grid grid-cols-2 gap-4">
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

                        <div className="space-y-4 pt-4 border-t border-border/50">
                            <h3 className="font-medium">Commission Structure</h3>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="upfront">Upfront Commission (%)</Label>
                                    <Input
                                        id="upfront"
                                        type="number"
                                        min="1"
                                        max="100"
                                        value={upfrontPct}
                                        onChange={(e) => setUpfrontPct(e.target.value)}
                                        className="h-12 bg-input/30"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="recurring">Recurring Commission (%)</Label>
                                    <Input
                                        id="recurring"
                                        type="number"
                                        min="0"
                                        max="100"
                                        value={recurringPct}
                                        onChange={(e) => setRecurringPct(e.target.value)}
                                        disabled={billingType === "one_time"}
                                        className="h-12 bg-input/30 disabled:opacity-50"
                                    />
                                </div>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="months">Max Recurring Months</Label>
                                    <Input
                                        id="months"
                                        type="number"
                                        min="1"
                                        max="36"
                                        value={maxRecurringMonths}
                                        onChange={(e) => setMaxRecurringMonths(e.target.value)}
                                        disabled={billingType === "one_time"}
                                        className="h-12 bg-input/30 disabled:opacity-50"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="cac">Max CAC Limit (₹) - Optional</Label>
                                    <Input
                                        id="cac"
                                        type="number"
                                        min="10"
                                        max="100000"
                                        value={maxCacLimit}
                                        onChange={(e) => setMaxCacLimit(e.target.value)}
                                        placeholder="No cap"
                                        className="h-12 bg-input/30"
                                    />
                                </div>
                            </div>
                            
                            {/* Calculator */}
                            <div className="mt-4 p-4 rounded-lg bg-foreground/[0.02] border border-border/50 text-sm">
                                <p className="text-muted-foreground mb-2">Commission Calculator:</p>
                                <p className="font-medium text-foreground">
                                    Seller earns ₹{priceInr ? (parseInt(priceInr) * parseInt(upfrontPct || "0") / 100).toFixed(2) : "X"} upfront 
                                    {billingType === "subscription" && parseInt(recurringPct) > 0 ? ` (+ ₹${priceInr ? (parseInt(priceInr) * parseInt(recurringPct || "0") / 100).toFixed(2) : "Y"}/mo × ${maxRecurringMonths || "Z"} months)` : ""}
                                    <br/>
                                    <span className="text-muted-foreground text-xs mt-1 block">
                                        · you pay that + 5% of it as fee · capped at ₹{maxCacLimit || "CAC"}
                                    </span>
                                </p>
                            </div>
                        </div>

                        {/* Service / per-meeting (Cal.com) — optional */}
                        <div className="space-y-4 pt-4 border-t border-border/50">
                            <h3 className="font-medium">Service / Per-Meeting (Cal.com) — Optional</h3>
                            <p className="text-xs text-muted-foreground">
                                Sell consulting, demos or services. Sellers book meetings on your Cal.com link and you pay a flat commission per completed meeting. Leave empty if this is a pure SaaS product.
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
                                <div className="space-y-2 col-span-2 sm:col-span-1">
                                    <Label htmlFor="meeting_flat">Flat Commission per Meeting (₹)</Label>
                                    <Input
                                        id="meeting_flat"
                                        type="number"
                                        min="1"
                                        value={meetingCommissionFlat}
                                        onChange={(e) => setMeetingCommissionFlat(e.target.value)}
                                        placeholder="e.g. 500"
                                        className="h-12 bg-input/30"
                                    />
                                </div>
                            </div>
                            {calLink && meetingCommissionFlat && (
                                <p className="text-xs text-muted-foreground">
                                    Warlords earn <strong>₹{meetingCommissionFlat}</strong> per completed meeting (you pay that + 5% of it as fee).
                                </p>
                            )}
                        </div>
                    </div>
                    
<div className="mt-8 flex justify-end">
                        <Button
                            disabled={!name || !websiteUrl || isSubmitting}
                            onClick={handleSubmit}
                            className="bg-foreground text-background hover:bg-foreground/90"
                        >
                            {isSubmitting ? (
                                <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    Creating...
                                </>
                            ) : (
                                <>
                                    Create Product
                                    <ArrowRight className="w-4 h-4 ml-2" />
                                </>
                            )}
                        </Button>
                    </div>
                </motion.div>
            </div>
        )
    }

    // Step 2: Payment Provider Setup
    return (
        <div className="min-h-screen bg-background flex items-center justify-center p-6">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full max-w-2xl"
            >
                <div className="mb-8">
                    <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mb-4">
                        <Shield className="w-8 h-8 text-green-500" />
                    </div>
                    <h1 className="text-3xl font-light tracking-tight mb-2">Product Created!</h1>
                    <p className="text-muted-foreground font-light">
                        Now connect your payment provider to start tracking sales
                    </p>
                </div>

                {/* Payment Provider Selection */}
                <div className="mb-6">
                    <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-4">
                        Select Your Payment Provider
                    </h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {paymentProviders.map((provider) => (
                            <button
                                key={provider.id}
                                onClick={() => setSelectedProvider(provider.id)}
                                className={cn(
                                    "p-4 rounded-xl border text-left transition-all",
                                    selectedProvider === provider.id
                                        ? "border-foreground/50 bg-foreground/5"
                                        : "border-border/50 hover:border-border"
                                )}
                            >
                                <p className="font-light text-sm">{provider.name}</p>
                                <p className="text-xs text-muted-foreground">{provider.description}</p>
                            </button>
                        ))}
                    </div>
                </div>

                {selectedProvider && (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="space-y-4"
                    >
                        {/* Webhook URL */}
                        <SpotlightCard className="p-5">
                            <h3 className="font-medium mb-2 flex items-center gap-2">
                                <CreditCard className="w-4 h-4" />
                                Webhook URL
                            </h3>
                            <p className="text-sm text-muted-foreground mb-3">
                                Add this URL to your {paymentProviders.find(p => p.id === selectedProvider)?.name} webhook settings
                            </p>
                            <div className="flex items-center gap-2 p-3 bg-muted/20 rounded-lg">
                                <code className="flex-1 text-xs font-mono break-all">{getWebhookUrl()}</code>
                                <Button size="sm" variant="ghost" onClick={() => handleCopy(getWebhookUrl(), "url")}>
                                    {copied === "url" ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                                </Button>
                            </div>
                        </SpotlightCard>

                        {/* Webhook Secret */}
                        <SpotlightCard className="p-5">
                            <h3 className="font-medium mb-2">Webhook Secret</h3>
                            <p className="text-sm text-muted-foreground mb-3">
                                You configured this secret during product creation. Use it in your provider dashboard.
                            </p>
                            <div className="flex items-center gap-2 p-3 bg-muted/20 rounded-lg">
                                <code className="flex-1 text-xs font-mono break-all">{webhookSecret}</code>
                                <Button size="sm" variant="ghost" onClick={() => handleCopy(webhookSecret || "", "secret")}>
                                    {copied === "secret" ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                                </Button>
                            </div>
                        </SpotlightCard>

                        {/* Provider-specific instructions */}
                        <SpotlightCard className="p-5">
                            <h3 className="font-medium mb-3">Setup Instructions</h3>
                            {selectedProvider === "razorpay" && (
                                <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
                                    <li>Go to Razorpay Dashboard → Settings → Webhooks</li>
                                    <li>Click "Add New Webhook"</li>
                                    <li>Paste the Webhook URL above</li>
                                    <li>Select ONLY: <code className="text-xs bg-muted/50 px-1 rounded">payment.captured</code></li>
                                    <li>Add the Webhook Secret from above</li>
                                    <li>Save and activate</li>
                                </ol>
                            )}
                            {selectedProvider === "stripe" && (
                                <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
                                    <li>Go to Stripe Dashboard → Developers → Webhooks</li>
                                    <li>Click "Add endpoint"</li>
                                    <li>Paste the Webhook URL above</li>
                                    <li>Select ONLY: <code className="text-xs bg-muted/50 px-1 rounded">invoice.paid</code> (subscriptions) and <code className="text-xs bg-muted/50 px-1 rounded">payment_intent.succeeded</code> (one-time)</li>
                                    <li><strong>WARNING:</strong> DO NOT enable <code className="text-xs bg-muted/50 px-1 rounded">checkout.session.completed</code> — it will double-count commissions.</li>
                                    <li>Stripe generates its own secret. In your Black Index product edit page, replace the system secret with Stripe’s secret.</li>
                                </ol>
                            )}
                            {selectedProvider === "lemonsqueezy" && (
                                <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
                                    <li>Go to Lemon Squeezy Dashboard → Settings → Webhooks</li>
                                    <li>Click "Add webhook"</li>
                                    <li>Paste the Webhook URL above</li>
                                    <li>Add the Webhook Secret from above</li>
                                    <li>Select events: <code className="text-xs bg-muted/50 px-1 rounded">order_created</code>, <code className="text-xs bg-muted/50 px-1 rounded">subscription_payment_success</code>, and <code className="text-xs bg-muted/50 px-1 rounded">order_refunded</code></li>
                                </ol>
                            )}
                            {selectedProvider === "gumroad" && (
                                <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
                                    <li>Go to Gumroad Settings → Advanced</li>
                                    <li>Find "Ping" section</li>
                                    <li>Paste the Webhook URL above</li>
                                    <li>Gumroad will ping on every sale</li>
                                    <li>Seller tracking via URL param: add <code>?ref_id=...</code></li>
                                </ol>
                            )}
                            {selectedProvider === "paypal" && (
                                <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
                                    <li>Go to PayPal Developer Dashboard</li>
                                    <li>Navigate to My Apps → Webhooks</li>
                                    <li>Create a webhook with the URL above</li>
                                    <li>Select events: <code className="text-xs bg-muted/50 px-1 rounded">PAYMENT.SALE.COMPLETED</code> or <code className="text-xs bg-muted/50 px-1 rounded">PAYMENT.CAPTURE.COMPLETED</code></li>
                                </ol>
                            )}
                            <p className="mt-4 text-xs text-muted-foreground">
                                <strong>Note:</strong> Refunds are auto-clawed back. Events without a ref ID are stored as unattributed_sale and return 200.
                            </p>
                        </SpotlightCard>
                    </motion.div>
                )}

                <div className="mt-8 flex justify-between">
                    <Button variant="outline" onClick={() => setStep(1)}>
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        Back
                    </Button>
                    <Link href="/dashboard/founder">
                        <Button className="bg-foreground text-background hover:bg-foreground/90">
                            Done - Go to Dashboard
                            <ArrowRight className="w-4 h-4 ml-2" />
                        </Button>
                    </Link>
                </div>
            </motion.div>
        </div>
    )
}
