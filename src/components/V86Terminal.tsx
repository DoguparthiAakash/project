/**
 * V86Terminal — VS Code-style multi-panel terminal
 *
 * Architecture:
 *  • ONE V86 emulator instance is created lazily and cached in a module-level
 *    singleton. It never gets destroyed on tab switches.
 *  • TWO xterm.js instances ("Agent" and "User") share the same emulator.
 *    Serial output is mirrored to both. Each terminal also has its own local
 *    log buffer so output doesn't disappear when you switch tabs.
 *  • Tab visibility is controlled by CSS (display:none vs block) so the xterm
 *    canvas is never torn down — no re-render, no re-boot.
 *  • Four output channels: Agent Terminal | User Terminal | Output | Debug
 */

import { useEffect, useRef, useState, useCallback } from "react"
import { Terminal as XTerminal } from "@xterm/xterm"
import { FitAddon } from "@xterm/addon-fit"
import "@xterm/xterm/css/xterm.css"
import { cn } from "@/lib/utils"
import { Terminal, Bot, MonitorPlay, FileText, Bug, Trash2, Copy, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { WebContainerTerminal } from "./WebContainerTerminal"
import { subscribeWCStatus, getWCStore } from "@/services/webcontainer"

// ─── Singleton emulator store ─────────────────────────────────────────────────

interface EmulatorSingleton {
  emulator: any
  status: "idle" | "loading" | "booting" | "ready" | "error"
  statusMessage: string
  serialListeners: Set<(data: string) => void>
  error?: string
}

const store: EmulatorSingleton = {
  emulator: null,
  status: "idle",
  statusMessage: "Linux VM not started",
  serialListeners: new Set(),
}

async function loadLibV86(): Promise<void> {
  if (window.V86Starter) return
  if (document.querySelector("script[data-v86-loader]")) {
    // Script tag already in DOM — wait for it
    await new Promise<void>((resolve, reject) => {
      const existing = document.querySelector("script[data-v86-loader]") as HTMLScriptElement
      existing.addEventListener("load", () => resolve(), { once: true })
      existing.addEventListener("error", () => reject(new Error("libv86.js failed to load")), { once: true })
    })
    return
  }
  await new Promise<void>((resolve, reject) => {
    const script = document.createElement("script")
    script.src = `${import.meta.env.VITE_V86_ASSET_BASE ?? "https://cdn.jsdelivr.net/gh/copy/v86@master/build"}/libv86.js`
    script.dataset.v86Loader = "true"
    script.onload = () => resolve()
    script.onerror = () => reject(new Error("Failed to load libv86.js"))
    document.body.appendChild(script)
  })
}

let bootPromise: Promise<void> | null = null

export function bootV86(screenContainer: HTMLElement): Promise<void> {
  if (bootPromise) return bootPromise

  bootPromise = (async () => {
    store.status = "loading"
    store.statusMessage = "Loading Linux VM runtime..."
    notifyStatusListeners()

    await loadLibV86()

    if (!window.V86Starter) {
      store.status = "error"
      store.statusMessage = "Error: V86Starter not found after loading libv86.js"
      store.error = store.statusMessage
      notifyStatusListeners()
      throw new Error(store.statusMessage)
    }

    store.status = "booting"
    store.statusMessage = "Booting Linux VM..."
    notifyStatusListeners()

    const assetBase = import.meta.env.VITE_V86_ASSET_BASE ?? "https://cdn.jsdelivr.net/gh/copy/v86@master/build"
    const linuxImage = import.meta.env.VITE_V86_LINUX_IMAGE ?? "https://raw.githubusercontent.com/copy/v86/master/images/linux3.iso"

    store.emulator = new window.V86Starter({
      wasm_path: `${assetBase}/v86.wasm`,
      memory_size: 512 * 1024 * 1024,
      vga_memory_size: 8 * 1024 * 1024,
      screen_container: screenContainer,
      bios: { url: `${assetBase}/seabios.bin` },
      vga_bios: { url: `${assetBase}/vgabios.bin` },
      cdrom: { url: linuxImage },
      autostart: true,
    })

    store.emulator.add_listener("download-progress", (e: any) => {
      if (e.total) {
        const pct = Math.floor((e.loaded / e.total) * 100)
        store.statusMessage = `Downloading OS image... ${pct}%`
        notifyStatusListeners()
      }
    })

    // Pipe all serial output to every registered listener (both xterm instances)
    store.emulator.add_listener("serial0-output-char", (char: string) => {
      store.serialListeners.forEach(fn => fn(char))
    })

    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("Boot timeout after 2 minutes")), 120_000)
      store.emulator.add_listener("emulator-ready", () => {
        clearTimeout(timer)
        resolve()
      })
    })

    store.status = "ready"
    store.statusMessage = "Linux VM — Ready"
    notifyStatusListeners()
  })()

  bootPromise.catch(() => {
    bootPromise = null // Allow retry
  })

  return bootPromise
}

// Status listeners so components can re-render when boot progresses
const statusListeners = new Set<() => void>()
function notifyStatusListeners() {
  statusListeners.forEach(fn => fn())
}

function useEmulatorStatus() {
  const [, setTick] = useState(0)
  useEffect(() => {
    const fn = () => setTick(t => t + 1)
    statusListeners.add(fn)
    return () => { statusListeners.delete(fn) }
  }, [])
  return { status: store.status, statusMessage: store.statusMessage }
}

// ─── Output log store (per-channel text buffer) ───────────────────────────────

interface LogStore {
  output: string[]
  debug: string[]
}
const logs: LogStore = { output: [], debug: [] }

export function appendOutput(line: string) {
  logs.output.push(line)
  outputListeners.forEach(fn => fn())
}
export function appendDebug(line: string) {
  logs.debug.push(line)
  outputListeners.forEach(fn => fn())
}

const outputListeners = new Set<() => void>()
function useOutputLogs(channel: keyof LogStore) {
  const [lines, setLines] = useState<string[]>([])
  useEffect(() => {
    setLines([...logs[channel]])
    const fn = () => setLines([...logs[channel]])
    outputListeners.add(fn)
    return () => { outputListeners.delete(fn) }
  }, [channel])
  return lines
}

// ─── CopyButton ───────────────────────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-foreground"
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000) }}>
      {copied ? <Check className="size-3 text-green-400" /> : <Copy className="size-3" />}
    </Button>
  )
}

// ─── Single xterm session panel ───────────────────────────────────────────────

interface XTermPanelProps {
  label: string
  /** Whether this panel is currently visible (CSS only — never unmounts) */
  active: boolean
  /** Called once to register the serial data listener; return cleanup */
  onMount: (writeToTerm: (data: string) => void) => () => void
  /** Called when the user types a key */
  onKey?: (key: string) => void
  /** Whether the emulator is ready for input */
  ready: boolean
}

function XTermPanel({ label, active, onMount, onKey, ready }: XTermPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const termRef = useRef<XTerminal | null>(null)
  const fitRef = useRef<FitAddon | null>(null)
  const cleanupRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    if (!containerRef.current || termRef.current) return

    const term = new XTerminal({
      theme: {
        background: "#09090b",
        foreground: "#d4d4d4",
        cursor: "#c8c8c8",
        selectionBackground: "#264f78",
      },
      fontFamily: "'JetBrains Mono', 'Cascadia Code', 'Fira Code', monospace",
      fontSize: 12,
      lineHeight: 1.4,
      cursorBlink: true,
      scrollback: 5000,
    })

    const fitAddon = new FitAddon()
    term.loadAddon(fitAddon)
    term.open(containerRef.current)
    fitAddon.fit()

    termRef.current = term
    fitRef.current = fitAddon

    // Write incoming serial output to this terminal
    const writeToTerm = (data: string) => term.write(data)
    cleanupRef.current = onMount(writeToTerm)

    // Send keystrokes to emulator
    if (onKey) {
      term.onData(onKey)
    }

    const ro = new ResizeObserver(() => fitAddon.fit())
    ro.observe(containerRef.current)

    return () => {
      ro.disconnect()
      cleanupRef.current?.()
      term.dispose()
      termRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Re-fit when tab becomes visible
  useEffect(() => {
    if (active) {
      setTimeout(() => fitRef.current?.fit(), 50)
    }
  }, [active])

  return (
    <div
      ref={containerRef}
      className="flex-1 w-full h-full min-h-0"
      style={{ display: active ? "block" : "none" }}
      aria-label={`${label} terminal`}
    />
  )
}

// ─── Output / Debug log viewer ────────────────────────────────────────────────

function LogPanel({ channel, active }: { channel: keyof LogStore; active: boolean }) {
  const lines = useOutputLogs(channel)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (active) bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [lines, active])

  const text = lines.join("\n")

  return (
    <div
      className="flex-1 overflow-y-auto p-3 font-mono text-xs leading-5 bg-zinc-950 text-zinc-300 min-h-0"
      style={{ display: active ? "flex" : "none", flexDirection: "column" }}
    >
      {lines.length === 0 ? (
        <span className="text-zinc-600 select-none">No {channel} output yet.</span>
      ) : (
        lines.map((line, i) => (
          <span key={i} className={cn(
            "whitespace-pre-wrap break-all",
            channel === "debug" && "text-amber-400",
          )}>{line}</span>
        ))
      )}
      <div ref={bottomRef} />
      {lines.length > 0 && (
        <div className="shrink-0 sticky bottom-0 right-2 flex justify-end py-1">
          <CopyButton text={text} />
        </div>
      )}
    </div>
  )
}

// ─── Boot overlay ─────────────────────────────────────────────────────────────

function BootOverlay({ status, message }: { status: EmulatorSingleton["status"]; message: string }) {
  if (status === "ready") return null
  const isError = status === "error"
  return (
    <div className="absolute inset-0 z-30 bg-zinc-950/95 flex items-center justify-center pointer-events-none">
      <div className="flex flex-col items-center gap-3 text-center px-6">
        {isError ? (
          <Bug className="size-8 text-red-400" />
        ) : (
          <div className="size-8 rounded-full border-2 border-zinc-700 border-t-emerald-400 animate-spin" />
        )}
        <span className={cn("text-xs font-mono", isError ? "text-red-400" : "text-zinc-400")}>
          {message}
        </span>
      </div>
    </div>
  )
}

// ─── Main exported component ──────────────────────────────────────────────────

export type TerminalTab = "agent" | "webcontainer" | "output" | "debug"

interface V86TerminalPanelProps {
  /** Initial tab to show */
  defaultTab?: TerminalTab
  /** Extra CSS classes for the root element */
  className?: string
  onReady?: () => void
  onPreviewReady?: (url: string | null) => void
}

export function V86Terminal({ defaultTab = "agent", className, onReady, onPreviewReady }: V86TerminalPanelProps) {
  const [activeTab, setActiveTab] = useState<TerminalTab>(defaultTab)
  const { status, statusMessage } = useEmulatorStatus()
  const hiddenScreenRef = useRef<HTMLDivElement>(null)

  // Boot the emulator once when the component first mounts
  useEffect(() => {
    if (!hiddenScreenRef.current) return
    if (store.status !== "idle") return // already booting / ready

    bootV86(hiddenScreenRef.current).then(() => {
      onReady?.()
    }).catch(err => {
      console.error("V86 boot failed:", err)
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Listen for WebContainer preview URL changes
  useEffect(() => {
    return subscribeWCStatus(() => {
      const url = getWCStore().previewUrl
      if (onPreviewReady && url) {
        onPreviewReady(url)
      }
    })
  }, [onPreviewReady])

  // Register a serial listener that writes to a given xterm write function
  const makeOnMount = useCallback((channel: "agent" | "user") => {
    return (writeToTerm: (data: string) => void) => {
      // Replay nothing on mount (fresh session) — serial output is live only
      store.serialListeners.add(writeToTerm)
      if (channel === "agent") {
        // Agent terminal also echoes to Output log
        const agentLogger = (data: string) => appendOutput(data)
        store.serialListeners.add(agentLogger)
        return () => {
          store.serialListeners.delete(writeToTerm)
          store.serialListeners.delete(agentLogger)
        }
      }
      return () => { store.serialListeners.delete(writeToTerm) }
    }
  }, [])

  const sendKey = useCallback((key: string) => {
    if (store.status === "ready" && store.emulator) {
      store.emulator.serial0_send(key)
    }
  }, [])

  const tabs: { id: TerminalTab; label: string; icon: React.ReactNode; color?: string }[] = [
    { id: "agent",        label: "Agent (V86)",  icon: <Bot          className="size-3" />, color: "text-emerald-400" },
    { id: "webcontainer", label: "WebContainer", icon: <MonitorPlay  className="size-3" />, color: "text-blue-400"    },
    { id: "output",       label: "Output",       icon: <FileText     className="size-3" />                            },
    { id: "debug",        label: "Debug",        icon: <Bug          className="size-3" />, color: "text-amber-400"   },
  ]

  const clearTab = () => {
    if (activeTab === "output") { logs.output = []; outputListeners.forEach(fn => fn()) }
    if (activeTab === "debug")  { logs.debug  = []; outputListeners.forEach(fn => fn()) }
  }

  return (
    <div className={cn("flex flex-col w-full h-full bg-zinc-950 overflow-hidden text-foreground", className)}>
      {/* VS Code-style tab bar */}
      <div className="shrink-0 flex items-center bg-muted/30 border-b border-border overflow-x-auto no-scrollbar">
        {/* Tab buttons */}
        <div className="flex items-center">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex items-center gap-1.5 px-4 h-9 text-xs font-mono border-b-2 shrink-0 transition-colors",
                activeTab === tab.id
                  ? `border-primary bg-card ${tab.color ?? "text-foreground"}`
                  : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/40",
              )}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Spacer + toolbar */}
        <div className="flex-1" />
        <div className="flex items-center gap-1 pr-2">
          {/* Status pill */}
          <span className={cn(
            "text-[10px] font-mono px-2 py-0.5 rounded-full border",
            status === "ready"  && "text-emerald-400 border-emerald-400/30 bg-emerald-400/10",
            status === "booting" && "text-amber-400 border-amber-400/30 bg-amber-400/10",
            status === "loading" && "text-zinc-400 border-zinc-600 bg-zinc-800",
            status === "error"  && "text-red-400 border-red-400/30 bg-red-400/10",
            status === "idle"   && "text-zinc-500 border-zinc-700 bg-zinc-900",
          )}>
            {status === "ready" ? "● Live" : status === "booting" ? "◌ Booting" : status === "loading" ? "◌ Loading" : status === "error" ? "✗ Error" : "○ Idle"}
          </span>

          {(activeTab === "output" || activeTab === "debug") && (
            <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-foreground" onClick={clearTab} title="Clear">
              <Trash2 className="size-3" />
            </Button>
          )}
        </div>
      </div>

      {/* Panel body — all panels rendered but hidden via CSS */}
      <div className="flex-1 relative min-h-0 flex flex-col">
        {/* Hidden v86 VGA screen — required by the emulator but invisible to users */}
        <div ref={hiddenScreenRef} style={{ position: "absolute", width: 1, height: 1, opacity: 0, pointerEvents: "none", overflow: "hidden" }} aria-hidden />

        {/* Boot overlay — shown on top of everything until ready */}
        <BootOverlay status={status} message={statusMessage} />

        {/* Agent terminal (CSS hidden when not active) */}
        <XTermPanel
          label="Agent"
          active={activeTab === "agent"}
          onMount={makeOnMount("agent")}
          onKey={sendKey}
          ready={status === "ready"}
        />

        {/* WebContainer terminal (replaces User) */}
        <WebContainerTerminal active={activeTab === "webcontainer"} />

        {/* Output log panel */}
        <LogPanel channel="output" active={activeTab === "output"} />

        {/* Debug log panel */}
        <LogPanel channel="debug" active={activeTab === "debug"} />
      </div>
    </div>
  )
}
