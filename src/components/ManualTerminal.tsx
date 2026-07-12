import { useEffect, useRef } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";
import { getWebContainer } from "../services/webcontainer";

export function ManualTerminal() {
  const terminalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let processStarted = false;
    let shellProcess: any = null;
    let term: Terminal | null = null;
    
    async function init() {
      if (!terminalRef.current) return;
      
      term = new Terminal({
        theme: {
          background: "#09090b", // zinc-950
          foreground: "#f4f4f5", // zinc-100
          cursor: "#f4f4f5",
          selectionBackground: "#27272a", // zinc-800
        },
        fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
        fontSize: 13,
        cursorBlink: true,
        convertEol: true,
      });
      
      const fitAddon = new FitAddon();
      term.loadAddon(fitAddon);
      term.open(terminalRef.current);
      
      // Initial fit and handle resize
      setTimeout(() => fitAddon.fit(), 100);
      const resizeObserver = new ResizeObserver(() => fitAddon.fit());
      resizeObserver.observe(terminalRef.current);

      try {
        term.writeln("\x1b[1;36mInitializing Manual Terminal...\x1b[0m");
        const wc = await getWebContainer();

        // Open an interactive shell
        shellProcess = await wc.spawn('jsh');
        
        // Connect xterm to the shell
        shellProcess.output.pipeTo(new WritableStream({
          write(data) {
            term?.write(data);
            if (!processStarted && data.includes("$")) {
              processStarted = true;
            }
          }
        }));

        term.onData((data) => {
          if (shellProcess) {
            shellProcess.input.getWriter().write(data);
          }
        });

      } catch (err: any) {
        term.writeln(`\r\n\x1b[1;31mError starting Manual Terminal: ${err.message}\x1b[0m`);
      }

      return () => {
        resizeObserver.disconnect();
        if (shellProcess) shellProcess.kill();
        if (term) term.dispose();
      };
    }
    
    const cleanupPromise = init();
    
    return () => {
      cleanupPromise.then(cleanup => cleanup && cleanup());
    };
  }, []);

  return (
    <div className="flex flex-col w-full h-full relative bg-zinc-950">
      <div className="flex-1 w-full h-full p-2 z-10" ref={terminalRef} />
    </div>
  );
}
