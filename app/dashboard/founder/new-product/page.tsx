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
    const [tagline, setTagline] = useState("")
    const [category, setCategory] = useState("")
    const [pricing, setPricing] = useState("")
    const [logoFile, setLogoFile] = useState<File | null>(null)
    const [logoPreview, setLogoPreview] = useState<string | null>(null)
    const [targetAudience, setTargetAudience] = useState("")
    const [upfrontPct, setUpfrontPct] = useState("30")
    const [recurringPct, setRecurringPct] = useState("15")
    const [maxRecurringMonths, setMaxRecurringMonths] = useState("12")
    const [maxCacLimit, setMaxCacLimit] = useState("")

    const categories = [
        { id: "ai_saas", label: "AI SaaS" },
        { id: "b2b", label: "B2B" },
        { id: "devtools", label: "DevTools" },
        { id: "marketing", label: "Marketing" },
        { id: "creator_tools", label: "Creator Tools" },
    ]

    const [providedWebhookSecret, setProvidedWebhookSecret] = useState("")

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
            const supabase = createClient()
            setWebhookSecret(providedWebhookSecret)

            const commissionConfig = {
                type: "hybrid" as const,
                upfront_pct: parseInt(upfrontPct) || 30,
                recurring_pct: parseInt(recurringPct) || 0,
                max_recurring_months: parseInt(maxRecurringMonths) || 12,
            }

            // Build extended description with all details
            const extendedDesc = [
                description,
                tagline ? `Tagline: ${tagline}` : null,
                category ? `Category: ${category}` : null,
                pricing ? `Pricing: ${pricing}` : null,
                targetAudience ? `Target Audience: ${targetAudience}` : null,
            ].filter(Boolean).join('\n\n')

            const { data, error: insertError } = await supabase.from("products").insert({
                founder_id: user.id,
                name,
                website_url: websiteUrl,
                description: extendedDesc || null,
                commission_config: commissionConfig,
                max_cac_limit: maxCacLimit ? parseInt(maxCacLimit) * 100 : null,
                webhook_secret: providedWebhookSecret,
                settlement_mode: "webhook",
                is_active: true,
            } as any).select("id").single()

            if (insertError) {
                throw insertError
            }

            const productId = data?.id

            // Upload logo if selected
            if (logoFile && logoPreview) {
                try {
                    const base64Data = logoPreview.split(',')[1] // remove 'data:image/...;base64,'
                    await fetch('/api/products/upload-logo', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            product_id: productId,
                            image_data: base64Data,
                            file_name: logoFile.name,
                            content_type: logoFile.type
                        })
                    })
                } catch (logoErr) {
                    console.error("Logo upload failed", logoErr)
                    toast.error("Product created, but logo upload failed.")
                }
            }

            setCreatedProductId(productId || null)
            toast.success("Product created! Now set up your webhook.")
            setStep(2)
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to create product")
            toast.error("Failed to create product")
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
                            <Label htmlFor="tagline">Tagline</Label>
                            <Input
                                id="tagline"
                                value={tagline}
                                onChange={(e) => setTagline(e.target.value)}
                                placeholder="e.g. The smarter way to prepare for NEET"
                                className="h-12 bg-input/30"
                            />
                            <p className="text-xs text-muted-foreground">A catchy one-liner for sellers</p>
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
                                    <option value="">Select category</option>
                                    {categories.map((cat) => (
                                        <option key={cat.id} value={cat.id}>{cat.label}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="pricing">Pricing Info</Label>
                                <Input
                                    id="pricing"
                                    value={pricing}
                                    onChange={(e) => setPricing(e.target.value)}
                                    placeholder="e.g. ₹999/month or ₹4999 one-time"
                                    className="h-12 bg-input/30"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="webhook_secret">Webhook Signing Secret *</Label>
                            <Input
                                id="webhook_secret"
                                type="password"
                                value={providedWebhookSecret}
                                onChange={(e) => setProvidedWebhookSecret(e.target.value)}
                                placeholder="Paste your Stripe/Razorpay webhook secret here"
                                className="h-12 bg-input/30"
                            />
                            <p className="text-xs text-muted-foreground">Used to verify that payloads come from your server</p>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="audience">Target Audience</Label>
                            <Input
                                id="audience"
                                value={targetAudience}
                                onChange={(e) => setTargetAudience(e.target.value)}
                                placeholder="e.g. NEET aspirants, Class 11-12 students, Medical entrance candidates"
                                className="h-12 bg-input/30"
                            />
                            <p className="text-xs text-muted-foreground">Who should sellers target?</p>
                        </div>

                        <div className="border-t border-border/30 pt-6">
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
                                    <p className="text-xs text-muted-foreground">First-time customer commission</p>
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
                                    <p className="text-xs text-muted-foreground">Repeat purchase commission</p>
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
                                    <Label htmlFor="cac">Max CAC (₹) - Optional</Label>
                                    <Input
                                        id="cac"
                                        type="number"
                                        value={maxCacLimit}
                                        onChange={(e) => setMaxCacLimit(e.target.value)}
                                        placeholder="e.g. 500"
                                        className="h-12 bg-input/30"
                                    />
                                    <p className="text-xs text-muted-foreground">Cap commission per sale</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="mt-8 flex justify-end">
                        <Button
                            disabled={!name || !websiteUrl || !providedWebhookSecret || isSubmitting}
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
                                    <li>Select events: <code className="text-xs bg-muted/50 px-1 rounded">subscription.charged</code> and <code className="text-xs bg-muted/50 px-1 rounded">payment.captured</code></li>
                                    <li>Add the secret key if prompted</li>
                                    <li>Save and activate</li>
                                </ol>
                            )}
                            {selectedProvider === "stripe" && (
                                <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
                                    <li>Go to Stripe Dashboard → Developers → Webhooks</li>
                                    <li>Click "Add endpoint"</li>
                                    <li>Paste the Webhook URL above</li>
                                    <li>Select events: <code className="text-xs bg-muted/50 px-1 rounded">invoice.paid</code> and <code className="text-xs bg-muted/50 px-1 rounded">checkout.session.completed</code></li>
                                    <li>Copy the signing secret and save it</li>
                                </ol>
                            )}
                            {selectedProvider === "lemonsqueezy" && (
                                <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
                                    <li>Go to Lemon Squeezy Dashboard → Settings → Webhooks</li>
                                    <li>Click "Add webhook"</li>
                                    <li>Paste the Webhook URL above</li>
                                    <li>Add the signing secret from above</li>
                                    <li>Select events: <code className="text-xs bg-muted/50 px-1 rounded">order_created</code></li>
                                </ol>
                            )}
                            {selectedProvider === "gumroad" && (
                                <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
                                    <li>Go to Gumroad Settings → Advanced</li>
                                    <li>Find "Ping" section</li>
                                    <li>Paste the Webhook URL above</li>
                                    <li>Gumroad will ping on every sale</li>
                                </ol>
                            )}
                            {selectedProvider === "paypal" && (
                                <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
                                    <li>Go to PayPal Developer Dashboard</li>
                                    <li>Navigate to My Apps → Webhooks</li>
                                    <li>Create a webhook with the URL above</li>
                                    <li>Select events: <code className="text-xs bg-muted/50 px-1 rounded">PAYMENT.SALE.COMPLETED</code></li>
                                </ol>
                            )}
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
