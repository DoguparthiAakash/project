import { cn } from "@/lib/utils"
import type { Severity } from "@/types/review"

const severityConfig: Record<Severity, { label: string; className: string }> = {
  critical: {
    label: "Critical",
    className: "bg-severity-critical/15 text-severity-critical border-severity-critical/30",
  },
  high: {
    label: "High",
    className: "bg-severity-high/15 text-severity-high border-severity-high/30",
  },
  medium: {
    label: "Medium",
    className: "bg-severity-medium/15 text-severity-medium border-severity-medium/30",
  },
  low: {
    label: "Low",
    className: "bg-severity-low/15 text-severity-low border-severity-low/30",
  },
}

interface SeverityBadgeProps {
  severity: Severity
  className?: string
}

export function SeverityBadge({ severity, className }: SeverityBadgeProps) {
  const config = severityConfig[severity]
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium",
        config.className,
        className
      )}
    >
      {config.label}
    </span>
  )
}
