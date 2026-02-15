"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
    LayoutDashboard, Package, Users, Settings, LogOut, Search,
    Loader2, Star, StarOff, Eye, Trash2, ArrowLeft, Check
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { Logo } from "@/components/logo"
import { SpotlightCard } from "@/components/ui/spotlight-card"
import Link from "next/link"
import { useAuth } from "@/components/auth-provider"
import { createClient } from "@/lib/supabase"
import { useConfirm } from "@/components/confirm-provider"
import { toast } from "sonner"

// Admin emails - only these users can access admin dashboard
const ADMIN_EMAILS = [
    "aryansharma24112003@gmail.com"
]

type AdminTab = "products" | "users"

interface Product {
    id: string
    name: string
    website_url: string
    is_active: boolean
    is_founders_choice: boolean
    commission_config: any
    created_at: string
    founder_id: string
}

interface User {
    id: string
    email: string
    full_name: string
    role: string
    created_at: string
}

export default function AdminDashboard() {
    const { user, isLoading: authLoading, signOut } = useAuth()
    const { showConfirm } = useConfirm()
    const [activeTab, setActiveTab] = useState<AdminTab>("products")
    const [products, setProducts] = useState<Product[]>([])
    const [users, setUsers] = useState<User[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [searchQuery, setSearchQuery] = useState("")
    const [togglingId, setTogglingId] = useState<string | null>(null)

    // Check if user is admin
    const isAdmin = user?.email && ADMIN_EMAILS.includes(user.email)

    // Fetch data
    useEffect(() => {
        async function fetchData() {
            if (!user || !isAdmin) return

            try {
                // Use admin API to bypass RLS and get all data
                const response = await fetch('/api/admin/data')
                const data = await response.json()

                if (response.ok) {
                    setProducts(data.products || [])
                    setUsers(data.users || [])
                }
            } catch (err) {
                console.error('Failed to fetch admin data:', err)
            }

            setIsLoading(false)
        }

        if (user && isAdmin) {
            fetchData()
        } else if (!authLoading) {
            setIsLoading(false)
        }
    }, [user, isAdmin, authLoading])

    const toggleFoundersChoice = async (product: Product) => {
        setTogglingId(product.id)
        try {
            const response = await fetch('/api/admin/products', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'toggle_founders_choice', productId: product.id })
            })
            const data = await response.json()

            if (response.ok) {
                setProducts(prev =>
                    prev.map(p =>
                        p.id === product.id
                            ? { ...p, is_founders_choice: data.is_founders_choice }
                            : p
                    )
                )
            }
        } catch (err) {
            console.error("Failed to toggle:", err)
        }
        setTogglingId(null)
    }

    const toggleProductActive = async (product: Product) => {
        setTogglingId(product.id)
        try {
            const response = await fetch('/api/admin/products', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'toggle_active', productId: product.id })
            })
            const data = await response.json()

            if (response.ok) {
                setProducts(prev =>
                    prev.map(p =>
                        p.id === product.id
                            ? { ...p, is_active: data.is_active }
                            : p
                    )
                )
            }
        } catch (err) {
            console.error("Failed to toggle active:", err)
        }
        setTogglingId(null)
    }

    const deleteProduct = async (product: Product) => {
        const confirmed = await showConfirm({
            title: "Delete Product",
            message: `Delete "${product.name}"? This will also delete all related links and transactions.`,
            confirmText: "Delete",
            cancelText: "Cancel",
            type: "danger"
        })

        if (!confirmed) return

        setTogglingId(product.id)
        try {
            const response = await fetch('/api/admin/products', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'delete', productId: product.id })
            })

            if (response.ok) {
                setProducts(prev => prev.filter(p => p.id !== product.id))
                toast.success(`"${product.name}" deleted successfully`)
            } else {
                toast.error("Failed to delete product")
            }
        } catch (err) {
            console.error("Failed to delete:", err)
            toast.error("Failed to delete product")
        }
        setTogglingId(null)
    }

    // Loading state
    if (authLoading || isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
        )
    }

    // Not logged in or not admin
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

    // Filter products by search
    const filteredProducts = products.filter(p =>
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.website_url.toLowerCase().includes(searchQuery.toLowerCase())
    )

    // Filter users by search
    const filteredUsers = users.filter(u =>
        u.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.email?.toLowerCase().includes(searchQuery.toLowerCase())
    )

    return (
        <div className="min-h-screen bg-background">
            {/* Sidebar */}
            <div className="fixed left-0 top-0 h-screen w-64 border-r border-border/30 bg-background/80 backdrop-blur-xl p-6 flex flex-col">
                <div className="flex items-center gap-3 mb-8">
                    <Logo className="h-8" />
                    <span className="text-xs px-2 py-1 rounded bg-red-500/10 text-red-400 font-medium">ADMIN</span>
                </div>

                <nav className="space-y-2 flex-1">
                    <button
                        onClick={() => setActiveTab("products")}
                        className={cn(
                            "w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-light transition-all",
                            activeTab === "products"
                                ? "bg-foreground/10 text-foreground"
                                : "text-muted-foreground hover:text-foreground hover:bg-foreground/5"
                        )}
                    >
                        <Package className="w-4 h-4" />
                        Products
                        <span className="ml-auto text-xs bg-foreground/10 px-2 py-0.5 rounded">{products.length}</span>
                    </button>

                    <button
                        onClick={() => setActiveTab("users")}
                        className={cn(
                            "w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-light transition-all",
                            activeTab === "users"
                                ? "bg-foreground/10 text-foreground"
                                : "text-muted-foreground hover:text-foreground hover:bg-foreground/5"
                        )}
                    >
                        <Users className="w-4 h-4" />
                        Users
                        <span className="ml-auto text-xs bg-foreground/10 px-2 py-0.5 rounded">{users.length}</span>
                    </button>
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
                    {/* Header */}
                    <div className="flex items-center justify-between mb-8">
                        <div>
                            <h1 className="text-3xl font-light tracking-tight">
                                {activeTab === "products" ? "Products" : "Users"}
                            </h1>
                            <p className="text-muted-foreground font-light">
                                {activeTab === "products"
                                    ? "Manage all products and set Founder's Choice"
                                    : "View and manage all users"}
                            </p>
                        </div>

                        <div className="relative w-64">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <Input
                                placeholder="Search..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-10 bg-input/30"
                            />
                        </div>
                    </div>

                    {/* Products Tab */}
                    {activeTab === "products" && (
                        <div className="space-y-4">
                            {filteredProducts.map((product) => {
                                const commission = product.commission_config?.upfront_pct || 0
                                return (
                                    <motion.div
                                        key={product.id}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                    >
                                        <SpotlightCard className="p-4">
                                            <div className="flex items-center gap-4">
                                                <div className="w-12 h-12 rounded-lg bg-purple-500/10 flex items-center justify-center">
                                                    <Package className="w-6 h-6 text-purple-400" />
                                                </div>

                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        <h3 className="font-light truncate">{product.name}</h3>
                                                        {product.is_founders_choice && (
                                                            <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 flex items-center gap-1">
                                                                <Star className="w-3 h-3" fill="currentColor" />
                                                                Founder's Choice
                                                            </span>
                                                        )}
                                                        {!product.is_active && (
                                                            <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/10 text-red-400">
                                                                Inactive
                                                            </span>
                                                        )}
                                                    </div>
                                                    <p className="text-xs text-muted-foreground truncate">{product.website_url}</p>
                                                </div>

                                                <div className="text-right mr-4">
                                                    <p className="text-lg font-light text-green-400">{commission}%</p>
                                                    <p className="text-xs text-muted-foreground">Commission</p>
                                                </div>

                                                <div className="flex items-center gap-2">
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        onClick={() => toggleFoundersChoice(product)}
                                                        disabled={togglingId === product.id}
                                                        className={cn(
                                                            "h-9",
                                                            product.is_founders_choice
                                                                ? "border-amber-500/50 text-amber-400 hover:bg-amber-500/10"
                                                                : ""
                                                        )}
                                                    >
                                                        {togglingId === product.id ? (
                                                            <Loader2 className="w-4 h-4 animate-spin" />
                                                        ) : product.is_founders_choice ? (
                                                            <>
                                                                <Star className="w-4 h-4 mr-1" fill="currentColor" />
                                                                Featured
                                                            </>
                                                        ) : (
                                                            <>
                                                                <StarOff className="w-4 h-4 mr-1" />
                                                                Feature
                                                            </>
                                                        )}
                                                    </Button>

                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        onClick={() => toggleProductActive(product)}
                                                        disabled={togglingId === product.id}
                                                        className={cn(
                                                            "h-9",
                                                            !product.is_active
                                                                ? "border-red-500/50 text-red-400"
                                                                : "border-green-500/50 text-green-400"
                                                        )}
                                                    >
                                                        {togglingId === product.id ? (
                                                            <Loader2 className="w-4 h-4 animate-spin" />
                                                        ) : (
                                                            product.is_active ? "Active" : "Paused"
                                                        )}
                                                    </Button>

                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        onClick={() => deleteProduct(product)}
                                                        disabled={togglingId === product.id}
                                                        className="h-9 border-red-500/30 text-red-400 hover:bg-red-500/10 hover:border-red-500/50"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </Button>
                                                </div>
                                            </div>
                                        </SpotlightCard>
                                    </motion.div>
                                )
                            })}

                            {filteredProducts.length === 0 && (
                                <div className="text-center py-12 text-muted-foreground">
                                    No products found
                                </div>
                            )}
                        </div>
                    )}

                    {/* Users Tab */}
                    {activeTab === "users" && (
                        <UsersSection users={filteredUsers} searchQuery={searchQuery} />
                    )}
                </div>
            </div>
        </div>
    )
}

// Separate Users Section Component with tabs and modal
function UsersSection({ users, searchQuery }: { users: User[]; searchQuery: string }) {
    const [userFilter, setUserFilter] = useState<'all' | 'founder' | 'warlord'>('all')
    const [selectedUser, setSelectedUser] = useState<User | null>(null)
    const [copied, setCopied] = useState(false)

    const filteredByRole = users.filter(u => {
        if (userFilter === 'all') return true
        return u.role === userFilter
    })

    const founders = users.filter(u => u.role === 'founder')
    const sellers = users.filter(u => u.role === 'warlord')

    const handleCopyEmail = async (email: string) => {
        await navigator.clipboard.writeText(email)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
    }

    return (
        <div className="space-y-6">
            {/* Role Filter Tabs */}
            <div className="flex gap-2">
                <button
                    onClick={() => setUserFilter('all')}
                    className={cn(
                        "px-4 py-2 rounded-lg text-sm font-light transition-all",
                        userFilter === 'all'
                            ? "bg-foreground text-background"
                            : "bg-foreground/5 text-muted-foreground hover:bg-foreground/10"
                    )}
                >
                    All ({users.length})
                </button>
                <button
                    onClick={() => setUserFilter('founder')}
                    className={cn(
                        "px-4 py-2 rounded-lg text-sm font-light transition-all",
                        userFilter === 'founder'
                            ? "bg-purple-500 text-white"
                            : "bg-purple-500/10 text-purple-400 hover:bg-purple-500/20"
                    )}
                >
                    Founders ({founders.length})
                </button>
                <button
                    onClick={() => setUserFilter('warlord')}
                    className={cn(
                        "px-4 py-2 rounded-lg text-sm font-light transition-all",
                        userFilter === 'warlord'
                            ? "bg-blue-500 text-white"
                            : "bg-blue-500/10 text-blue-400 hover:bg-blue-500/20"
                    )}
                >
                    Sellers ({sellers.length})
                </button>
            </div>

            {/* User Cards */}
            <div className="space-y-3">
                {filteredByRole.map((user) => (
                    <motion.div
                        key={user.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                    >
                        <SpotlightCard
                            className="p-4 cursor-pointer hover:border-foreground/20 transition-all"
                            onClick={() => setSelectedUser(user)}
                        >
                            <div className="flex items-center gap-4">
                                <div className={cn(
                                    "w-12 h-12 rounded-full flex items-center justify-center text-lg font-light",
                                    user.role === 'founder' ? "bg-purple-500/10 text-purple-400" : "bg-blue-500/10 text-blue-400"
                                )}>
                                    {user.full_name?.charAt(0).toUpperCase() || "U"}
                                </div>

                                <div className="flex-1">
                                    <h3 className="font-light">{user.full_name || "No name"}</h3>
                                    <p className="text-xs text-muted-foreground">{user.email}</p>
                                </div>

                                <div className="text-right">
                                    <span className={cn(
                                        "text-xs px-2 py-1 rounded-full",
                                        user.role === "founder"
                                            ? "bg-purple-500/10 text-purple-400"
                                            : "bg-blue-500/10 text-blue-400"
                                    )}>
                                        {user.role === "founder" ? "Founder" : "Warlord"}
                                    </span>
                                </div>

                                <p className="text-xs text-muted-foreground">
                                    {new Date(user.created_at).toLocaleDateString()}
                                </p>
                            </div>
                        </SpotlightCard>
                    </motion.div>
                ))}

                {filteredByRole.length === 0 && (
                    <div className="text-center py-12 text-muted-foreground">
                        No users found
                    </div>
                )}
            </div>

            {/* User Detail Modal */}
            <AnimatePresence>
                {selectedUser && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[100] flex items-center justify-center p-4"
                        onClick={() => setSelectedUser(null)}
                    >
                        <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="relative w-full max-w-md"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <SpotlightCard className="p-6">
                                {/* Header */}
                                <div className="flex items-center gap-4 mb-6">
                                    <div className={cn(
                                        "w-16 h-16 rounded-full flex items-center justify-center text-2xl font-light",
                                        selectedUser.role === 'founder' ? "bg-purple-500/10 text-purple-400" : "bg-blue-500/10 text-blue-400"
                                    )}>
                                        {selectedUser.full_name?.charAt(0).toUpperCase() || "U"}
                                    </div>
                                    <div>
                                        <h2 className="text-xl font-light">{selectedUser.full_name || "No name"}</h2>
                                        <span className={cn(
                                            "text-xs px-2 py-1 rounded-full",
                                            selectedUser.role === "founder"
                                                ? "bg-purple-500/10 text-purple-400"
                                                : "bg-blue-500/10 text-blue-400"
                                        )}>
                                            {selectedUser.role === "founder" ? "Founder" : "Warlord (Seller)"}
                                        </span>
                                    </div>
                                </div>

                                {/* Contact Info */}
                                <div className="space-y-4">
                                    <div className="p-4 rounded-lg bg-foreground/5 border border-border/30">
                                        <p className="text-xs text-muted-foreground mb-1">Email</p>
                                        <div className="flex items-center justify-between">
                                            <p className="font-light text-sm">{selectedUser.email}</p>
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() => handleCopyEmail(selectedUser.email)}
                                                className="h-8"
                                            >
                                                {copied ? (
                                                    <><Check className="w-3 h-3 mr-1 text-green-400" /> Copied</>
                                                ) : (
                                                    "Copy"
                                                )}
                                            </Button>
                                        </div>
                                    </div>

                                    <div className="p-4 rounded-lg bg-foreground/5 border border-border/30">
                                        <p className="text-xs text-muted-foreground mb-1">User ID</p>
                                        <p className="font-mono text-xs text-muted-foreground">{selectedUser.id}</p>
                                    </div>

                                    <div className="p-4 rounded-lg bg-foreground/5 border border-border/30">
                                        <p className="text-xs text-muted-foreground mb-1">Joined</p>
                                        <p className="font-light text-sm">
                                            {new Date(selectedUser.created_at).toLocaleDateString('en-IN', {
                                                weekday: 'long',
                                                year: 'numeric',
                                                month: 'long',
                                                day: 'numeric'
                                            })}
                                        </p>
                                    </div>
                                </div>

                                {/* Actions */}
                                <div className="mt-6 flex gap-3">
                                    <a
                                        href={`mailto:${selectedUser.email}`}
                                        className="flex-1"
                                    >
                                        <Button className="w-full bg-foreground text-background hover:bg-foreground/90">
                                            Send Email
                                        </Button>
                                    </a>
                                    <Button
                                        variant="outline"
                                        onClick={() => setSelectedUser(null)}
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

