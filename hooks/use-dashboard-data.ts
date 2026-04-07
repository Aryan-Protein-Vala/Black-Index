'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { useAuth } from '@/components/auth-provider'
import type { Product, Transaction, Link, Profile } from '@/lib/database.types'

// Hook to fetch all products (The Armoury)
export function useProducts() {
    const [products, setProducts] = useState<Product[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<Error | null>(null)

    useEffect(() => {
        async function fetchProducts() {
            try {
                const response = await fetch('/api/products?active=true')
                const data = await response.json()

                if (!response.ok) {
                    throw new Error(data.error || 'Failed to fetch products')
                }

                setProducts(data.products)
            } catch (err) {
                setError(err as Error)
            } finally {
                setIsLoading(false)
            }
        }

        fetchProducts()
    }, [])

    return { products, isLoading, error }
}

// Hook to fetch user's links
export function useLinks() {
    const [links, setLinks] = useState<(Link & { url: string; products: Partial<Product> })[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<Error | null>(null)

    useEffect(() => {
        async function fetchLinks() {
            try {
                const response = await fetch('/api/links/generate')
                const data = await response.json()

                if (!response.ok) {
                    if (response.status === 401) {
                        setIsLoading(false)
                        return
                    }
                    throw new Error(data.error || 'Failed to fetch links')
                }

                setLinks(data.links)
            } catch (err) {
                setError(err as Error)
            } finally {
                setIsLoading(false)
            }
        }

        fetchLinks()
    }, [])

    const generateLink = async (productId: string, customSlug?: string) => {
        const response = await fetch('/api/links/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ product_id: productId, custom_slug: customSlug }),
        })

        const data = await response.json()

        if (!response.ok) {
            throw new Error(data.error || 'Failed to generate link')
        }

        // Add to local state
        setLinks(prev => [{ ...data.link, url: data.url }, ...prev])

        return data
    }

    return { links, isLoading, error, generateLink }
}

// Hook to fetch user's transactions with realtime updates
export function useTransactions() {
    const { user } = useAuth()
    const [transactions, setTransactions] = useState<Transaction[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<Error | null>(null)

    useEffect(() => {
        if (!user) {
            setIsLoading(false)
            return
        }

        const supabase = createClient()

        // Initial fetch
        async function fetchTransactions() {
            try {
                const { data, error } = await supabase
                    .from('transactions')
                    .select('*')
                    .eq('seller_id', user!.id)
                    .order('created_at', { ascending: false })
                    .limit(50)

                if (error) throw error
                setTransactions(data || [])
            } catch (err) {
                setError(err as Error)
            } finally {
                setIsLoading(false)
            }
        }

        fetchTransactions()

        // Set up realtime subscription
        const channelName = `tx-${user!.id}-${Math.random().toString(36).slice(2)}`
        const channel = supabase
            .channel(channelName)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'transactions',
                    filter: `seller_id=eq.${user!.id}`,
                },
                (payload) => {
                    setTransactions(prev => [payload.new as Transaction, ...prev])
                }
            )
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'transactions',
                    filter: `seller_id=eq.${user!.id}`,
                },
                (payload) => {
                    setTransactions(prev =>
                        prev.map(tx => tx.id === payload.new.id ? payload.new as Transaction : tx)
                    )
                }
            )
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [user])

    return { transactions, isLoading, error }
}

// Hook to get dashboard stats
export function useDashboardStats() {
    const { profile } = useAuth()
    const { transactions } = useTransactions()

    // Calculate stats from transactions
    const stats = {
        totalEarnings: profile?.total_earnings || 0,
        pendingBalance: profile?.pending_balance || 0,
        withdrawableBalance: profile?.withdrawable_balance || 0,
        thisWeekEarnings: 0,
        conversions: transactions.filter(tx => tx.type === 'sale').length,
        pendingConversions: transactions.filter(tx => tx.status === 'pending').length,
    }

    // Calculate this week's earnings
    const oneWeekAgo = new Date()
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7)

    stats.thisWeekEarnings = transactions
        .filter(tx =>
            tx.type === 'sale' &&
            new Date(tx.created_at) > oneWeekAgo
        )
        .reduce((sum, tx) => sum + tx.commission_amount, 0)

    return stats
}

// Format currency (paise to rupees)
export function formatCurrency(paise: number): string {
    const rupees = paise / 100
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(rupees)
}

// Format relative time
export function formatRelativeTime(dateString: string): string {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins} min ago`
    if (diffHours < 24) return `${diffHours} hr ago`
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`

    return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}
