import { createBrowserClient } from '@supabase/ssr'
import type { Database } from './database.types'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

export function createClient() {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      'Missing Supabase environment variables. Please create .env.local with NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY'
    )
  }

  return createBrowserClient<Database>(supabaseUrl, supabaseAnonKey)
}

// Singleton instance for client-side usage
let supabase: ReturnType<typeof createClient> | null = null

export function getSupabaseClient() {
  if (!supabase) {
    supabase = createClient()
  }
  return supabase
}
