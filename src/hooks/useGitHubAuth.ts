/**
 * useGitHubAuth
 *
 * Full REST-API GitHub OAuth flow backed by Supabase persistence.
 *
 * Architecture:
 *  - signIn()  → redirects browser to GET /auth/github on the backend
 *  - Backend   → GitHub → /auth/github/callback
 *               → upserts user profile + encrypted token into Supabase
 *               → issues httpOnly JWT cookie (codesage_token)
 *               → redirects to /dashboard?auth_success=1
 *  - On mount  → GET /auth/me (sends cookie automatically)
 *               → backend verifies JWT, reads profile from Supabase, returns safe JSON
 *  - signOut() → POST /auth/logout → backend clears the cookie
 *
 * The raw GitHub access token is stored ONLY in Supabase (server side).
 * The browser only holds the opaque JWT cookie.
 * All GitHub API calls go through /api/github/* — the backend resolves
 * the token from Supabase using the JWT sub claim.
 */
import { useState, useEffect, useCallback } from "react"
export type GitProfile = {
  id: number | string
  login: string
  name: string
  avatar_url: string
  provider: string
}

const API_BASE = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? "http://localhost:3001" : "")

export type AuthState = "idle" | "loading" | "authenticated" | "unauthenticated"

export interface GitAuthState {
  state:    AuthState
  profile:  GitProfile | null
  profiles: GitProfile[]
  activeProvider: string
  setActiveProvider: (provider: string) => void
  signIn:   (provider?: string) => void
  addPAT:   (provider: string, login: string, pat: string, name?: string) => Promise<void>
  signOut:  () => Promise<void>
  refresh:  () => Promise<void>
}

export function useGitAuth(): GitAuthState {
  const [state,   setState]   = useState<AuthState>("idle")
  const [profile, setProfile] = useState<GitProfile | null>(null)
  const [profiles, setProfiles] = useState<GitProfile[]>([])
  
  const [activeProvider, setActiveProviderState] = useState<string>(() => {
    return localStorage.getItem("gitProvider") || "github"
  })

  const setActiveProvider = useCallback((provider: string) => {
    localStorage.setItem("gitProvider", provider)
    setActiveProviderState(provider)
    // Update active profile based on the selected provider
    setProfile(profiles.find(p => p.provider === provider) || profiles[0] || null)
  }, [profiles])

  /**
   * Verify the JWT cookie by calling /auth/me.
   * If valid, the backend returns the safe profile from Supabase.
   */
  const fetchMe = useCallback(async () => {
    setState((s) => s === "idle" ? "loading" : s)
    try {
      const res = await fetch(`${API_BASE}/auth/me`, {
        credentials: "include",   // send the httpOnly JWT cookie
        headers: { "Accept": "application/json" },
      })

      if (res.ok) {
        const data = await res.json()
        setProfiles(data.profiles || [])
        // Find profile for active provider, fallback to first, or null
        const active = (data.profiles || []).find((p: GitProfile) => p.provider === activeProvider) || data.profiles?.[0] || data.profile
        setProfile(active || null)
        setState("authenticated")
      } else {
        setProfile(null)
        setProfiles([])
        setState("unauthenticated")
      }
    } catch {
      setProfile(null)
      setProfiles([])
      setState("unauthenticated")
    }
  }, [])

  // Check auth state on mount.
  // Re-check when the tab regains focus — handles the OAuth popup/redirect flow.
  useEffect(() => {
    fetchMe()
    const onFocus = () => fetchMe()
    window.addEventListener("focus", onFocus)
    return () => window.removeEventListener("focus", onFocus)
  }, [fetchMe])

  /**
   * Initiate the GitHub OAuth flow.
   * Redirects the current tab to the backend which starts the OAuth dance.
   * Backend redirects back to /dashboard?auth_success=1 when done.
   */
  const signIn = useCallback((provider = "github") => {
    setState("loading")
    window.location.href = `${API_BASE}/auth/${provider}`
  }, [])

  const addPAT = useCallback(async (provider: string, login: string, pat: string, name?: string) => {
    const res = await fetch(`${API_BASE}/auth/pat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ provider, login, pat, name })
    })
    if (!res.ok) throw new Error("Failed to add PAT")
    await fetchMe()
  }, [fetchMe])

  /**
   * Sign out: ask the backend to clear the JWT cookie,
   * then reset local state.
   */
  const signOut = useCallback(async () => {
    try {
      await fetch(`${API_BASE}/auth/logout`, {
        method:      "POST",
        credentials: "include",
      })
    } finally {
      setProfile(null)
      setProfiles([])
      setState("unauthenticated")
    }
  }, [])

  return { state, profile, profiles, activeProvider, setActiveProvider, signIn, addPAT, signOut, refresh: fetchMe }
}
