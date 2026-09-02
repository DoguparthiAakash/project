/**
 * EditorBreadcrumb.tsx
 *
 * VS Code-style breadcrumb navigation showing the full path to the open file.
 * Each path segment is rendered with its icon and color.
 * Clicking a segment fires onNavigate(prefix), e.g. "src/components".
 */

import { ChevronRight } from "lucide-react"
import { getFileIcon } from "@/lib/fileIcons"
import { cn } from "@/lib/utils"

interface EditorBreadcrumbProps {
  /** Full relative file path, e.g. "src/components/App.tsx" */
  filePath: string
  /** Optional: called when user clicks a directory segment */
  onNavigate?: (pathPrefix: string) => void
  className?: string
}

export function EditorBreadcrumb({
  filePath,
  onNavigate,
  className,
}: EditorBreadcrumbProps) {
  const parts = filePath.split("/").filter(Boolean)
  const fileInfo = getFileIcon(filePath)

  return (
    <div
      className={cn(
        "flex items-center h-7 px-3 gap-0 overflow-x-auto no-scrollbar",
        "bg-[#0d1117] border-b border-[#21262d] select-none shrink-0",
        className
      )}
      aria-label="File path breadcrumb"
    >
      {parts.map((segment, idx) => {
        const isLast = idx === parts.length - 1
        const prefix = parts.slice(0, idx + 1).join("/")
        const isFile = isLast

        // For intermediate directories, use a folder-ish color
        const segmentColor = isFile ? fileInfo.color : "text-zinc-500"
        const icon = isFile ? fileInfo.icon : "󰉋"

        return (
          <span key={prefix} className="flex items-center shrink-0">
            {/* Segment */}
            <button
              onClick={() => !isLast && onNavigate?.(prefix)}
              className={cn(
                "flex items-center gap-1 px-1 py-0.5 rounded text-[11px] font-mono transition-colors",
                isLast
                  ? `${segmentColor} font-medium cursor-default`
                  : "text-zinc-500 hover:text-zinc-300 hover:bg-white/5 cursor-pointer",
              )}
              title={prefix}
              disabled={isLast}
            >
              {/* Icon — use text character for nerd-font or fall back to nothing */}
              <span
                className={cn("text-[12px] leading-none", segmentColor)}
                aria-hidden
              >
                {icon}
              </span>
              <span>{segment}</span>
            </button>

            {/* Separator */}
            {!isLast && (
              <ChevronRight className="size-3 text-zinc-700 mx-0.5 shrink-0" />
            )}
          </span>
        )
      })}

      {/* Language badge at far right */}
      <span className="ml-auto shrink-0 flex items-center">
        <span
          className={cn(
            "text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border",
            "border-current/30 bg-current/10",
            fileInfo.color,
          )}
        >
          {fileInfo.label}
        </span>
      </span>
    </div>
  )
}
