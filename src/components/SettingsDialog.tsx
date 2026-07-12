/**
 * SettingsDialog
 *
 * A full-screen Sheet (side panel) where users configure:
 *  - Active AI provider
 *  - API key per provider
 *  - Model selection per provider
 *
 * Keys are stored in localStorage via src/services/settings.ts.
 * They are sent to the backend on each review request — the backend never
 * stores them; they are used only for that request.
 */
import { useState, useEffect } from "react"
import {
  Settings, Eye, EyeOff, ExternalLink, Check,
  ChevronRight, Cpu, AlertTriangle, CheckCircle2,
} from "lucide-react"
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  AI_PROVIDERS, loadSettings, saveSettings,
} from "@/services/settings"
import type { AppSettings, AIProviderId } from "@/types/settings"
import { cn } from "@/lib/utils"

// ── Appearance Panel ─────────────────────────────────────────────────────────

function AppearancePanel({ settings, onChange }: { settings: AppSettings, onChange: (s: AppSettings) => void }) {
  const updateColor = (theme: "light" | "dark", key: keyof AppSettings["colors"]["light"], value: string) => {
    onChange({
      ...settings,
      colors: {
        ...settings.colors,
        [theme]: {
          ...settings.colors[theme],
          [key]: value
        }
      }
    })
  }

  const renderColorPickers = (theme: "light" | "dark") => (
    <div className="space-y-4 mt-4">
      <h4 className="font-semibold text-sm capitalize">{theme} Theme Colors</h4>
      <div className="grid grid-cols-2 gap-4">
        {Object.entries(settings.colors[theme]).map(([key, value]) => (
          <div key={key} className="space-y-1.5">
            <Label className="text-xs capitalize">{key}</Label>
            <div className="flex items-center gap-2">
              <input 
                type="color" 
                value={value as string} 
                onChange={(e) => updateColor(theme, key as keyof AppSettings["colors"]["light"], e.target.value)}
                className="w-8 h-8 p-0 border-0 rounded overflow-hidden cursor-pointer"
              />
              <Input 
                value={value as string} 
                onChange={(e) => updateColor(theme, key as keyof AppSettings["colors"]["light"], e.target.value)}
                className="font-mono text-xs h-8"
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Appearance</h3>
        <p className="text-sm text-muted-foreground">Customize the colors used in CodeSage.</p>
      </div>
      <Separator />
      {renderColorPickers("light")}
      <Separator />
      {renderColorPickers("dark")}
    </div>
  )
}


// ── Provider logos (inline SVG / emoji fallbacks) ────────────────────────────

const PROVIDER_ICONS: Record<AIProviderId, React.ReactNode> = {
  grok: (
    <span className="font-black text-sm tracking-tighter leading-none">xAI</span>
  ),
  openai: (
    <svg viewBox="0 0 24 24" className="size-4 fill-current" aria-hidden>
      <path d="M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.18a5.985 5.985 0 0 0-3.998 2.9 6.046 6.046 0 0 0 .743 7.097 5.98 5.98 0 0 0 .51 4.911 6.051 6.051 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.997-2.9 6.056 6.056 0 0 0-.747-7.073zM13.26 22.43a4.476 4.476 0 0 1-2.876-1.04l.141-.081 4.779-2.758a.795.795 0 0 0 .392-.681v-6.737l2.02 1.168a.071.071 0 0 1 .038.052v5.583a4.504 4.504 0 0 1-4.494 4.494zM3.6 18.304a4.47 4.47 0 0 1-.535-3.014l.142.085 4.783 2.759a.771.771 0 0 0 .78 0l5.843-3.369v2.332a.08.08 0 0 1-.033.062L9.74 19.95a4.5 4.5 0 0 1-6.14-1.646zM2.34 7.896a4.485 4.485 0 0 1 2.366-1.973V11.6a.766.766 0 0 0 .388.676l5.815 3.355-2.02 1.168a.076.076 0 0 1-.071 0l-4.83-2.786A4.504 4.504 0 0 1 2.34 7.896zm16.597 3.855l-5.833-3.387L15.119 7.2a.076.076 0 0 1 .071 0l4.83 2.791a4.494 4.494 0 0 1-.676 8.105v-5.678a.79.79 0 0 0-.407-.667zm2.01-3.023l-.141-.085-4.774-2.782a.776.776 0 0 0-.785 0L9.409 9.23V6.897a.066.066 0 0 1 .028-.061l4.83-2.787a4.5 4.5 0 0 1 6.68 4.66zm-12.64 4.135l-2.02-1.164a.08.08 0 0 1-.038-.057V6.075a4.5 4.5 0 0 1 7.375-3.453l-.142.08L8.704 5.46a.795.795 0 0 0-.393.681zm1.097-2.365l2.602-1.5 2.607 1.5v2.999l-2.597 1.5-2.607-1.5z" />
    </svg>
  ),
  gemini: (
    <svg viewBox="0 0 24 24" className="size-4 fill-current" aria-hidden>
      <path d="M11.04 0C9.48.04 7.92.56 6.6 1.56L12 11.04 17.4 1.56C16.08.56 14.52.04 12.96 0zm-5.52 2.64C3.36 4.68 1.8 7.56 1.56 10.68h10.2zm6.96 0l3.72 8.04h10.2C26.2 7.56 24.64 4.68 22.48 2.64zM1.56 13.32c.24 3.12 1.8 6 4.08 7.92L9.36 13.32zm7.8 0l-1.92 9.24C8.76 23.52 10.2 24 11.76 24c1.56 0 3-.48 4.32-1.32L14.16 13.32zm6.84 0l3.72 8.04c2.28-1.92 3.84-4.8 4.08-7.92z" />
    </svg>
  ),
  anthropic: (
    <span className="font-bold text-xs tracking-tight leading-none">claude</span>
  ),
  groq: (
    <span className="font-black text-sm tracking-tighter leading-none">groq</span>
  ),
  nvidia: (
    <span className="font-black text-sm text-green-500 tracking-tighter leading-none">NVIDIA</span>
  ),
  openrouter: (
    <span className="font-black text-sm tracking-tighter leading-none">OpenRouter</span>
  ),
}

const BADGE_COLORS: Record<string, string> = {
  "Recommended": "bg-brand-blue/10 text-brand-blue border-brand-blue/20",
  "Free tier":   "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20",
  "Ultra-fast":  "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20",
}

// ── Masked key display ────────────────────────────────────────────────────────

function maskKey(key: string): string {
  if (!key || key.length < 8) return key
  return key.slice(0, 6) + "••••••••" + key.slice(-4)
}

// ── Per-provider config panel ─────────────────────────────────────────────────

interface ProviderPanelProps {
  providerId: AIProviderId
  settings: AppSettings
  onChange: (settings: AppSettings) => void
}

function ProviderPanel({ providerId, settings, onChange }: ProviderPanelProps) {
  const meta       = AI_PROVIDERS.find((p) => p.id === providerId)!
  const ps         = settings.providers[providerId]
  const [show, setShow] = useState(false)

  const update = (patch: Partial<typeof ps>) => {
    onChange({
      ...settings,
      providers: {
        ...settings.providers,
        [providerId]: { ...ps, ...patch },
      },
    })
  }

  const hasKey = ps.apiKey.trim().length > 0

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-base">{meta.name}</h3>
            {meta.badge && (
              <Badge
                variant="outline"
                className={cn("text-xs", BADGE_COLORS[meta.badge] ?? "")}
              >
                {meta.badge}
              </Badge>
            )}
            {hasKey && (
              <Badge variant="outline" className="text-xs gap-1 border-green-500/30 text-green-600 dark:text-green-400">
                <CheckCircle2 className="size-2.5" /> Configured
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">{meta.description}</p>
        </div>
        <Button variant="outline" size="sm" asChild className="shrink-0 gap-1.5 text-xs">
          <a href={meta.docsUrl} target="_blank" rel="noopener noreferrer">
            Get key <ExternalLink className="size-3" />
          </a>
        </Button>
      </div>

      <Separator />

      {/* API Key */}
      <div className="space-y-2">
        <Label htmlFor={`key-${providerId}`} className="text-sm font-medium">
          API Key
        </Label>
        <div className="relative">
          <Input
            id={`key-${providerId}`}
            type={show ? "text" : "password"}
            value={ps.apiKey}
            onChange={(e) => update({ apiKey: e.target.value })}
            placeholder={meta.keyPlaceholder}
            className="pr-10 font-mono text-sm"
            autoComplete="off"
            spellCheck={false}
          />
          <button
            type="button"
            onClick={() => setShow((v) => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            aria-label={show ? "Hide key" : "Show key"}
          >
            {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
        {ps.apiKey && (
          <p className="text-xs text-muted-foreground font-mono">
            Stored: {maskKey(ps.apiKey)}
          </p>
        )}
        <p className="text-xs text-muted-foreground flex items-start gap-1.5 mt-2">
          <AlertTriangle className="size-3 shrink-0 text-yellow-500 mt-0.5" />
          <span>
            <strong>Optional:</strong> If left empty, the app will automatically use secure environment variables configured on the server. Keys entered here are only saved locally in your browser.
          </span>
        </p>
      </div>

      {/* Model selector */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Model</Label>
        <Select value={ps.model} onValueChange={(v) => update({ model: v })}>
          <SelectTrigger className="text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {meta.models.map((m) => (
              <SelectItem key={m.value} value={m.value} className="text-sm">
                {m.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Clear key */}
      {hasKey && (
        <Button
          variant="outline"
          size="sm"
          className="text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/30"
          onClick={() => update({ apiKey: "" })}
        >
          Remove key
        </Button>
      )}
    </div>
  )
}

// ── Main SettingsDialog ───────────────────────────────────────────────────────

interface SettingsDialogProps {
  open: boolean
  onClose: () => void
  onSave?: (settings: AppSettings) => void
}

export function SettingsDialog({ open, onClose, onSave }: SettingsDialogProps) {
  const [settings, setSettings] = useState<AppSettings>(loadSettings)
  const [saved,    setSaved]    = useState(false)

  // Reload from storage when opened
  useEffect(() => {
    if (open) setSettings(loadSettings())
  }, [open])

  const handleSave = () => {
    saveSettings(settings)
    onSave?.(settings)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const activeProvider = AI_PROVIDERS.find((p) => p.id === settings.activeProvider)!
  const configuredCount = AI_PROVIDERS.filter(
    (p) => settings.providers[p.id]?.apiKey?.trim()
  ).length

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-xl flex flex-col gap-0 p-0"
      >
        <Tabs defaultValue="ai" className="flex flex-col h-full">
          {/* Header */}
          <SheetHeader className="px-6 pt-6 pb-4 border-b border-border shrink-0">
            <div className="flex items-center gap-3">
              <div className="size-9 rounded-xl bg-primary flex items-center justify-center shrink-0">
                <Settings className="size-4 text-primary-foreground" />
              </div>
              <div>
                <SheetTitle className="text-base">Settings</SheetTitle>
                <SheetDescription className="text-xs mt-0.5">
                  Configure your IDE preferences and AI models
                </SheetDescription>
              </div>
            </div>
            
            <TabsList className="mt-4 grid w-full grid-cols-3">
              <TabsTrigger value="ai">AI Providers</TabsTrigger>
              <TabsTrigger value="appearance">Appearance</TabsTrigger>
              <TabsTrigger value="devops">DevOps</TabsTrigger>
            </TabsList>
          </SheetHeader>

          {/* AI Providers Tab Content */}
          <TabsContent value="ai" className="flex flex-col flex-1 min-h-0 m-0 data-[state=inactive]:hidden">
            {/* Active provider summary */}
            <div className="m-4 rounded-lg border border-border bg-muted/40 px-3 py-2.5 flex items-center gap-3">
            <Cpu className="size-4 text-primary shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground">Active provider</p>
              <p className="text-sm font-medium">{activeProvider.name}</p>
            </div>
            <Badge variant="secondary" className="text-xs shrink-0">
              {configuredCount}/{AI_PROVIDERS.length} configured
            </Badge>
          </div>

        <Tabs
          value={settings.activeProvider}
          onValueChange={(v) =>
            setSettings((s) => ({ ...s, activeProvider: v as AIProviderId }))
          }
          className="flex flex-col flex-1 min-h-0"
        >
          {/* Provider tabs — horizontal scrollable */}
          <div className="px-4 pt-3 border-b border-border shrink-0">
            <TabsList className="h-auto p-1 w-full flex overflow-x-auto no-scrollbar justify-start gap-1">
              {AI_PROVIDERS.map((p) => {
                const hasKey = settings.providers[p.id]?.apiKey?.trim().length > 0
                return (
                  <TooltipProvider key={p.id} delayDuration={300}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <TabsTrigger
                          value={p.id}
                          className={cn(
                            "flex flex-col items-center gap-1 py-2 px-1 text-xs relative",
                            "data-[state=active]:bg-background data-[state=active]:shadow-sm"
                          )}
                        >
                          <span className="size-7 flex items-center justify-center rounded-md bg-muted">
                            {PROVIDER_ICONS[p.id]}
                          </span>
                          <span className="truncate w-full text-center leading-tight hidden sm:block">
                            {p.id === "anthropic" ? "Claude" : p.name.split(" ")[0]}
                          </span>
                          {hasKey && (
                            <span className="absolute top-1 right-1 size-1.5 rounded-full bg-green-500" />
                          )}
                        </TabsTrigger>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" className="text-xs">
                        {p.name}
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )
              })}
            </TabsList>
          </div>

          {/* Tab content */}
          <ScrollArea className="flex-1">
            {AI_PROVIDERS.map((p) => (
              <TabsContent key={p.id} value={p.id} className="m-0 px-6 py-5 focus-visible:outline-none">
                <ProviderPanel
                  providerId={p.id}
                  settings={settings}
                  onChange={setSettings}
                />

                {/* Set as active */}
                {settings.activeProvider !== p.id && (
                  <div className="mt-6 pt-5 border-t border-border">
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-2 w-full"
                      onClick={() =>
                        setSettings((s) => ({ ...s, activeProvider: p.id }))
                      }
                    >
                      <ChevronRight className="size-3.5" />
                      Use {p.name} as active provider
                    </Button>
                  </div>
                )}

                {settings.activeProvider === p.id && (
                  <div className="mt-6 pt-5 border-t border-border">
                    <p className="text-xs text-primary flex items-center gap-1.5 font-medium">
                      <Check className="size-3.5" />
                      This is your active provider — all reviews will use {p.name}
                    </p>
                  </div>
                )}
              </TabsContent>
            ))}
          </ScrollArea>
        </Tabs>
      </TabsContent>

      {/* Appearance Tab Content */}
      <TabsContent value="appearance" className="flex flex-col flex-1 min-h-0 m-0 p-6 overflow-y-auto data-[state=inactive]:hidden">
        <AppearancePanel settings={settings} onChange={setSettings} />
      </TabsContent>

      {/* DevOps Tab Content */}
      <TabsContent value="devops" className="flex flex-col flex-1 min-h-0 m-0 p-6 overflow-y-auto data-[state=inactive]:hidden">
        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-medium flex items-center gap-2">
              <Cpu className="size-5" /> Auto-Healing DevOps Agent
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              The DevOps agent monitors the WebContainer server logs. If the server crashes, the agent can analyze the error and execute a fix.
            </p>
          </div>
          <Separator />
          
          <div className="space-y-4">
            <label className="flex items-start gap-3 cursor-pointer group">
              <div className="flex items-center h-5">
                <input
                  type="radio"
                  name="devopsPermission"
                  className="w-4 h-4 text-primary bg-background border-border focus:ring-primary focus:ring-offset-background"
                  checked={settings.devopsAgentPermission === 'ask'}
                  onChange={() => setSettings({ ...settings, devopsAgentPermission: 'ask' })}
                />
              </div>
              <div>
                <div className="text-sm font-medium group-hover:text-primary transition-colors">Ask for permission (Recommended)</div>
                <div className="text-xs text-muted-foreground mt-0.5">The agent will propose a fix and wait for your approval before executing it.</div>
              </div>
            </label>

            <label className="flex items-start gap-3 cursor-pointer group mt-3">
              <div className="flex items-center h-5">
                <input
                  type="radio"
                  name="devopsPermission"
                  className="w-4 h-4 text-primary bg-background border-border focus:ring-primary focus:ring-offset-background"
                  checked={settings.devopsAgentPermission === 'auto'}
                  onChange={() => setSettings({ ...settings, devopsAgentPermission: 'auto' })}
                />
              </div>
              <div>
                <div className="text-sm font-medium flex items-center gap-2 group-hover:text-primary transition-colors">
                  Fully Autonomous 
                  <AlertTriangle className="size-3.5 text-amber-500" />
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">The agent will immediately execute commands to fix the server without asking.</div>
              </div>
            </label>
          </div>
        </div>
      </TabsContent>

      {/* Footer */}
      <div className="shrink-0 border-t border-border px-6 py-4 flex items-center justify-between gap-3 bg-muted/20">
          <p className="text-xs text-muted-foreground">
            Keys are stored locally in your browser.
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl px-5 min-w-[90px]"
            >
              {saved ? (
                <><Check className="size-3.5" /> Saved!</>
              ) : (
                "Save settings"
              )}
            </Button>
          </div>
        </div>
        </Tabs>
      </SheetContent>
    </Sheet>
  )
}
