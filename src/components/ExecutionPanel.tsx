import { useState, useRef, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  Terminal, Play, ChevronDown, ChevronUp, Trash2, Clock,
  CheckCircle2, XCircle, AlertTriangle, Copy, Check, ChevronsDownUp,
  Keyboard,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"
import type { ExecuteResult } from "@/services/api"
import { SUPPORTED_EXEC_LANGUAGES } from "@/services/github"

interface ExecutionPanelProps {
  language: string
  onRun: (stdin: string) => Promise<void>
  result: ExecuteResult | null
  running: boolean
  height?: number
  onHeightChange?: (h: number) => void
}

function StatusBadge({ exitCode }: { exitCode: number }) {
  if (exitCode === 0) return (
    <Badge className="gap-1 text-xs bg-green-500/15 text-green-600 dark:text-green-400 border-green-500/30 border">
      <CheckCircle2 className="size-3" /> Passed
    </Badge>
  )
  if (exitCode === -1) return (
    <Badge className="gap-1 text-xs bg-severity-medium/15 text-severity-medium border-severity-medium/30 border">
      <AlertTriangle className="size-3" /> Timeout
    </Badge>
  )
  return (
    <Badge className="gap-1 text-xs bg-destructive/15 text-destructive border-destructive/30 border">
      <XCircle className="size-3" /> Error ({exitCode})
    </Badge>
  )
}

function OutputLine({ text, type }: { text: string; type: "stdout" | "stderr" | "info" }) {
  return (
    <span className={cn(
      "block whitespace-pre-wrap break-all",
      type === "stderr" && "text-red-400 dark:text-red-400",
      type === "info" && "text-muted-foreground italic",
      type === "stdout" && "text-green-300 dark:text-green-300",
    )}>
      {text}
    </span>
  )
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <Button
      variant="ghost"
      size="icon-xs"
      onClick={() => {
        navigator.clipboard.writeText(text)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      }}
      className="text-muted-foreground hover:text-foreground"
    >
      {copied ? <Check className="size-3 text-green-400" /> : <Copy className="size-3" />}
    </Button>
  )
}

const MIN_HEIGHT = 200
const MAX_HEIGHT = 600
const DEFAULT_HEIGHT = 280

export function ExecutionPanel({
  language,
  onRun,
  result,
  running,
  height = DEFAULT_HEIGHT,
  onHeightChange,
}: ExecutionPanelProps) {
  const [stdin, setStdin] = useState("")
  const [showStdin, setShowStdin] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const terminalRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{ startY: number; startH: number } | null>(null)

  const canExecute = SUPPORTED_EXEC_LANGUAGES.has(language)

  useEffect(() => {
    if (result && terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight
    }
  }, [result])

  const handleDragStart = (e: React.MouseEvent) => {
    e.preventDefault()
    dragRef.current = { startY: e.clientY, startH: height }
    const onMove = (ev: MouseEvent) => {
      if (!dragRef.current) return
      const delta = dragRef.current.startY - ev.clientY
      const newH = Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT, dragRef.current.startH + delta))
      onHeightChange?.(newH)
    }
    const onUp = () => {
      dragRef.current = null
      window.removeEventListener("mousemove", onMove)
      window.removeEventListener("mouseup", onUp)
    }
    window.addEventListener("mousemove", onMove)
    window.addEventListener("mouseup", onUp)
  }

  const handleRun = async () => {
    if (!canExecute || running) return
    await onRun(stdin)
  }

  const outputText = result
    ? [result.stdout, result.stderr].filter(Boolean).join("\n")
    : ""

  return (
    <div className="h-full flex flex-col border-t border-border bg-background">
      {/* Drag handle */}
      <div
        className="shrink-0 h-1 cursor-ns-resize bg-border/50 hover:bg-primary/40 transition-colors"
        onMouseDown={handleDragStart}
      />

      {/* Panel header */}
      <div className="shrink-0 flex items-center gap-2 px-3 h-9 border-b border-border bg-muted/20">
        <Terminal className="size-3.5 text-muted-foreground" />
        <span className="text-xs font-medium text-muted-foreground">Terminal</span>

        {result && !running && (
          <div className="flex items-center gap-2">
            <Separator orientation="vertical" className="h-3.5" />
            <StatusBadge exitCode={result.exitCode} />
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="size-3" />
              {result.time}ms
            </span>
          </div>
        )}

        <div className="flex-1" />

        {!canExecute && (
          <span className="text-xs text-muted-foreground/60">
            {language} execution not supported
          </span>
        )}

        <Button
          variant="ghost"
          size="icon-xs"
          onClick={() => setShowStdin((v) => !v)}
          title="Toggle stdin input"
          className={cn("text-muted-foreground", showStdin && "text-primary")}
        >
          <Keyboard className="size-3.5" />
        </Button>

        {result && (
          <CopyButton text={outputText} />
        )}
        {result && (
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={() => {}}
            title="Clear output"
            className="text-muted-foreground"
          >
            <Trash2 className="size-3.5" />
          </Button>
        )}

        <Button
          variant="ghost"
          size="icon-xs"
          onClick={() => setCollapsed((v) => !v)}
          className="text-muted-foreground"
        >
          {collapsed ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
        </Button>
      </div>

      {!collapsed && (
        <div className="flex flex-1 min-h-0">
          {/* Stdin panel */}
          <AnimatePresence initial={false}>
            {showStdin && (
              <motion.div
                initial={{ width: 0, opacity: 0 }}
                animate={{ width: 200, opacity: 1 }}
                exit={{ width: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="shrink-0 border-r border-border flex flex-col overflow-hidden"
              >
                <div className="px-3 py-1.5 border-b border-border">
                  <span className="text-xs text-muted-foreground font-medium">stdin</span>
                </div>
                <Textarea
                  value={stdin}
                  onChange={(e) => setStdin(e.target.value)}
                  placeholder="Enter input for your program..."
                  className="flex-1 resize-none rounded-none border-0 bg-transparent font-mono text-xs focus-visible:ring-0 text-foreground placeholder:text-muted-foreground/40"
                  spellCheck={false}
                />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Output terminal */}
          <div className="flex-1 flex flex-col min-w-0 bg-zinc-950 dark:bg-zinc-950">
            <div
              ref={terminalRef}
              className="flex-1 overflow-y-auto p-3 font-mono text-xs leading-5 scroll-smooth"
            >
              {running ? (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <motion.span
                    animate={{ opacity: [1, 0.3, 1] }}
                    transition={{ repeat: Infinity, duration: 1 }}
                    className="text-green-400"
                  >
                    ▶
                  </motion.span>
                  <span className="text-zinc-400">Running {language} code...</span>
                </div>
              ) : result ? (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  {/* Compile info */}
                  {result.compiled !== undefined && (
                    <OutputLine
                      text={result.compiled ? "✓ Compiled successfully\n" : "✗ Compilation failed\n"}
                      type={result.compiled ? "info" : "stderr"}
                    />
                  )}
                  {result.compileError && (
                    <OutputLine text={result.compileError + "\n"} type="stderr" />
                  )}
                  {/* stdout */}
                  {result.stdout && (
                    <OutputLine text={result.stdout} type="stdout" />
                  )}
                  {/* stderr */}
                  {result.stderr && !result.compileError && (
                    <OutputLine text={result.stderr} type="stderr" />
                  )}
                  {/* Exit status */}
                  <div className="mt-2 pt-2 border-t border-zinc-800 flex items-center gap-3 text-zinc-500">
                    <span>exit {result.exitCode}</span>
                    <span>·</span>
                    <span>{result.time}ms</span>
                    {result.memoryKb && <><span>·</span><span>{result.memoryKb} KB</span></>}
                  </div>
                </motion.div>
              ) : (
                <span className="text-zinc-600 select-none">
                  Press <span className="text-zinc-400 bg-zinc-800 px-1 py-0.5 rounded text-xs">Run</span> to execute your code
                </span>
              )}
            </div>

            {/* Run button inside terminal */}
            <div className="shrink-0 border-t border-zinc-800 px-3 py-2 flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs text-zinc-500">
                <span className="size-2 rounded-full bg-green-500/70 inline-block" />
                {canExecute ? `${language} ready` : "execution unavailable"}
              </div>
              <Button
                size="xs"
                onClick={handleRun}
                disabled={!canExecute || running}
                className={cn(
                  "gap-1.5 text-xs h-7",
                  canExecute
                    ? "bg-green-600 hover:bg-green-500 text-white"
                    : "opacity-50"
                )}
              >
                {running ? (
                  <>
                    <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 0.8, ease: "linear" }}>
                      <ChevronsDownUp className="size-3" />
                    </motion.div>
                    Running...
                  </>
                ) : (
                  <>
                    <Play className="size-3" />
                    Run
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
