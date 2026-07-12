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
  encoding?: string
  content?: string
}

export interface GHTreeItem {
  path: string
  type: "blob" | "tree"
  size?: number
}

const BASE = "https://api.github.com"

function headers(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    "X-GitHub-Api-Version": "2022-11-28",
    Accept: "application/vnd.github+json",
  }
}

export async function fetchRepos(token: string, page = 1): Promise<GHRepo[]> {
  const res = await fetch(
    `${BASE}/user/repos?sort=updated&per_page=50&page=${page}&affiliation=owner,collaborator`,
    { headers: headers(token) }
  )
  if (!res.ok) throw new Error(`GitHub API: ${res.status} ${res.statusText}`)
  return res.json()
}

export async function fetchContents(
  token: string,
  owner: string,
  repo: string,
  path = ""
): Promise<GHContent[]> {
  const res = await fetch(
    `${BASE}/repos/${owner}/${repo}/contents/${path}`,
    { headers: headers(token) }
  )
  if (!res.ok) throw new Error(`GitHub API: ${res.status} ${res.statusText}`)
  const data = await res.json()
  return Array.isArray(data) ? data : [data]
}

export async function fetchFileContent(
  token: string,
  owner: string,
  repo: string,
  path: string
): Promise<string> {
  const res = await fetch(
    `${BASE}/repos/${owner}/${repo}/contents/${path}`,
    { headers: headers(token) }
  )
  if (!res.ok) throw new Error(`GitHub API: ${res.status} ${res.statusText}`)
  const data: GHContent = await res.json()
  if (data.encoding === "base64" && data.content) {
    return atob(data.content.replace(/\n/g, ""))
  }
  if (data.download_url) {
    const raw = await fetch(data.download_url)
    return raw.text()
  }
  throw new Error("Cannot decode file content")
}

// Detect language from file extension
const EXT_MAP: Record<string, string> = {
  py: "python", js: "javascript", mjs: "javascript", cjs: "javascript",
  ts: "typescript", tsx: "typescript", jsx: "javascript",
  java: "java", c: "c", cpp: "cpp", cc: "cpp", cxx: "cpp", h: "c", hpp: "cpp",
  go: "go", rs: "rust", php: "php", cs: "csharp",
  html: "html", htm: "html", css: "css", scss: "css",
  rb: "ruby", swift: "swift", kt: "kotlin",
}

export function detectLanguage(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase() ?? ""
  return EXT_MAP[ext] ?? "javascript"
}

export const SUPPORTED_EXEC_LANGUAGES = new Set([
  "python", "javascript", "typescript", "go", "php", "c", "cpp", "java", "rust",
])
