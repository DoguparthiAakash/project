/**
 * githubController.js
 *
 * All handlers verify the JWT cookie and look up the GitHub access token
 * from Supabase. The raw token never touches the frontend.
 */
import { getProviderAdapter } from "../services/gitProviderService.js"
import { getGitToken } from "../services/supabaseService.js"

/**
 * Read the authenticated user's id from the JWT payload attached by
 * the requireAuth middleware in index.js (req.userId).
 * Then fetch their GitHub token from Supabase.
 */
async function getToken(req, provider = "github") {
  const userId = req.userId       // set by requireAuth middleware
  if (!userId) throw Object.assign(new Error("Not authenticated"), { status: 401 })
  const token = await getGitToken(userId, provider)
  return token
}

function getProvider(req) {
  return req.query.provider || req.headers['x-git-provider'] || req.body.provider || "github"
}

function handleErr(res, err) {
  const status = err.status || (
    err.message === "Not authenticated" || err.message === "User not found in database"
      ? 401
      : 502
  )
  res.status(status).json({ message: err.message })
}

// ─── Repos ────────────────────────────────────────────────────────────────────

export async function handleListRepos(req, res) {
  try {
    const providerName = getProvider(req)
    const token = await getToken(req, providerName)
    const adapter = getProviderAdapter(providerName)
    const page  = Math.max(1, parseInt(req.query.page) || 1)
    const data  = await adapter.listRepos(token, page)
    res.json(data)
  } catch (err) { handleErr(res, err) }
}

export async function handleCreateRepo(req, res) {
  try {
    const providerName = getProvider(req)
    const token = await getToken(req, providerName)
    const adapter = getProviderAdapter(providerName)
    const { name, description, isPrivate } = req.body
    if (!name) return res.status(400).json({ message: "Repository name is required" })
    
    const data = await adapter.createRepo(token, { name, description, private: isPrivate })
    res.json(data)
  } catch (err) { handleErr(res, err) }
}

// ─── Contents / file tree ─────────────────────────────────────────────────────

export async function handleGetContents(req, res) {
  try {
    const providerName = getProvider(req)
    const token           = await getToken(req, providerName)
    const adapter         = getProviderAdapter(providerName)
    const { owner, repo } = req.params
    const path            = req.query.path || ""
    const ref             = req.query.ref  || null
    const data            = await adapter.getContents(token, owner, repo, path, ref)
    res.json(data)
  } catch (err) { handleErr(res, err) }
}

export async function handleGetFile(req, res) {
  try {
    const providerName = getProvider(req)
    const token           = await getToken(req, providerName)
    const adapter         = getProviderAdapter(providerName)
    const { owner, repo } = req.params
    const path            = req.query.path || ""
    const ref             = req.query.ref  || null
    const data            = await adapter.getFileContent(token, owner, repo, path, ref)
    res.json(data)
  } catch (err) { handleErr(res, err) }
}

// ─── Branches ─────────────────────────────────────────────────────────────────

export async function handleListBranches(req, res) {
  try {
    const providerName = getProvider(req)
    const token           = await getToken(req, providerName)
    const adapter         = getProviderAdapter(providerName)
    const { owner, repo } = req.params
    const data            = await adapter.listBranches(token, owner, repo)
    res.json(data)
  } catch (err) { handleErr(res, err) }
}

export async function handleGetRepo(req, res) {
  try {
    const providerName = getProvider(req)
    const token           = await getToken(req, providerName)
    const adapter         = getProviderAdapter(providerName)
    const { owner, repo } = req.params
    const data            = await adapter.getRepo(token, owner, repo)
    res.json(data)
  } catch (err) { handleErr(res, err) }
}

// ─── Commit / push ────────────────────────────────────────────────────────────

export async function handleCommitFile(req, res) {
  try {
    const providerName = getProvider(req)
    const token = await getToken(req, providerName)
    const adapter = getProviderAdapter(providerName)
    const { owner, repo, path, message, content, sha, branch } = req.body

    if (!owner || !repo || !path || !message || content === undefined) {
      return res.status(400).json({ message: "owner, repo, path, message, and content are required." })
    }

    const commit = await adapter.commitFile({ token, owner, repo, path, message, content, sha, branch })
    res.json({ ok: true, commit })
  } catch (err) { handleErr(res, err) }
}

// ─── Pull Requests ────────────────────────────────────────────────────────────

export async function handleListPRs(req, res) {
  try {
    const providerName = getProvider(req)
    const token           = await getToken(req, providerName)
    const adapter         = getProviderAdapter(providerName)
    const { owner, repo } = req.params
    const data            = await adapter.listPRs(token, owner, repo)
    res.json(data)
  } catch (err) { handleErr(res, err) }
}

export async function handleCommentOnPR(req, res) {
  try {
    const providerName = getProvider(req)
    const token = await getToken(req, providerName)
    const adapter = getProviderAdapter(providerName)
    const { owner, repo, pullNumber, body }  = req.body

    if (!owner || !repo || !pullNumber || !body) {
      return res.status(400).json({ message: "owner, repo, pullNumber, and body are required." })
    }

    const comment = await adapter.commentOnPR({ token, owner, repo, pullNumber, body })
    res.json({ ok: true, comment })
  } catch (err) { handleErr(res, err) }
}
