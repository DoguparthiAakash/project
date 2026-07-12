import { useEffect, useState, useRef } from "react"
import { getAgentTaskStatus } from "@/services/api"
import { Loader2, CheckCircle2, XCircle, Terminal } from "lucide-react"
import { Button } from "@/components/ui/button"

interface GenerationOverlayProps {
  taskId: string
  onComplete: (repo: { owner: string; repo: string }) => void
  onCancel: () => void
}

export function GenerationOverlay({ taskId, onComplete, onCancel }: GenerationOverlayProps) {
  const [status, setStatus] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [logMessages, setLogMessages] = useState<string[]>([])
  const logEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>

    const checkStatus = async () => {
      try {
        const data = await getAgentTaskStatus(taskId)
        setStatus(data)
        
        if (data.statusMessage) {
           setLogMessages(prev => {
             if (prev[prev.length - 1] === data.statusMessage) return prev;
             return [...prev, data.statusMessage].slice(-6);
           })
        }
        
        if (data.status === "completed" && data.result) {
          clearInterval(interval)
          setTimeout(() => onComplete(data.result), 1500)
        } else if (data.status === "failed") {
          clearInterval(interval)
          setError(data.error || "Generation failed")
        }
      } catch (err: any) {
        clearInterval(interval)
        setError(err.message || "Failed to fetch task status")
      }
    }

    checkStatus()
    interval = setInterval(checkStatus, 1500)

    return () => clearInterval(interval)
  }, [taskId, onComplete])

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logMessages])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <div className="relative flex flex-col max-w-2xl w-full mx-4 sneat-card overflow-hidden">
        <div className="h-1 bg-primary w-full animate-pulse" />
        
        <div className="p-8">
          <div className="flex items-center gap-4 mb-8 border-b border-border pb-6">
            <div className="p-3 rounded-xl bg-primary/10 relative">
              <div className="absolute inset-0 bg-primary/10 rounded-xl animate-ping opacity-30" />
              <Terminal className="size-8 text-primary" />
            </div>
            <div>
              <h2 className="text-2xl font-bold tracking-tight">
                {status?.status === "completed" ? "Project Generated" : "Generating Project..."}
              </h2>
              <p className="text-primary font-mono text-sm uppercase tracking-widest mt-1 opacity-80 flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                </span>
                Multi-Agent Protocol Running
              </p>
            </div>
          </div>
          
          <div className="font-mono space-y-3 mb-8 h-48 overflow-y-auto pr-2 custom-scrollbar text-sm">
            {error ? (
               <div className="text-destructive flex items-center gap-2 bg-destructive/10 p-3 rounded-lg border border-destructive/20">
                 <XCircle className="size-4" /> [ERROR] {error}
               </div>
            ) : status?.status === "completed" ? (
               <div className="text-green-600 dark:text-green-400 flex items-center gap-2 bg-green-500/10 p-3 rounded-lg border border-green-500/20">
                 <CheckCircle2 className="size-4" /> [SUCCESS] Project generated and pushed to GitHub.
               </div>
            ) : logMessages.length > 0 ? (
               logMessages.map((msg, i) => (
                 <div key={i} className={`flex items-start gap-3 ${i === logMessages.length - 1 ? 'text-foreground' : 'text-muted-foreground'}`}>
                   <span className="text-primary shrink-0 opacity-70 mt-0.5">&gt;</span>
                   <span className={i === logMessages.length - 1 ? "animate-pulse" : ""}>{msg}</span>
                 </div>
               ))
            ) : (
               <div className="flex items-start gap-3 text-muted-foreground">
                 <span className="text-primary shrink-0 opacity-70 mt-0.5">&gt;</span>
                 <span className="animate-pulse">Initializing agents...</span>
               </div>
            )}
            <div ref={logEndRef} />
          </div>

          <div className="flex items-center justify-between mt-4">
            {!error && status?.status !== "completed" ? (
              <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground uppercase tracking-widest">
                <Loader2 className="size-4 animate-spin text-primary" />
                <span>Processing...</span>
              </div>
            ) : (
              <div /> // placeholder for flex layout
            )}

            {error && (
              <Button variant="outline" onClick={onCancel} className="rounded-xl">
                Close
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
