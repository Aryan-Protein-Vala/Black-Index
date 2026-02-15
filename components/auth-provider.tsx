'use client'

import { createContext, useContext, useEffect, useState, useRef, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import type { User, Session, SupabaseClient } from '@supabase/supabase-js'
import type { Profile, Database } from '@/lib/database.types'

interface AuthContextType {
    user: User | null
    profile: Profile | null
    session: Session | null
    isLoading: boolean
    signIn: (email: string, password: string) => Promise<{ error: Error | null }>
    signUp: (email: string, password: string, fullName: string) => Promise<{ error: Error | null }>
    signOut: () => Promise<void>
    refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null)
    const [profile, setProfile] = useState<Profile | null>(null)
    const [session, setSession] = useState<Session | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const router = useRouter()

    // Lazy initialize supabase client (only on client-side)
    const supabaseRef = useRef<SupabaseClient<Database> | null>(null)

    function getSupabase() {
        if (!supabaseRef.current) {
            supabaseRef.current = createClient()
        }
        return supabaseRef.current
    }

    // Fetch user profile via API route (bypasses RLS)
    async function fetchProfile(userId: string): Promise<Profile | null> {
        try {
            const response = await fetch(`/api/profile?userId=${userId}`)
            if (!response.ok) {
                return { id: userId, role: 'warlord' } as Profile
            }
            const data = await response.json()
            return data as Profile
        } catch (err) {
            console.error('Profile fetch error:', err)
            return { id: userId, role: 'warlord' } as Profile
        }
    }

    // Refresh profile data
    async function refreshProfile() {
        if (user) {
            const profileData = await fetchProfile(user.id)
            setProfile(profileData)
        }
    }

    useEffect(() => {
        const supabase = getSupabase()
        let mounted = true

        // Initialize auth state
        async function initAuth() {
            try {
                // Get the current session
                const { data: { session }, error } = await supabase.auth.getSession()

                if (error) {
                    console.error('getSession error:', error.message)
                    if (mounted) setIsLoading(false)
                    return
                }

                if (mounted) {
                    setSession(session)
                    setUser(session?.user ?? null)

                    // Fetch profile if we have a user
                    if (session?.user) {
                        const profileData = await fetchProfile(session.user.id)
                        if (mounted) setProfile(profileData)
                    }

                    setIsLoading(false)
                }
            } catch (err) {
                console.error('initAuth error:', err)
                if (mounted) setIsLoading(false)
            }
        }

        initAuth()

        // Listen for subsequent auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            async (event, session) => {
                if (!mounted) return

                setSession(session)
                setUser(session?.user ?? null)

                if (session?.user) {
                    const profileData = await fetchProfile(session.user.id)
                    if (mounted) setProfile(profileData)
                } else {
                    setProfile(null)
                }
            }
        )

        return () => {
            mounted = false
            subscription.unsubscribe()
        }
    }, [])

    // Sign in with email/password
    async function signIn(email: string, password: string) {
        const supabase = getSupabase()
        const { error } = await supabase.auth.signInWithPassword({
            email,
            password,
        })

        if (!error) {
            router.push('/dashboard')
        }

        return { error: error as Error | null }
    }

    // Sign up with email/password
    // Note: Does NOT auto-redirect - user must verify email first
    async function signUp(email: string, password: string, fullName: string) {
        const supabase = getSupabase()

        // Determine redirect URL based on environment
        const baseUrl = typeof window !== 'undefined'
            ? window.location.origin
            : 'https://blackindex.in'

        const { error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: {
                    full_name: fullName,
                },
                emailRedirectTo: `${baseUrl}/dashboard`,
            },
        })

        // Don't redirect - user needs to verify email first
        return { error: error as Error | null }
    }

    // Sign out
    async function signOut() {
        const supabase = getSupabase()
        await supabase.auth.signOut()
        setUser(null)
        setProfile(null)
        setSession(null)
        router.push('/')
    }

    const value = {
        user,
        profile,
        session,
        isLoading,
        signIn,
        signUp,
        signOut,
        refreshProfile,
    }

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
    const context = useContext(AuthContext)
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider')
    }
    return context
}

