"use client"

import { useState, useEffect, useCallback } from "react"
import { motion } from "framer-motion"
import {
    LayoutDashboard, Package, Users, LogOut, Search,
    Loader2, Star, StarOff, Eye, Trash2, ArrowLeft, Check, ShieldCheck,
    AlertTriangle, Ban, ArrowUpCircle, ArrowDownCircle, Scale, RefreshCw, X
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { Logo } from "@/components/logo"
import { SpotlightCard } from "@/components/ui/spotlight-card"
import Link from "next/link"
import { useAuth } from "@/components/auth-provider"
import { useConfirm } from "@/components/confirm-provider"
import { toast } from "sonner"

// Admin access is decided SERVER-SIDE by /api/admin/data (env ADMIN_EMAILS).
// No hardcoded email list here — otherwise admins added via env could use the
// APIs but be locked out of this UI.

type AdminTab = "overview" | "products" | "transactions" | "disputes" | "blacklist" | "users"

const fmt = (paise: number) => `₹${((paise || 0) / 100).toLocaleString("en-IN")}`

function statusBadge(status: string) {
    const map: Record<string, string> = {
        pending: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
        cleared: "bg-green-500/10 text-green-400 border-green-500/20",
        paid: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
        refunded: "bg-red-500/10 text-red-400 border-red-500/20",
        disputed: "bg-orange-500/10 text-orange-400 border-orange-500/20",
        cancelled: "bg-foreground/5 text-muted-foreground border-border/30",
        failed: "bg-red-500/10 text-red-400 border-red-500/20",
    }
    return map[status] || "bg-foreground/5 text-muted-foreground border-border/30"
}

export default function AdminDashboard() {
    const { user, isLoading: authLoading, signOut } = useAuth()
    const { showConfirm } = useConfirm()
    const [activeTab, setActiveTab] = useState<AdminTab>("overview")
    const [products, setProducts] = useState<any[]>([])
    const [users, setUsers] = useState<any[]>([])
    const [transactions, setTransactions] = useState<any[]>([])
    const [disputes, setDisputes] = useState<any[]>([])
    const [fraudReports, setFraudReports] = useState<any[]>([])
    const [blacklist, setBlacklist] = useState<any[]>([])
    const [stats, setStats] = useState<Record<string, number>>({})
    const [isLoading, setIsLoading] = useState(true)
    const [isAdmin, setIsAdmin] = useState(false)
    const [searchQuery, setSearchQuery] = useState("")
    const [actionId, setActionId] = useState<string | null>(null)

    const fetchData = useCallback(async () => {
        if (!user) return
        try {
            const response = await fetch('/api/admin/data')
            if (response.ok) {
                setIsAdmin(true)
                const data = await response.json()
                setProducts(data.products || [])
                setUsers(data.users || [])
                setTransactions(data.transactions || [])
                setDisputes(data.disputes || [])
                setFraudReports(data.fraudReports || [])
                setBlacklist(data.blacklist || [])
                setStats(data.stats || {})
            } else {
                setIsAdmin(false)
            }
        } catch (err) {
            console.error('Failed to fetch admin data:', err)
        } finally {
            setIsLoading(false)
        }
    }, [user])

    useEffect(() => {
        if (user && !authLoading) {
            setIsLoading(true)
            fetchData()
        } else if (!authLoading) {
            setIsLoading(false)
        }
    }, [user, authLoading, fetchData])

    const postAdmin = async (path: string, body: any) => {
        const response = await fetch(path, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        })
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || 'Request failed')
        return data
    }

    const runAction = async (path: string, body: any, successMsg: string) => {
        let key = `${body.action || ''}:${body.transactionId || body.reportId || body.id || body.userId || ''}`
        if (key.endsWith(':')) key = key.slice(0, -1)
        setActionId(key)
        try {
            await postAdmin(path, body)
            toast.success(successMsg)
            await fetchData()
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Action failed')
        } finally {
            setActionId(null)
        }
    }

    if (authLoading || isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
        )
    }

    if (!user || !isAdmin) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background p-6">
                <SpotlightCard className="p-8 max-w-md text-center">
                    <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4">
                        <LogOut className="w-8 h-8 text-red-500" />
                    </div>
                    <h1 className="text-2xl font-light mb-2">Access Denied</h1>
                    <p className="text-muted-foreground mb-6">
                        {user ? "You don't have admin privileges." : "Please log in with an admin account."}
                    </p>
                    <Link href={user ? "/dashboard" : "/login"}>
                        <Button className="bg-foreground text-background hover:bg-foreground/90">
                            {user ? "Go to Dashboard" : "Login"}
                        </Button>
                    </Link>
                </SpotlightCard>
            </div>
        )
    }

    const tabs: { id: AdminTab; label: string; icon: any; count?: number }[] = [
        { id: "overview", label: "Overview", icon: LayoutDashboard },
        { id: "products", label: "Products", icon: Package, count: products.length },
        { id: "transactions", label: "Transactions", icon: ArrowUpCircle, count: transactions.length },
        { id: "disputes", label: "Disputes", icon: Scale, count: disputes.length + fraudReports.filter((r: any) => r.status === 'pending').length },
        { id: "blacklist", label: "Blacklist", icon: Ban, count: blacklist.length },
        { id: "users", label: "Users", icon: Users, count: users.length },
    ]

    const headerTitle: Record<AdminTab, { title: string; sub: string }> = {
        overview: { title: "Overview", sub: "Platform health at a glance" },
        products: { title: "Products", sub: "Manage all products, certify, feature, pause" },
        transactions: { title: "Transactions", sub: "Ledger — release stuck escrow, admin refunds" },
        disputes: { title: "Disputes", sub: "Review fraud reports and disputed transactions" },
        blacklist: { title: "Blacklist", sub: "Transparency list — add or remove entries" },
        users: { title: "Users", sub: "Roles, balances, and account management" },
    }

    return (
        <div className="min-h-screen bg-background">
            {/* Sidebar */}
            <div className="fixed left-0 top-0 h-screen w-64 border-r border-border/30 bg-background/80 backdrop-blur-xl p-6 flex flex-col overflow-y-auto">
                <div className="flex items-center gap-3 mb-8">
                    <Logo className="h-8" />
                    <span className="text-xs px-2 py-1 rounded bg-red-500/10 text-red-400 font-medium">ADMIN</span>
                </div>

                <nav className="space-y-1 flex-1">
                    {tabs.map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={cn(
                                "w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-light transition-all",
                                activeTab === tab.id
                                    ? "bg-foreground/10 text-foreground"
                                    : "text-muted-foreground hover:text-foreground hover:bg-foreground/5"
                            )}
                        >
                            <tab.icon className="w-4 h-4" />
                            {tab.label}
                            {typeof tab.count === 'number' && tab.count > 0 && (
                                <span className="ml-auto text-[10px] bg-foreground/10 px-2 py-0.5 rounded">
                                    {tab.count}
                                </span>
                            )}
                        </button>
                    ))}
                </nav>

                <div className="pt-4 border-t border-border/30">
                    <Link href="/dashboard">
                        <button className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-light text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition-all">
                            <ArrowLeft className="w-4 h-4" />
                            Back to Dashboard
                        </button>
                    </Link>
                    <button
                        onClick={() => signOut()}
                        className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-light text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition-all"
                    >
                        <LogOut className="w-4 h-4" />
                        Sign Out
                    </button>
                </div>
            </div>

            {/* Main Content */}
            <div className="ml-64 p-8">
                <div className="max-w-6xl mx-auto">
                    <div className="flex items-center justify-between mb-8">
                        <div>
                            <h1 className="text-3xl font-light tracking-tight">{headerTitle[activeTab].title}</h1>
                            <p className="text-muted-foreground font-light">{headerTitle[activeTab].sub}</p>
                        </div>

                        <div className="flex items-center gap-3">
                            {activeTab !== "overview" && (
                                <div className="relative w-64">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                    <Input
                                        placeholder="Search..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="pl-10 bg-input/30"
                                    />
                                </div>
                            )}
                            <button
                                onClick={() => { setIsLoading(true); fetchData() }}
                                className="p-2 rounded-lg border border-border/30 text-muted-foreground hover:text-foreground hover:bg-foreground/5"
                                title="Refresh"
                            >
                                <RefreshCw className="w-4 h-4" />
                            </button>
                        </div>
                    </div>

                    {activeTab === "overview" && <OverviewSection stats={stats} />}

                    {activeTab === "products" && (
                        <ProductsSection
                            products={products}
                            searchQuery={searchQuery}
                            actionId={actionId}
                            runAction={runAction}
                            showConfirm={showConfirm}
                        />
                    )}

                    {activeTab === "transactions" && (
                        <TransactionsSection
                            transactions={transactions}
                            searchQuery={searchQuery}
                            actionId={actionId}
                            runAction={runAction}
                            showConfirm={showConfirm}
                        />
                    )}

                    {activeTab === "disputes" && (
                        <DisputesSection
                            disputes={disputes}
                            fraudReports={fraudReports}
                            actionId={actionId}
                            runAction={runAction}
                            showConfirm={showConfirm}
                        />
                    )}

                    {activeTab === "blacklist" && (
                        <BlacklistSection
                            entries={blacklist}
                            actionId={actionId}
                            runAction={runAction}
                            showConfirm={showConfirm}
                        />
                    )}

                    {activeTab === "users" && (
                        <UsersSection
                            users={users}
                            searchQuery={searchQuery}
                            actionId={actionId}
                            runAction={runAction}
                            showConfirm={showConfirm}
                        />
                    )}
                </div>
            </div>
        </div>
    )
}

// ============================================================
// OVERVIEW
// ============================================================
function OverviewSection({ stats }: { stats: Record<string, number> }) {
    const cards = [
        { label: "Platform Fee Revenue", value: fmt(stats.platform_fee_revenue || 0), icon: ArrowUpCircle, color: "text-emerald-400 bg-emerald-500/10" },
        { label: "Escrow Held (pending)", value: fmt(stats.escrow_held || 0), icon: ShieldCheck, color: "text-blue-400 bg-blue-500/10" },
        { label: "Seller Withdrawable", value: fmt(stats.seller_withdrawable || 0), icon: ArrowDownCircle, color: "text-purple-400 bg-purple-500/10" },
        { label: "Founder Wallet Floats", value: fmt(stats.founder_wallets || 0), icon: Users, color: "text-yellow-400 bg-yellow-500/10" },
        { label: "Total Sales", value: String(stats.total_sales || 0), icon: Package, color: "text-green-400 bg-green-500/10" },
        { label: "Disputed Tx", value: String(stats.disputed_txs || 0), icon: Scale, color: "text-orange-400 bg-orange-500/10" },
        { label: "Fraud Reports (pending)", value: String(stats.fraud_pending || 0), icon: AlertTriangle, color: "text-red-400 bg-red-500/10" },
        { label: "Blacklisted", value: String(stats.blacklisted || 0), icon: Ban, color: "text-red-400 bg-red-500/10" },
        { label: "Users", value: String(stats.users || 0), icon: Users, color: "text-blue-400 bg-blue-500/10" },
        { label: "Products", value: String(stats.products || 0), icon: Package, color: "text-purple-400 bg-purple-500/10" },
    ]

    return (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {cards.map((card, i) => (
                <motion.div
                    key={card.label}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.03 }}
                >
                    <SpotlightCard className="p-5">
                        <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center mb-3", card.color)}>
                            <card.icon className="w-5 h-5" />
                        </div>
                        <p className="text-xl font-light">{card.value}</p>
                        <p className="text-xs text-muted-foreground font-light mt-1">{card.label}</p>
                    </SpotlightCard>
                </motion.div>
            ))}
        </div>
    )
}

// ============================================================
// PRODUCTS
// ============================================================
function ProductsSection({ products, searchQuery, actionId, runAction, showConfirm }: any) {
    const filtered = products.filter((p: any) =>
        p.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.website_url?.toLowerCase().includes(searchQuery.toLowerCase())
    )

    return (
        <div className="space-y-4">
            {filtered.map((product: any) => {
                const commission = product.commission_config?.upfront_pct || 0
                const isBusy = actionId === `toggle_active:${product.id}` || actionId === `certify:${product.id}` || actionId === `delete:${product.id}`
                return (
                    <motion.div key={product.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                        <SpotlightCard className="p-4">
                            <div className="flex items-center gap-4 flex-wrap">
                                <div className="w-12 h-12 rounded-lg bg-purple-500/10 flex items-center justify-center">
                                    <Package className="w-6 h-6 text-purple-400" />
                                </div>

                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <h3 className="font-light truncate">{product.name}</h3>
                                        {product.is_founders_choice && (
                                            <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 flex items-center gap-1">
                                                <Star className="w-3 h-3" fill="currentColor" /> FC
                                            </span>
                                        )}
                                        {product.is_active ? (
                                            <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/10 text-green-400">Active</span>
                                        ) : (
                                            <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/10 text-red-400">Inactive</span>
                                        )}
                                        {product.verified_at ? (
                                            <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400">Certified</span>
                                        ) : (
                                            <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-500/10 text-yellow-400">Uncertified</span>
                                        )}
                                        {product.auto_paused && (
                                            <span className="text-xs px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-400">Auto-paused</span>
                                        )}
                                        <span className="text-xs px-2 py-0.5 rounded-full bg-foreground/5 text-muted-foreground">
                                            Tier {(product as any).trust_tier ?? 0}
                                        </span>
                                    </div>
                                    <p className="text-xs text-muted-foreground truncate">{product.website_url}</p>
                                </div>

                                <div className="text-right text-xs text-muted-foreground">
                                    <div>{commission}% upfront</div>
                                    <div>{fmt(product.price_inr || 0)}</div>
                                </div>

                                <div className="flex items-center gap-2">
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        disabled={isBusy}
                                        onClick={() => runAction('/api/admin/products', { action: 'toggle_active', productId: product.id },
                                            product.is_active ? 'Product paused' : 'Product activated')}
                                    >
                                        {product.is_active ? "Pause" : "Activate"}
                                    </Button>
                                    {!product.verified_at && (
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            disabled={isBusy}
                                            onClick={() => runAction('/api/admin/products', { action: 'certify', productId: product.id },
                                                'Product certified — visible in Vault')}
                                        >
                                            <ShieldCheck className="w-3 h-3 mr-1" /> Certify
                                        </Button>
                                    )}
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        disabled={isBusy}
                                        onClick={() => runAction('/api/admin/products',
                                            { action: 'toggle_founders_choice', productId: product.id },
                                            product.is_founders_choice ? "Removed Founder's Choice" : "Made Founder's Choice")}
                                    >
                                        {product.is_founders_choice ? <StarOff className="w-3 h-3" /> : <Star className="w-3 h-3" />}
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        disabled={isBusy}
                                        className="text-red-400 hover:text-red-300"
                                        onClick={async () => {
                                            const confirmed = await showConfirm({
                                                title: "Remove Product",
                                                message: `Remove "${product.name}" from listings? Records are preserved (soft delete).`,
                                                confirmText: "Remove",
                                                cancelText: "Cancel",
                                                type: "danger",
                                            })
                                            if (confirmed) runAction('/api/admin/products', { action: 'delete', productId: product.id }, 'Product removed from listings')
                                        }}
                                    >
                                        <Trash2 className="w-3 h-3" />
                                    </Button>
                                </div>
                            </div>
                        </SpotlightCard>
                    </motion.div>
                )
            })}
            {filtered.length === 0 && <p className="text-muted-foreground text-sm font-light">No products found.</p>}
        </div>
    )
}

// ============================================================
// TRANSACTIONS
// ============================================================
function TransactionsSection({ transactions, searchQuery, actionId, runAction, showConfirm }: any) {
    const filtered = transactions.filter((t: any) => {
        const q = searchQuery.toLowerCase()
        if (!q) return true
        return (
            (t.external_customer_id || '').toLowerCase().includes(q) ||
            (t.external_transaction_id || '').toLowerCase().includes(q) ||
            (t.seller?.email || '').toLowerCase().includes(q) ||
            (t.products?.name || '').toLowerCase().includes(q) ||
            (t.status || '').toLowerCase().includes(q)
        )
    })

    return (
        <div className="overflow-x-auto rounded-xl border border-border/30">
            <table className="w-full text-sm">
                <thead>
                    <tr className="border-b border-border/30 bg-foreground/[0.03]">
                        <th className="text-left font-light text-muted-foreground px-4 py-3">Created</th>
                        <th className="text-left font-light text-muted-foreground px-4 py-3">Product</th>
                        <th className="text-left font-light text-muted-foreground px-4 py-3">Seller</th>
                        <th className="text-left font-light text-muted-foreground px-4 py-3">Type</th>
                        <th className="text-left font-light text-muted-foreground px-4 py-3">Status</th>
                        <th className="text-right font-light text-muted-foreground px-4 py-3">Commission</th>
                        <th className="text-right font-light text-muted-foreground px-4 py-3">Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {filtered.map((t: any) => {
                        const isBusy = actionId === `release_escrow:${t.id}` || actionId === `mark_refunded:${t.id}`
                        return (
                            <tr key={t.id} className="border-b border-border/20 last:border-0 hover:bg-foreground/[0.02]">
                                <td className="px-4 py-3 text-muted-foreground text-xs whitespace-nowrap">
                                    {new Date(t.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                                    {t.vertical && (
                                        <span className="ml-1 text-[10px] px-1.5 py-0.5 rounded bg-foreground/5 text-muted-foreground">{t.vertical}</span>
                                    )}
                                </td>
                                <td className="px-4 py-3 font-light">{t.products?.name || '—'}</td>
                                <td className="px-4 py-3 text-muted-foreground text-xs">{t.seller?.email || '—'}</td>
                                <td className="px-4 py-3 text-xs">{t.type}</td>
                                <td className="px-4 py-3">
                                    <span className={cn("text-xs px-2 py-1 rounded border", statusBadge(t.status))}>{t.status}</span>
                                    {t.billing_status === 'wallet_insufficient' && (
                                        <span className="ml-1 text-[10px] px-1.5 py-0.5 rounded bg-red-500/10 text-red-400">unpaid</span>
                                    )}
                                </td>
                                <td className="px-4 py-3 text-right font-light whitespace-nowrap">{fmt(t.commission_amount)}</td>
                                <td className="px-4 py-3">
                                    <div className="flex items-center justify-end gap-1.5">
                                        {t.type === 'sale' && t.status === 'pending' && t.billing_status === 'billed' && (
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                disabled={isBusy}
                                                onClick={async () => {
                                                    const confirmed = await showConfirm({
                                                        title: "Release Escrow",
                                                        message: `Release ${fmt(t.commission_amount)} to the seller now? This skips the waiting period.`,
                                                        confirmText: "Release",
                                                        cancelText: "Cancel",
                                                    })
                                                    if (confirmed) runAction('/api/admin/transactions', { action: 'release_escrow', transactionId: t.id }, 'Escrow released')
                                                }}
                                            >
                                                <ArrowUpCircle className="w-3 h-3 mr-1" /> Release
                                            </Button>
                                        )}
                                        {t.type === 'sale' && !['refunded', 'cancelled'].includes(t.status) && (
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                disabled={isBusy}
                                                className="text-red-400"
                                                onClick={async () => {
                                                    const confirmed = await showConfirm({
                                                        title: "Admin Refund",
                                                        message: `Refund ${fmt((t.commission_amount || 0) + (t.platform_fee || 0))} (gross)? Seller pending is clawed back, founder wallet re-credited.`,
                                                        confirmText: "Refund",
                                                        cancelText: "Cancel",
                                                        type: "danger",
                                                    })
                                                    if (confirmed) runAction('/api/admin/transactions', { action: 'mark_refunded', transactionId: t.id }, 'Transaction refunded')
                                                }}
                                            >
                                                <ArrowDownCircle className="w-3 h-3 mr-1" /> Refund
                                            </Button>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        )
                    })}
                    {filtered.length === 0 && (
                        <tr><td colSpan={7} className="px-4 py-6 text-center text-muted-foreground text-sm font-light">No transactions found.</td></tr>
                    )}
                </tbody>
            </table>
        </div>
    )
}

// ============================================================
// DISPUTES
// ============================================================
function DisputesSection({ disputes, fraudReports, actionId, runAction, showConfirm }: any) {
    const pendingReports = fraudReports.filter((r: any) => r.status === 'pending' || r.status === 'verified')

    return (
        <div className="space-y-10">
            {/* Fraud report queue */}
            <div>
                <h2 className="text-lg font-light mb-3 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-orange-400" />
                    Fraud Report Queue ({pendingReports.length})
                </h2>
                {pendingReports.length === 0 && (
                    <p className="text-sm text-muted-foreground font-light">No pending fraud reports. 🎉</p>
                )}
                <div className="space-y-3">
                    {pendingReports.map((r: any) => {
                        const isBusy = actionId === `confirm_fraud:${r.id}` || actionId === `dismiss_fraud:${r.id}`
                        return (
                            <SpotlightCard key={r.id} className="p-4">
                                <div className="flex items-start gap-4 flex-wrap">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="text-xs px-2 py-0.5 rounded bg-orange-500/10 text-orange-400">{r.status}</span>
                                            <span className="text-xs text-muted-foreground">{r.products?.name || 'Product removed'}</span>
                                            <span className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString('en-IN')}</span>
                                        </div>
                                        <p className="text-sm font-light mt-2">{r.description}</p>
                                        {r.evidence_url && r.evidence_url !== 'system_heuristic' && (
                                            <p className="text-xs text-muted-foreground mt-1">Evidence: {r.evidence_url}</p>
                                        )}
                                        <p className="text-xs text-muted-foreground mt-1">
                                            {r.evidence_url === 'system_heuristic' ? '⚙️ System heuristic (self-booking / self-purchase)' : `Reporter: ${r.reporter_id?.slice(0, 8)}`}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            disabled={isBusy}
                                            className="text-green-400"
                                            onClick={() => runAction('/api/admin/disputes', { action: 'confirm_fraud', reportId: r.id }, 'Fraud confirmed')}
                                        >
                                            <Check className="w-3 h-3 mr-1" /> Confirm
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            disabled={isBusy}
                                            className="text-muted-foreground"
                                            onClick={() => runAction('/api/admin/disputes', { action: 'dismiss_fraud', reportId: r.id }, 'Fraud report dismissed')}
                                        >
                                            <X className="w-3 h-3 mr-1" /> Dismiss
                                        </Button>
                                    </div>
                                </div>
                            </SpotlightCard>
                        )
                    })}
                </div>
            </div>

            {/* Disputed transactions */}
            <div>
                <h2 className="text-lg font-light mb-3 flex items-center gap-2">
                    <Scale className="w-4 h-4 text-orange-400" />
                    Disputed Transactions ({disputes.length})
                </h2>
                {disputes.length === 0 && (
                    <p className="text-sm text-muted-foreground font-light">No disputed transactions.</p>
                )}
                <div className="space-y-4">
                    {disputes.map((d: any) => {
                        const isBusy = actionId === `release_tx:${d.id}` || actionId === `refund_tx:${d.id}`
                        return (
                            <SpotlightCard key={d.id} className="p-4">
                                <div className="flex items-start gap-4 flex-wrap">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="text-xs px-2 py-0.5 rounded bg-orange-500/10 text-orange-400">disputed</span>
                                            <span className="text-sm font-light">{d.products?.name || 'Product removed'}</span>
                                            <span className="text-xs text-muted-foreground">
                                                {d.vertical} · {d.external_customer_id || 'no email'} · {d.meeting_start_at ? new Date(d.meeting_start_at).toLocaleString('en-IN') : new Date(d.created_at).toLocaleDateString('en-IN')}
                                            </span>
                                        </div>
                                        <p className="text-xs text-muted-foreground mt-1">
                                            Seller: {d.seller?.email || '—'} · Founder: {d.products?.founder?.email || '—'} · Commission: {fmt(d.commission_amount)}
                                        </p>

                                        {/* Evidence */}
                                        <div className="mt-3 space-y-1">
                                            <p className="text-xs text-muted-foreground uppercase tracking-wider">Evidence</p>
                                            {d.evidence?.length ? (
                                                d.evidence.map((ev: any) => (
                                                    <div key={ev.id} className="flex items-center gap-2 text-xs">
                                                        {ev.url ? (
                                                            <a href={ev.url} target="_blank" rel="noopener noreferrer" className="text-blue-400 underline underline-offset-2 flex items-center gap-1">
                                                                <Eye className="w-3 h-3" /> {ev.note || 'evidence file'}
                                                            </a>
                                                        ) : (
                                                            <span className="text-muted-foreground">{ev.note || 'evidence file'}</span>
                                                        )}
                                                        <span className="text-muted-foreground">· {new Date(ev.created_at).toLocaleDateString('en-IN')}</span>
                                                    </div>
                                                ))
                                            ) : (
                                                <p className="text-xs text-muted-foreground">No evidence uploaded yet.</p>
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex flex-col gap-2">
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            disabled={isBusy}
                                            className="text-green-400"
                                            onClick={async () => {
                                                const confirmed = await showConfirm({
                                                    title: "Release to Seller",
                                                    message: "Dispute dismissed — release escrow to the seller?",
                                                    confirmText: "Release",
                                                    cancelText: "Cancel",
                                                })
                                                if (confirmed) runAction('/api/admin/disputes', { action: 'release_tx', transactionId: d.id }, 'Released to seller')
                                            }}
                                        >
                                            <ArrowUpCircle className="w-3 h-3 mr-1" /> Release to Seller
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            disabled={isBusy}
                                            className="text-red-400"
                                            onClick={async () => {
                                                const confirmed = await showConfirm({
                                                    title: "Refund & Blacklist",
                                                    message: "Dispute upheld — refund the buyer (claw back commission) and blacklist the seller?",
                                                    confirmText: "Refund + Blacklist",
                                                    cancelText: "Cancel",
                                                    type: "danger",
                                                })
                                                if (confirmed) runAction('/api/admin/disputes',
                                                    { action: 'refund_tx', transactionId: d.id, blacklistSeller: true, sellerDisplayName: d.seller?.full_name || 'Seller' },
                                                    'Refunded and seller blacklisted')
                                            }}
                                        >
                                            <Ban className="w-3 h-3 mr-1" /> Refund + Blacklist
                                        </Button>
                                    </div>
                                </div>
                            </SpotlightCard>
                        )
                    })}
                </div>
            </div>
        </div>
    )
}

// ============================================================
// BLACKLIST
// ============================================================
function BlacklistSection({ entries, actionId, runAction, showConfirm }: any) {
    const [name, setName] = useState("")
    const [productName, setProductName] = useState("")
    const [offense, setOffense] = useState("fraud")
    const [profileId, setProfileId] = useState("")

    const handleAdd = async () => {
        if (!name.trim()) {
            toast.error("Display name required")
            return
        }
        await runAction('/api/admin/blacklist', {
            action: 'add',
            display_name: name.trim(),
            product_name: productName.trim() || null,
            offense_code: offense,
            profile_id: profileId.trim() || null,
        }, `Blacklisted "${name.trim()}"`)
        setName("")
        setProductName("")
        setProfileId("")
    }

    const offenseLabels: Record<string, string> = {
        dispute_rate: 'Dispute-rate abuse',
        fraud: 'Confirmed fraud',
        chargeback: 'Chargeback abuse',
        other: 'Policy violation',
    }

    return (
        <div className="space-y-6">
            <SpotlightCard className="p-5">
                <h3 className="font-light mb-3">Add Entry</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <Input placeholder="Display name *" value={name} onChange={(e) => setName(e.target.value)} className="bg-input/30" />
                    <Input placeholder="Product name" value={productName} onChange={(e) => setProductName(e.target.value)} className="bg-input/30" />
                    <Input placeholder="Profile ID (optional)" value={profileId} onChange={(e) => setProfileId(e.target.value)} className="bg-input/30" />
                    <select
                        value={offense}
                        onChange={(e) => setOffense(e.target.value)}
                        className="h-10 px-3 bg-input/30 border border-border/50 rounded-lg text-sm font-light focus:border-foreground/30 focus:outline-none"
                    >
                        {Object.entries(offenseLabels).map(([k, v]) => (
                            <option key={k} value={k} className="bg-background text-foreground">{v}</option>
                        ))}
                    </select>
                </div>
                <Button size="sm" className="mt-3" onClick={handleAdd} disabled={actionId === 'add'}>
                    <Ban className="w-3 h-3 mr-1" /> Add to Blacklist
                </Button>
            </SpotlightCard>

            <div className="overflow-x-auto rounded-xl border border-border/30">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b border-border/30 bg-foreground/[0.03]">
                            <th className="text-left font-light text-muted-foreground px-4 py-3">Name</th>
                            <th className="text-left font-light text-muted-foreground px-4 py-3">Product</th>
                            <th className="text-left font-light text-muted-foreground px-4 py-3">Offense</th>
                            <th className="text-left font-light text-muted-foreground px-4 py-3">Date</th>
                            <th className="text-right font-light text-muted-foreground px-4 py-3"></th>
                        </tr>
                    </thead>
                    <tbody>
                        {entries.map((e: any) => (
                            <tr key={e.id} className="border-b border-border/20 last:border-0 hover:bg-foreground/[0.02]">
                                <td className="px-4 py-3 font-light">{e.display_name}</td>
                                <td className="px-4 py-3 text-muted-foreground">{e.product_name || '—'}</td>
                                <td className="px-4 py-3">
                                    <span className="px-2 py-1 rounded bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
                                        {offenseLabels[e.offense_code] || e.offense_code}
                                    </span>
                                </td>
                                <td className="px-4 py-3 text-muted-foreground text-xs">
                                    {new Date(e.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                                </td>
                                <td className="px-4 py-3 text-right">
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        disabled={actionId === `remove:${e.id}`}
                                        className="text-muted-foreground"
                                        onClick={async () => {
                                            const confirmed = await showConfirm({
                                                title: "Remove from Blacklist",
                                                message: `Remove "${e.display_name}" from the blacklist?`,
                                                confirmText: "Remove",
                                                cancelText: "Cancel",
                                                type: "danger",
                                            })
                                            if (confirmed) runAction('/api/admin/blacklist', { action: 'remove', id: e.id }, 'Removed from blacklist')
                                        }}
                                    >
                                        <X className="w-3 h-3" />
                                    </Button>
                                </td>
                            </tr>
                        ))}
                        {entries.length === 0 && (
                            <tr><td colSpan={5} className="px-4 py-6 text-center text-muted-foreground text-sm font-light">Blacklist is empty.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    )
}

// ============================================================
// USERS
// ============================================================
function UsersSection({ users, searchQuery, actionId, runAction, showConfirm }: any) {
    const [userFilter, setUserFilter] = useState<'all' | 'founder' | 'warlord'>('all')
    const [selectedUser, setSelectedUser] = useState<any | null>(null)
    const [balanceField, setBalanceField] = useState<'pending_balance' | 'withdrawable_balance' | 'wallet_balance'>('withdrawable_balance')
    const [balanceDelta, setBalanceDelta] = useState("")
    const [balanceNote, setBalanceNote] = useState("")
    const [msgTitle, setMsgTitle] = useState("")
    const [msgContent, setMsgContent] = useState("")

    const filteredByRole = users.filter((u: any) => {
        if (userFilter === 'all') return true
        return u.role === userFilter
    })

    const filtered = filteredByRole.filter((u: any) => {
        const q = searchQuery.toLowerCase()
        if (!q) return true
        return (u.email || '').toLowerCase().includes(q) || (u.full_name || '').toLowerCase().includes(q)
    })

    const founders = users.filter((u: any) => u.role === 'founder')
    const sellers = users.filter((u: any) => u.role === 'warlord')

    const applyBalance = async () => {
        if (!selectedUser) return
        const deltaPaise = Math.round(parseFloat(balanceDelta) * 100)
        if (!Number.isFinite(deltaPaise) || deltaPaise === 0) {
            toast.error("Enter a non-zero amount in ₹")
            return
        }
        const confirmed = await showConfirm({
            title: "Adjust Balance",
            message: `${deltaPaise > 0 ? 'Credit' : 'Debit'} ${fmt(Math.abs(deltaPaise))} ${balanceField === 'wallet_balance' ? 'to wallet' : balanceField === 'pending_balance' ? 'to pending' : 'to withdrawable'} for ${selectedUser.full_name || selectedUser.email}?`,
            confirmText: "Apply",
            cancelText: "Cancel",
            type: deltaPaise > 0 ? undefined : "danger",
        })
        if (!confirmed) return
        await runAction('/api/admin/users', {
            action: 'adjust_balance',
            userId: selectedUser.id,
            field: balanceField,
            delta: deltaPaise,
            note: balanceNote.trim() || undefined,
        }, 'Balance adjusted')
        setBalanceDelta("")
        setBalanceNote("")
    }

    const changeRole = async (newRole: string) => {
        if (!selectedUser) return
        const confirmed = await showConfirm({
            title: "Change Role",
            message: `Change ${selectedUser.full_name || selectedUser.email} from ${selectedUser.role} to ${newRole}?`,
            confirmText: "Change",
            cancelText: "Cancel",
        })
        if (!confirmed) return
        await runAction('/api/admin/users', { action: 'set_role', userId: selectedUser.id, role: newRole }, 'Role updated')
        setSelectedUser(null)
    }

    const sendMessage = async () => {
        if (!selectedUser) return
        if (!msgContent.trim()) {
            toast.error("Message content cannot be empty")
            return
        }
        await runAction('/api/admin/users', {
            action: 'send_message',
            userId: selectedUser.id,
            title: msgTitle,
            message: msgContent
        }, 'Message sent')
        setMsgTitle("")
        setMsgContent("")
    }

    return (
        <div className="space-y-6">
            {/* Role Filter Tabs */}
            <div className="flex gap-2">
                <button
                    onClick={() => setUserFilter('all')}
                    className={cn(
                        "px-4 py-2 rounded-lg text-sm font-light transition-all",
                        userFilter === 'all' ? "bg-foreground text-background" : "bg-foreground/5 text-muted-foreground hover:bg-foreground/10"
                    )}
                >
                    All ({users.length})
                </button>
                <button
                    onClick={() => setUserFilter('founder')}
                    className={cn(
                        "px-4 py-2 rounded-lg text-sm font-light transition-all",
                        userFilter === 'founder' ? "bg-purple-500 text-white" : "bg-purple-500/10 text-purple-400 hover:bg-purple-500/20"
                    )}
                >
                    Founders ({founders.length})
                </button>
                <button
                    onClick={() => setUserFilter('warlord')}
                    className={cn(
                        "px-4 py-2 rounded-lg text-sm font-light transition-all",
                        userFilter === 'warlord' ? "bg-blue-500 text-white" : "bg-blue-500/10 text-blue-400 hover:bg-blue-500/20"
                    )}
                >
                    Sellers ({sellers.length})
                </button>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
                {/* User list */}
                <div className="space-y-3">
                    {filtered.map((u: any) => (
                        <motion.div key={u.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                            <SpotlightCard
                                className={cn("p-4 cursor-pointer hover:border-foreground/20 transition-all", selectedUser?.id === u.id && "border-foreground/40")}
                                onClick={() => { setSelectedUser(u); setBalanceDelta(""); setBalanceNote("") }}
                            >
                                <div className="flex items-center gap-4">
                                    <div className={cn(
                                        "w-12 h-12 rounded-full flex items-center justify-center text-lg font-light",
                                        u.role === 'founder' ? "bg-purple-500/10 text-purple-400" : "bg-blue-500/10 text-blue-400"
                                    )}>
                                        {u.full_name?.charAt(0).toUpperCase() || "U"}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h3 className="font-light truncate">{u.full_name || "No name"}</h3>
                                        <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                                    </div>
                                    <div className="text-right">
                                        <span className={cn(
                                            "text-xs px-2 py-1 rounded-full",
                                            u.role === "founder" ? "bg-purple-500/10 text-purple-400" : "bg-blue-500/10 text-blue-400"
                                        )}>
                                            {u.role === "founder" ? "Founder" : "Warlord"}
                                        </span>
                                        <div className="text-[10px] text-muted-foreground mt-1">
                                            P {fmt(u.pending_balance)} · W {fmt(u.withdrawable_balance)}
                                        </div>
                                    </div>
                                </div>
                            </SpotlightCard>
                        </motion.div>
                    ))}
                    {filtered.length === 0 && <p className="text-sm text-muted-foreground font-light">No users found.</p>}
                </div>

                {/* Detail / actions */}
                {selectedUser ? (
                    <SpotlightCard className="p-6 h-fit">
                        <div className="flex items-start justify-between mb-4">
                            <div>
                                <h3 className="text-xl font-light">{selectedUser.full_name || "No name"}</h3>
                                <p className="text-sm text-muted-foreground">{selectedUser.email}</p>
                            </div>
                            <button onClick={() => setSelectedUser(null)} className="text-muted-foreground hover:text-foreground">
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        <div className="grid grid-cols-3 gap-3 mb-6">
                            <div className="p-3 rounded-lg bg-foreground/5">
                                <p className="text-[10px] text-muted-foreground uppercase">Pending</p>
                                <p className="text-lg font-light">{fmt(selectedUser.pending_balance)}</p>
                            </div>
                            <div className="p-3 rounded-lg bg-foreground/5">
                                <p className="text-[10px] text-muted-foreground uppercase">Withdrawable</p>
                                <p className="text-lg font-light">{fmt(selectedUser.withdrawable_balance)}</p>
                            </div>
                            <div className="p-3 rounded-lg bg-foreground/5">
                                <p className="text-[10px] text-muted-foreground uppercase">Wallet</p>
                                <p className="text-lg font-light">{fmt(selectedUser.wallet_balance)}</p>
                            </div>
                        </div>

                        {/* Role */}
                        <div className="mb-6">
                            <p className="text-xs text-muted-foreground mb-2">Role</p>
                            <div className="flex gap-2">
                                <Button size="sm" variant={selectedUser.role === 'founder' ? "default" : "outline"} disabled={selectedUser.role === 'founder'} onClick={() => changeRole('founder')}>
                                    Founder
                                </Button>
                                <Button size="sm" variant={selectedUser.role === 'warlord' ? "default" : "outline"} disabled={selectedUser.role === 'warlord'} onClick={() => changeRole('warlord')}>
                                    Warlord
                                </Button>
                            </div>
                        </div>

                        {/* Balance adjustment */}
                        <div>
                            <p className="text-xs text-muted-foreground mb-2">Adjust Balance (₹)</p>
                            <div className="space-y-2">
                                <select
                                    value={balanceField}
                                    onChange={(e) => setBalanceField(e.target.value as any)}
                                    className="w-full h-10 px-3 bg-input/30 border border-border/50 rounded-lg text-sm font-light focus:border-foreground/30 focus:outline-none"
                                >
                                    <option value="withdrawable_balance" className="bg-background text-foreground">Withdrawable</option>
                                    <option value="pending_balance" className="bg-background text-foreground">Pending</option>
                                    <option value="wallet_balance" className="bg-background text-foreground">Wallet</option>
                                </select>
                                <Input
                                    type="number"
                                    placeholder="+500 or -200"
                                    value={balanceDelta}
                                    onChange={(e) => setBalanceDelta(e.target.value)}
                                    className="bg-input/30"
                                />
                                <Input
                                    placeholder="Reason (logged to audit trail)"
                                    value={balanceNote}
                                    onChange={(e) => setBalanceNote(e.target.value)}
                                    className="bg-input/30"
                                />
                                <Button size="sm" className="w-full" onClick={applyBalance} disabled={actionId === `adjust_balance:${selectedUser.id}`}>
                                    Apply Balance Change
                                </Button>
                            </div>
                        </div>

                        {/* Send Message */}
                        <div className="mt-6 pt-6 border-t border-border/30">
                            <p className="text-xs text-muted-foreground mb-2">Send Message (Notification)</p>
                            <div className="space-y-2">
                                <Input
                                    placeholder="Title (Optional)"
                                    value={msgTitle}
                                    onChange={(e) => setMsgTitle(e.target.value)}
                                    className="bg-input/30"
                                />
                                <textarea
                                    placeholder="Type your message here..."
                                    value={msgContent}
                                    onChange={(e) => setMsgContent(e.target.value)}
                                    className="w-full min-h-[80px] p-3 bg-input/30 border border-border/50 rounded-lg text-sm font-light focus:border-foreground/30 focus:outline-none resize-y"
                                />
                                <Button size="sm" className="w-full" onClick={sendMessage} disabled={actionId === 'send_message'}>
                                    Send Notification
                                </Button>
                            </div>
                        </div>

                        {/* Danger Zone */}
                        <div className="mt-8 pt-6 border-t border-border/30">
                            <p className="text-xs text-red-500/80 mb-2 font-medium">Danger Zone</p>
                            <Button 
                                size="sm" 
                                variant="outline" 
                                className="w-full bg-red-500/5 text-red-500 border-red-500/20 hover:bg-red-500/10 hover:text-red-400"
                                onClick={async () => {
                                    const confirmed = await showConfirm({
                                        title: "Blacklist User",
                                        message: `Are you sure you want to permanently blacklist ${selectedUser.full_name || selectedUser.email}?`,
                                        confirmText: "Blacklist",
                                        cancelText: "Cancel",
                                        type: "danger"
                                    })
                                    if (confirmed) {
                                        await runAction('/api/admin/blacklist', {
                                            action: 'add',
                                            profile_id: selectedUser.id,
                                            display_name: selectedUser.full_name || selectedUser.email,
                                            offense_code: 'other',
                                            note: 'Manually blocked by admin from Users tab'
                                        }, 'User blacklisted')
                                    }
                                }}
                            >
                                Blacklist / Block User
                            </Button>
                        </div>
                    </SpotlightCard>
                ) : (
                    <SpotlightCard className="p-6 h-fit text-center text-muted-foreground font-light text-sm">
                        Select a user to manage roles and balances.
                    </SpotlightCard>
                )}
            </div>
        </div>
    )
}
