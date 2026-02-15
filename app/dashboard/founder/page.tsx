"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import {
    LayoutDashboard, Package, Users, Settings, LogOut, Plus,
    Loader2, AlertCircle, CheckCircle2, XCircle, ArrowUpRight,
    ExternalLink, Webhook, TrendingUp, CreditCard, Edit2, Trash2, Copy, Link2
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { Area, AreaChart, ResponsiveContainer, XAxis, YAxis, Tooltip } from "recharts"
import { Logo } from "@/components/logo"
import { SpotlightCard } from "@/components/ui/spotlight-card"
import Link from "next/link"
import { useAuth } from "@/components/auth-provider"
import { createClient } from "@/lib/supabase"
import { formatCurrency } from "@/hooks/use-dashboard-data"
import type { Product, Transaction } from "@/lib/database.types"
import { SetupBilling } from "@/components/founder/setup-billing"
import { toast } from "sonner"

const sidebarItems = [
    { id: "overview", label: "Overview", icon: LayoutDashboard },
    { id: "products", label: "My Products", icon: Package },
    { id: "activity", label: "Sales Activity", icon: TrendingUp },
    { id: "billing", label: "Billing", icon: CreditCard },
    { id: "settings", label: "Settings", icon: Settings },
]

// ============================================
// OVERVIEW TAB
// ============================================
function OverviewTab({ products, transactions, isLoading }: {
    products: Product[]
    transactions: Transaction[]
    isLoading: boolean
}) {
    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
        )
    }

    const totalSales = transactions.filter(t => t.type === "sale").length
    const totalCommissionPaid = transactions
        .filter(t => t.type === "sale")
        .reduce((sum, t) => sum + (t.commission_amount || 0), 0)
    const totalRevenue = transactions
        .filter(t => t.type === "sale")
        .reduce((sum, t) => sum + (t.sale_amount || 0), 0)
    const activeProducts = products.filter(p => p.is_active).length

    // Chart data from recent transactions
    const chartData = [
        { day: "Mon", sales: 0 },
        { day: "Tue", sales: 0 },
        { day: "Wed", sales: 0 },
        { day: "Thu", sales: 0 },
        { day: "Fri", sales: 0 },
        { day: "Sat", sales: 0 },
        { day: "Sun", sales: totalSales },
    ]

    return (
        <div className="space-y-6">
            {/* Stats Row */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.1 }}
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
            >
                <SpotlightCard className="p-6">
                    <p className="text-xs font-light text-muted-foreground uppercase tracking-[0.2em] mb-2">
                        Active Products
                    </p>
                    <div className="flex items-baseline gap-2">
                        <span className="text-2xl font-light tracking-tight">{activeProducts}</span>
                    </div>
                </SpotlightCard>

                <SpotlightCard className="p-6">
                    <p className="text-xs font-light text-muted-foreground uppercase tracking-[0.2em] mb-2">
                        Total Sales
                    </p>
                    <div className="flex items-baseline gap-2">
                        <span className="text-2xl font-light tracking-tight">{totalSales}</span>
                    </div>
                </SpotlightCard>

                <SpotlightCard className="p-6">
                    <p className="text-xs font-light text-muted-foreground uppercase tracking-[0.2em] mb-2">
                        Total Revenue
                    </p>
                    <div className="flex items-baseline gap-2">
                        <span className="text-2xl font-light tracking-tight">{formatCurrency(totalRevenue)}</span>
                    </div>
                </SpotlightCard>

                <SpotlightCard className="p-6">
                    <p className="text-xs font-light text-muted-foreground uppercase tracking-[0.2em] mb-2">
                        Commission Paid
                    </p>
                    <div className="flex items-baseline gap-2">
                        <span className="text-2xl font-light tracking-tight">{formatCurrency(totalCommissionPaid)}</span>
                    </div>
                </SpotlightCard>
            </motion.div>

            {/* Chart */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.2 }}
            >
                <SpotlightCard className="p-6">
                    <h3 className="text-xs font-light text-muted-foreground uppercase tracking-[0.2em] mb-6">
                        Sales Overview
                    </h3>
                    <div className="h-48 sm:h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={chartData}>
                                <defs>
                                    <linearGradient id="salesGradient" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="#a855f7" stopOpacity={0.3} />
                                        <stop offset="100%" stopColor="#a855f7" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "#666" }} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "#666" }} width={30} />
                                <Tooltip
                                    contentStyle={{
                                        background: "rgba(10,10,10,0.95)",
                                        border: "1px solid rgba(255,255,255,0.1)",
                                        borderRadius: "8px",
                                        fontSize: "12px",
                                        fontWeight: 300,
                                    }}
                                    formatter={(value: number) => [value, "Sales"]}
                                />
                                <Area
                                    type="monotone"
                                    dataKey="sales"
                                    stroke="#a855f7"
                                    strokeWidth={2}
                                    fill="url(#salesGradient)"
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </SpotlightCard>
            </motion.div>

            {/* No Products CTA */}
            {products.length === 0 && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                >
                    <SpotlightCard className="p-6">
                        <div className="flex items-start gap-4">
                            <div className="w-12 h-12 rounded-full bg-purple-500/10 flex items-center justify-center">
                                <Package className="w-6 h-6 text-purple-400" />
                            </div>
                            <div className="flex-1">
                                <h3 className="font-medium mb-1">Add Your First Product</h3>
                                <p className="text-sm text-muted-foreground mb-4">
                                    List your product on Black Index and let Warlords drive sales for you.
                                </p>
                                <Link href="/dashboard/founder/new-product">
                                    <Button className="bg-purple-600 hover:bg-purple-700 text-white">
                                        <Plus className="w-4 h-4 mr-2" />
                                        Add Product
                                    </Button>
                                </Link>
                            </div>
                        </div>
                    </SpotlightCard>
                </motion.div>
            )}
        </div>
    )
}

// ============================================
// PRODUCTS TAB
// ============================================
function ProductsTab({ products, isLoading, onRefresh }: { products: Product[]; isLoading: boolean; onRefresh: () => void }) {
    const [deletingId, setDeletingId] = useState<string | null>(null)
    const [confirmDelete, setConfirmDelete] = useState<Product | null>(null)
    const [togglingId, setTogglingId] = useState<string | null>(null)
    const [featuringId, setFeaturingId] = useState<string | null>(null)
    const [webhookProduct, setWebhookProduct] = useState<Product | null>(null)
    const [copiedUrl, setCopiedUrl] = useState<string | null>(null)
    const [testingWebhook, setTestingWebhook] = useState(false)
    const [webhookTestResult, setWebhookTestResult] = useState<{ success: boolean; message: string } | null>(null)

    const handleCopyUrl = (url: string, provider: string) => {
        navigator.clipboard.writeText(url)
        setCopiedUrl(provider)
        setTimeout(() => setCopiedUrl(null), 2000)
    }

    const handleTestWebhook = async (productId: string) => {
        setTestingWebhook(true)
        setWebhookTestResult(null)
        try {
            const response = await fetch(`/api/webhooks/test/${productId}`, { method: 'POST' })
            const data = await response.json()
            setWebhookTestResult({
                success: data.success,
                message: data.success ? 'Integration looks good!' : (data.message || 'Check your setup')
            })
        } catch {
            setWebhookTestResult({ success: false, message: 'Test failed - try again' })
        }
        setTestingWebhook(false)
    }

    const handleToggleActive = async (product: Product) => {
        setTogglingId(product.id)
        try {
            const supabase = createClient()
            const { error } = await supabase
                .from('products')
                .update({ is_active: !product.is_active } as never)
                .eq('id', product.id)

            if (error) throw error
            onRefresh()
        } catch (err) {
            console.error('Failed to toggle product:', err)
        }
        setTogglingId(null)
    }

    const handleMakeFeatured = async (product: Product) => {
        setFeaturingId(product.id)
        try {
            // Fetch Razorpay config
            const configRes = await fetch("/api/config/razorpay")
            const configData = await configRes.json()
            if (!configRes.ok || !configData.keyId) {
                throw new Error("Payment system unavailable")
            }

            // Create order for featured product
            const orderRes = await fetch("/api/products/feature", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ product_id: product.id }),
            })
            const orderData = await orderRes.json()
            if (!orderRes.ok) {
                throw new Error(orderData.error || "Failed to create order")
            }

            // Open Razorpay checkout
            const options = {
                key: configData.keyId,
                amount: orderData.amount,
                currency: "INR",
                name: "Black Index",
                description: `Featured Listing: ${orderData.product_name}`,
                order_id: orderData.orderId,
                handler: async (response: any) => {
                    // Verify payment
                    const verifyRes = await fetch("/api/products/feature/verify", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            razorpay_order_id: response.razorpay_order_id,
                            razorpay_payment_id: response.razorpay_payment_id,
                            razorpay_signature: response.razorpay_signature,
                            product_id: product.id,
                        }),
                    })
                    const verifyData = await verifyRes.json()
                    if (verifyRes.ok && verifyData.success) {
                        onRefresh()
                        toast.success("🌟 Your product is now featured!")
                    } else {
                        toast.error("Payment verification failed. Please contact support.")
                    }
                },
                theme: { color: "#a855f7" },
            }

            const rzp = new (window as any).Razorpay(options)
            rzp.open()
        } catch (err) {
            console.error("Featured payment failed:", err)
            toast.error(err instanceof Error ? err.message : "Payment failed")
        }
        setFeaturingId(null)
    }

    const handleDelete = async (product: Product) => {
        setDeletingId(product.id)
        try {
            const supabase = createClient()
            // Soft delete - just mark as inactive and update name
            const { error } = await supabase
                .from('products')
                .update({
                    is_active: false,
                    name: `[DELETED] ${product.name}`
                } as never)
                .eq('id', product.id)

            if (error) throw error
            setConfirmDelete(null)
            onRefresh()
        } catch (err) {
            console.error('Failed to delete product:', err)
        }
        setDeletingId(null)
    }

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
        )
    }

    // Filter out deleted products
    const visibleProducts = products.filter(p => !p.name.startsWith('[DELETED]'))

    if (visibleProducts.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-20">
                <Package className="w-12 h-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-light mb-2">No Products Yet</h3>
                <p className="text-sm text-muted-foreground max-w-sm text-center mb-4">
                    Add your first product to the Black Index network and let Warlords drive sales for you.
                </p>
                <Link href="/dashboard/founder/new-product">
                    <Button className="bg-foreground text-background hover:bg-foreground/90">
                        <Plus className="w-4 h-4 mr-2" />
                        Add Product
                    </Button>
                </Link>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-lg font-light">Your Products</h2>
                <Link href="/dashboard/founder/new-product">
                    <Button size="sm" className="bg-foreground text-background hover:bg-foreground/90">
                        <Plus className="w-4 h-4 mr-1" />
                        Add Product
                    </Button>
                </Link>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {visibleProducts.map((product, i) => {
                    const config = product.commission_config as any
                    const commission = config?.upfront_pct ? `${config.upfront_pct}%` : "—"

                    return (
                        <motion.div
                            key={product.id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.1 }}
                        >
                            <SpotlightCard className="p-6 h-full">
                                <div className="flex items-start justify-between mb-4">
                                    <div className="flex items-center gap-3">
                                        {product.logo_url ? (
                                            <img src={product.logo_url} alt={product.name} className="w-10 h-10 rounded-lg object-cover" />
                                        ) : (
                                            <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                                                <Package className="w-5 h-5 text-purple-400" />
                                            </div>
                                        )}
                                        <div>
                                            <h4 className="text-base font-light tracking-tight">{product.name}</h4>
                                            <p className="text-xs text-muted-foreground font-light">{product.website_url}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => handleToggleActive(product)}
                                            disabled={togglingId === product.id}
                                            className={cn(
                                                "px-2 py-1 text-[10px] font-light uppercase tracking-wider rounded cursor-pointer transition-all",
                                                product.is_active
                                                    ? "bg-green-500/10 text-green-400 border border-green-500/20 hover:bg-green-500/20"
                                                    : "bg-foreground/5 text-muted-foreground border border-border/30 hover:bg-foreground/10"
                                            )}
                                        >
                                            {togglingId === product.id ? (
                                                <Loader2 className="w-3 h-3 animate-spin" />
                                            ) : (
                                                product.is_active ? "Active" : "Paused"
                                            )}
                                        </button>
                                    </div>
                                </div>

                                <div className="space-y-3 mb-4">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-muted-foreground font-light">Commission</span>
                                        <span className="font-light">{commission}</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-muted-foreground font-light">Status</span>
                                        <span className={cn(
                                            "flex items-center gap-1.5 text-xs",
                                            product.is_active ? "text-green-400" : "text-muted-foreground"
                                        )}>
                                            {product.is_active ? (
                                                <><CheckCircle2 className="w-3 h-3" />Active</>
                                            ) : (
                                                <><AlertCircle className="w-3 h-3" />Paused</>
                                            )}
                                        </span>
                                    </div>
                                </div>

                                {/* Action Buttons */}
                                <div className="flex flex-col gap-2">
                                    {/* Featured Badge or Button */}
                                    {(product as any).is_featured && (product as any).featured_until && new Date((product as any).featured_until) > new Date() ? (
                                        <div className="flex items-center justify-center gap-2 py-2 rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-xs text-yellow-400">
                                            ⭐ Featured until {new Date((product as any).featured_until).toLocaleDateString()}
                                        </div>
                                    ) : (
                                        <button
                                            onClick={() => handleMakeFeatured(product)}
                                            disabled={featuringId === product.id}
                                            className="w-full flex items-center justify-center gap-2 py-2 rounded-lg border border-yellow-500/20 bg-yellow-500/5 hover:bg-yellow-500/10 transition-all text-xs text-yellow-400"
                                        >
                                            {featuringId === product.id ? (
                                                <Loader2 className="w-3 h-3 animate-spin" />
                                            ) : (
                                                <>⭐ Make Featured — ₹4,999/mo</>
                                            )}
                                        </button>
                                    )}

                                    {/* Webhook URLs Button */}
                                    <button
                                        onClick={() => setWebhookProduct(product)}
                                        className="w-full flex items-center justify-center gap-2 py-2 rounded-lg border border-blue-500/20 bg-blue-500/5 hover:bg-blue-500/10 transition-all text-xs text-blue-400"
                                    >
                                        <Link2 className="w-3 h-3" />
                                        View Webhook URLs
                                    </button>

                                    <div className="flex gap-2">
                                        <Link href={`/dashboard/founder/edit-product/${product.id}`} className="flex-1">
                                            <button className="w-full flex items-center justify-center gap-2 py-2 rounded-lg border border-border/30 bg-foreground/5 hover:bg-foreground/10 transition-all text-xs text-muted-foreground">
                                                <Edit2 className="w-3 h-3" />
                                                Edit
                                            </button>
                                        </Link>
                                        <button
                                            onClick={() => setConfirmDelete(product)}
                                            className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-red-500/20 bg-red-500/5 hover:bg-red-500/10 transition-all text-xs text-red-400"
                                        >
                                            <Trash2 className="w-3 h-3" />
                                        </button>
                                    </div>
                                </div>
                            </SpotlightCard>
                        </motion.div>
                    )
                })}
            </div>

            {/* Delete Confirmation Modal */}
            <AnimatePresence>
                {confirmDelete && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[100] flex items-center justify-center p-4"
                        onClick={() => setConfirmDelete(null)}
                    >
                        <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="relative w-full max-w-sm"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <SpotlightCard className="p-6">
                                <div className="text-center mb-6">
                                    <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4">
                                        <Trash2 className="w-6 h-6 text-red-500" />
                                    </div>
                                    <h3 className="text-lg font-light mb-2">Delete Product?</h3>
                                    <p className="text-sm text-muted-foreground">
                                        This will remove <strong>{confirmDelete.name}</strong> from the Warlord network.
                                        Sellers will no longer be able to promote it.
                                    </p>
                                </div>
                                <div className="flex gap-3">
                                    <Button
                                        variant="outline"
                                        className="flex-1"
                                        onClick={() => setConfirmDelete(null)}
                                    >
                                        Cancel
                                    </Button>
                                    <Button
                                        onClick={() => handleDelete(confirmDelete)}
                                        disabled={deletingId === confirmDelete.id}
                                        className="flex-1 bg-red-500 hover:bg-red-600 text-white"
                                    >
                                        {deletingId === confirmDelete.id ? (
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                        ) : (
                                            "Delete"
                                        )}
                                    </Button>
                                </div>
                            </SpotlightCard>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Webhook URLs Modal */}
            <AnimatePresence>
                {webhookProduct && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[100] flex items-center justify-center p-4"
                        onClick={() => setWebhookProduct(null)}
                    >
                        <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="relative w-full max-w-lg max-h-[80vh] overflow-y-auto"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <SpotlightCard className="p-6">
                                <div className="text-center mb-6">
                                    <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center mx-auto mb-4">
                                        <Webhook className="w-6 h-6 text-blue-500" />
                                    </div>
                                    <h3 className="text-lg font-light mb-2">Webhook URLs</h3>
                                    <p className="text-sm text-muted-foreground">
                                        Copy the URL for your payment provider and paste it in their webhook settings.
                                    </p>
                                </div>

                                <div className="space-y-4">
                                    {[
                                        { name: 'Razorpay', key: 'razorpay', event: 'payment.captured', hint: 'Add ref_id in order notes' },
                                        { name: 'Stripe', key: 'stripe', event: 'checkout.session.completed', hint: 'Add ref_id in session metadata' },
                                        { name: 'Gumroad', key: 'gumroad', event: 'Ping URL', hint: 'Add ?ref_id=xxx to product links' },
                                        { name: 'Lemon Squeezy', key: 'lemonsqueezy', event: 'order_created', hint: 'Add ref_id in custom_data' },
                                        { name: 'PayPal', key: 'paypal', event: 'PAYMENT.CAPTURE.COMPLETED', hint: 'Add ref_id in custom_id' },
                                    ].map((provider) => {
                                        const url = `${process.env.NEXT_PUBLIC_APP_URL || 'https://blackindex.in'}/api/webhooks/${provider.key}/${webhookProduct.id}?secret=${(webhookProduct as any).webhook_secret || 'YOUR_SECRET'}`
                                        return (
                                            <div key={provider.key} className="p-3 rounded-lg border border-border/30 bg-foreground/5">
                                                <div className="flex items-center justify-between mb-2">
                                                    <span className="font-medium text-sm">{provider.name}</span>
                                                    <span className="text-xs text-muted-foreground">{provider.event}</span>
                                                </div>
                                                <div className="flex gap-2">
                                                    <input
                                                        type="text"
                                                        readOnly
                                                        value={url}
                                                        className="flex-1 px-3 py-2 text-xs bg-black/30 border border-border/20 rounded-lg font-mono truncate"
                                                    />
                                                    <button
                                                        onClick={() => handleCopyUrl(url, provider.key)}
                                                        className={cn(
                                                            "px-3 py-2 rounded-lg border transition-all text-xs",
                                                            copiedUrl === provider.key
                                                                ? "border-green-500/50 bg-green-500/10 text-green-400"
                                                                : "border-border/30 bg-foreground/5 hover:bg-foreground/10 text-muted-foreground"
                                                        )}
                                                    >
                                                        {copiedUrl === provider.key ? (
                                                            <CheckCircle2 className="w-4 h-4" />
                                                        ) : (
                                                            <Copy className="w-4 h-4" />
                                                        )}
                                                    </button>
                                                </div>
                                                <p className="text-xs text-muted-foreground mt-2">💡 {provider.hint}</p>
                                            </div>
                                        )
                                    })}
                                </div>

                                {/* Tracking Script Section */}
                                <div className="mt-6 pt-4 border-t border-border/30">
                                    <h4 className="text-sm font-medium mb-2">📦 Step 1: Add Tracking Script</h4>
                                    <p className="text-xs text-muted-foreground mb-3">
                                        Add this to your website to auto-capture ref_id and inject into payments:
                                    </p>
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            readOnly
                                            value={`<script src="https://blackindex.in/track.js"></script>`}
                                            className="flex-1 px-3 py-2 text-xs bg-black/30 border border-border/20 rounded-lg font-mono"
                                        />
                                        <button
                                            onClick={() => handleCopyUrl(`<script src="https://blackindex.in/track.js"></script>`, 'trackjs')}
                                            className={cn(
                                                "px-3 py-2 rounded-lg border transition-all text-xs",
                                                copiedUrl === 'trackjs'
                                                    ? "border-green-500/50 bg-green-500/10 text-green-400"
                                                    : "border-border/30 bg-foreground/5 hover:bg-foreground/10 text-muted-foreground"
                                            )}
                                        >
                                            {copiedUrl === 'trackjs' ? (
                                                <CheckCircle2 className="w-4 h-4" />
                                            ) : (
                                                <Copy className="w-4 h-4" />
                                            )}
                                        </button>
                                    </div>
                                    <p className="text-xs text-green-400 mt-2">
                                        ✓ Auto-captures ref_id from URL<br />
                                        ✓ Auto-injects into Stripe & Razorpay
                                    </p>
                                </div>

                                {/* Test Webhook Section */}
                                <div className="mt-6 pt-4 border-t border-border/30">
                                    <h4 className="text-sm font-medium mb-2">🧪 Step 2: Test Your Integration</h4>
                                    <Button
                                        onClick={() => handleTestWebhook(webhookProduct.id)}
                                        disabled={testingWebhook}
                                        className="w-full"
                                        variant="outline"
                                    >
                                        {testingWebhook ? (
                                            <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Testing...</>
                                        ) : (
                                            '🔍 Test Webhook Setup'
                                        )}
                                    </Button>
                                    {webhookTestResult && (
                                        <div className={cn(
                                            "mt-2 p-2 rounded-lg text-xs text-center",
                                            webhookTestResult.success
                                                ? "bg-green-500/10 text-green-400 border border-green-500/20"
                                                : "bg-red-500/10 text-red-400 border border-red-500/20"
                                        )}>
                                            {webhookTestResult.success ? '✅' : '❌'} {webhookTestResult.message}
                                        </div>
                                    )}
                                </div>

                                <div className="mt-6 pt-4 border-t border-border/30">
                                    <Button
                                        variant="outline"
                                        className="w-full"
                                        onClick={() => setWebhookProduct(null)}
                                    >
                                        Close
                                    </Button>
                                </div>
                            </SpotlightCard>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}


// ============================================
// ACTIVITY TAB
// ============================================
function ActivityTab({ transactions, isLoading }: { transactions: Transaction[]; isLoading: boolean }) {
    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
        )
    }

    const salesTransactions = transactions.filter(t => t.type === "sale")

    if (salesTransactions.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-20">
                <TrendingUp className="w-12 h-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-light mb-2">No Sales Yet</h3>
                <p className="text-sm text-muted-foreground max-w-sm text-center">
                    When Warlords generate sales through their referral links, you'll see them here.
                </p>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            <SpotlightCard className="p-6">
                <h3 className="text-xs font-light text-muted-foreground uppercase tracking-[0.2em] mb-6">
                    Recent Sales
                </h3>
                <div className="space-y-3">
                    {salesTransactions.slice(0, 20).map((tx, i) => (
                        <motion.div
                            key={tx.id}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.05 }}
                            className="flex items-center justify-between py-3 border-b border-border/30 last:border-0"
                        >
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-purple-500/10 flex items-center justify-center">
                                    <span className="text-xs font-light text-purple-400">₹</span>
                                </div>
                                <div>
                                    <p className="text-sm font-light">
                                        Sale #{tx.external_transaction_id?.slice(0, 8) || tx.id.slice(0, 8)}
                                    </p>
                                    <p className="text-xs text-muted-foreground font-light">
                                        {new Date(tx.created_at).toLocaleDateString()}
                                    </p>
                                </div>
                            </div>
                            <div className="text-right">
                                <p className="text-sm font-light">{formatCurrency(tx.sale_amount)}</p>
                                <p className="text-xs text-purple-400">
                                    -{formatCurrency(tx.commission_amount)} commission
                                </p>
                            </div>
                        </motion.div>
                    ))}
                </div>
            </SpotlightCard>
        </div>
    )
}

// ============================================
// SETTINGS TAB
// ============================================
function SettingsTab({ profile, signOut }: { profile: any; signOut: () => void }) {
    const [saved, setSaved] = useState(false)

    const handleSave = () => {
        setSaved(true)
        setTimeout(() => setSaved(false), 2000)
    }

    return (
        <div className="space-y-6">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
                <SpotlightCard className="p-6">
                    <h3 className="text-xs font-light text-muted-foreground uppercase tracking-[0.2em] mb-6">
                        Founder Profile
                    </h3>
                    <div className="space-y-4">
                        <div>
                            <label className="text-xs font-light text-muted-foreground mb-2 block">Display Name</label>
                            <Input
                                defaultValue={profile?.full_name || ""}
                                className="h-12 bg-background/50 border-border/50 text-sm font-light focus:border-foreground/30"
                            />
                        </div>
                        <div>
                            <label className="text-xs font-light text-muted-foreground mb-2 block">Username</label>
                            <Input
                                defaultValue={profile?.username || ""}
                                placeholder="your-username"
                                className="h-12 bg-background/50 border-border/50 text-sm font-light focus:border-foreground/30"
                            />
                        </div>
                    </div>
                </SpotlightCard>
            </motion.div>

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.1 }}
            >
                <Button
                    onClick={handleSave}
                    className="w-full h-12 text-sm font-light bg-foreground text-background hover:bg-foreground/90"
                >
                    {saved ? "Saved Successfully" : "Save Changes"}
                </Button>
            </motion.div>

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.2 }}
            >
                <button
                    onClick={signOut}
                    className="w-full flex items-center justify-center gap-2 py-4 rounded-xl border border-border/30 bg-transparent hover:bg-foreground/5 hover:border-border/50 transition-all duration-300"
                >
                    <LogOut className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm font-light text-muted-foreground">Sign Out</span>
                </button>
            </motion.div>
        </div>
    )
}

// ============================================
// MAIN FOUNDER DASHBOARD
// ============================================
export default function FounderDashboard() {
    const router = useRouter()
    const [activeTab, setActiveTab] = useState("overview")
    const [products, setProducts] = useState<Product[]>([])
    const [transactions, setTransactions] = useState<Transaction[]>([])
    const [isLoading, setIsLoading] = useState(true)

    const { user, profile, isLoading: authLoading, signOut } = useAuth()

    // Fetch founder's products and transactions
    const fetchData = async () => {
        if (!user) return

        const supabase = createClient()

        // SECURITY: Only select non-sensitive fields - webhook_secret must NEVER be returned to client
        const { data: productsData } = await supabase
            .from("products")
            .select("id, name, description, logo_url, website_url, is_active, is_founders_choice, is_featured, featured_until, commission_config, max_cac_limit, created_at, settlement_mode, founder_id")
            .eq("founder_id", user.id)
            .order("created_at", { ascending: false })

        if (productsData) {
            const typedProducts = productsData as unknown as Product[]
            setProducts(typedProducts)

            const productIds = typedProducts.map(p => p.id)
            if (productIds.length > 0) {
                const { data: txData } = await supabase
                    .from("transactions")
                    .select("*")
                    .in("product_id", productIds)
                    .order("created_at", { ascending: false })

                if (txData) {
                    setTransactions(txData as Transaction[])
                }
            }
        }

        setIsLoading(false)
    }

    useEffect(() => {
        if (user) {
            fetchData()
        }
    }, [user])

    // Build live ticker from recent sales
    const recentSales = transactions.slice(0, 5).map(tx => ({
        id: tx.id.slice(0, 6),
        amount: formatCurrency(tx.sale_amount),
        commission: formatCurrency(tx.commission_amount),
    }))

    const renderTabContent = () => {
        switch (activeTab) {
            case "overview":
                return <OverviewTab products={products} transactions={transactions} isLoading={isLoading} />
            case "products":
                return <ProductsTab products={products} isLoading={isLoading} onRefresh={fetchData} />
            case "activity":
                return <ActivityTab transactions={transactions} isLoading={isLoading} />
            case "billing":
                return <SetupBilling />
            case "settings":
                return <SettingsTab profile={profile} signOut={signOut} />
            default:
                return <OverviewTab products={products} transactions={transactions} isLoading={isLoading} />
        }
    }

    if (authLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
        )
    }

    return (
        <div className="min-h-screen w-full overflow-x-hidden bg-background">
            {/* Grain overlay */}
            <div className="grain-overlay" />

            {/* Sidebar */}
            <motion.aside
                initial={{ x: -100, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                className="fixed left-0 top-0 h-full w-16 lg:w-56 bg-background/80 backdrop-blur-xl border-r border-border/30 z-50 flex flex-col"
            >
                {/* Logo */}
                <div className="p-4 lg:p-6 border-b border-border/30">
                    <Link href="/" className="cursor-pointer">
                        <Logo showText={false} className="lg:hidden" />
                        <Logo showText={true} className="hidden lg:flex" />
                    </Link>
                </div>

                {/* Navigation */}
                <nav className="flex-1 p-2 lg:p-3">
                    <ul className="space-y-1">
                        {sidebarItems.map((item, index) => {
                            const Icon = item.icon
                            const isActive = activeTab === item.id
                            return (
                                <motion.li
                                    key={item.id}
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: index * 0.05 + 0.2 }}
                                >
                                    <button
                                        onClick={() => setActiveTab(item.id)}
                                        className={cn(
                                            "w-full flex items-center justify-center lg:justify-start gap-3 px-3 py-3 rounded-lg transition-all duration-300 cursor-pointer",
                                            isActive
                                                ? "bg-purple-500/10 text-purple-400 shadow-[0_0_20px_rgba(168,85,247,0.1)]"
                                                : "text-muted-foreground hover:text-foreground hover:bg-foreground/5"
                                        )}
                                    >
                                        <Icon className="w-4 h-4 flex-shrink-0" />
                                        <span className="hidden lg:block text-sm font-light tracking-tight">{item.label}</span>
                                    </button>
                                </motion.li>
                            )
                        })}
                    </ul>
                </nav>

                {/* Seller Dashboard Link */}
                <div className="p-2 lg:p-3 border-t border-border/30">
                    <Link href="/dashboard/seller">
                        <button className="w-full flex items-center justify-center lg:justify-start gap-3 px-3 py-3 rounded-lg text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition-all duration-300 cursor-pointer">
                            <Users className="w-4 h-4 flex-shrink-0" />
                            <span className="hidden lg:block text-sm font-light tracking-tight">Seller View</span>
                        </button>
                    </Link>
                </div>

                {/* Back to Home */}
                <div className="p-2 lg:p-3 border-t border-border/30">
                    <Link href="/">
                        <button className="w-full flex items-center justify-center lg:justify-start gap-3 px-3 py-3 rounded-lg text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition-all duration-300 cursor-pointer">
                            <ArrowUpRight className="w-4 h-4 flex-shrink-0 rotate-[-135deg]" />
                            <span className="hidden lg:block text-sm font-light tracking-tight">Back to Home</span>
                        </button>
                    </Link>
                </div>
            </motion.aside>

            {/* Main Content */}
            <main className="ml-16 lg:ml-56 min-h-screen">
                {/* Top Header */}
                <motion.header
                    initial={{ y: -20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ duration: 0.5 }}
                    className="sticky top-0 z-40 bg-background/80 backdrop-blur-xl border-b border-border/30 px-4 lg:px-6 py-4"
                >
                    <div className="flex items-center justify-between max-w-6xl">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground font-light">
                            <span>Founder Dashboard</span>
                            <span className="text-border">/</span>
                            <span className="text-foreground capitalize">{activeTab}</span>
                        </div>
                        <div className="flex items-center gap-4">
                            <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400">Founder</span>
                            <div className="flex items-center gap-2">
                                <div className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-pulse" />
                                <span className="text-[10px] text-muted-foreground font-light tracking-wide hidden sm:block">Live</span>
                            </div>
                        </div>
                    </div>
                </motion.header>

                {/* Live Ticker */}
                <div className="border-b border-border/30 bg-purple-500/5 overflow-hidden">
                    <motion.div
                        animate={{ x: [0, -1200] }}
                        transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
                        className="flex items-center gap-8 py-2.5 px-4 whitespace-nowrap"
                    >
                        {recentSales.length > 0 ? (
                            [...recentSales, ...recentSales, ...recentSales].map((sale, i) => (
                                <span key={i} className="text-[10px] text-muted-foreground font-light tracking-wide">
                                    <span className="text-purple-400">Sale #{sale.id}</span>
                                    {" — "}
                                    <span className="text-foreground/80">{sale.amount}</span>
                                    {" ("}
                                    <span className="text-muted-foreground">-{sale.commission} commission</span>
                                    {")"}
                                </span>
                            ))
                        ) : (
                            <span className="text-[10px] text-muted-foreground font-light tracking-wide">
                                No sales yet — add products and let Warlords drive sales for you
                            </span>
                        )}
                    </motion.div>
                </div>

                {/* Dashboard Content */}
                <div className="p-4 lg:p-6 max-w-6xl">
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={activeTab}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            transition={{ duration: 0.3 }}
                        >
                            {renderTabContent()}
                        </motion.div>
                    </AnimatePresence>
                </div>
            </main>
        </div>
    )
}
