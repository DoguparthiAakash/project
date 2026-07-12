import { useEffect, useRef, useState } from "react"
import { Terminal as XTerminal } from "@xterm/xterm"
import { FitAddon } from "@xterm/addon-fit"
import "@xterm/xterm/css/xterm.css"
import { Loader2 } from "lucide-react"
import { getCheerpX, syncRepoToCheerpX } from "@/services/cheerpx"

interface CheerpXTerminalProps {
  owner: string
  repo: string
  branch: string
}

export function CheerpXTerminal({ owner, repo, branch }: CheerpXTerminalProps) {
  const terminalRef = useRef<HTMLDivElement>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!terminalRef.current) return

    const term = new XTerminal({
      theme: {
        background: '#09090b', // zinc-950
        foreground: '#f4f4f5', // zinc-50
        cursor: '#f4f4f5',
        selectionBackground: '#27272a', // zinc-800
      },
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      fontSize: 13,
      lineHeight: 1.4,
      cursorBlink: true,
      disableStdin: false,
      convertEol: true,
    })

    const fitAddon = new FitAddon()
    term.loadAddon(fitAddon)
    term.open(terminalRef.current)

    // Initial fit and handle resize
    setTimeout(() => fitAddon.fit(), 100)
    const resizeObserver = new ResizeObserver(() => fitAddon.fit())
    resizeObserver.observe(terminalRef.current)

    term.writeln("\x1b[1;36m[CheerpX] Booting WebVM (Linux in Browser)...\x1b[0m")
    term.writeln("\x1b[1;30mDownloading ext2 disk image (this may take a minute on first load)...\x1b[0m")

    let cxConsoleWriter: ((data: string | Uint8Array) => void) | null = null;
    let isTerminated = false;

    async function init() {
      try {
        const cx = await getCheerpX();
        term.writeln("\r\n\x1b[1;32m[CheerpX] Engine initialized.\x1b[0m")
        
        term.writeln(`\x1b[1;36m[CheerpX] Cloning repository ${owner}/${repo}...\x1b[0m`)
        const workspacePath = await syncRepoToCheerpX(owner, repo, branch, cx)
        
        term.writeln(`\x1b[1;32m[CheerpX] Repository cloned to ${workspacePath}.\x1b[0m`)
        term.writeln("\x1b[1;36m[CheerpX] Starting bash shell...\x1b[0m\r\n")
        
        setIsLoading(false);
        
        // Setup console redirection
        cxConsoleWriter = cx.setCustomConsole((buf: Uint8Array) => {
          if (!isTerminated) {
            const str = new TextDecoder("utf-8").decode(buf);
            term.write(str);
          }
        }, 80, 24) as any; // Pass cols and rows if needed
        
        // Handle input from xterm.js to CheerpX
        term.onData((data) => {
          if (cxConsoleWriter) {
            // CheerpX console writer accepts strings directly
            cxConsoleWriter(data);
          }
        });
        
        // Auto-type the cd command to enter the workspace, then clear the screen
        setTimeout(() => {
          if (cxConsoleWriter) {
            cxConsoleWriter(`cd ${workspacePath}\r\nclear\r\n`);
          }
        }, 1000);
        
        // Run bash interactively
        await cx.run("/bin/bash", ["--login"]);
        
      } catch (err: any) {
        term.writeln(`\r\n\x1b[1;31m[CheerpX] Error: ${err.message}\x1b[0m`);
        setIsLoading(false);
      }
    }

    init();

    return () => {
      isTerminated = true;
      resizeObserver.disconnect()
      term.dispose()
    }
  }, [owner, repo, branch])

  return (
    <div className="w-full h-full relative group">
      {isLoading && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-zinc-950/80 backdrop-blur-sm">
          <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
          <p className="text-zinc-400 font-mono text-sm animate-pulse">Booting WebVM Engine...</p>
        </div>
      )}
      <div ref={terminalRef} className="w-full h-full" />
    </div>
  )
}
