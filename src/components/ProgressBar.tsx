import { motion } from "framer-motion"
import { cn } from "@/lib/utils"

interface ProgressBarProps {
  value: number
  max?: number
  label?: string
  className?: string
  colorClass?: string
}

export function ProgressBar({ value, max = 10, label, className, colorClass }: ProgressBarProps) {
  const percentage = Math.min(100, (value / max) * 100)

  const getDefaultColor = () => {
    if (percentage >= 80) return "bg-green-500"
    if (percentage >= 60) return "bg-brand-blue"
    if (percentage >= 40) return "bg-severity-medium"
    return "bg-severity-critical"
  }

  return (
    <div className={cn("space-y-1.5", className)}>
      {label && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">{label}</span>
          <span className="font-medium tabular-nums">{value}/{max}</span>
        </div>
      )}
      <div className="h-2 w-full rounded-full bg-secondary overflow-hidden">
        <motion.div
          className={cn("h-full rounded-full", colorClass || getDefaultColor())}
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        />
      </div>
    </div>
  )
}
