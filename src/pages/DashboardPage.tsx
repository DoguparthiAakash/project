import { useState, useEffect, useCallback } from "react"
import { useSearchParams } from "react-router-dom"
import { motion } from "framer-motion"
import { toast } from "sonner"
import {
  FolderOpen, Globe, Lock, Search, Star, GitBranch, RefreshCw, Settings, AlertCircle, Sparkles
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Toaster } from "@/components/ui/sonner"
import { ModeToggle } from "@/components/mode-toggle"

import { GitConnect } from "@/components/GitHubConnect"
import { SettingsDialog } from "@/components/SettingsDialog"
import { GenerateProjectDialog } from "@/components/GenerateProjectDialog"
import { GenerationOverlay } from "@/components/GenerationOverlay"
import { ProjectWorkspace } from "@/components/ProjectWorkspace"
import { ghListRepos, type GHRepo, submitAgentWorkload } from "@/services/api"
import { loadSettings, hasValidKey, AI_PROVIDERS, getAgentSettings } from "@/services/settings"
import { useGitAuth } from "@/hooks/useGitHubAuth"
import type { AppSettings } from "@/types/settings"
import { cn } from "@/lib/utils"

function timeAgo(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000
  if (diff < 60) return "just now"
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

export default function DashboardPage() {
  const auth = useGitAuth()
  const [searchParams] = useSearchParams()

  // ── settings ─────────────────────────────────────────────────────────────────
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [appSettings, setAppSettings] = useState<AppSettings>(loadSettings)
  const coderProviderMeta = AI_PROVIDERS.find((p) => p.id === appSettings.agents.coder)

  // ── repos ────────────────────────────────────────────────────────────────────
  const [repos, setRepos] = useState<GHRepo[]>([])
  const [isGenerating, setIsGenerating] = useState(false)
  const [generationTaskId, setGenerationTaskId] = useState<string | null>(null)
  const [isGenerationDialogOpen, setIsGenerationDialogOpen] = useState(false)
  const [reposLoading, setReposLoading] = useState(false)
  const [reposError, setReposError] = useState<string | null>(null)
  const [repoSearch, setRepoSearch] = useState("")
  
  // ── selected workspace ───────────────────────────────────────────────────────
  const [selectedRepo, setSelectedRepo] = useState<GHRepo | null>(null)

  const loadRepos = useCallback(async () => {
    if (auth.state !== "authenticated") return
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
  }, [auth.state])

  useEffect(() => {
    loadRepos()
  }, [loadRepos])

  // Handle ?auth_success=1 and ?auth_error=… redirects from OAuth callback
  useEffect(() => {
    const success = searchParams.get("auth_success")
    const error = searchParams.get("auth_error")
    if (success) {
      toast.success("Git account connected successfully!")
      auth.refresh()
      window.history.replaceState({}, "", window.location.pathname)
    }
    if (error) {
      toast.error(`Git auth failed: ${decodeURIComponent(error)}`)
      window.history.replaceState({}, "", window.location.pathname)
    }
  }, [auth, searchParams])

  const handleGenerateProject = async (data: any) => {
    setIsGenerating(true)
    try {
      const { provider: aiProvider, apiKey: aiKey, model: aiModel } = getAgentSettings(appSettings, 'coder')
      
      const fallbackProviders = Object.entries(appSettings.providers)
        .filter(([_, ps]) => ps.apiKey.trim().length > 0)
        .map(([id, ps]) => ({ provider: id, apiKey: ps.apiKey, model: ps.model }))
      // ensure active is first
      fallbackProviders.sort((a, b) => a.provider === aiProvider ? -1 : (b.provider === aiProvider ? 1 : 0))

      const payload = { ...data, aiProvider, aiKey, aiModel, fallbackProviders }
      const response = await submitAgentWorkload("generate_new_project", auth.activeProvider, payload)
      setGenerationTaskId(response.taskId)
      setIsGenerationDialogOpen(false)
    } catch (err: any) {
      console.error(err)
      toast.error(err.message || "Failed to start generation")
    } finally {
      setIsGenerating(false)
    }
  }

  const handleGenerationComplete = () => {
    setGenerationTaskId(null)
    loadRepos()
  }

  const filteredRepos = repos.filter((r) =>
    r.name.toLowerCase().includes(repoSearch.toLowerCase()) ||
    (r.description ?? "").toLowerCase().includes(repoSearch.toLowerCase())
  )

  if (generationTaskId) {
    return (
      <GenerationOverlay
        taskId={generationTaskId}
        onComplete={handleGenerationComplete}
        onCancel={() => setGenerationTaskId(null)}
      />
    )
  }

  // If a repo is selected, show the workspace instead of the dashboard
  if (selectedRepo) {
    return (
      <ProjectWorkspace 
        repo={selectedRepo} 
        onBack={() => setSelectedRepo(null)} 
      />
    )
  }

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden text-foreground">
      <Toaster />
      
      <SettingsDialog
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onSave={(s) => setAppSettings(s)}
      />

      <GenerateProjectDialog
        open={isGenerationDialogOpen}
        onOpenChange={setIsGenerationDialogOpen}
        onSubmit={handleGenerateProject}
        isSubmitting={isGenerating}
      />

      {/* Top Navbar */}
      <header className="flex items-center px-6 py-4 gap-4 bg-card border-b border-border shadow-sm z-30">
        <div className="flex items-center gap-3">
          <img src="/vite.svg" alt="Logo" className="size-8 rounded-xl object-contain shadow-sm bg-background border border-border/50" />
          <span className="font-bold text-lg tracking-tight">CodeSage</span>
          <Badge variant="outline" className="text-xs px-2 hidden sm:flex bg-primary/5 text-primary border-primary/20">
            {coderProviderMeta?.name.split(" ")[0] ?? "AI"} Platform
          </Badge>
        </div>

        <div className="flex-1" />

        <div className="flex items-center gap-3">
          <GitConnect auth={auth} onBrowseRepos={() => loadRepos()} />

          <ModeToggle />

          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSettingsOpen(true)}
            className={cn(
              "relative rounded-xl hover:bg-muted transition-colors text-muted-foreground",
              !hasValidKey(appSettings) && "text-destructive hover:text-destructive/80 hover:bg-destructive/10"
            )}
          >
            <Settings className="size-5" />
            {!hasValidKey(appSettings) && (
              <span className="absolute top-1.5 right-1.5 size-2 rounded-full bg-destructive ring-2 ring-background animate-pulse" />
            )}
          </Button>
        </div>
      </header>

      {/* Main Content (Dashboard) */}
      <div className="flex-1 overflow-y-auto p-8 pt-10">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-10 gap-6">
            <div>
              <h1 className="text-3xl font-bold tracking-tight mb-2">Projects</h1>
              <p className="text-muted-foreground">Manage your repositories or start a new AI-generated project.</p>
            </div>
            
            <div className="flex items-center gap-3 w-full md:w-auto">
              <Button 
                onClick={() => setIsGenerationDialogOpen(true)} 
                className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl shadow-sm"
              >
                <Sparkles className="size-4" /> New Project
              </Button>
              <div className="relative w-full md:w-72">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground/70" />
                <Input
                  placeholder="Search repositories..."
                  className="pl-9 h-10 bg-card border-border focus-visible:ring-primary/50 transition-all rounded-xl"
                  value={repoSearch}
                  onChange={(e) => setRepoSearch(e.target.value)}
                />
              </div>
              <Button variant="outline" size="icon" onClick={loadRepos} disabled={reposLoading} className="shrink-0 bg-card border-border hover:bg-muted rounded-xl">
                <RefreshCw className={cn("size-4 text-muted-foreground", reposLoading && "animate-spin")} />
              </Button>
            </div>
          </div>

          {auth.state !== "authenticated" ? (
            <div className="flex flex-col items-center justify-center py-24 sneat-panel">
              <div className="size-16 rounded-full bg-primary/10 flex items-center justify-center mb-6">
                <AlertCircle className="size-8 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Connect Your Account</h3>
              <p className="text-muted-foreground mb-6 max-w-md text-center">
                Link your GitHub account to start managing repositories and generating new projects.
              </p>
            </div>
          ) : reposLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-44 rounded-2xl bg-card border border-border" />
              ))}
            </div>
          ) : reposError ? (
            <div className="py-20 text-center sneat-card border-destructive/20">
              <AlertCircle className="size-12 mx-auto text-destructive mb-4" />
              <p className="text-lg text-destructive mb-6 font-medium">{reposError}</p>
              <Button variant="outline" onClick={loadRepos} className="border-destructive/30 hover:bg-destructive/10 text-destructive rounded-xl">Try Again</Button>
            </div>
          ) : filteredRepos.length === 0 ? (
            <div className="py-24 text-center sneat-panel">
              <FolderOpen className="size-12 mx-auto text-muted-foreground/40 mb-4" />
              <p className="text-lg text-muted-foreground">No repositories found.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredRepos.map((repo, i) => (
                <motion.div
                  key={repo.id}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: i * 0.05 }}
                  className="group flex flex-col sneat-card p-5 cursor-pointer relative overflow-hidden"
                  onClick={() => setSelectedRepo(repo)}
                >
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 rounded-lg bg-primary/5 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                        {repo.private ? (
                          <Lock className="size-4" />
                        ) : (
                          <Globe className="size-4" />
                        )}
                      </div>
                      <h3 className="font-semibold text-base truncate pr-2 group-hover:text-primary transition-colors">{repo.name}</h3>
                    </div>
                    {repo.language && (
                      <Badge variant="secondary" className="bg-secondary/50 text-secondary-foreground shrink-0 rounded-md">
                        {repo.language}
                      </Badge>
                    )}
                  </div>
                  
                  <p className="text-sm text-muted-foreground line-clamp-2 mb-6 flex-1 leading-relaxed">
                    {repo.description || "No description provided."}
                  </p>
                  
                  <div className="flex items-center justify-between text-xs text-muted-foreground pt-4 border-t border-border/50">
                    <div className="flex items-center gap-3">
                      <span className="flex items-center gap-1">
                        <Star className="size-3.5" /> {repo.stargazers_count}
                      </span>
                      <span className="flex items-center gap-1">
                        <GitBranch className="size-3.5" /> {repo.default_branch}
                      </span>
                    </div>
                    <span className="font-medium">{timeAgo(repo.updated_at)}</span>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
