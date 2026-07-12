import { motion } from "framer-motion"
import { cn } from "@/lib/utils"

interface ScoreRingProps {
  score: number
  size?: number
  strokeWidth?: number
  className?: string
}

export function ScoreRing({ score, size = 120, strokeWidth = 8, className }: ScoreRingProps) {
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const progress = (score / 10) * circumference
  const offset = circumference - progress

  const getScoreColor = (s: number) => {
    if (s >= 8) return "oklch(0.6 0.15 180)"
    if (s >= 6) return "var(--brand-blue)"
    if (s >= 4) return "var(--severity-medium)"
    return "var(--severity-critical)"
  }

  return (
    <div className={cn("relative inline-flex items-center justify-center", className)}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-border"
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={getScoreColor(score)}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.2, ease: "easeOut" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <motion.span
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.5, duration: 0.4 }}
          className="text-2xl font-bold tabular-nums"
        >
          {score}
        </motion.span>
        <span className="text-xs text-muted-foreground">/10</span>
      </div>
    </div>
  )
}
