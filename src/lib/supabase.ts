/**
 * Frontend Supabase client (anon key — read-only public data).
 *
 * The backend uses the SERVICE_ROLE key to write github_profiles.
 * The frontend client uses the ANON key for read-only queries if needed,
 * and for any future Supabase Realtime or Storage features.
 *
 * All auth-sensitive operations (OAuth, token storage) stay on the backend.
 */
import { createClient } from "@supabase/supabase-js"

const supabaseUrl     = import.meta.env.VITE_SUPABASE_URL     as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    "[CodeSage] VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY is not set. " +
    "Supabase features will be unavailable."
  )
}

export const supabase = createClient(
  supabaseUrl  ?? "https://placeholder.supabase.co",
  supabaseAnonKey ?? "placeholder",
  { auth: { persistSession: false } }
)

// ─── Database row types ───────────────────────────────────────────────────────

/** Matches the public.github_profiles table created on Supabase */
export interface GitHubProfileRow {
  id:            string          // GitHub numeric user id (text)
  github_login:  string | null
  github_name:   string | null
  github_avatar: string | null
  github_email:  string | null
  github_token:  string          // stored server-side only; not exposed to browser
  token_scope:   string
  created_at:    string
  updated_at:    string
}

/**
 * Safe public profile shape — what /auth/me returns.
 * github_token is NEVER included here.
 */
export interface GitHubProfile {
  id:          string
  login:       string
  name:        string | null
  avatar_url:  string | null
  email:       string | null
  token_scope: string
}
