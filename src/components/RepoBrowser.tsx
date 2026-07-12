import { useState, useEffect, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  FolderOpen, ChevronRight, ChevronLeft,
  Search, Loader2, Star, Lock, Globe, RefreshCw,
  ArrowUpRight, AlertCircle, Home, GitBranch,
} from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Skeleton } from "@/components/ui/skeleton"
import {
  ghListRepos, ghGetContents, ghGetFile,
  type GHRepo, type GHContent,
} from "@/services/api"
import { cn } from "@/lib/utils"

// ─── helpers ─────────────────────────────────────────────────────────────────

const FILE_ICON_MAP: Record<string, string> = {
  py: "🐍", js: "🟡", ts: "🔷", tsx: "🔷", jsx: "🟡",
  java: "☕", cpp: "⚙️", c: "⚙️", go: "🐹", rs: "🦀",
  php: "🐘", cs: "💜", html: "🌐", css: "🎨", json: "📋",
  md: "📝", txt: "📄", yml: "⚙️", yaml: "⚙️", sh: "💻",
}
function fileIcon(name: string) {
  const ext = name.split(".").pop()?.toLowerCase() ?? ""
  return FILE_ICON_MAP[ext] ?? "📄"
}
function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1048576).toFixed(1)} MB`
}
function timeAgo(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000
  if (diff < 60) return "just now"
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}
const EXT_LANG: Record<string, string> = {
  py:"python", js:"javascript", mjs:"javascript", ts:"typescript",
  tsx:"typescript", jsx:"javascript", java:"java", c:"c", cpp:"cpp",
  cc:"cpp", go:"go", rs:"rust", php:"php", cs:"csharp",
  html:"html", htm:"html", css:"css",
}
function detectLanguage(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase() ?? ""
  return EXT_LANG[ext] ?? "javascript"
}

// ─── props ────────────────────────────────────────────────────────────────────

interface RepoBrowserProps {
  open: boolean
  onClose: () => void
  /** Whether the user is authenticated (token is server-side) */
  authenticated: boolean
  onLoadFile: (
    content: string,
    language: string,
    filename: string,
    owner: string,
    repo: string,
    filePath: string,
    defaultBranch: string
  ) => void
}

type View = "repos" | "files"

// ─── component ────────────────────────────────────────────────────────────────

export function RepoBrowser({ open, onClose, authenticated, onLoadFile }: RepoBrowserProps) {
  const [view,          setView]          = useState<View>("repos")
  const [repos,         setRepos]         = useState<GHRepo[]>([])
  const [reposLoading,  setReposLoading]  = useState(false)
  const [reposError,    setReposError]    = useState<string | null>(null)
  const [repoSearch,    setRepoSearch]    = useState("")

  const [selectedRepo,      setSelectedRepo]      = useState<GHRepo | null>(null)
  const [path,              setPath]              = useState("")
  const [breadcrumbs,       setBreadcrumbs]       = useState<string[]>([])
  const [contents,          setContents]          = useState<GHContent[]>([])
  const [contentsLoading,   setContentsLoading]   = useState(false)
  const [contentsError,     setContentsError]     = useState<string | null>(null)
  const [loadingFile,       setLoadingFile]       = useState<string | null>(null)

  // ── load repos ───────────────────────────────────────────────────────────────
  const loadRepos = useCallback(async () => {
    setReposLoading(true)
    setReposError(null)
    try {
      const data = await ghListRepos()
      setRepos(data)
    } catch (e) {
      setReposError(e instanceof Error ? e.message : "Failed to load repos")
    } finally {
      setReposLoading(false)
    }
  }, [])

  // ── load directory contents ──────────────────────────────────────────────────
  const loadContents = useCallback(async (repo: GHRepo, dirPath: string) => {
    setContentsLoading(true)
    setContentsError(null)
    try {
      const [owner, repoName] = repo.full_name.split("/")
      const items = await ghGetContents(owner, repoName, dirPath)
      items.sort((a, b) => {
        if (a.type === b.type) return a.name.localeCompare(b.name)
        return a.type === "dir" ? -1 : 1
      })
      setContents(items)
    } catch (e) {
      setContentsError(e instanceof Error ? e.message : "Failed to load contents")
    } finally {
      setContentsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (open && authenticated && repos.length === 0 && !reposLoading) {
      loadRepos()
    }
  }, [open, authenticated, repos.length, reposLoading, loadRepos])

  // ── handlers ─────────────────────────────────────────────────────────────────
  const handleSelectRepo = (repo: GHRepo) => {
    setSelectedRepo(repo)
    setPath("")
    setBreadcrumbs([])
    setView("files")
    loadContents(repo, "")
  }

  const handleNavigateDir = (item: GHContent) => {
    setPath(item.path)
    setBreadcrumbs(item.path.split("/"))
    loadContents(selectedRepo!, item.path)
  }

  const handleBreadcrumb = (idx: number) => {
    if (idx === -1) {
      setPath("")
      setBreadcrumbs([])
      loadContents(selectedRepo!, "")
    } else {
      const newPath = breadcrumbs.slice(0, idx + 1).join("/")
      setPath(newPath)
      setBreadcrumbs(breadcrumbs.slice(0, idx + 1))
      loadContents(selectedRepo!, newPath)
    }
  }

  const handleLoadFile = async (item: GHContent) => {
    if (!selectedRepo) return
    setLoadingFile(item.path)
    try {
      const [owner, repoName] = selectedRepo.full_name.split("/")
      const { content } = await ghGetFile(owner, repoName, item.path)
      onLoadFile(
        content,
        detectLanguage(item.name),
        item.name,
        owner,
        repoName,
        item.path,
        selectedRepo.default_branch
      )
      handleClose()
    } catch (e) {
      setContentsError(e instanceof Error ? e.message : "Failed to load file")
    } finally {
      setLoadingFile(null)
    }
  }

  const handleClose = () => {
    onClose()
    setTimeout(() => {
      setView("repos")
      setSelectedRepo(null)
      setPath("")
      setBreadcrumbs([])
      setContents([])
    }, 200)
  }

  const filteredRepos = repos.filter((r) =>
    r.name.toLowerCase().includes(repoSearch.toLowerCase()) ||
    (r.description ?? "").toLowerCase().includes(repoSearch.toLowerCase())
  )

  // ── not authenticated ─────────────────────────────────────────────────────────
  if (!authenticated) {
    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Connect GitHub First</DialogTitle></DialogHeader>
          <div className="py-8 text-center">
            <AlertCircle className="size-10 mx-auto text-muted-foreground mb-4" />
            <p className="text-sm text-muted-foreground">
              Connect your GitHub account to browse your repositories.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  // ── main dialog ───────────────────────────────────────────────────────────────
  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col p-0 gap-0">

        {/* Header */}
        <DialogHeader className="px-5 pt-5 pb-4 border-b border-border shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {view === "files" && (
                <Button variant="ghost" size="icon-sm" onClick={() => { setView("repos"); setSelectedRepo(null) }}>
                  <ChevronLeft className="size-4" />
                </Button>
              )}
              <DialogTitle className="text-base">
                {view === "repos" ? "Your Repositories" : selectedRepo?.name}
              </DialogTitle>
              {selectedRepo?.private && (
                <Badge variant="outline" className="text-xs gap-1">
                  <Lock className="size-2.5" /> Private
                </Badge>
              )}
              {selectedRepo?.language && view === "files" && (
                <Badge variant="secondary" className="text-xs">{selectedRepo.language}</Badge>
              )}
            </div>
            {view === "repos" && (
              <Button variant="ghost" size="icon-sm" onClick={loadRepos} disabled={reposLoading}>
                <RefreshCw className={cn("size-3.5", reposLoading && "animate-spin")} />
              </Button>
            )}
          </div>

          {/* Breadcrumbs */}
          {view === "files" && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground mt-2 flex-wrap">
              <button
                onClick={() => handleBreadcrumb(-1)}
                className="hover:text-foreground transition-colors flex items-center gap-1"
              >
                <Home className="size-3" />
                {selectedRepo?.name}
              </button>
              {breadcrumbs.map((crumb, i) => (
                <span key={i} className="flex items-center gap-1">
                  <ChevronRight className="size-3" />
                  <button
                    onClick={() => handleBreadcrumb(i)}
                    className={cn(
                      "hover:text-foreground transition-colors",
                      i === breadcrumbs.length - 1 && "text-foreground font-medium"
                    )}
                  >
                    {crumb}
                  </button>
                </span>
              ))}
            </div>
          )}
        </DialogHeader>

        {/* Body */}
        <AnimatePresence mode="wait">
          {view === "repos" ? (
            <motion.div
              key="repos"
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 }}
              transition={{ duration: 0.15 }}
              className="flex flex-col flex-1 min-h-0"
            >
              <div className="px-4 py-3 border-b border-border shrink-0">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Search repositories..."
                    className="pl-9 h-8 text-sm"
                    value={repoSearch}
                    onChange={(e) => setRepoSearch(e.target.value)}
                  />
                </div>
              </div>

              <ScrollArea className="flex-1">
                <div className="p-2">
                  {reposLoading ? (
                    <div className="space-y-2 p-2">
                      {Array.from({ length: 6 }).map((_, i) => (
                        <Skeleton key={i} className="h-16 w-full rounded-lg" />
                      ))}
                    </div>
                  ) : reposError ? (
                    <div className="py-12 text-center">
                      <AlertCircle className="size-8 mx-auto text-muted-foreground mb-3" />
                      <p className="text-sm text-destructive">{reposError}</p>
                      <Button variant="outline" size="sm" className="mt-3" onClick={loadRepos}>Retry</Button>
                    </div>
                  ) : filteredRepos.length === 0 ? (
                    <div className="py-12 text-center text-sm text-muted-foreground">
                      No repositories found.
                    </div>
                  ) : (
                    filteredRepos.map((repo) => (
                      <button
                        key={repo.id}
                        onClick={() => handleSelectRepo(repo)}
                        className="w-full text-left rounded-lg px-4 py-3 hover:bg-muted/60 transition-colors group"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              {repo.private
                                ? <Lock className="size-3 text-muted-foreground shrink-0" />
                                : <Globe className="size-3 text-muted-foreground shrink-0" />}
                              <span className="font-medium text-sm truncate">{repo.name}</span>
                              {repo.language && (
                                <Badge variant="secondary" className="text-xs px-1.5 py-0 shrink-0">
                                  {repo.language}
                                </Badge>
                              )}
                            </div>
                            {repo.description && (
                              <p className="text-xs text-muted-foreground truncate mb-1.5">{repo.description}</p>
                            )}
                            <div className="flex items-center gap-3 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Star className="size-2.5" />{repo.stargazers_count}
                              </span>
                              <span className="flex items-center gap-1">
                                <GitBranch className="size-2.5" />{repo.default_branch}
                              </span>
                              <span>{timeAgo(repo.updated_at)}</span>
                            </div>
                          </div>
                          <ChevronRight className="size-4 text-muted-foreground shrink-0 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </ScrollArea>
            </motion.div>
          ) : (
            <motion.div
              key="files"
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 16 }}
              transition={{ duration: 0.15 }}
              className="flex-1 min-h-0"
            >
              <ScrollArea className="h-full max-h-[60vh]">
                <div className="p-2">
                  {contentsLoading ? (
                    <div className="space-y-1.5 p-2">
                      {Array.from({ length: 8 }).map((_, i) => (
                        <Skeleton key={i} className="h-10 w-full rounded-lg" />
                      ))}
                    </div>
                  ) : contentsError ? (
                    <div className="py-12 text-center">
                      <AlertCircle className="size-8 mx-auto text-muted-foreground mb-3" />
                      <p className="text-sm text-destructive">{contentsError}</p>
                      <Button variant="outline" size="sm" className="mt-3"
                        onClick={() => loadContents(selectedRepo!, path)}>Retry</Button>
                    </div>
                  ) : contents.length === 0 ? (
                    <div className="py-12 text-center text-sm text-muted-foreground">Empty directory.</div>
                  ) : (
                    contents.map((item) =>
                      item.type === "dir" ? (
                        <button
                          key={item.path}
                          onClick={() => handleNavigateDir(item)}
                          className="w-full text-left rounded-lg px-4 py-2.5 hover:bg-muted/60 transition-colors group flex items-center gap-3"
                        >
                          <FolderOpen className="size-4 text-brand-blue shrink-0" />
                          <span className="text-sm flex-1 truncate">{item.name}</span>
                          <ChevronRight className="size-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                        </button>
                      ) : (
                        <button
                          key={item.path}
                          onClick={() => handleLoadFile(item)}
                          disabled={loadingFile === item.path || (item.size ?? 0) > 500_000}
                          className="w-full text-left rounded-lg px-4 py-2.5 hover:bg-muted/60 transition-colors group flex items-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <span className="text-base shrink-0">{fileIcon(item.name)}</span>
                          <span className="text-sm flex-1 truncate">{item.name}</span>
                          <span className="text-xs text-muted-foreground shrink-0">
                            {item.size ? formatSize(item.size) : ""}
                          </span>
                          {loadingFile === item.path
                            ? <Loader2 className="size-3.5 text-primary animate-spin shrink-0" />
                            : <ArrowUpRight className="size-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />}
                        </button>
                      )
                    )
                  )}
                </div>
              </ScrollArea>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Footer */}
        {view === "files" && selectedRepo && (
          <div className="shrink-0 border-t border-border px-4 py-2.5 flex items-center justify-between text-xs text-muted-foreground">
            <span>{selectedRepo.language ? `${selectedRepo.language} repository` : "Repository"}</span>
            <a
              href={`https://github.com/${selectedRepo.full_name}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 hover:text-foreground transition-colors"
            >
              Open on GitHub <ArrowUpRight className="size-3" />
            </a>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
