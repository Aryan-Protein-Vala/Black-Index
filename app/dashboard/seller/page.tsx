"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
    LayoutDashboard, Link2, Vault, TrendingUp, Settings,
    Copy, Check, ArrowUpRight, LogOut, Package, Plus, Loader2,
    ExternalLink, Crown
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { Area, AreaChart, ResponsiveContainer, XAxis, YAxis, Tooltip } from "recharts"
import { Logo } from "@/components/logo"
import { SpotlightCard } from "@/components/ui/spotlight-card"
import Link from "next/link"
import { useAuth } from "@/components/auth-provider"
import { useProducts, useLinks, useDashboardStats, formatCurrency, useTransactions } from "@/hooks/use-dashboard-data"
import { BecomeSellerModal } from "@/components/become-seller-modal"

// Tab configuration
const sidebarItems = [
    { id: "overview", label: "Overview", icon: LayoutDashboard },
    { id: "links", label: "My Links", icon: Link2 },
    { id: "vault", label: "The Vault", icon: Vault },
    { id: "analytics", label: "Analytics", icon: TrendingUp },
    { id: "settings", label: "Settings", icon: Settings },
]

// Mock chart data (will be real when we have more transaction history)
const chartData = [
    { day: "Mon", earnings: 0 },
    { day: "Tue", earnings: 0 },
    { day: "Wed", earnings: 0 },
    { day: "Thu", earnings: 0 },
    { day: "Fri", earnings: 0 },
    { day: "Sat", earnings: 0 },
    { day: "Sun", earnings: 0 },
]

// ============================================
// OVERVIEW TAB
// ============================================
function OverviewTab({ stats, transactions }: { stats: ReturnType<typeof useDashboardStats>, transactions: any[] }) {
    const recentSales = transactions.slice(0, 5).map(tx => ({
        user: `Sale #${tx.id.slice(0, 6)}`,
        product: tx.product_id?.slice(0, 8) || "Product",
        amount: `+${formatCurrency(tx.commission_amount)}`,
        time: new Date(tx.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }))

    return (
        <div className="space-y-6">
            {/* Stats Row */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.1 }}
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
            >
                <SpotlightCard className="p-6">
                    <p className="text-xs font-light text-muted-foreground uppercase tracking-[0.2em] mb-2">Total Earnings</p>
                    <div className="flex items-baseline gap-2">
                        <span className="text-2xl font-light tracking-tight">{formatCurrency(stats.totalEarnings)}</span>
                    </div>
                </SpotlightCard>
                <SpotlightCard className="p-6">
                    <p className="text-xs font-light text-muted-foreground uppercase tracking-[0.2em] mb-2">This Week</p>
                    <div className="flex items-baseline gap-2">
                        <span className="text-2xl font-light tracking-tight">{formatCurrency(stats.thisWeekEarnings)}</span>
                    </div>
                </SpotlightCard>
                <SpotlightCard className="p-6">
                    <p className="text-xs font-light text-muted-foreground uppercase tracking-[0.2em] mb-2">Conversions</p>
                    <div className="flex items-baseline gap-2">
                        <span className="text-2xl font-light tracking-tight">{stats.conversions}</span>
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
                        Earnings Overview
                    </h3>
                    <div className="h-48 sm:h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={chartData}>
                                <defs>
                                    <linearGradient id="earningsGradient" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="#ffffff" stopOpacity={0.15} />
                                        <stop offset="100%" stopColor="#ffffff" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "#666" }} />
                                <YAxis
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fontSize: 10, fill: "#666" }}
                                    tickFormatter={(value) => `₹${value}`}
                                    width={50}
                                />
                                <Tooltip
                                    contentStyle={{
                                        background: "rgba(10,10,10,0.95)",
                                        border: "1px solid rgba(255,255,255,0.1)",
                                        borderRadius: "8px",
                                        fontSize: "12px",
                                        fontWeight: 300,
                                    }}
                                    formatter={(value: number) => [`₹${value}`, "Earnings"]}
                                />
                                <Area
                                    type="monotone"
                                    dataKey="earnings"
                                    stroke="rgba(255,255,255,0.5)"
                                    strokeWidth={1.5}
                                    fill="url(#earningsGradient)"
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </SpotlightCard>
            </motion.div>

            {/* Recent Activity */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.3 }}
            >
                <SpotlightCard className="p-6">
                    <h3 className="text-xs font-light text-muted-foreground uppercase tracking-[0.2em] mb-6">Recent Activity</h3>
                    {recentSales.length === 0 ? (
                        <div className="text-center py-8">
                            <p className="text-sm text-muted-foreground font-light">No sales yet</p>
                            <p className="text-xs text-muted-foreground/60 mt-1">Start sharing your referral links to earn commissions</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {recentSales.map((sale, i) => (
                                <motion.div
                                    key={i}
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: i * 0.1 }}
                                    className="flex items-center justify-between py-3 border-b border-border/30 last:border-0"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-foreground/10 flex items-center justify-center">
                                            <span className="text-xs font-light">₹</span>
                                        </div>
                                        <div>
                                            <p className="text-sm font-light">{sale.user}</p>
                                            <p className="text-xs text-muted-foreground font-light">{sale.product}</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-sm font-light text-green-400">{sale.amount}</p>
                                        <p className="text-xs text-muted-foreground font-light">{sale.time}</p>
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    )}
                </SpotlightCard>
            </motion.div>
        </div>
    )
}

// ============================================
// MY LINKS TAB
// ============================================
function LinksTab({ copiedStates, handleCopy }: { copiedStates: Record<string, boolean>; handleCopy: (text: string, id: string) => void }) {
    const { links, isLoading } = useLinks()

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {/* My Links */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
            >
                <SpotlightCard className="p-6">
                    <h3 className="text-xs font-light text-muted-foreground uppercase tracking-[0.2em] mb-6">
                        Your Links
                    </h3>
                    {links.length === 0 ? (
                        <div className="text-center py-8">
                            <Link2 className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
                            <p className="text-sm text-muted-foreground font-light">No links yet</p>
                            <p className="text-xs text-muted-foreground/60 mt-1">Generate links from The Vault tab</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {links.map((link, i) => (
                                <motion.div
                                    key={link.id}
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: i * 0.05 }}
                                    className="flex items-center justify-between p-4 rounded-lg border border-border/30 bg-background/30"
                                >
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-light truncate">{link.products?.name || "Product"}</p>
                                        <p className="text-xs text-muted-foreground font-mono truncate">{link.url}</p>
                                        <p className="text-xs text-muted-foreground mt-1">{link.clicks || 0} clicks</p>
                                    </div>
                                    <button
                                        onClick={() => handleCopy(link.url, link.id)}
                                        className="ml-4 flex items-center gap-2 px-3 py-2 rounded-lg bg-foreground/5 hover:bg-foreground/10 transition-all"
                                    >
                                        {copiedStates[link.id] ? (
                                            <><Check className="w-3 h-3 text-green-400" /><span className="text-xs text-green-400">Copied</span></>
                                        ) : (
                                            <><Copy className="w-3 h-3 text-muted-foreground" /><span className="text-xs text-muted-foreground">Copy</span></>
                                        )}
                                    </button>
                                </motion.div>
                            ))}
                        </div>
                    )}
                </SpotlightCard>
            </motion.div>
        </div>
    )
}

// ============================================
// THE VAULT TAB (Products)
// ============================================
function VaultTab({ copiedStates, handleCopy }: { copiedStates: Record<string, boolean>; handleCopy: (text: string, id: string) => void }) {
    const { products, isLoading } = useProducts()
    const { generateLink } = useLinks()
    const [generatingFor, setGeneratingFor] = useState<string | null>(null)
    const [selectedProduct, setSelectedProduct] = useState<any | null>(null)
    const [activeFilter, setActiveFilter] = useState('all')

    // Filter products based on active filter
    const filteredProducts = products.filter(product => {
        const config = product.commission_config as any
        const commission = config?.upfront_pct || 0
        const isFoundersChoice = (product as any).is_founders_choice || false
        const isFeatured = (product as any).is_featured && (product as any).featured_until && new Date((product as any).featured_until) > new Date()

        switch (activeFilter) {
            case 'featured':
                return isFeatured
            case 'founders-choice':
                return isFoundersChoice
            case '50+':
                return commission >= 50
            case '40-50':
                return commission >= 40 && commission < 50
            case '30-40':
                return commission >= 30 && commission < 40
            case '5-30':
                return commission >= 5 && commission < 30
            default:
                return true
        }
    })

    const handleGetLink = async (productId: string, productName: string, e?: React.MouseEvent) => {
        if (e) e.stopPropagation()
        setGeneratingFor(productId)
        try {
            const result = await generateLink(productId)
            handleCopy(result.url, `vault-${productName}`)
        } catch (err) {
            console.error(err)
        }
        setGeneratingFor(null)
    }

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
        )
    }

    if (products.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-20">
                <Vault className="w-12 h-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-light mb-2">The Vault is Empty</h3>
                <p className="text-sm text-muted-foreground">No products available yet. Check back soon!</p>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {/* Filter Tabs */}
            <div className="flex flex-wrap gap-2">
                {[
                    { id: 'all', label: 'All' },
                    { id: 'featured', label: '🌟 Featured' },
                    { id: 'founders-choice', label: "⭐ Founder's Choice" },
                    { id: '50+', label: '50%+' },
                    { id: '40-50', label: '40-50%' },
                    { id: '30-40', label: '30-40%' },
                    { id: '5-30', label: '5-30%' },
                ].map((filter) => (
                    <button
                        key={filter.id}
                        onClick={() => setActiveFilter(filter.id)}
                        className={cn(
                            "px-4 py-2 rounded-lg text-sm font-light transition-all",
                            activeFilter === filter.id
                                ? "bg-foreground text-background"
                                : "bg-foreground/5 text-muted-foreground hover:bg-foreground/10 hover:text-foreground"
                        )}
                    >
                        {filter.label}
                    </button>
                ))}
            </div>

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="grid grid-cols-1 sm:grid-cols-2 gap-4"
            >
                {filteredProducts.map((product, i) => {
                    const config = product.commission_config as any
                    const upfrontPct = config?.upfront_pct || 0
                    const recurringPct = config?.recurring_pct || 0
                    const isFoundersChoice = (product as any).is_founders_choice || false
                    const isFeatured = (product as any).is_featured && (product as any).featured_until && new Date((product as any).featured_until) > new Date()

                    return (
                        <motion.div
                            key={product.id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.1 }}
                        >
                            <SpotlightCard
                                className={cn(
                                    "p-6 h-full flex flex-col cursor-pointer hover:border-foreground/20 transition-all",
                                    isFeatured && "border-yellow-400/50 shadow-[0_0_20px_rgba(250,204,21,0.25)] bg-gradient-to-br from-yellow-500/5 to-transparent",
                                    isFoundersChoice && !isFeatured && "border-white/40 shadow-[0_0_25px_rgba(255,255,255,0.2)] bg-gradient-to-br from-white/5 to-transparent"
                                )}
                                onClick={() => setSelectedProduct(product)}
                            >
                                {/* Header - Fixed */}
                                <div className="flex items-start justify-between mb-4">
                                    <div className="flex items-center gap-3">
                                        {product.logo_url ? (
                                            <img src={product.logo_url} alt={product.name} className="w-10 h-10 rounded-lg object-cover" />
                                        ) : (
                                            <div className="w-10 h-10 rounded-lg bg-foreground/10 flex items-center justify-center">
                                                <Package className="w-5 h-5 text-muted-foreground" />
                                            </div>
                                        )}
                                        <div>
                                            <h4 className="text-base font-light tracking-tight">{product.name}</h4>
                                            <p className="text-xs text-muted-foreground font-light mt-0.5">{product.website_url}</p>
                                        </div>
                                    </div>
                                    <span className={cn(
                                        "px-2 py-1 text-[10px] font-light uppercase tracking-wider rounded flex-shrink-0",
                                        product.is_active
                                            ? "bg-green-500/10 text-green-400 border border-green-500/20"
                                            : "bg-foreground/5 text-muted-foreground border border-border/30"
                                    )}>
                                        {product.is_active ? "Active" : "Inactive"}
                                    </span>
                                </div>

                                {/* Commission - Fixed Height */}
                                <div className="flex justify-between text-sm mb-4">
                                    <span className="text-muted-foreground font-light">Commission</span>
                                    <span className="font-light">{upfrontPct}%</span>
                                </div>

                                {/* Spacer to push button to bottom */}
                                <div className="flex-1" />

                                {/* Button - Always at bottom */}
                                {product.is_active && (
                                    <button
                                        onClick={(e) => handleGetLink(product.id, product.name, e)}
                                        disabled={generatingFor === product.id}
                                        className="w-full flex items-center justify-center gap-2 py-3 rounded-lg border border-border/30 bg-foreground/5 hover:bg-foreground/10 hover:border-border/50 transition-all duration-300 mt-4"
                                    >
                                        {generatingFor === product.id ? (
                                            <><Loader2 className="w-4 h-4 animate-spin" /><span className="text-xs font-light">Generating...</span></>
                                        ) : copiedStates[`vault-${product.name}`] ? (
                                            <><Check className="w-4 h-4 text-green-400" /><span className="text-xs font-light text-green-400">Link Copied!</span></>
                                        ) : (
                                            <><Link2 className="w-4 h-4 text-muted-foreground" /><span className="text-xs font-light text-muted-foreground">Get Referral Link</span></>
                                        )}
                                    </button>
                                )}
                            </SpotlightCard>
                        </motion.div>
                    )
                })}
            </motion.div>

            {/* Product Detail Modal */}
            <AnimatePresence>
                {selectedProduct && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[100] flex items-center justify-center p-4"
                        onClick={() => setSelectedProduct(null)}
                    >
                        <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="relative w-full max-w-lg"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <SpotlightCard className="p-6">
                                {/* Header */}
                                <div className="flex items-start justify-between mb-6">
                                    <div className="flex items-center gap-4">
                                        {selectedProduct.logo_url ? (
                                            <img src={selectedProduct.logo_url} alt={selectedProduct.name} className="w-14 h-14 rounded-xl object-cover" />
                                        ) : (
                                            <div className="w-14 h-14 rounded-xl bg-foreground/10 flex items-center justify-center">
                                                <Package className="w-7 h-7 text-muted-foreground" />
                                            </div>
                                        )}
                                        <div>
                                            <h3 className="text-xl font-light tracking-tight">{selectedProduct.name}</h3>
                                            <a href={selectedProduct.website_url} target="_blank" rel="noopener noreferrer" className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
                                                {selectedProduct.website_url}
                                                <ExternalLink className="w-3 h-3" />
                                            </a>
                                        </div>
                                    </div>
                                    <button onClick={() => setSelectedProduct(null)} className="text-muted-foreground hover:text-foreground">
                                        <span className="sr-only">Close</span>
                                        ✕
                                    </button>
                                </div>

                                {/* Tagline */}
                                {selectedProduct.tagline && (
                                    <p className="text-base text-foreground/80 font-light italic mb-4">
                                        "{selectedProduct.tagline}"
                                    </p>
                                )}

                                {/* Description */}
                                {selectedProduct.description && (
                                    <p className="text-sm text-muted-foreground font-light mb-4 leading-relaxed whitespace-pre-wrap">
                                        {selectedProduct.description}
                                    </p>
                                )}

                                {/* Product Info Grid */}
                                <div className="grid grid-cols-2 gap-3 mb-4">
                                    {selectedProduct.category && (
                                        <div className="p-3 rounded-lg bg-foreground/5 border border-border/30">
                                            <p className="text-xs text-muted-foreground mb-1">Category</p>
                                            <p className="text-sm font-light">{selectedProduct.category}</p>
                                        </div>
                                    )}
                                    {selectedProduct.pricing && (
                                        <div className="p-3 rounded-lg bg-foreground/5 border border-border/30">
                                            <p className="text-xs text-muted-foreground mb-1">Pricing</p>
                                            <p className="text-sm font-light">{selectedProduct.pricing}</p>
                                        </div>
                                    )}
                                </div>

                                {/* Target Audience */}
                                {selectedProduct.target_audience && (
                                    <div className="p-3 rounded-lg bg-purple-500/5 border border-purple-500/20 mb-4">
                                        <p className="text-xs text-purple-400 mb-1">Target Audience</p>
                                        <p className="text-sm font-light">{selectedProduct.target_audience}</p>
                                    </div>
                                )}

                                {/* Commission Details */}
                                <div className="space-y-3 p-4 rounded-lg bg-foreground/5 border border-border/30 mb-6">
                                    <h4 className="text-xs font-light text-muted-foreground uppercase tracking-wider mb-3">Your Commission</h4>
                                    <div className="flex justify-between">
                                        <span className="text-sm font-light">Upfront (First Sale)</span>
                                        <span className="text-sm font-medium text-green-400">{(selectedProduct.commission_config as any)?.upfront_pct || 0}%</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-sm font-light">Recurring (Monthly)</span>
                                        <span className="text-sm font-medium text-blue-400">{(selectedProduct.commission_config as any)?.recurring_pct || 0}%</span>
                                    </div>
                                </div>

                                {/* Get Link Button */}
                                {selectedProduct.is_active && (
                                    <Button
                                        onClick={() => handleGetLink(selectedProduct.id, selectedProduct.name)}
                                        disabled={generatingFor === selectedProduct.id}
                                        className="w-full h-12 bg-foreground text-background hover:bg-foreground/90"
                                    >
                                        {generatingFor === selectedProduct.id ? (
                                            <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Generating...</>
                                        ) : copiedStates[`vault-${selectedProduct.name}`] ? (
                                            <><Check className="w-4 h-4 mr-2" />Link Copied!</>
                                        ) : (
                                            <><Link2 className="w-4 h-4 mr-2" />Get Referral Link</>
                                        )}
                                    </Button>
                                )}
                            </SpotlightCard>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}


// ============================================
// ANALYTICS TAB (Original Style from performance-sales-network)
// ============================================
function AnalyticsTab({ stats, links, products }: { stats: ReturnType<typeof useDashboardStats>, links: any[], products: any[] }) {
    const weeklyData = [
        { week: "Week 1", earnings: 0 },
        { week: "Week 2", earnings: 0 },
        { week: "Week 3", earnings: 0 },
        { week: "Week 4", earnings: stats.thisWeekEarnings / 100 },
    ]

    // Calculate metrics from real data
    const totalClicks = links.reduce((sum, link) => sum + (link.clicks || 0), 0)
    const conversionRate = totalClicks > 0 ? ((stats.conversions / totalClicks) * 100) : 0
    const avgOrder = stats.conversions > 0 ? Math.round(stats.totalEarnings / stats.conversions) : 0

    // For now, no historical data means 0% change
    // In the future, compare with last week's data from transactions
    const clickRateChange = 0
    const conversionChange = 0
    const avgOrderChange = 0
    const revenueChange = 0

    // Helper to format change with sign and color
    const formatChange = (value: number, isPercent: boolean = true, isCurrency: boolean = false) => {
        if (value === 0) return { text: "0.0%", color: "text-muted-foreground" }
        const sign = value > 0 ? "+" : ""
        const formatted = isCurrency
            ? `${sign}${formatCurrency(Math.abs(value))}`
            : `${sign}${Math.abs(value).toFixed(1)}%`
        const color = value > 0 ? "text-green-400" : "text-red-400"
        return { text: formatted, color }
    }

    const statsData = [
        { label: "Click Rate", value: `${conversionRate.toFixed(1)}%`, ...formatChange(clickRateChange) },
        { label: "Conversion", value: `${conversionRate.toFixed(1)}%`, ...formatChange(conversionChange) },
        { label: "Avg. Order", value: formatCurrency(avgOrder), ...formatChange(avgOrderChange, false, true) },
        { label: "Revenue", value: formatCurrency(stats.totalEarnings), ...formatChange(revenueChange) },
    ]

    return (
        <div className="space-y-6">
            {/* Weekly Stats - Original Style */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="grid grid-cols-2 lg:grid-cols-4 gap-4"
            >
                {statsData.map((stat, i) => (
                    <motion.div
                        key={stat.label}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.1 }}
                    >
                        <SpotlightCard className="p-4">
                            <p className="text-[10px] font-light text-muted-foreground uppercase tracking-[0.2em] mb-2">
                                {stat.label}
                            </p>
                            <div className="flex items-baseline gap-2">
                                <span className="text-lg font-light tracking-tight">{stat.value}</span>
                                <span className={`text-[10px] font-light ${stat.color}`}>{stat.text}</span>
                            </div>
                        </SpotlightCard>
                    </motion.div>
                ))}
            </motion.div>

            {/* Monthly Chart */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.2 }}
            >
                <SpotlightCard className="p-6">
                    <h3 className="text-xs font-light text-muted-foreground uppercase tracking-[0.2em] mb-6">
                        Monthly Performance
                    </h3>
                    <div className="h-48 sm:h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={weeklyData}>
                                <defs>
                                    <linearGradient id="weeklyGradient" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="#ffffff" stopOpacity={0.15} />
                                        <stop offset="100%" stopColor="#ffffff" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <XAxis dataKey="week" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "#666" }} />
                                <YAxis
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fontSize: 10, fill: "#666" }}
                                    tickFormatter={(value) => `₹${(value / 1000).toFixed(0)}K`}
                                    width={45}
                                />
                                <Tooltip
                                    contentStyle={{
                                        background: "rgba(10,10,10,0.95)",
                                        border: "1px solid rgba(255,255,255,0.1)",
                                        borderRadius: "8px",
                                        fontSize: "12px",
                                        fontWeight: 300,
                                    }}
                                    formatter={(value: number) => [`₹${value.toLocaleString()}`, "Earnings"]}
                                />
                                <Area
                                    type="monotone"
                                    dataKey="earnings"
                                    stroke="rgba(255,255,255,0.5)"
                                    strokeWidth={1.5}
                                    fill="url(#weeklyGradient)"
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </SpotlightCard>
            </motion.div>

            {/* Top Performing Products */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.3 }}
            >
                <SpotlightCard className="p-6">
                    <h3 className="text-xs font-light text-muted-foreground uppercase tracking-[0.2em] mb-6">
                        Top Performing Products
                    </h3>
                    {products.length === 0 ? (
                        <div className="text-center py-6">
                            <p className="text-sm text-muted-foreground font-light">No products yet</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {products
                                .filter(p => p.is_active)
                                .slice(0, 5)
                                .map((product, i) => {
                                    // Count links for this product
                                    const productLinks = links.filter(l => l.product_id === product.id)
                                    const productClicks = productLinks.reduce((sum, l) => sum + (l.clicks || 0), 0)
                                    const maxClicks = Math.max(...products.map(p =>
                                        links.filter(l => l.product_id === p.id).reduce((sum, l) => sum + (l.clicks || 0), 0)
                                    ), 1)

                                    return (
                                        <div key={product.id} className="flex items-center gap-4">
                                            <span className="text-xs text-muted-foreground font-light w-4">{i + 1}</span>
                                            <div className="flex-1">
                                                <div className="flex items-center justify-between mb-2">
                                                    <span className="text-sm font-light">{product.name}</span>
                                                    <span className="text-xs text-muted-foreground font-light">{productClicks} clicks</span>
                                                </div>
                                                <div className="h-1 bg-foreground/5 rounded-full overflow-hidden">
                                                    <motion.div
                                                        initial={{ width: 0 }}
                                                        animate={{ width: `${(productClicks / maxClicks) * 100}%` }}
                                                        transition={{ duration: 1, delay: i * 0.2 }}
                                                        className="h-full bg-foreground/30 rounded-full"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    )
                                })}
                        </div>
                    )}
                </SpotlightCard>
            </motion.div>
        </div>
    )
}

// ============================================
// SETTINGS TAB
// ============================================
function SettingsTab({ profile, signOut }: { profile: any, signOut: () => void }) {
    const [saved, setSaved] = useState(false)
    const [saving, setSaving] = useState(false)
    const [displayName, setDisplayName] = useState(profile?.full_name || "")
    const [username, setUsername] = useState(profile?.username || "")

    // Update state when profile changes
    useEffect(() => {
        if (profile) {
            setDisplayName(profile.full_name || "")
            setUsername(profile.username || "")
        }
    }, [profile])

    const handleSave = async () => {
        setSaving(true)
        try {
            const response = await fetch('/api/profile', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    full_name: displayName,
                    username: username,
                }),
            })

            if (response.ok) {
                setSaved(true)
                setTimeout(() => setSaved(false), 2000)
            }
        } catch (error) {
            console.error('Failed to save:', error)
        } finally {
            setSaving(false)
        }
    }

    return (
        <div className="space-y-6">
            {/* Profile Settings */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
                <SpotlightCard className="p-6">
                    <h3 className="text-xs font-light text-muted-foreground uppercase tracking-[0.2em] mb-6">Profile Settings</h3>
                    <div className="space-y-4">
                        <div>
                            <label className="text-xs font-light text-muted-foreground mb-2 block">Display Name</label>
                            <Input
                                value={displayName}
                                onChange={(e) => setDisplayName(e.target.value)}
                                className="h-12 bg-background/50 border-border/50 text-sm font-light focus:border-foreground/30"
                            />
                        </div>
                        <div>
                            <label className="text-xs font-light text-muted-foreground mb-2 block">Username</label>
                            <Input
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                placeholder="your-username"
                                className="h-12 bg-background/50 border-border/50 text-sm font-light focus:border-foreground/30"
                            />
                        </div>
                        <div>
                            <label className="text-xs font-light text-muted-foreground mb-2 block">Role</label>
                            <Input
                                value={profile?.role === "founder" ? "Founder" : "Warlord (Seller)"}
                                readOnly
                                className="h-12 bg-background/30 border-border/30 text-sm font-light text-muted-foreground"
                            />
                        </div>
                    </div>
                </SpotlightCard>
            </motion.div>

            {/* Save Button */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.2 }}
            >
                <Button
                    onClick={handleSave}
                    disabled={saving}
                    className="w-full h-12 text-sm font-light bg-foreground text-background hover:bg-foreground/90"
                >
                    {saving ? (
                        <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving...</>
                    ) : saved ? (
                        <><Check className="w-4 h-4 mr-2" />Saved Successfully</>
                    ) : (
                        "Save Changes"
                    )}
                </Button>
            </motion.div>

            {/* Logout */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.3 }}
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
// MAIN DASHBOARD
// ============================================
export default function UnifiedDashboard() {
    const [activeTab, setActiveTab] = useState("overview")
    const [copiedStates, setCopiedStates] = useState<Record<string, boolean>>({})
    const [showUpgradeModal, setShowUpgradeModal] = useState(false)

    const { profile, signOut, isLoading: authLoading } = useAuth()
    const stats = useDashboardStats()
    const { transactions } = useTransactions()
    const { links } = useLinks()
    const { products } = useProducts()

    const handleCopy = (text: string, id: string) => {
        navigator.clipboard.writeText(text)
        setCopiedStates({ ...copiedStates, [id]: true })
        setTimeout(() => {
            setCopiedStates({ ...copiedStates, [id]: false })
        }, 2000)
    }

    // Build live ticker from recent transactions
    const recentSales = transactions.slice(0, 5).map(tx => ({
        user: `Sale #${tx.id.slice(0, 4)}`,
        product: "Product",
        amount: `+${formatCurrency(tx.commission_amount)}`,
    }))

    const renderTabContent = () => {
        switch (activeTab) {
            case "overview":
                return <OverviewTab stats={stats} transactions={transactions} />
            case "links":
                return <LinksTab copiedStates={copiedStates} handleCopy={handleCopy} />
            case "vault":
                return <VaultTab copiedStates={copiedStates} handleCopy={handleCopy} />
            case "analytics":
                return <AnalyticsTab stats={stats} links={links} products={products} />
            case "settings":
                return <SettingsTab profile={profile} signOut={signOut} />
            default:
                return <OverviewTab stats={stats} transactions={transactions} />
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
                                                ? "bg-foreground/10 text-foreground shadow-[0_0_20px_rgba(255,255,255,0.03)]"
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

                {/* Become a Seller / My Products */}
                <div className="p-2 lg:p-3 border-t border-border/30">
                    {profile?.role === "founder" ? (
                        <Link href="/dashboard/founder">
                            <button className="w-full flex items-center justify-center lg:justify-start gap-3 px-3 py-3 rounded-lg text-foreground hover:bg-foreground/10 transition-all duration-300 cursor-pointer">
                                <Package className="w-4 h-4 flex-shrink-0" />
                                <span className="hidden lg:block text-sm font-light tracking-tight">My Products</span>
                            </button>
                        </Link>
                    ) : (
                        <button
                            onClick={() => setShowUpgradeModal(true)}
                            className="w-full flex items-center justify-center lg:justify-start gap-3 px-3 py-3 rounded-lg bg-gradient-to-r from-amber-500/10 to-yellow-600/10 text-amber-500 hover:from-amber-500/20 hover:to-yellow-600/20 transition-all duration-300 cursor-pointer border border-amber-500/20"
                        >
                            <Crown className="w-4 h-4 flex-shrink-0" />
                            <span className="hidden lg:block text-sm font-light tracking-tight">Become a Seller</span>
                        </button>
                    )}
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
                            <span>Dashboard</span>
                            <span className="text-border">/</span>
                            <span className="text-foreground capitalize">{activeTab === "vault" ? "The Vault" : activeTab}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                            <span className="text-[10px] text-muted-foreground font-light tracking-wide hidden sm:block">Live</span>
                        </div>
                    </div>
                </motion.header>

                {/* Live Ticker */}
                <div className="border-b border-border/30 bg-card/20 overflow-hidden">
                    <motion.div
                        animate={{ x: [0, -1200] }}
                        transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
                        className="flex items-center gap-8 py-2.5 px-4 whitespace-nowrap"
                    >
                        {recentSales.length > 0 ? (
                            [...recentSales, ...recentSales, ...recentSales].map((sale, i) => (
                                <span key={i} className="text-[10px] text-muted-foreground font-light tracking-wide">
                                    <span className="text-foreground/80">{sale.user}</span>
                                    {" earned "}
                                    <span className="text-green-400/80">{sale.amount}</span>
                                </span>
                            ))
                        ) : (
                            <span className="text-[10px] text-muted-foreground font-light tracking-wide">
                                No recent sales — start sharing your referral links to earn commissions
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

            {/* Become a Seller Modal */}
            <BecomeSellerModal
                isOpen={showUpgradeModal}
                onClose={() => setShowUpgradeModal(false)}
                onSuccess={() => {
                    // Refresh page to update role
                    window.location.reload()
                }}
            />

            {/* Razorpay Script */}
            <script src="https://checkout.razorpay.com/v1/checkout.js" async />
        </div>
    )
}
