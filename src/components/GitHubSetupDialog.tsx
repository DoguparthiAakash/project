import { ExternalLink, Copy, Check, AlertCircle } from "lucide-react"
import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"

interface GitHubSetupDialogProps {
  open: boolean
  onClose: () => void
  onProceed: () => void
}

function CodeLine({ children }: { children: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <div className="flex items-center gap-2 rounded-md bg-muted/60 px-3 py-2 font-mono text-xs border border-border/60 group">
      <span className="flex-1 text-foreground">{children}</span>
      <button
        onClick={() => {
          navigator.clipboard.writeText(children)
          setCopied(true)
          setTimeout(() => setCopied(false), 2000)
        }}
        className="text-muted-foreground hover:text-foreground transition-colors opacity-0 group-hover:opacity-100"
      >
        {copied ? <Check className="size-3 text-green-500" /> : <Copy className="size-3" />}
      </button>
    </div>
  )
}

const steps = [
  {
    num: "1",
    title: "Create a GitHub OAuth App",
    content: (
      <div className="space-y-2">
        <p className="text-xs text-muted-foreground">
          Go to{" "}
          <a
            href="https://github.com/settings/developers"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline"
          >
            GitHub → Settings → Developer settings → OAuth Apps
          </a>{" "}
          and click <strong>New OAuth App</strong>.
        </p>
        <div className="space-y-1.5">
          <p className="text-xs font-medium">Set the Authorization callback URL to:</p>
          <CodeLine>https://[your-project-ref].supabase.co/auth/v1/callback</CodeLine>
        </div>
      </div>
    ),
  },
  {
    num: "2",
    title: "Enable GitHub in Supabase",
    content: (
      <p className="text-xs text-muted-foreground">
        In your{" "}
        <a
          href="https://app.supabase.com"
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary underline"
        >
          Supabase Dashboard
        </a>
        , go to{" "}
        <strong>Authentication → Providers → GitHub</strong> and paste your
        GitHub OAuth App&apos;s <strong>Client ID</strong> and{" "}
        <strong>Client Secret</strong>.
      </p>
    ),
  },
  {
    num: "3",
    title: "Set the redirect URL in your app",
    content: (
      <div className="space-y-2">
        <p className="text-xs text-muted-foreground">
          In Supabase Dashboard → Authentication → URL Configuration, add your
          app URL to the Redirect URLs list:
        </p>
        <CodeLine>{window.location.origin + "/dashboard"}</CodeLine>
      </div>
    ),
  },
]

export function GitHubSetupDialog({ open, onClose, onProceed }: GitHubSetupDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-1">
            <AlertCircle className="size-4 text-brand-blue" />
            <DialogTitle>GitHub OAuth Setup Required</DialogTitle>
          </div>
          <DialogDescription>
            To connect your GitHub account, complete these one-time setup steps in
            your Supabase project.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 my-2">
          {steps.map((step, i) => (
            <div key={i} className="flex gap-3">
              <div className="shrink-0 size-6 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
                <span className="text-xs font-bold text-primary">{step.num}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm mb-1.5">{step.title}</p>
                {step.content}
              </div>
            </div>
          ))}
        </div>

        <Separator />

        <div className="flex items-center justify-between pt-1">
          <a
            href="https://supabase.com/docs/guides/auth/social-login/auth-github"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Full docs <ExternalLink className="size-3" />
          </a>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => {
                onClose()
                onProceed()
              }}
              className="gap-2 bg-gradient-to-r from-brand-blue to-brand-violet text-white border-0"
            >
              I&apos;ve configured it — Connect
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
