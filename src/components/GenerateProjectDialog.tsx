import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Bot, Sparkles, Globe, Lock, Loader2 } from "lucide-react"

interface GenerateProjectDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (data: any) => void
  isSubmitting?: boolean
}

export function GenerateProjectDialog({ open, onOpenChange, onSubmit, isSubmitting }: GenerateProjectDialogProps) {
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [techStack, setTechStack] = useState("React + Node.js")
  const [prompt, setPrompt] = useState("")
  const [isPrivate, setIsPrivate] = useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name || !prompt) return
    onSubmit({ name, description, techStack, prompt, isPrivate })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] bg-card border-border shadow-md rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3 text-2xl font-bold tracking-tight">
            <Bot className="h-7 w-7 text-primary" />
            New Project
          </DialogTitle>
          <DialogDescription className="text-muted-foreground text-base leading-relaxed">
            Provide the parameters for your new project. CodeSage AI will scaffold the core systems and deploy them directly to your repository network.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 mt-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-foreground font-semibold">Name <span className="text-primary">*</span></Label>
              <Input
                id="name"
                placeholder="e.g. my-app"
                value={name}
                onChange={(e) => setName(e.target.value.replace(/[^a-zA-Z0-9-_]/g, ""))}
                required
                className="bg-background border-border focus-visible:ring-primary/50 rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="visibility" className="text-foreground font-semibold">Visibility</Label>
              <div className="flex items-center space-x-2 bg-background border border-border rounded-xl p-2 h-10">
                <Switch
                  id="visibility"
                  checked={isPrivate}
                  onCheckedChange={setIsPrivate}
                  className="data-[state=checked]:bg-primary"
                />
                <Label htmlFor="visibility" className="flex items-center gap-2 cursor-pointer text-sm text-muted-foreground font-medium">
                  {isPrivate ? <Lock className="h-4 w-4 text-primary" /> : <Globe className="h-4 w-4 text-blue-500" />}
                  {isPrivate ? "Private" : "Public"}
                </Label>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description" className="text-foreground font-semibold">Description (Optional)</Label>
            <Input
              id="description"
              placeholder="What is this project about?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="bg-background border-border focus-visible:ring-primary/50 rounded-xl"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="techStack" className="text-foreground font-semibold">Tech Stack</Label>
            <Select value={techStack} onValueChange={setTechStack}>
              <SelectTrigger className="bg-background border-border focus:ring-primary/50 rounded-xl">
                <SelectValue placeholder="Select a framework" />
              </SelectTrigger>
              <SelectContent className="bg-popover border-border rounded-xl shadow-md">
                <SelectItem value="React + Node.js (Express)" className="cursor-pointer rounded-md">React + Node.js (Express)</SelectItem>
                <SelectItem value="Next.js + TypeScript + Tailwind" className="cursor-pointer rounded-md">Next.js + TypeScript + Tailwind</SelectItem>
                <SelectItem value="Vue + Node.js (Express)" className="cursor-pointer rounded-md">Vue + Node.js (Express)</SelectItem>
                <SelectItem value="Vanilla HTML/JS/CSS" className="cursor-pointer rounded-md">Vanilla HTML/JS/CSS</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="prompt" className="text-foreground font-semibold">Detailed Specifications <span className="text-primary">*</span></Label>
            <Textarea
              id="prompt"
              placeholder="Describe the modules, data schemas, API routes, or specific interface components you require..."
              className="min-h-[120px] bg-background border-border focus-visible:ring-primary/50 custom-scrollbar resize-none rounded-xl"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              required
            />
          </div>

          <DialogFooter className="pt-2 border-t border-border mt-4">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={isSubmitting} className="hover:bg-muted text-muted-foreground rounded-xl">
              Cancel
            </Button>
            <Button type="submit" disabled={!name || !prompt || isSubmitting} className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl px-6 shadow-sm">
              {isSubmitting ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="size-4" />
                  Generate
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
