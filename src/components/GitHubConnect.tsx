import React from "react"
import { LogOut, FolderOpen, ExternalLink, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import type { GitAuthState } from "@/hooks/useGitHubAuth"

interface GitConnectProps {
  auth: GitAuthState
  onBrowseRepos: () => void
}

function ProviderIcon({ provider, className }: { provider: string, className?: string }) {
  if (provider === "github") {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.02 10.02 0 0 0 22 12.017C22 6.484 17.522 2 12 2z" />
      </svg>
    )
  }
  if (provider === "gitlab") {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M22.65 14.39L12 22.13 1.35 14.39a.84.84 0 0 1-.3-.94l1.22-3.78 2.44-7.51A.42.42 0 0 1 5.46 2h.06a.42.42 0 0 1 .4.28l2.79 8.58h6.58l2.79-8.58a.42.42 0 0 1 .4-.28h.06a.42.42 0 0 1 .39.28l2.44 7.51 1.22 3.78a.84.84 0 0 1-.3.94z" />
      </svg>
    )
  }
  if (provider === "bitbucket") {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M2.216 4.085a.965.965 0 0 1 .956-.835h17.656a.965.965 0 0 1 .955.835l2.001 13.064a.965.965 0 0 1-.955 1.111H1.168a.965.965 0 0 1-.956-1.11z" />
      </svg>
    )
  }
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3"></circle>
      <path d="M12 9v13"></path>
      <path d="M12 2v4"></path>
    </svg>
  )
}

export function GitConnect({ auth, onBrowseRepos }: GitConnectProps) {
  const { state, profile, profiles, activeProvider, setActiveProvider, signIn, signOut, addPAT } = auth
  const [patDialogOpen, setPatDialogOpen] = React.useState(false)
  const [patProvider, setPatProvider] = React.useState("gitlab")
  const [patLogin, setPatLogin] = React.useState("")
  const [patToken, setPatToken] = React.useState("")

  const handleAddPAT = async () => {
    try {
      await addPAT(patProvider, patLogin, patToken)
      setPatDialogOpen(false)
    } catch (err) {
      console.error(err)
      alert("Failed to add PAT")
    }
  }

  if (state === "idle" || state === "loading") {
    return (
      <Button variant="outline" size="sm" disabled className="gap-2">
        <Loader2 className="size-3.5 animate-spin" />
        <span className="hidden sm:inline">GitHub</span>
      </Button>
    )
  }

  if (state === "authenticated" && profile) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2 pr-2">
            {profile.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt={profile.login}
                className="size-5 rounded-full ring-1 ring-border"
              />
            ) : (
            <ProviderIcon provider={profile.provider} className="size-4" />
            )}
            <span className="hidden sm:inline text-xs font-medium">{profile.login}</span>
            <Badge variant="secondary" className="text-xs px-1 py-0 rounded-sm ml-0.5 hidden sm:flex">
              Connected
            </Badge>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <div className="px-3 py-2">
            <div className="flex items-center gap-2.5">
              {profile.avatar_url && (
                <img src={profile.avatar_url} alt="" className="size-8 rounded-full" />
              )}
              <div className="min-w-0">
                <p className="font-medium text-sm truncate">{profile.name || profile.login}</p>
                <p className="text-xs text-muted-foreground truncate">@{profile.login} ({profile.provider})</p>
              </div>
            </div>
          </div>
          <DropdownMenuSeparator />
          
          <div className="px-3 py-1 text-xs text-muted-foreground font-semibold">Active Provider</div>
          {profiles.map(p => (
            <DropdownMenuItem key={`${p.provider}-${p.login}`} onClick={() => setActiveProvider(p.provider)}>
              <div className="flex items-center gap-2 w-full">
                <ProviderIcon provider={p.provider} className="size-4 shrink-0" />
                <span className="flex-1 truncate">{p.provider} ({p.login})</span>
                {p.provider === activeProvider && <span className="text-primary text-xs font-bold">✓</span>}
              </div>
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => signIn("github")} className="gap-2 cursor-pointer text-muted-foreground text-xs">
             + Change / Add Account (OAuth)
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => { setPatProvider("gitlab"); setPatDialogOpen(true); }} className="gap-2 cursor-pointer text-muted-foreground text-xs">
             + Add PAT Account
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={onBrowseRepos} className="gap-2 cursor-pointer">
            <FolderOpen className="size-3.5" />
            Browse Repositories
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <a
              href={`https://github.com/${profile.login}`}
              target="_blank"
              rel="noopener noreferrer"
              className="gap-2 cursor-pointer"
            >
              <ExternalLink className="size-3.5" />
              View on {profile.provider}
            </a>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={signOut}
            className="gap-2 cursor-pointer text-destructive focus:text-destructive"
          >
            <LogOut className="size-3.5" />
            Disconnect
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    )
  }

  // Unauthenticated
  // Unauthenticated or showing connect options
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2 border-border hover:border-primary/40 hover:bg-primary/5">
            <ProviderIcon provider="git" className="size-4" />
            <span className="hidden sm:inline">Connect Git</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => signIn("github")}>Connect GitHub (OAuth)</DropdownMenuItem>
          <DropdownMenuItem onClick={() => { setPatProvider("gitlab"); setPatDialogOpen(true); }}>Connect GitLab (PAT)</DropdownMenuItem>
          <DropdownMenuItem onClick={() => { setPatProvider("bitbucket"); setPatDialogOpen(true); }}>Connect Bitbucket (PAT)</DropdownMenuItem>
          <DropdownMenuItem onClick={() => { setPatProvider("codeberg"); setPatDialogOpen(true); }}>Connect Codeberg (PAT)</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={patDialogOpen} onOpenChange={setPatDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Connect {patProvider}</DialogTitle>
            <DialogDescription>Enter your Personal Access Token (PAT) for {patProvider}.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Username / Login</Label>
              <Input value={patLogin} onChange={e => setPatLogin(e.target.value)} placeholder="username" />
            </div>
            <div>
              <Label>Personal Access Token</Label>
              <Input type="password" value={patToken} onChange={e => setPatToken(e.target.value)} placeholder="ghp_***" />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleAddPAT}>Save Token</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
