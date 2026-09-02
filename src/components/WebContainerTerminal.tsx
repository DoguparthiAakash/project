import { useEffect, useRef, useState, useCallback } from "react"
import { Terminal as XTerminal } from "@xterm/xterm"
import { FitAddon } from "@xterm/addon-fit"
import "@xterm/xterm/css/xterm.css"
import { 
  getWebContainer, 
  subscribeWCStatus, 
  getWCStore, 
  spawnShell, 
  resizeShell,
  type WCStatus
} from "@/services/webcontainer"
import type { WebContainerProcess } from "@webcontainer/api"
import { Loader2, Bug, Play } from "lucide-react"

interface WebContainerTerminalProps {
  /** Whether the terminal tab is currently visible (CSS display trick) */
  active: boolean
}

export function WebContainerTerminal({ active }: WebContainerTerminalProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const xtermRef = useRef<XTerminal | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  
  const shellProcRef = useRef<WebContainerProcess | null>(null)
  const [status, setStatus] = useState<WCStatus>(getWCStore().status)
  const [message, setMessage] = useState(getWCStore().statusMessage)

  // Status sync
  useEffect(() => {
    return subscribeWCStatus(() => {
      setStatus(getWCStore().status)
      setMessage(getWCStore().statusMessage)
    })
  }, [])

  // Boot WebContainer immediately if not already booted
  useEffect(() => {
    getWebContainer().catch(console.error)
  }, [])

  // Mount Xterm and bind to WebContainer shell
  useEffect(() => {
    if (!containerRef.current || xtermRef.current) return

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

    xtermRef.current = term
    fitAddonRef.current = fitAddon

    let resizeObserver: ResizeObserver | null = null

    // When WebContainer is ready, spawn the shell
    if (getWCStore().status === 'ready' || getWCStore().isMounted) {
      startShell(term, fitAddon)
    } else {
      const unsub = subscribeWCStatus(() => {
        if (getWCStore().status === 'ready' && !shellProcRef.current) {
          startShell(term, fitAddon)
        }
      })
      // Cleanup early subscription if unmounted
      return () => {
        unsub()
        cleanupTerm()
      }
    }

    async function startShell(term: XTerminal, fit: FitAddon) {
      try {
        term.writeln('\x1b[36m> CodeSage WebContainer Shell (POSIX)\x1b[0m')
        const proc = await spawnShell()
        shellProcRef.current = proc

        // WebContainer stdout -> Xterm
        proc.output.pipeTo(
          new WritableStream({
            write(data) {
              term.write(data)
            }
          })
        )

        // Xterm -> WebContainer stdin
        // Create a writer and don't close it until unmount
        const writer = proc.input.getWriter()
        const dataListener = term.onData(data => {
          writer.write(data)
        })

        // Resize sync
        resizeObserver = new ResizeObserver(() => {
          fit.fit()
          if (term.cols && term.rows) {
            resizeShell(proc, term.cols, term.rows)
          }
        })
        resizeObserver.observe(containerRef.current!)
        
        // Initial resize
        if (term.cols && term.rows) resizeShell(proc, term.cols, term.rows)

      } catch (err: any) {
        term.writeln(`\r\n\x1b[31mShell error: ${err.message}\x1b[0m`)
      }
    }

    function cleanupTerm() {
      resizeObserver?.disconnect()
      shellProcRef.current?.kill()
      term.dispose()
      xtermRef.current = null
    }

    return cleanupTerm
  }, [])

  // Refit when tab becomes active
  useEffect(() => {
    if (active) {
      setTimeout(() => {
        fitAddonRef.current?.fit()
        if (xtermRef.current?.cols && shellProcRef.current) {
          resizeShell(shellProcRef.current, xtermRef.current.cols, xtermRef.current.rows)
        }
      }, 50)
    }
  }, [active])

  return (
    <div className="relative w-full h-full" style={{ display: active ? "block" : "none" }}>
      {/* Loading Overlay */}
      {(status === 'booting' || status === 'fetching' || status === 'mounting' || status === 'installing') && (
        <div className="absolute inset-0 z-30 bg-zinc-950/95 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3 text-center px-6">
            <Loader2 className="size-6 text-emerald-400 animate-spin" />
            <span className="text-xs font-mono text-zinc-400">{message}</span>
          </div>
        </div>
      )}

      {/* Error Overlay */}
      {status === 'error' && (
        <div className="absolute inset-0 z-30 bg-zinc-950/95 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3 text-center px-6 text-red-400">
            <Bug className="size-8" />
            <span className="text-xs font-mono">{message}</span>
          </div>
        </div>
      )}

      {/* Terminal Container */}
      <div
        ref={containerRef}
        className="w-full h-full min-h-0"
        aria-label="WebContainer shell"
      />
    </div>
  )
}
