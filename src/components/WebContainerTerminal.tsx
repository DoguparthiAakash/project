import { useEffect, useRef, useState } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";
import { mountRepoAndRun, cleanupTerminalListener } from "../services/webcontainer";
import { detectErrorInLogs, analyzeError, executeFix } from "../services/devops";
import { loadSettings } from "../services/settings";

interface WebContainerTerminalProps {
  owner: string;
  repo: string;
  branch: string;
  onReady?: () => void;
}

export function WebContainerTerminal({ owner, repo, branch, onReady }: WebContainerTerminalProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let processStarted = false;
    let terminalCallback: ((data: string) => void) | null = null;
    let recentLogs = "";
    let isAnalyzing = false;
    
    async function init() {
      if (!terminalRef.current) return;
      
      const term = new Terminal({
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
        terminalCallback = async (data: string) => {
          term.write(data);
          recentLogs += data;
          if (recentLogs.length > 5000) recentLogs = recentLogs.slice(-5000); // Keep last 5k chars
          
          if (!processStarted && (data.includes("Ready") || data.includes("Started") || data.includes("localhost:"))) {
            processStarted = true;
            setLoading(false);
            if (onReady) onReady();
          }

          // Auto-healing DevOps Agent Logic
          if (!isAnalyzing && detectErrorInLogs(data)) {
            isAnalyzing = true;
            term.writeln(`\r\n\x1b[1;33m[DevOps Agent] Detected an error. Analyzing with AI...\x1b[0m`);
            
            const proposal = await analyzeError(owner, repo, recentLogs);
            
            if (proposal) {
              const settings = loadSettings();
              term.writeln(`\r\n\x1b[1;36m[DevOps Agent] Analysis: ${proposal.reasoning}\x1b[0m`);
              
              if (settings.devopsAgentPermission === 'auto') {
                term.writeln(`\r\n\x1b[1;32m[DevOps Agent] Auto-executing fix...\x1b[0m`);
                await executeFix(proposal, (output) => term.write(output));
              } else {
                term.writeln(`\r\n\x1b[1;33m[DevOps Agent] Proposed fix: \`${proposal.command} ${proposal.args.join(' ')}\`\x1b[0m`);
                term.writeln(`\x1b[1;33m[DevOps Agent] Set permission to 'auto' in Settings to execute fixes automatically.\x1b[0m\r\n`);
              }
            } else {
               term.writeln(`\r\n\x1b[1;31m[DevOps Agent] Could not determine a fix.\x1b[0m`);
            }
            
            // Debounce future analysis for a bit
            setTimeout(() => { isAnalyzing = false; }, 10000);
          }
        };

        await mountRepoAndRun(owner, repo, branch, terminalCallback);
      } catch (err: any) {
        term.writeln(`\r\n\x1b[1;31mError starting WebContainer: ${err.message}\x1b[0m`);
        setLoading(false);
      }

      return () => {
        resizeObserver.disconnect();
        if (terminalCallback) {
          cleanupTerminalListener(terminalCallback);
        }
        term.dispose();
      };
    }
    
    const cleanupPromise = init();
    
    return () => {
      cleanupPromise.then(cleanup => cleanup && cleanup());
    };
  }, [owner, repo, branch]);

  return (
    <div className="flex flex-col w-full h-full relative bg-zinc-950">
      <div className="flex-1 w-full h-full p-2 z-10" ref={terminalRef} />
      {loading && (
        <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-full z-20 flex items-center justify-center pointer-events-none border border-white/10 shadow-lg">
          <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white mr-2"></div>
          <span className="text-xs text-white/90 font-medium">Starting Environment...</span>
        </div>
      )}
    </div>
  );
}
