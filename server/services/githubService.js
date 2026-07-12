/**
 * GitHub REST API helpers used by backend routes.
 * The access token is read from the session — never sent to the frontend.
 */
import fetch from "node-fetch"

const BASE = "https://api.github.com"

function headers(token) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "Content-Type": "application/json",
  }
}

async function ghFetch(token, path, options = {}) {
  const res = await fetch(`${BASE}${path}`, { ...options, headers: headers(token) })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.message || `GitHub API ${res.status}: ${path}`)
  }
  // 204 No Content
  if (res.status === 204) return null
  return res.json()
}

// ─── Repos ────────────────────────────────────────────────────────────────────

export async function listRepos(token, page = 1, perPage = 50) {
  return ghFetch(
    token,
    `/user/repos?sort=updated&per_page=${perPage}&page=${page}&affiliation=owner,collaborator`
  )
}

export async function createRepo(token, { name, description, private: isPrivate = false }) {
  return ghFetch(token, `/user/repos`, {
    method: "POST",
    body: JSON.stringify({
      name,
      description,
      private: isPrivate,
      auto_init: true // create a readme so we have a main branch
    })
  })
}

// ─── Contents ─────────────────────────────────────────────────────────────────

export async function getContents(token, owner, repo, path = "", ref = null) {
  const query = ref ? `?ref=${encodeURIComponent(ref)}` : ""
  const data = await ghFetch(token, `/repos/${owner}/${repo}/contents/${path}${query}`)
  return Array.isArray(data) ? data : [data]
}

export async function getFileContent(token, owner, repo, path, ref = null) {
  const query = ref ? `?ref=${encodeURIComponent(ref)}` : ""
  const data = await ghFetch(token, `/repos/${owner}/${repo}/contents/${path}${query}`)

  if (data.encoding === "base64" && data.content) {
    // node.js Buffer-based base64 decode
    return {
      content: Buffer.from(data.content.replace(/\n/g, ""), "base64").toString("utf-8"),
      sha: data.sha,
      size: data.size,
    }
  }
  throw new Error("Cannot decode file — unexpected encoding")
}

// ─── Branches ─────────────────────────────────────────────────────────────────

export async function listBranches(token, owner, repo) {
  return ghFetch(token, `/repos/${owner}/${repo}/branches?per_page=50`)
}

export async function getRepo(token, owner, repo) {
  return ghFetch(token, `/repos/${owner}/${repo}`)
}

// ─── Commit / Push ────────────────────────────────────────────────────────────

/**
 * Create or update a single file in a repo via the Contents API.
 * Returns the commit object.
 */
export async function commitFile({
  token,
  owner,
  repo,
  path,
  message,
  content,      // UTF-8 string — will be base64-encoded here
  sha,          // current file SHA (required for updates, omit for create)
  branch,       // defaults to repo's default branch
}) {
  const body = {
    message,
    content: Buffer.from(content, "utf-8").toString("base64"),
    ...(sha ? { sha } : {}),
    ...(branch ? { branch } : {}),
  }
  const data = await ghFetch(token, `/repos/${owner}/${repo}/contents/${path}`, {
    method: "PUT",
    body: JSON.stringify(body),
  })
  return data.commit
}

// ─── Pull Request Comments ────────────────────────────────────────────────────

/**
 * Post a general (issue) comment on a PR.
 */
export async function commentOnPR({ token, owner, repo, pullNumber, body }) {
  return ghFetch(token, `/repos/${owner}/${repo}/issues/${pullNumber}/comments`, {
    method: "POST",
    body: JSON.stringify({ body }),
  })
}

/**
 * List open pull requests for a repo.
 */
export async function listPRs(token, owner, repo) {
  return ghFetch(token, `/repos/${owner}/${repo}/pulls?state=open&per_page=25`)
}

// ─── Project Level Analysis & Multi-file Commits ─────────────────────────────

/**
 * Fetch the complete file tree of a repository recursively.
 */
export async function getRepoTree(token, owner, repo, branch = "main") {
  return ghFetch(token, `/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`)
}

/**
 * Creates a commit with multiple file changes using the Git Database API.
 * `changes` is an array of { path, content }.
 */
export async function commitMultipleFiles({ token, owner, repo, branch = "main", message, changes }) {
  // 1. Get current branch reference to find the latest commit SHA
  const ref = await ghFetch(token, `/repos/${owner}/${repo}/git/ref/heads/${branch}`)
  const latestCommitSha = ref.object.sha

  // 2. Get the commit object to find its tree SHA
  const latestCommit = await ghFetch(token, `/repos/${owner}/${repo}/git/commits/${latestCommitSha}`)
  const baseTreeSha = latestCommit.tree.sha

  // 3. Create blobs for all new files and build the new tree structure
  const tree = []
  for (const change of changes) {
    // Create a blob for the file content
    const blob = await ghFetch(token, `/repos/${owner}/${repo}/git/blobs`, {
      method: "POST",
      body: JSON.stringify({
        content: Buffer.from(change.content, "utf-8").toString("base64"),
        encoding: "base64"
      })
    })
    
    tree.push({
      path: change.path,
      mode: "100644",
      type: "blob",
      sha: blob.sha
    })
  }

  // 4. Create the new tree
  const newTree = await ghFetch(token, `/repos/${owner}/${repo}/git/trees`, {
    method: "POST",
    body: JSON.stringify({
      base_tree: baseTreeSha,
      tree: tree
    })
  })

  // 5. Create the new commit
  const newCommit = await ghFetch(token, `/repos/${owner}/${repo}/git/commits`, {
    method: "POST",
    body: JSON.stringify({
      message: message,
      tree: newTree.sha,
      parents: [latestCommitSha]
    })
  })

  // 6. Update the branch reference
  const updatedRef = await ghFetch(token, `/repos/${owner}/${repo}/git/refs/heads/${branch}`, {
    method: "PATCH",
    body: JSON.stringify({
      sha: newCommit.sha,
      force: false
    })
  })

  return updatedRef
}

// ─── Workflow Permissions ─────────────────────────────────────────────────────

/**
 * Ensure the default workflow permissions allow writing (needed for Actions deployments).
 * Silently does nothing if the repo belongs to an org where the user isn't an admin.
 */
export async function fixWorkflowPermissions(token, owner, repo) {
  try {
    await ghFetch(token, `/repos/${owner}/${repo}/actions/permissions/workflow`, {
      method: "PUT",
      body: JSON.stringify({
        default_workflow_permissions: "write",
        can_approve_pull_request_reviews: true,
      }),
    })
  } catch {
    // Non-critical — repo may be in an org or user may not have admin rights
  }
}
