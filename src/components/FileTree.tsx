import { useState, useEffect } from "react"
import { ChevronRight, ChevronDown, File, Folder, Loader2, Plus, Trash2 } from "lucide-react"
import { ghGetContents, type GHContent } from "@/services/api"
import { cn } from "@/lib/utils"

interface FileTreeProps {
  owner: string
  repo: string
  branch: string
  onSelectFile: (path: string) => void
  onAddFile?: (path: string) => void
  onAddFolder?: (path: string) => void
  onDelete?: (path: string) => void
}

function FileTreeNode({ 
  item, 
  owner, 
  repo, 
  branch, 
  level, 
  onSelectFile,
  onAddFile,
  onAddFolder,
  onDelete
}: { 
  item: GHContent, 
  owner: string, 
  repo: string, 
  branch: string, 
  level: number, 
  onSelectFile: (p: string) => void,
  onAddFile?: (p: string) => void,
  onAddFolder?: (p: string) => void,
  onDelete?: (p: string) => void
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [children, setChildren] = useState<GHContent[]>([])
  const [loading, setLoading] = useState(false)

  const isDir = item.type === "dir"

  const toggleOpen = async () => {
    if (!isDir) {
      onSelectFile(item.path)
      return
    }
    
    if (!isOpen && children.length === 0) {
      setLoading(true)
      try {
        const data = await ghGetContents(owner, repo, item.path, branch)
        // Sort: dirs first
        const sorted = data.sort((a, b) => {
          if (a.type === b.type) return a.name.localeCompare(b.name)
          return a.type === "dir" ? -1 : 1
        })
        setChildren(sorted)
      } catch (e) {
        console.error(e)
      } finally {
        setLoading(false)
      }
    }
    setIsOpen(!isOpen)
  }

  return (
    <div className="flex flex-col">
      <div 
        className={cn(
          "group flex items-center py-1.5 px-2 hover:bg-muted cursor-pointer rounded-md text-sm transition-colors",
        )}
        style={{ paddingLeft: `${level * 12 + 8}px` }}
        onClick={toggleOpen}
      >
        <span className="shrink-0 w-4 h-4 mr-1 flex items-center justify-center text-muted-foreground group-hover:text-primary transition-colors">
          {isDir ? (
            loading ? <Loader2 className="size-3 animate-spin text-primary" /> :
            isOpen ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />
          ) : null}
        </span>
        <span className="shrink-0 mr-2 text-muted-foreground group-hover:text-primary transition-colors">
          {isDir ? <Folder className="size-4" /> : <File className="size-4" />}
        </span>
        <span className="truncate flex-1 text-foreground transition-colors">{item.name}</span>
        
        {/* Actions - hidden by default, visible on hover */}
        <div className="hidden group-hover:flex items-center gap-1 shrink-0 ml-2">
          {isDir && onAddFile && (
            <button onClick={(e) => { e.stopPropagation(); onAddFile(item.path) }} className="p-1.5 hover:bg-primary/20 hover:text-primary rounded-md transition-colors" title="Add File">
              <Plus className="size-3" />
            </button>
          )}
          {onDelete && (
            <button onClick={(e) => { e.stopPropagation(); onDelete(item.path) }} className="p-1.5 hover:bg-destructive/20 hover:text-destructive rounded-md transition-colors" title="Delete">
              <Trash2 className="size-3" />
            </button>
          )}
        </div>
      </div>
      
      {isOpen && isDir && (
        <div className="flex flex-col">
          {children.map(child => (
            <FileTreeNode 
              key={child.sha} 
              item={child} 
              owner={owner} 
              repo={repo} 
              branch={branch} 
              level={level + 1} 
              onSelectFile={onSelectFile}
              onAddFile={onAddFile}
              onAddFolder={onAddFolder}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export function FileTree({ owner, repo, branch, onSelectFile, onAddFile, onAddFolder, onDelete }: FileTreeProps) {
  const [rootItems, setRootItems] = useState<GHContent[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    ghGetContents(owner, repo, "", branch).then(data => {
      if (!mounted) return
      const sorted = data.sort((a, b) => {
        if (a.type === b.type) return a.name.localeCompare(b.name)
        return a.type === "dir" ? -1 : 1
      })
      setRootItems(sorted)
      setLoading(false)
    }).catch(e => {
      console.error(e)
      if (mounted) setLoading(false)
    })
    return () => { mounted = false }
  }, [owner, repo, branch])

  if (loading) {
    return (
      <div className="p-4 flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> Loading files...
      </div>
    )
  }

  return (
    <div className="flex flex-col py-2 w-full h-full overflow-auto">
      {rootItems.map(item => (
        <FileTreeNode 
          key={item.sha} 
          item={item} 
          owner={owner} 
          repo={repo} 
          branch={branch} 
          level={0} 
          onSelectFile={onSelectFile}
          onAddFile={onAddFile}
          onAddFolder={onAddFolder}
          onDelete={onDelete}
        />
      ))}
    </div>
  )
}
