/**
 * FindInFiles.tsx
 *
 * VS Code-style "Find in Files" content search panel.
 *  - Text input with regex / case-sensitive / whole-word toggles
 *  - Fetches up to 30 text files from the GitHub tree and searches content client-side
 *  - Results grouped by file with line numbers and highlighted match snippets
 *  - Clicking a result opens the file and jumps to the line
 */

import { useState, useRef, useCallback } from "react"
import {
  Search, CaseSensitive, Regex, WholeWord,
  FileCode2, Loader2, X, ChevronRight, ChevronDown,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { getFileIcon } from "@/lib/fileIcons"

interface MatchLine {
  lineNumber: number
  lineContent: string
  matchStart: number
  matchEnd: number
}

interface FileMatch {
  path: string
  matches: MatchLine[]
  collapsed: boolean
}

interface FindInFilesProps {
  owner: string
  repo: string
  branch: string
  /** Called when user clicks a match — open the file */
  onFileOpen: (path: string, lineNumber?: number) => void
}

async function fetchFileText(owner: string, repo: string, path: string, branch: string): Promise<string> {
  const res = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}?ref=${branch}`,
    { headers: { Accept: "application/vnd.github.v3.raw" } }
  )
  if (!res.ok) return ""
  return res.text()
}

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function highlightMatch(line: string, start: number, end: number) {
  return (
    <span>
      <span className="text-zinc-400">{line.slice(0, start)}</span>
      <mark className="bg-yellow-400/30 text-yellow-200 rounded-sm">{line.slice(start, end)}</mark>
      <span className="text-zinc-400">{line.slice(end)}</span>
    </span>
  )
}

const SKIP_PATTERNS = [
  /node_modules/i, /\.git\//i, /dist\//i, /build\//i, /\.next\//i,
  /coverage\//i, /\.cache\//i, /\.yarn\//i,
]
const BINARY_EXTS = new Set([
  "png","jpg","jpeg","gif","svg","ico","wasm","zip","gz","tar",
  "pdf","ttf","otf","woff","woff2","exe","bin","lock",
])

function isSkippable(path: string): boolean {
  if (SKIP_PATTERNS.some(r => r.test(path))) return true
  const ext = path.split(".").pop()?.toLowerCase() ?? ""
  return BINARY_EXTS.has(ext)
}

export function FindInFiles({ owner, repo, branch, onFileOpen }: FindInFilesProps) {
  const [query, setQuery] = useState("")
  const [useRegex, setUseRegex] = useState(false)
  const [caseSensitive, setCaseSensitive] = useState(false)
  const [wholeWord, setWholeWord] = useState(false)
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<FileMatch[]>([])
  const [searched, setSearched] = useState(false)
  const [totalMatches, setTotalMatches] = useState(0)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const toggleCollapse = (idx: number) => {
    setResults(prev => prev.map((r, i) => i === idx ? { ...r, collapsed: !r.collapsed } : r))
  }

  const runSearch = useCallback(async () => {
    if (!query.trim()) return
    setLoading(true)
    setResults([])
    setSearched(false)
    setErrorMsg(null)
    abortRef.current?.abort()
    const abort = new AbortController()
    abortRef.current = abort

    try {
      // Fetch the full git tree
      const treeRes = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`,
        { signal: abort.signal }
      )
      if (!treeRes.ok) throw new Error("Failed to fetch repo tree")
      const treeData = await treeRes.json()

      const files: string[] = (treeData.tree ?? [])
        .filter((f: any) => f.type === "blob" && !isSkippable(f.path))
        .map((f: any) => f.path)
        .slice(0, 50)  // cap at 50 files

      // Build search regex
      let pattern: string
      if (useRegex) {
        pattern = query
      } else {
        pattern = escapeRegex(query)
      }
      if (wholeWord) pattern = `\\b${pattern}\\b`
      const flags = caseSensitive ? "gm" : "gim"
      let regex: RegExp
      try {
        regex = new RegExp(pattern, flags)
      } catch {
        setErrorMsg("Invalid regular expression")
        setLoading(false)
        return
      }

      // Fetch files in batches of 5
      const fileMatches: FileMatch[] = []
      let totalM = 0

      for (let i = 0; i < files.length; i += 5) {
        if (abort.signal.aborted) break
        const batch = files.slice(i, i + 5)
        const texts = await Promise.all(
          batch.map(p => fetchFileText(owner, repo, p, branch).catch(() => ""))
        )

        batch.forEach((path, bIdx) => {
          const text = texts[bIdx]
          if (!text) return

          const lines = text.split("\n")
          const matches: MatchLine[] = []

          lines.forEach((lineContent, lineIdx) => {
            // Reset regex lastIndex
            regex.lastIndex = 0
            let m: RegExpExecArray | null
            const singleLineRegex = new RegExp(regex.source, flags.replace("m", ""))

            while ((m = singleLineRegex.exec(lineContent)) !== null) {
              matches.push({
                lineNumber: lineIdx + 1,
                lineContent: lineContent.trim(),
                matchStart: m.index,
                matchEnd: m.index + m[0].length,
              })
              if (!flags.includes("g")) break
              if (singleLineRegex.lastIndex === m.index) {
                singleLineRegex.lastIndex++
              }
            }
          })

          if (matches.length > 0) {
            totalM += matches.length
            fileMatches.push({ path, matches: matches.slice(0, 30), collapsed: false })
          }
        })
      }

      if (!abort.signal.aborted) {
        setResults(fileMatches)
        setTotalMatches(totalM)
        setSearched(true)
      }
    } catch (err: any) {
      if (err.name !== "AbortError") {
        setErrorMsg(err.message ?? "Search failed")
      }
    } finally {
      if (!abort.signal.aborted) setLoading(false)
    }
  }, [query, useRegex, caseSensitive, wholeWord, owner, repo, branch])

  const ToggleBtn = ({
    active, onClick, title, icon,
  }: { active: boolean; onClick: () => void; title: string; icon: React.ReactNode }) => (
    <button
      onClick={onClick}
      title={title}
      className={cn(
        "h-6 w-6 flex items-center justify-center rounded transition-colors text-xs",
        active
          ? "bg-blue-500/20 text-blue-400 border border-blue-500/30"
          : "text-zinc-500 hover:text-zinc-300 hover:bg-white/5",
      )}
    >
      {icon}
    </button>
  )

  return (
    <div className="flex flex-col h-full overflow-hidden bg-background">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Find in Files
      </div>

      {/* Search input */}
      <div className="p-3 space-y-2 shrink-0">
        <div className="flex items-center gap-1 bg-zinc-900 border border-zinc-700 rounded-md px-2 py-1 focus-within:border-blue-500 transition-colors">
          <Search className="size-3 text-zinc-500 shrink-0" />
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === "Enter" && runSearch()}
            placeholder="Search in files..."
            className="flex-1 bg-transparent text-xs text-foreground outline-none placeholder:text-zinc-600 min-w-0"
          />
          {query && (
            <button onClick={() => { setQuery(""); setResults([]); setSearched(false) }}
              className="text-zinc-500 hover:text-zinc-300">
              <X className="size-3" />
            </button>
          )}
        </div>

        {/* Toggles */}
        <div className="flex items-center gap-1.5">
          <ToggleBtn
            active={caseSensitive}
            onClick={() => setCaseSensitive(v => !v)}
            title="Match Case (Alt+C)"
            icon={<CaseSensitive className="size-3" />}
          />
          <ToggleBtn
            active={wholeWord}
            onClick={() => setWholeWord(v => !v)}
            title="Match Whole Word (Alt+W)"
            icon={<WholeWord className="size-3" />}
          />
          <ToggleBtn
            active={useRegex}
            onClick={() => setUseRegex(v => !v)}
            title="Use Regular Expression (Alt+R)"
            icon={<Regex className="size-3" />}
          />

          <Button
            size="sm"
            onClick={runSearch}
            disabled={loading || !query.trim()}
            className="ml-auto h-6 text-[11px] px-3 bg-blue-600 hover:bg-blue-500 text-white"
          >
            {loading ? <Loader2 className="size-3 animate-spin" /> : "Search"}
          </Button>
        </div>

        {/* Result summary */}
        {searched && !loading && (
          <div className="text-[11px] text-zinc-500">
            {totalMatches > 0
              ? `${totalMatches} result${totalMatches !== 1 ? "s" : ""} in ${results.length} file${results.length !== 1 ? "s" : ""}`
              : "No results found"}
          </div>
        )}
        {errorMsg && (
          <div className="text-[11px] text-red-400">{errorMsg}</div>
        )}
      </div>

      {/* Results list */}
      <div className="flex-1 overflow-y-auto px-2 pb-4">
        {results.map((file, fIdx) => {
          const icon = getFileIcon(file.path)
          return (
            <div key={file.path} className="mb-1">
              {/* File header */}
              <button
                onClick={() => toggleCollapse(fIdx)}
                className="w-full flex items-center gap-1.5 px-2 py-1 rounded hover:bg-muted/50 transition-colors text-left group"
              >
                {file.collapsed
                  ? <ChevronRight className="size-3 text-zinc-500 shrink-0" />
                  : <ChevronDown  className="size-3 text-zinc-500 shrink-0" />
                }
                <span className={cn("text-[12px] shrink-0", icon.color)}>{icon.icon}</span>
                <span className="text-[11px] text-zinc-300 font-mono truncate flex-1">
                  {file.path.split("/").pop()}
                </span>
                <span className="text-[10px] text-zinc-600 shrink-0 font-mono">
                  {file.matches.length}
                </span>
              </button>

              {/* File path label */}
              {!file.collapsed && (
                <div className="ml-6 mb-1 text-[10px] text-zinc-600 font-mono truncate px-2">
                  {file.path}
                </div>
              )}

              {/* Match lines */}
              {!file.collapsed && file.matches.map((match, mIdx) => (
                <button
                  key={mIdx}
                  onClick={() => onFileOpen(file.path, match.lineNumber)}
                  className="w-full flex items-start gap-2 px-2 py-0.5 ml-4 rounded hover:bg-blue-500/10 text-left transition-colors"
                >
                  <span className="text-[10px] text-zinc-600 font-mono w-8 shrink-0 text-right pt-0.5">
                    {match.lineNumber}
                  </span>
                  <span className="text-[11px] font-mono truncate">
                    {highlightMatch(match.lineContent, match.matchStart, match.matchEnd)}
                  </span>
                </button>
              ))}
            </div>
          )
        })}

        {/* Loading state */}
        {loading && (
          <div className="flex items-center justify-center py-8 gap-2 text-zinc-500">
            <Loader2 className="size-4 animate-spin" />
            <span className="text-xs">Searching files...</span>
          </div>
        )}
      </div>
    </div>
  )
}
