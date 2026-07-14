import type { ReviewRequest, ReviewResult } from "@/types/review"
import { loadSettings, getAgentSettings } from "@/services/settings"

export interface ExecuteRequest {
  code: string
  language: string
  stdin?: string
}

export interface ExecuteResult {
  stdout: string
  stderr: string
  exitCode: number
  time: number
  memoryKb?: number
  compiled?: boolean
  compileError?: string
}

// In production on Render, frontend and backend are the same origin.
// Empty VITE_API_URL means use relative URLs (same origin).
// In local dev, fall back to http://localhost:3001.
const API_BASE = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? "http://localhost:3001" : "")

// ─── Code review / analysis ───────────────────────────────────────────────────

export async function analyzeCode(request: ReviewRequest): Promise<ReviewResult> {
  // Attach active provider credentials from local settings
  const { provider, apiKey, model } = getAgentSettings(loadSettings(), 'coder')

  const response = await fetch(`${API_BASE}/api/review`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ ...request, provider, apiKey, model }),
    signal: AbortSignal.timeout(90_000),
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: "Unknown error" }))
    throw new Error(error.message || `Request failed with status ${response.status}`)
  }

  return response.json()
}

// ─── Code execution ───────────────────────────────────────────────────────────

export async function executeCode(request: ExecuteRequest): Promise<ExecuteResult> {
  const response = await fetch(`${API_BASE}/api/execute`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(request),
    signal: AbortSignal.timeout(35_000),
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: "Unknown error" }))
    throw new Error(error.message || `Request failed with status ${response.status}`)
  }

  return response.json()
}

// ─── Project Execution and Analysis ──────────────────────────────────────────

export async function projectAnalyze(owner: string, repo: string, branch: string = "main", targetPath?: string | null) {
  const { provider, apiKey, model } = getAgentSettings(loadSettings(), 'coder')
  const response = await fetch(`${API_BASE}/api/project/${owner}/${repo}/analyze?branch=${branch}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ provider, apiKey, model, targetPath }),
  })
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: "Unknown error" }))
    throw new Error(error.message || `Request failed with status ${response.status}`)
  }
  return response.json()
}

export async function projectRun(owner: string, repo: string, branch: string = "main") {
  const { provider, apiKey, model } = getAgentSettings(loadSettings(), 'coder')
  const response = await fetch(`${API_BASE}/api/project/${owner}/${repo}/run?branch=${branch}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ provider, apiKey, model }),
  })
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: "Unknown error" }))
    throw new Error(error.message || `Request failed with status ${response.status}`)
  }
  return response.json()
}

export async function projectPushFixes(owner: string, repo: string, branch: string = "main", message: string, fixes: any[]) {
  const response = await fetch(`${API_BASE}/api/project/${owner}/${repo}/fixes?branch=${branch}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ message, fixes }),
  })
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: "Unknown error" }))
    throw new Error(error.message || `Request failed with status ${response.status}`)
  }
  return response.json()
}

export async function projectExec(owner: string, repo: string, branch: string = "main", command: string) {
  const response = await fetch(`${API_BASE}/api/project/${owner}/${repo}/exec?branch=${branch}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ command }),
  })
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: "Unknown error" }))
    throw new Error(error.message || `Request failed with status ${response.status}`)
  }
  return response.json()
}

export async function getChatThreads() {
  const response = await fetch(`${API_BASE}/api/project/chat/threads`, {
    credentials: "include",
  })
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: "Unknown error" }))
    throw new Error(error.message || `Request failed with status ${response.status}`)
  }
  return response.json()
}

export async function createChatThread(owner: string, repo: string, title: string = "New Chat") {
  const response = await fetch(`${API_BASE}/api/project/${owner}/${repo}/chat/threads`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ title }),
  })
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: "Unknown error" }))
    throw new Error(error.message || `Request failed with status ${response.status}`)
  }
  return response.json()
}

export async function projectChat(owner: string, repo: string, threadId: string, message: string, branch: string = "main", targetPath?: string | null, attachments: string[] = [], agents?: any) {
  const settings = loadSettings()
  const plannerId = (agents?.planner || settings.agents.planner || "nvidia") as keyof typeof settings.providers
  const coderId = (agents?.coder || settings.agents.coder || "groq") as keyof typeof settings.providers
  const fallbackId = (agents?.fallback || settings.agents.fallback || "openrouter") as keyof typeof settings.providers

  // Generate a structure representing the pipeline configuration with their respective API keys
  const agentsConfig = {
    planner: {
      provider: plannerId,
      apiKey: settings.providers[plannerId]?.apiKey || "",
      model: settings.providers[plannerId]?.model || "meta/llama-3.1-70b-instruct"
    },
    coder: {
      provider: coderId,
      apiKey: settings.providers[coderId]?.apiKey || "",
      model: settings.providers[coderId]?.model || "llama-3.3-70b-versatile"
    },
    fallback: {
      provider: fallbackId,
      apiKey: settings.providers[fallbackId]?.apiKey || "",
      model: settings.providers[fallbackId]?.model || "anthropic/claude-3.5-sonnet"
    }
  }

  const response = await fetch(`${API_BASE}/api/project/${owner}/${repo}/chat/${threadId}?branch=${branch}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ agents: agentsConfig, targetPath, message, attachments }),
  })
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: "Unknown error" }))
    throw new Error(error.message || `Request failed with status ${response.status}`)
  }
  return response.json()
}

export async function getThreadHistory(owner: string, repo: string, threadId: string) {
  const response = await fetch(`${API_BASE}/api/project/${owner}/${repo}/chat/${threadId}/history`, {
    credentials: "include",
  })
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: "Unknown error" }))
    throw new Error(error.message || `Request failed with status ${response.status}`)
  }
  return response.json()
}

export async function deleteChatThread(owner: string, repo: string, threadId: string) {
  const response = await fetch(`${API_BASE}/api/project/${owner}/${repo}/chat/${threadId}`, {
    method: "DELETE",
    credentials: "include",
  })
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: "Unknown error" }))
    throw new Error(error.message || `Request failed with status ${response.status}`)
  }
  return response.json()
}

export async function clearChatHistory(owner: string, repo: string) {
  const response = await fetch(`${API_BASE}/api/project/${owner}/${repo}/chat/clear`, {
    method: "DELETE",
    credentials: "include",
  })
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: "Unknown error" }))
    throw new Error(error.message || `Request failed with status ${response.status}`)
  }
  return response.json()
}

// ─── GitHub — proxied through backend (token never touches the browser) ────────

export interface GHRepo {
  id: number
  name: string
  full_name: string
  description: string | null
  private: boolean
  language: string | null
  updated_at: string
  default_branch: string
  stargazers_count: number
}

export interface GHContent {
  type: "file" | "dir" | "symlink"
  name: string
  path: string
  sha: string
  size: number
  download_url: string | null
}

export interface GHBranch {
  name: string
  protected: boolean
}

export interface GHPullRequest {
  number: number
  title: string
  html_url: string
  head: { ref: string }
  base: { ref: string }
}

export interface CommitFileRequest {
  owner: string
  repo: string
  path: string
  message: string
  content: string
  sha?: string        // required when updating existing file
  branch?: string
}

export interface CommentPRRequest {
  owner: string
  repo: string
  pullNumber: number
  body: string
}

export async function gitApi<T>(path: string, options: RequestInit = {}): Promise<T> {
  const provider = localStorage.getItem('gitProvider') || 'github'
  const res = await fetch(`${API_BASE}/api/git${path}`, {
    ...options,
    credentials: "include",
    headers: { 
      "Content-Type": "application/json", 
      "x-git-provider": provider,
      ...(options.headers ?? {}) 
    },
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: `HTTP ${res.status}` }))
    throw new Error(err.message || `Git API error ${res.status}`)
  }
  return res.json()
}

export async function ghListRepos(page = 1): Promise<GHRepo[]> {
  return gitApi<GHRepo[]>(`/repos?page=${page}`)
}

export async function ghGetRepo(owner: string, repo: string): Promise<GHRepo> {
  return gitApi<GHRepo>(`/repos/${owner}/${repo}`)
}

export async function ghGetContents(
  owner: string,
  repo: string,
  path = "",
  ref?: string
): Promise<GHContent[]> {
  const q = new URLSearchParams({ path })
  if (ref) q.set("ref", ref)
  return gitApi<GHContent[]>(`/repos/${owner}/${repo}/contents?${q}`)
}

export async function ghGetFile(
  owner: string,
  repo: string,
  path: string,
  ref?: string
): Promise<{ content: string; sha: string; size: number }> {
  const q = new URLSearchParams({ path })
  if (ref) q.set("ref", ref)
  return gitApi(`/repos/${owner}/${repo}/file?${q}`)
}

export async function ghListBranches(owner: string, repo: string): Promise<GHBranch[]> {
  return gitApi<GHBranch[]>(`/repos/${owner}/${repo}/branches`)
}

export async function ghCommitFile(req: CommitFileRequest): Promise<{ ok: boolean; commit: object }> {
  return gitApi("/repos/commit", {
    method: "POST",
    body: JSON.stringify(req),
  })
}

export async function ghListPRs(owner: string, repo: string): Promise<GHPullRequest[]> {
  return gitApi<GHPullRequest[]>(`/repos/${owner}/${repo}/pulls`)
}

export async function ghCommentOnPR(req: CommentPRRequest): Promise<{ ok: boolean }> {
  return gitApi("/repos/pulls/comment", {
    method: "POST",
    body: JSON.stringify(req),
  })
}

// ─── Agent Workloads ──────────────────────────────────────────────────────────

export async function submitAgentWorkload(type: string, provider: string, payload: any) {
  const response = await fetch(`${API_BASE}/api/agent/workload`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ type, provider, payload }),
  })
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: "Unknown error" }))
    throw new Error(error.message || `Request failed with status ${response.status}`)
  }
  return response.json()
}

export async function getAgentTaskStatus(taskId: string) {
  const response = await fetch(`${API_BASE}/api/agent/tasks/${taskId}`, {
    credentials: "include",
  })
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: "Unknown error" }))
    throw new Error(error.message || `Request failed with status ${response.status}`)
  }
  return response.json()
}
