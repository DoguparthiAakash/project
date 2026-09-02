/**
 * EditorToolbar.tsx
 *
 * VS Code-style action bar that sits between the file tabs and the editor canvas.
 * Actions operate directly on the Monaco editor instance via the passed editorRef.
 *
 * Toolbar items:
 *  - Format Document (Shift+Alt+F)
 *  - Fold All / Unfold All toggle
 *  - Word Wrap cycle (off → on → bounded)
 *  - Minimap toggle
 *  - Go to Line (Ctrl+G)
 *  - Copy full path
 *  - Separator
 *  - Live Ln : Col cursor position
 *  - Selection count (when > 0)
 *  - Encoding badge
 *  - Indentation indicator
 */

import { useRef } from "react"
import type * as monaco from "monaco-editor"
import {
  WrapText, Map, AlignJustify, Fold, Maximize2, ChevronsUpDown,
  Copy, Check, MousePointerClick, FileText,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useState } from "react"

export type WordWrapMode = "off" | "on" | "bounded"

interface EditorToolbarProps {
  /** Stable ref to the mounted Monaco editor instance */
  editorRef: React.RefObject<monaco.editor.IStandaloneCodeEditor | null>
  filePath: string | null
  /** Current cursor position, updated by MonacoEditor's onCursorChange */
  cursorLine: number
  cursorCol: number
  selectionCount: number
  showMinimap: boolean
  onMinimapToggle: () => void
  wordWrap: WordWrapMode
  onWordWrapChange: (next: WordWrapMode) => void
  /** Content of current file (to detect LF vs CRLF) */
  fileContent?: string
  /** Tab size / indent config */
  tabSize?: number
}

const WRAP_CYCLE: WordWrapMode[] = ["on", "off", "bounded"]

function ToolbarButton({
  icon,
  label,
  onClick,
  active = false,
  title,
}: {
  icon: React.ReactNode
  label?: string
  onClick: () => void
  active?: boolean
  title?: string
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={cn(
        "flex items-center gap-1 px-2 h-full text-[11px] font-mono transition-colors",
        "hover:bg-white/5 rounded",
        active
          ? "text-blue-400"
          : "text-zinc-500 hover:text-zinc-300",
      )}
    >
      {icon}
      {label && <span>{label}</span>}
    </button>
  )
}

function ToolbarSep() {
  return <div className="w-px h-4 bg-zinc-800 mx-1 shrink-0" />
}

export function EditorToolbar({
  editorRef,
  filePath,
  cursorLine,
  cursorCol,
  selectionCount,
  showMinimap,
  onMinimapToggle,
  wordWrap,
  onWordWrapChange,
  fileContent = "",
  tabSize = 2,
}: EditorToolbarProps) {
  const [folded, setFolded] = useState(false)
  const [copied, setCopied] = useState(false)

  const runAction = (actionId: string) => {
    editorRef.current?.getAction(actionId)?.run()
  }

  const handleFormat = () => {
    runAction("editor.action.formatDocument")
  }

  const handleFoldToggle = () => {
    if (folded) {
      runAction("editor.unfoldAll")
      setFolded(false)
    } else {
      runAction("editor.foldAll")
      setFolded(true)
    }
  }

  const handleWrapCycle = () => {
    const next = WRAP_CYCLE[(WRAP_CYCLE.indexOf(wordWrap) + 1) % WRAP_CYCLE.length]
    onWordWrapChange(next)
    editorRef.current?.updateOptions({ wordWrap: next })
  }

  const handleGoToLine = () => {
    runAction("editor.action.gotoLine")
  }

  const handleCopyPath = () => {
    if (!filePath) return
    navigator.clipboard.writeText(filePath)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // Detect line ending
  const lineEnding = fileContent.includes("\r\n") ? "CRLF" : "LF"
  // Format cursor info
  const cursorInfo = cursorLine > 0 ? `Ln ${cursorLine}, Col ${cursorCol}` : "—"

  return (
    <div
      className={cn(
        "shrink-0 flex items-center h-7 px-2 gap-0",
        "bg-[#0d1117] border-b border-[#21262d]",
        "overflow-x-auto no-scrollbar",
      )}
      aria-label="Editor toolbar"
    >
      {/* ── Left actions ──────────────────────────────────────────────── */}
      <ToolbarButton
        icon={<AlignJustify className="size-3" />}
        label="Format"
        onClick={handleFormat}
        title="Format Document (Shift+Alt+F)"
      />

      <ToolbarButton
        icon={folded ? <Maximize2 className="size-3" /> : <Fold className="size-3" />}
        label={folded ? "Unfold" : "Fold All"}
        onClick={handleFoldToggle}
        title={folded ? "Unfold All" : "Fold All"}
      />

      <ToolbarButton
        icon={<WrapText className="size-3" />}
        label={wordWrap === "off" ? "Wrap Off" : wordWrap === "bounded" ? "Bounded" : "Wrap On"}
        onClick={handleWrapCycle}
        active={wordWrap !== "off"}
        title="Toggle Word Wrap"
      />

      <ToolbarButton
        icon={<Map className="size-3" />}
        label="Minimap"
        onClick={onMinimapToggle}
        active={showMinimap}
        title="Toggle Minimap"
      />

      <ToolbarButton
        icon={<ChevronsUpDown className="size-3" />}
        label="Go to Line"
        onClick={handleGoToLine}
        title="Go to Line (Ctrl+G)"
      />

      {filePath && (
        <ToolbarButton
          icon={copied ? <Check className="size-3 text-green-400" /> : <Copy className="size-3" />}
          label="Copy Path"
          onClick={handleCopyPath}
          title="Copy file path to clipboard"
        />
      )}

      {/* ── Spacer ────────────────────────────────────────────────────── */}
      <div className="flex-1" />

      {/* ── Right: status indicators ──────────────────────────────────── */}
      <ToolbarSep />

      {/* Cursor position */}
      <button
        onClick={handleGoToLine}
        title="Go to line / column"
        className="flex items-center gap-1 px-2 h-full text-[11px] font-mono text-zinc-400 hover:text-zinc-200 hover:bg-white/5 rounded transition-colors"
      >
        <MousePointerClick className="size-3 text-zinc-600" />
        <span>{cursorInfo}</span>
        {selectionCount > 0 && (
          <span className="text-blue-400 ml-1">
            ({selectionCount} sel)
          </span>
        )}
      </button>

      <ToolbarSep />

      {/* Line ending */}
      <span className="px-2 text-[11px] font-mono text-zinc-500">
        {lineEnding}
      </span>

      <ToolbarSep />

      {/* Indentation */}
      <span className="px-2 text-[11px] font-mono text-zinc-500">
        Spaces: {tabSize}
      </span>

      <ToolbarSep />

      {/* Encoding */}
      <span className="px-2 text-[11px] font-mono text-zinc-500">
        UTF-8
      </span>
    </div>
  )
}
