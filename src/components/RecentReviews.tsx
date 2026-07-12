import { motion, AnimatePresence } from "framer-motion"
import { Clock, Trash2, ChevronRight, Code2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import type { StoredReview } from "@/types/review"
import { cn } from "@/lib/utils"

interface RecentReviewsProps {
  reviews: StoredReview[]
  onSelect: (review: StoredReview) => void
  onDelete: (id: string) => void
  selectedId?: string
}

const languageColors: Record<string, string> = {
  python: "bg-yellow-500/15 text-yellow-600 dark:text-yellow-400",
  javascript: "bg-yellow-400/15 text-yellow-600 dark:text-yellow-400",
  typescript: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
  java: "bg-orange-500/15 text-orange-600 dark:text-orange-400",
  go: "bg-cyan-500/15 text-cyan-600 dark:text-cyan-400",
  rust: "bg-orange-700/15 text-orange-700 dark:text-orange-300",
  cpp: "bg-blue-700/15 text-blue-700 dark:text-blue-300",
  c: "bg-blue-800/15 text-blue-800 dark:text-blue-200",
  csharp: "bg-purple-500/15 text-purple-600 dark:text-purple-400",
  php: "bg-violet-500/15 text-violet-600 dark:text-violet-400",
  html: "bg-red-500/15 text-red-600 dark:text-red-400",
  css: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
}

export function RecentReviews({ reviews, onSelect, onDelete, selectedId }: RecentReviewsProps) {
  if (reviews.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center px-4">
        <Code2 className="size-8 text-muted-foreground/40 mb-3" />
        <p className="text-sm text-muted-foreground">No reviews yet.</p>
        <p className="text-xs text-muted-foreground/60 mt-1">Your reviews will appear here.</p>
      </div>
    )
  }

  return (
    <ScrollArea className="flex-1">
      <div className="p-2 space-y-1">
        <AnimatePresence initial={false}>
          {reviews.map((review) => (
            <motion.div
              key={review.id}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              transition={{ duration: 0.2 }}
            >
              <button
                onClick={() => onSelect(review)}
                className={cn(
                  "w-full text-left rounded-lg p-3 transition-colors group hover:bg-muted/60",
                  selectedId === review.id && "bg-primary/10 ring-1 ring-primary/20"
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5">
                      <Badge
                        className={cn("text-xs px-1.5 py-0 rounded-md font-mono capitalize", languageColors[review.language] || "bg-muted text-muted-foreground")}
                        variant="outline"
                      >
                        {review.language}
                      </Badge>
                      <span className={cn(
                        "text-xs font-bold tabular-nums",
                        review.result.score >= 7 ? "text-green-600 dark:text-green-400" :
                          review.result.score >= 5 ? "text-brand-blue" : "text-severity-critical"
                      )}>
                        {review.result.score}/10
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground font-mono truncate">
                      {review.codeSnippet}
                    </p>
                    <div className="flex items-center gap-1 mt-1.5 text-xs text-muted-foreground/60">
                      <Clock className="size-2.5" />
                      {new Date(review.timestamp).toLocaleString()}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={(e) => {
                        e.stopPropagation()
                        onDelete(review.id)
                      }}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="size-3" />
                    </Button>
                    <ChevronRight className="size-3 text-muted-foreground" />
                  </div>
                </div>
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ScrollArea>
  )
}
