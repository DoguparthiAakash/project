/**
 * GitHub OAuth REST API routes
 *
 * Flow:
 *   1. GET  /auth/github            → redirect browser to GitHub authorization
 *   2. GET  /auth/github/callback   → exchange code → access_token
 *                                    → fetch GitHub user profile
 *                                    → upsert profile + token in Supabase
 *                                    → sign JWT, set as httpOnly cookie
 *                                    → redirect to frontend /dashboard
 *   3. GET  /auth/me                → verify JWT cookie, return safe profile
 *   4. POST /auth/logout            → clear JWT cookie
 *
 * The raw GitHub access token NEVER leaves the server.
 * The frontend only holds the opaque JWT cookie (httpOnly, Secure in prod).
 */
import { Router }   from "express"
import fetch        from "node-fetch"
import jwt          from "jsonwebtoken"
import { upsertGitHubProfile, getGitHubProfile, getAllGitProfiles, upsertGitProfile } from "../services/supabaseService.js"

const router = Router()

const GITHUB_OAUTH_URL = "https://github.com/login/oauth/authorize"
const GITHUB_TOKEN_URL = "https://github.com/login/oauth/access_token"
const GITHUB_API       = "https://api.github.com"
const COOKIE_NAME      = "codesage_token"
const JWT_EXPIRY       = "7d"

function ghHeaders(token) {
  return {
    Authorization:          `Bearer ${token}`,
    Accept:                 "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  }
}

function jwtSecret() {
  const s = process.env.JWT_SECRET
  if (!s) throw new Error("JWT_SECRET is not set")
  return s
}

function signToken(userId) {
  return jwt.sign({ sub: userId }, jwtSecret(), { expiresIn: JWT_EXPIRY })
}

function cookieOptions(req) {
  const isProd = process.env.NODE_ENV === "production"
  return {
    httpOnly:  true,
    secure:    isProd,
    sameSite:  isProd ? "none" : "lax",
    maxAge:    7 * 24 * 60 * 60 * 1000,
    path:      "/",
  }
}

// ─── 1. Initiate OAuth ────────────────────────────────────────────────────────
router.get("/github", (req, res) => {
  const clientId = process.env.GITHUB_CLIENT_ID
  if (!clientId) {
    return res.status(500).json({ message: "GITHUB_CLIENT_ID is not configured." })
  }

  // CSRF state — store in a short-lived signed cookie (no server session needed)
  const state       = Math.random().toString(36).slice(2) + Date.now().toString(36)
  const stateToken  = jwt.sign({ state }, jwtSecret(), { expiresIn: "10m" })
  res.cookie("oauth_state", stateToken, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    maxAge:   10 * 60 * 1000,
    path:     "/",
  })

  const url         = new URL(GITHUB_OAUTH_URL)
  url.searchParams.set("client_id",    clientId)
  // url.searchParams.set("redirect_uri", redirectUri) // omitted to let GitHub use the registered callback URL
  url.searchParams.set("scope",        "repo read:user user:email")
  url.searchParams.set("state",        state)

  res.redirect(url.toString())
})

// ─── 2. OAuth callback ────────────────────────────────────────────────────────
router.get("/github/callback", async (req, res) => {
  const { code, state, error } = req.query
  const clientUrl = process.env.CLIENT_URL || "http://localhost:5173"

  const fail = (msg) =>
    res.redirect(`${clientUrl}/dashboard?auth_error=${encodeURIComponent(msg)}`)

  if (error) return fail(error)
  if (!code)  return fail("no_code")

  // Validate CSRF state against the cookie
  const stateToken = req.cookies?.oauth_state
  if (!stateToken) return fail("missing_state_cookie")
  try {
    const decoded = jwt.verify(stateToken, jwtSecret())
    if (decoded.state !== state) return fail("invalid_state")
  } catch {
    return fail("invalid_state_token")
  }
  res.clearCookie("oauth_state", { path: "/" })

  try {
    // ── Exchange code for access token ────────────────────────────────────────
    const tokenRes = await fetch(GITHUB_TOKEN_URL, {
      method:  "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body:    JSON.stringify({
        client_id:     process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code,
        // redirect_uri omitted to match authorization request
      }),
    })
    const tokenData = await tokenRes.json()

    if (tokenData.error || !tokenData.access_token) {
      console.error("Token exchange error:", tokenData)
      return fail(tokenData.error_description || tokenData.error || "token_exchange_failed")
    }

    const accessToken = tokenData.access_token

    // ── Fetch GitHub user profile ─────────────────────────────────────────────
    const [userRes, emailsRes] = await Promise.all([
      fetch(`${GITHUB_API}/user`,        { headers: ghHeaders(accessToken) }),
      fetch(`${GITHUB_API}/user/emails`, { headers: ghHeaders(accessToken) }),
    ])

    if (!userRes.ok) throw new Error(`GitHub /user failed: ${userRes.status}`)
    const ghUser = await userRes.json()

    let email = ghUser.email
    if (!email && emailsRes.ok) {
      const emails = await emailsRes.json()
      const primary = emails.find((e) => e.primary && e.verified)
      email = primary?.email ?? emails[0]?.email ?? null
    }

    // ── Upsert into Supabase ──────────────────────────────────────────────────
    const userId = String(ghUser.id)
    await upsertGitHubProfile({
      id:     userId,
      login:  ghUser.login,
      name:   ghUser.name || ghUser.login,
      avatar: ghUser.avatar_url,
      email,
      token:  accessToken,
      scope:  tokenData.scope || "",
    })

    // ── Issue JWT cookie ──────────────────────────────────────────────────────
    const jwtToken = signToken(userId)
    res.cookie(COOKIE_NAME, jwtToken, cookieOptions(req))

    res.redirect(`${clientUrl}/dashboard?auth_success=1`)
  } catch (err) {
    console.error("OAuth callback error:", err)
    fail(err.message)
  }
})

// ─── 3. Current user (/auth/me) ───────────────────────────────────────────────
router.get("/me", async (req, res) => {
  const token = req.cookies?.[COOKIE_NAME]
  if (!token) return res.status(401).json({ message: "Not authenticated" })

  let userId
  try {
    const decoded = jwt.verify(token, jwtSecret())
    userId = decoded.sub
  } catch {
    return res.status(401).json({ message: "Invalid or expired token" })
  }

  try {
    const profile = await getGitHubProfile(userId)
    if (!profile) return res.status(401).json({ message: "User not found" })

    const allProfiles = await getAllGitProfiles(userId)

    // Return safe profile — never expose the token
    res.json({
      id:          profile.id,
      login:       profile.github_login,
      name:        profile.github_name,
      avatar_url:  profile.github_avatar,
      email:       profile.github_email,
      token_scope: profile.token_scope,
      providers:   allProfiles.map(p => ({
        provider: p.provider,
        login: p.login,
        name: p.name,
        avatar_url: p.avatar
      }))
    })
  } catch (err) {
    console.error("/auth/me error:", err)
    res.status(500).json({ message: "Failed to load profile" })
  }
})

// ─── 4. Add Personal Access Token (PAT) for other providers ───────────────────
router.post("/pat", async (req, res) => {
  const token = req.cookies?.[COOKIE_NAME]
  if (!token) return res.status(401).json({ message: "Not authenticated" })

  let userId
  try {
    userId = jwt.verify(token, jwtSecret()).sub
  } catch {
    return res.status(401).json({ message: "Invalid or expired token" })
  }

  const { provider, login, pat, name } = req.body
  if (!provider || !login || !pat) {
    return res.status(400).json({ message: "provider, login, and pat are required" })
  }

  try {
    await upsertGitProfile(userId, provider, {
      id: `${provider}_${login}`,
      login,
      name: name || login,
      avatar: "", // Can fetch later or leave empty
      email: "",
      token: pat,
      scope: "repo"
    })
    res.json({ ok: true })
  } catch (err) {
    console.error("Failed to save PAT:", err)
    res.status(500).json({ message: "Failed to save PAT" })
  }
})

// ─── 4. Logout ────────────────────────────────────────────────────────────────
router.post("/logout", (req, res) => {
  res.clearCookie(COOKIE_NAME, { path: "/" })
  res.json({ ok: true })
})

export default router
