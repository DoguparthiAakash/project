/**
 * CommandPalette.tsx
 *
 * VS Code-style Ctrl+Shift+P / Ctrl+P command palette.
 *
 * Opens as a centered modal overlay.
 * Categories:
 *  - Files     — recently opened or all repo files (fuzzy match on path)
 *  - Actions   — editor actions (format, fold, go to line, toggle wrap…)
 *  - Settings  — quick settings toggles (minimap, theme…)
 *
 * Usage: controlled via `open` / `onClose` props.
 *        Parent passes `editorRef` so actions can call `editor.getAction(…).run()`.
 */

import { useState, useEffect, useRef, useCallback } from "react"
import { AnimatePresence, motion } from "framer-motion"
import {
  Search, FileCode2, Zap, Settings2, AlignJustify,
  ChevronsUpDown, FoldVertical, Map, WrapText, GitBranch,
  Play, Sparkles, ArrowRight, X,
} from "lucide-react"
import type * as monaco from "monaco-editor"
import { cn } from "@/lib/utils"
import { getFileIcon } from "@/lib/fileIcons"

// ─── Command definitions ──────────────────────────────────────────────────────

type CommandCategory = "file" | "action" | "setting"

interface Command {
  id: string
  label: string
  description?: string
  category: CommandCategory
  icon: React.ReactNode
  keybind?: string
  run: () => void
}

interface CommandPaletteProps {
  open: boolean
  onClose: () => void
  editorRef: React.RefObject<monaco.editor.IStandaloneCodeEditor | null>
  openFiles: string[]
  recentFiles: string[]
  allFiles?: string[]
  onFileOpen: (path: string) => void
  showMinimap: boolean
  onMinimapToggle: () => void
  wordWrap: "off" | "on" | "bounded"
  onWordWrapChange: (v: "off" | "on" | "bounded") => void
}

// Simple fuzzy match: returns true if all chars of needle appear in order in haystack
function fuzzyMatch(needle: string, haystack: string): boolean {
  if (!needle) return true
  const n = needle.toLowerCase()
  const h = haystack.toLowerCase()
  let ni = 0
  for (let hi = 0; hi < h.length && ni < n.length; hi++) {
    if (h[hi] === n[ni]) ni++
  }
  return ni === n.length
}

// Scoring: consecutive matches score higher
function fuzzyScore(needle: string, haystack: string): number {
  if (!needle) return 0
  const n = needle.toLowerCase()
  const h = haystack.toLowerCase()
  let score = 0
  let consecutive = 0
  let ni = 0
  for (let hi = 0; hi < h.length && ni < n.length; hi++) {
    if (h[hi] === n[ni]) {
      score += 1 + consecutive * 2
      consecutive++
      ni++
    } else {
      consecutive = 0
    }
  }
  return score
}

const CATEGORY_LABELS: Record<CommandCategory, string> = {
  file: "Open File",
  action: "Editor Action",
  setting: "Setting",
}

const CATEGORY_ICONS: Record<CommandCategory, React.ReactNode> = {
  file:    <FileCode2 className="size-3 text-blue-400" />,
  action:  <Zap       className="size-3 text-yellow-400" />,
  setting: <Settings2 className="size-3 text-purple-400" />,
}

export function CommandPalette({
  open,
  onClose,
  editorRef,
  openFiles,
  recentFiles,
  allFiles = [],
  onFileOpen,
  showMinimap,
  onMinimapToggle,
  wordWrap,
  onWordWrapChange,
}: CommandPaletteProps) {
  const [query, setQuery] = useState("")
  const [selectedIdx, setSelectedIdx] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const runAction = useCallback((id: string) => {
    editorRef.current?.getAction(id)?.run()
  }, [editorRef])

  // ── Static action commands
  const actionCommands: Command[] = [
    {
      id: "action.format",
      label: "Format Document",
      description: "Reformat the entire file",
      category: "action",
      icon: <AlignJustify className="size-3.5" />,
      keybind: "Shift+Alt+F",
      run: () => runAction("editor.action.formatDocument"),
    },
    {
      id: "action.foldAll",
      label: "Fold All",
      description: "Collapse all code blocks",
      category: "action",
      icon: <FoldVertical className="size-3.5" />,
      run: () => runAction("editor.foldAll"),
    },
    {
      id: "action.unfoldAll",
      label: "Unfold All",
      description: "Expand all code blocks",
      category: "action",
      icon: <FoldVertical className="size-3.5" />,
      run: () => runAction("editor.unfoldAll"),
    },
    {
      id: "action.gotoLine",
      label: "Go to Line...",
      description: "Jump to a specific line number",
      category: "action",
      icon: <ChevronsUpDown className="size-3.5" />,
      keybind: "Ctrl+G",
      run: () => runAction("editor.action.gotoLine"),
    },
    {
      id: "action.findReplace",
      label: "Find and Replace",
      description: "Open the find & replace widget",
      category: "action",
      icon: <Search className="size-3.5" />,
      keybind: "Ctrl+H",
      run: () => runAction("editor.action.startFindReplaceAction"),
    },
    {
      id: "action.rename",
      label: "Rename Symbol",
      description: "Rename all occurrences of a symbol",
      category: "action",
      icon: <ArrowRight className="size-3.5" />,
      keybind: "F2",
      run: () => runAction("editor.action.rename"),
    },
    {
      id: "action.comment",
      label: "Toggle Line Comment",
      category: "action",
      icon: <span className="text-[11px] font-mono">//</span>,
      keybind: "Ctrl+/",
      run: () => runAction("editor.action.commentLine"),
    },
    {
      id: "action.selectAll",
      label: "Select All Occurrences",
      category: "action",
      icon: <Zap className="size-3.5" />,
      keybind: "Ctrl+Shift+L",
      run: () => runAction("editor.action.selectHighlights"),
    },
    {
      id: "action.sortLines",
      label: "Sort Lines Ascending",
      category: "action",
      icon: <AlignJustify className="size-3.5" />,
      run: () => runAction("editor.action.sortLinesAscending"),
    },
    {
      id: "action.trimTrailing",
      label: "Trim Trailing Whitespace",
      category: "action",
      icon: <X className="size-3.5" />,
      run: () => runAction("editor.action.trimTrailingWhitespace"),
    },
  ]

  const settingCommands: Command[] = [
    {
      id: "setting.minimap",
      label: showMinimap ? "Hide Minimap" : "Show Minimap",
      description: "Toggle the minimap sidebar",
      category: "setting",
      icon: <Map className="size-3.5" />,
      run: onMinimapToggle,
    },
    {
      id: "setting.wrap",
      label: wordWrap === "off" ? "Enable Word Wrap" : "Disable Word Wrap",
      description: "Toggle soft line wrapping",
      category: "setting",
      icon: <WrapText className="size-3.5" />,
      keybind: "Alt+Z",
      run: () => onWordWrapChange(wordWrap === "off" ? "on" : "off"),
    },
  ]

  // ── File commands — deduped union of recent + open + all
  const uniqueFilePaths = Array.from(
    new Set([...openFiles, ...recentFiles, ...allFiles])
  )
  const fileCommands: Command[] = uniqueFilePaths.map(path => ({
    id: `file.${path}`,
    label: path.split("/").pop() ?? path,
    description: path,
    category: "file" as CommandCategory,
    icon: (
      <span className={cn("text-[12px] leading-none", getFileIcon(path).color)}>
        {getFileIcon(path).icon}
      </span>
    ),
    run: () => onFileOpen(path),
  }))

  // ── All commands merged
  const allCommands = [...fileCommands, ...actionCommands, ...settingCommands]

  // ── Filter + sort
  const filtered = query
    ? allCommands
        .filter(c => fuzzyMatch(query, c.label) || fuzzyMatch(query, c.description ?? ""))
        .sort((a, b) => {
          const sa = Math.max(fuzzyScore(query, a.label), fuzzyScore(query, a.description ?? ""))
          const sb = Math.max(fuzzyScore(query, b.label), fuzzyScore(query, b.description ?? ""))
          return sb - sa
        })
    : allCommands

  // Reset selection when filter changes
  useEffect(() => setSelectedIdx(0), [query])

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setQuery("")
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  // Scroll selected item into view
  useEffect(() => {
    const item = listRef.current?.children[selectedIdx] as HTMLElement | undefined
    item?.scrollIntoView({ block: "nearest" })
  }, [selectedIdx])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault()
      setSelectedIdx(i => Math.min(i + 1, filtered.length - 1))
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setSelectedIdx(i => Math.max(i - 1, 0))
    } else if (e.key === "Enter") {
      e.preventDefault()
      if (filtered[selectedIdx]) {
        filtered[selectedIdx].run()
        onClose()
      }
    } else if (e.key === "Escape") {
      onClose()
    }
  }

  // Group visible results by category
  const grouped: Partial<Record<CommandCategory, Command[]>> = {}
  for (const cmd of filtered) {
    if (!grouped[cmd.category]) grouped[cmd.category] = []
    grouped[cmd.category]!.push(cmd)
  }

  let flatIdx = 0 // Running index to match selectedIdx against flat list

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.12 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Palette modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -10 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className={cn(
              "fixed z-50 top-[10%] left-1/2 -translate-x-1/2",
              "w-full max-w-[600px] mx-4",
              "bg-[#161b22] border border-[#30363d] rounded-xl shadow-2xl overflow-hidden",
            )}
          >
            {/* Search input */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-[#21262d]">
              <Search className="size-4 text-zinc-500 shrink-0" />
              <input
                ref={inputRef}
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type a command or file name..."
                className="flex-1 bg-transparent text-sm text-zinc-200 outline-none placeholder:text-zinc-600"
              />
              {query && (
                <button onClick={() => setQuery("")} className="text-zinc-600 hover:text-zinc-400">
                  <X className="size-3.5" />
                </button>
              )}
              <kbd className="text-[10px] font-mono text-zinc-600 border border-zinc-700 rounded px-1.5 py-0.5">
                esc
              </kbd>
            </div>

            {/* Results */}
            <div
              ref={listRef}
              className="max-h-[420px] overflow-y-auto py-1"
            >
              {filtered.length === 0 ? (
                <div className="py-8 text-center text-sm text-zinc-600">
                  No results for "{query}"
                </div>
              ) : (
                (["file", "action", "setting"] as CommandCategory[]).map(cat => {
                  const items = grouped[cat]
                  if (!items || items.length === 0) return null

                  return (
                    <div key={cat}>
                      {/* Category header */}
                      <div className="flex items-center gap-2 px-4 py-1.5 mt-1">
                        {CATEGORY_ICONS[cat]}
                        <span className="text-[10px] font-semibold uppercase tracking-widest text-zinc-600">
                          {CATEGORY_LABELS[cat]}
                        </span>
                      </div>

                      {/* Items */}
                      {items.map(cmd => {
                        const myIdx = flatIdx++
                        const isSelected = myIdx === selectedIdx
                        return (
                          <button
                            key={cmd.id}
                            onClick={() => { cmd.run(); onClose() }}
                            onMouseEnter={() => setSelectedIdx(myIdx)}
                            className={cn(
                              "w-full flex items-center gap-3 px-4 py-2 text-left transition-colors",
                              isSelected
                                ? "bg-[#1f6feb44] text-zinc-100"
                                : "text-zinc-400 hover:text-zinc-200",
                            )}
                          >
                            {/* Icon */}
                            <span className="shrink-0 w-4 flex items-center justify-center">
                              {cmd.icon}
                            </span>

                            {/* Label + description */}
                            <span className="flex-1 min-w-0">
                              <span className="text-sm block">{cmd.label}</span>
                              {cmd.description && cmd.description !== cmd.label && (
                                <span className="text-[11px] text-zinc-600 truncate block">
                                  {cmd.description}
                                </span>
                              )}
                            </span>

                            {/* Keybind badge */}
                            {cmd.keybind && (
                              <kbd className="shrink-0 text-[10px] font-mono text-zinc-600 border border-zinc-800 rounded px-1.5 py-0.5 bg-zinc-900">
                                {cmd.keybind}
                              </kbd>
                            )}
                          </button>
                        )
                      })}
                    </div>
                  )
                })
              )}
            </div>

            {/* Footer hint */}
            <div className="border-t border-[#21262d] px-4 py-2 flex items-center gap-4 text-[10px] text-zinc-600 font-mono">
              <span><kbd className="border border-zinc-700 rounded px-1">↑↓</kbd> navigate</span>
              <span><kbd className="border border-zinc-700 rounded px-1">↵</kbd> select</span>
              <span><kbd className="border border-zinc-700 rounded px-1">esc</kbd> close</span>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
