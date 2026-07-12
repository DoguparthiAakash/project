import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  ChevronDown, Bug, ShieldCheck, Zap, BookOpen,
  Star, Wind, Smile, Clock, Database, CheckCircle2,
  Code2, FileText, Copy, Download, Check,
} from "lucide-react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { ScoreRing } from "@/components/ScoreRing"
import { ProgressBar } from "@/components/ProgressBar"
import { SeverityBadge } from "@/components/SeverityBadge"
import type { ReviewResult, ReviewIssue } from "@/types/review"

interface IssueListProps {
  issues: ReviewIssue[]
  emptyMessage?: string
}

function IssueList({ issues, emptyMessage = "No issues found." }: IssueListProps) {
  if (issues.length === 0) {
    return (
      <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
        <CheckCircle2 className="size-4 text-green-500" />
        {emptyMessage}
      </div>
    )
  }
  return (
    <div className="space-y-3">
      {issues.map((issue, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.05 }}
          className="rounded-lg border border-border/60 bg-muted/30 p-4"
        >
          <div className="flex items-start justify-between gap-3 mb-2">
            <p className="font-medium text-sm leading-tight">{issue.title}</p>
            <div className="flex items-center gap-2 shrink-0">
              {issue.line && (
                <Badge variant="outline" className="text-xs font-mono">L{issue.line}</Badge>
              )}
              <SeverityBadge severity={issue.severity} />
            </div>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">{issue.description}</p>
        </motion.div>
      ))}
    </div>
  )
}

interface CollapsibleSectionProps {
  title: string
  icon: React.ElementType
  count: number
  children: React.ReactNode
  defaultOpen?: boolean
}

function CollapsibleSection({ title, icon: Icon, count, children, defaultOpen = false }: CollapsibleSectionProps) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="border border-border/60 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between p-4 hover:bg-muted/40 transition-colors"
      >
        <div className="flex items-center gap-3">
          <Icon className="size-4 text-muted-foreground" />
          <span className="font-medium text-sm">{title}</span>
          {count > 0 && (
            <Badge variant="secondary" className="text-xs px-2 py-0.5 rounded-full">{count}</Badge>
          )}
        </div>
        <ChevronDown
          className={`size-4 text-muted-foreground transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="p-4 pt-0 border-t border-border/60">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

interface CopyButtonProps {
  text: string
}

function CopyButton({ text }: CopyButtonProps) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <Button variant="ghost" size="icon-sm" onClick={copy}>
      {copied ? <Check className="size-3.5 text-green-500" /> : <Copy className="size-3.5" />}
    </Button>
  )
}

interface ReviewPanelProps {
  result: ReviewResult
  language: string
}

export function ReviewPanel({ result, language }: ReviewPanelProps) {
  const totalIssues =
    result.bugs.length +
    result.security.length +
    result.performance.length +
    result.maintainability.length +
    result.codeSmells.length

  const downloadCode = () => {
    const ext: Record<string, string> = {
      python: "py", javascript: "js", typescript: "ts", java: "java",
      go: "go", rust: "rs", cpp: "cpp", c: "c", csharp: "cs", php: "php",
    }
    const blob = new Blob([result.optimizedCode], { type: "text/plain" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `optimized.${ext[language] || "txt"}`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <ScrollArea className="h-full">
      <div className="p-4 space-y-5">
        {/* Overview card */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="p-6 bg-gradient-to-br from-brand-blue/5 to-brand-violet/5 border-primary/20">
            <div className="flex flex-col sm:flex-row items-center gap-6">
              <ScoreRing score={result.score} size={110} />
              <div className="flex-1 min-w-0 text-center sm:text-left">
                <h3 className="font-semibold text-lg mb-1">Overall Assessment</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{result.summary}</p>
                <div className="flex items-center justify-center sm:justify-start gap-4 mt-3">
                  <span className="text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">{totalIssues}</span> issues found
                  </span>
                  <Separator orientation="vertical" className="h-3" />
                  <span className="text-xs text-muted-foreground font-mono">
                    {result.timeComplexity.split(" ")[0]}
                  </span>
                </div>
              </div>
            </div>
          </Card>
        </motion.div>

        {/* Metrics */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card className="p-5 space-y-4">
            <h4 className="font-medium text-sm">Code Metrics</h4>
            <ProgressBar
              label="Code Quality"
              value={result.score}
              max={10}
            />
            <ProgressBar
              label="Security"
              value={Math.max(1, 10 - result.security.filter(i => i.severity === "critical" || i.severity === "high").length * 2)}
              max={10}
            />
            <ProgressBar
              label="Performance"
              value={Math.max(1, 10 - result.performance.length)}
              max={10}
            />
            <ProgressBar
              label="Maintainability"
              value={Math.max(1, 10 - result.maintainability.length)}
              max={10}
            />
          </Card>
        </motion.div>

        {/* Complexity */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          <Card className="p-5">
            <h4 className="font-medium text-sm mb-4">Complexity Analysis</h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-lg bg-muted/50 p-3">
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="size-3.5 text-brand-blue" />
                  <span className="text-xs font-medium text-muted-foreground">Time</span>
                </div>
                <p className="text-sm font-semibold font-mono">{result.timeComplexity.split(" ")[0]}</p>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  {result.timeComplexity.substring(result.timeComplexity.indexOf(" ") + 1)}
                </p>
              </div>
              <div className="rounded-lg bg-muted/50 p-3">
                <div className="flex items-center gap-2 mb-2">
                  <Database className="size-3.5 text-brand-purple" />
                  <span className="text-xs font-medium text-muted-foreground">Space</span>
                </div>
                <p className="text-sm font-semibold font-mono">{result.spaceComplexity.split(" ")[0]}</p>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  {result.spaceComplexity.substring(result.spaceComplexity.indexOf(" ") + 1)}
                </p>
              </div>
            </div>
          </Card>
        </motion.div>

        {/* Issues tabs */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Tabs defaultValue="issues">
            <TabsList className="w-full grid grid-cols-3 h-9">
              <TabsTrigger value="issues" className="text-xs">Issues</TabsTrigger>
              <TabsTrigger value="optimized" className="text-xs">Optimized</TabsTrigger>
              <TabsTrigger value="extras" className="text-xs">Extras</TabsTrigger>
            </TabsList>

            <TabsContent value="issues" className="mt-4 space-y-3">
              <CollapsibleSection title="Bugs" icon={Bug} count={result.bugs.length} defaultOpen>
                <IssueList issues={result.bugs} emptyMessage="No bugs detected." />
              </CollapsibleSection>
              <CollapsibleSection title="Security" icon={ShieldCheck} count={result.security.length} defaultOpen={result.security.length > 0}>
                <IssueList issues={result.security} emptyMessage="No security issues found." />
              </CollapsibleSection>
              <CollapsibleSection title="Performance" icon={Zap} count={result.performance.length}>
                <IssueList issues={result.performance} emptyMessage="No performance issues." />
              </CollapsibleSection>
              <CollapsibleSection title="Maintainability" icon={BookOpen} count={result.maintainability.length}>
                <IssueList issues={result.maintainability} emptyMessage="Good maintainability." />
              </CollapsibleSection>
              <CollapsibleSection title="Code Smells" icon={Wind} count={result.codeSmells.length}>
                <IssueList issues={result.codeSmells} emptyMessage="No code smells detected." />
              </CollapsibleSection>
              <CollapsibleSection title="Readability" icon={Smile} count={result.readability.length}>
                <IssueList issues={result.readability} emptyMessage="Code is readable." />
              </CollapsibleSection>
              <CollapsibleSection title="Best Practices" icon={Star} count={result.bestPractices.length}>
                <IssueList issues={result.bestPractices} emptyMessage="Follows best practices." />
              </CollapsibleSection>
            </TabsContent>

            <TabsContent value="optimized" className="mt-4 space-y-3">
              <Card className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-medium text-sm flex items-center gap-2">
                    <Code2 className="size-4 text-brand-blue" />
                    Optimized Code
                  </h4>
                  <div className="flex gap-2">
                    <CopyButton text={result.optimizedCode} />
                    <Button variant="ghost" size="icon-sm" onClick={downloadCode}>
                      <Download className="size-3.5" />
                    </Button>
                  </div>
                </div>
                <pre className="text-xs font-mono bg-muted/50 rounded-lg p-4 overflow-x-auto whitespace-pre-wrap break-all leading-relaxed">
                  {result.optimizedCode}
                </pre>
              </Card>
              {result.explanation && (
                <Card className="p-4">
                  <h4 className="font-medium text-sm flex items-center gap-2 mb-3">
                    <Star className="size-4 text-brand-purple" />
                    Explanation of Improvements
                  </h4>
                  <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
                    {result.explanation}
                  </p>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="extras" className="mt-4 space-y-3">
              {result.unitTests ? (
                <Card className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-medium text-sm flex items-center gap-2">
                      <CheckCircle2 className="size-4 text-green-500" />
                      Unit Tests
                    </h4>
                    <CopyButton text={result.unitTests} />
                  </div>
                  <pre className="text-xs font-mono bg-muted/50 rounded-lg p-4 overflow-x-auto whitespace-pre-wrap break-all leading-relaxed">
                    {result.unitTests}
                  </pre>
                </Card>
              ) : null}
              {result.documentation ? (
                <Card className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-medium text-sm flex items-center gap-2">
                      <FileText className="size-4 text-brand-violet" />
                      Documentation
                    </h4>
                    <CopyButton text={result.documentation} />
                  </div>
                  <pre className="text-xs font-mono bg-muted/50 rounded-lg p-4 overflow-x-auto whitespace-pre-wrap break-all leading-relaxed">
                    {result.documentation}
                  </pre>
                </Card>
              ) : null}
              {!result.unitTests && !result.documentation && (
                <div className="py-12 text-center text-sm text-muted-foreground">
                  <FileText className="size-8 mx-auto mb-3 opacity-40" />
                  <p>Use the "Generate Tests" or "Generate Docs" mode to get extras.</p>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </motion.div>
      </div>
    </ScrollArea>
  )
}
