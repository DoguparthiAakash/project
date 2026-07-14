import { useState, useRef, useEffect } from "react"
import { 
  Play, Sparkles, ArrowLeft,
  Save, Loader2, GitCommitHorizontal, FileCode2,
  Image as ImageIcon, X, Terminal,
  Files, Search, GitBranch, Settings, LayoutPanelLeft,
  CheckCircle2
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import Editor, { DiffEditor } from "@monaco-editor/react"
import { Terminal as XTerminal } from "@xterm/xterm"
import { FitAddon } from "@xterm/addon-fit"
import "@xterm/xterm/css/xterm.css"

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

import { FileTree } from "@/components/FileTree"
import { SettingsDialog } from "@/components/SettingsDialog"
import { ghGetFile, projectPushFixes, projectChat, getChatThreads, createChatThread, getThreadHistory, clearChatHistory, type GHRepo } from "@/services/api"
import { getWebContainer, mountRepoAndRun, writeFileToWebContainer } from "@/services/webcontainer"
import { loadSettings } from "@/services/settings"
import { writeFileToCheerpX } from "@/services/cheerpx"
import { WebContainerTerminal } from "./WebContainerTerminal"
import { ManualTerminal } from "./ManualTerminal"
import { CheerpXTerminal } from "./CheerpXTerminal"

interface ProjectWorkspaceProps {
  repo: GHRepo
  onBack: () => void
}

export function ProjectWorkspace({ repo, onBack }: ProjectWorkspaceProps) {
  const [owner, repoName] = repo.full_name.split("/")
  const branch = repo.default_branch

  // ─── State ─────────────────────────────────────────────────────────────
  const settings = loadSettings()
  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null)
  const [openFiles, setOpenFiles] = useState<string[]>([])
  const [fileContent, setFileContent] = useState<string>("")
  const [loadingFile, setLoadingFile] = useState(false)
  const [previewFixes, setPreviewFixes] = useState<Record<string, string>>({})
  
  // VS Code States
  const [activeSidebarTab, setActiveSidebarTab] = useState<'explorer' | 'search' | 'scm'>('explorer')
  const [showSettings, setShowSettings] = useState(false)
  const [showMinimap, setShowMinimap] = useState(false)
  
  // Search State
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [isSearching, setIsSearching] = useState(false)
  
  const [unsavedChanges, setUnsavedChanges] = useState<Record<string, string>>({})
  const unsavedChangesRef = useRef(unsavedChanges)
  useEffect(() => {
    unsavedChangesRef.current = unsavedChanges
  }, [unsavedChanges])
  
  const [threads, setThreads] = useState<any[]>([])
  const [activeThreadId, setActiveThreadId] = useState<string | "new">("new")

  const [chatMessages, setChatMessages] = useState<any[]>([])
  const [chatInput, setChatInput] = useState("")
  const [chatAttachments, setChatAttachments] = useState<string[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const chatEndRef = useRef<HTMLDivElement>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [running, setRunning] = useState(false)
  const [pushing, setPushing] = useState(false)
  const [executing, setExecuting] = useState(false)
  
  const [pendingFixes, setPendingFixes] = useState<any[]>([])
  const [savingFile, setSavingFile] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  
  const terminalRef = useRef<HTMLDivElement>(null)
  const xtermRef = useRef<XTerminal | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)

  // Initialize Xterm
  useEffect(() => {
    if (terminalRef.current && !xtermRef.current) {
      const term = new XTerminal({ 
        theme: { background: '#09090b' },
        fontFamily: 'monospace',
        fontSize: 12
      })
      const fitAddon = new FitAddon()
      term.loadAddon(fitAddon)
      term.open(terminalRef.current)
      fitAddon.fit()
      
      xtermRef.current = term
      fitAddonRef.current = fitAddon
      term.writeln('CodeSage WebContainer Terminal Ready.')
    }
    
    const handleResize = () => {
      fitAddonRef.current?.fit()
    }
    
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [chatMessages, analyzing])

  // Fetch file content when selected
  useEffect(() => {
    if (!selectedFilePath) return
    
    const localContent = unsavedChangesRef.current[selectedFilePath]
    if (localContent !== undefined) {
      setFileContent(localContent)
      return
    }

    setLoadingFile(true)
    ghGetFile(owner, repoName, selectedFilePath, branch)
      .then(res => setFileContent(res.content))
      .catch(err => toast.error("Failed to load file: " + err.message))
      .finally(() => setLoadingFile(false))
  }, [selectedFilePath, owner, repoName, branch])

  // Fetch threads on mount
  useEffect(() => {
    getChatThreads()
      .then(res => {
        const repoThreads = res.filter((t: any) => t.owner === owner && t.repo === repoName)
        setThreads(repoThreads)
        if (repoThreads.length > 0) {
          setActiveThreadId(repoThreads[0].id)
        }
      })
      .catch(err => console.error("Failed to load chat threads", err))
  }, [owner, repoName])

  // Fetch history when thread changes
  useEffect(() => {
    if (activeThreadId === "new") {
      setChatMessages([])
      return
    }
    getThreadHistory(owner, repoName, activeThreadId)
      .then(res => {
        const mapped = res.map((msg: any) => {
          if (msg.fixes) {
            const commandFix = msg.fixes.find((f: any) => f.path === "_command")
            if (commandFix) {
              msg.command = commandFix.content
              msg.fixes = msg.fixes.filter((f: any) => f.path !== "_command")
            }
          }
          return msg
        })
        setChatMessages(mapped)
      })
      .catch(err => console.error("Failed to load chat history", err))
  }, [activeThreadId, owner, repoName])

  // ─── Actions ───────────────────────────────────────────────────────────
  const handleChatSubmit = async () => {
    if (!chatInput.trim() && chatAttachments.length === 0) return
    if (analyzing) return

    let currentThreadId = activeThreadId
    if (currentThreadId === "new") {
      try {
        const title = chatInput.trim().substring(0, 30) || "New Chat"
        const thread = await createChatThread(owner, repoName, title)
        currentThreadId = thread.id
        setActiveThreadId(thread.id)
        setThreads(prev => [thread, ...prev])
      } catch (err: any) {
        toast.error("Failed to create thread: " + err.message)
        return
      }
    }

    const message = chatInput.trim()
    const attachmentsToSent = [...chatAttachments]
    setChatInput("")
    setChatAttachments([])
    setAnalyzing(true)

    const userMessage = { role: "user", content: message, attachments: attachmentsToSent }
    setChatMessages(prev => [...prev, userMessage])

    try {
      const res = await projectChat(owner, repoName, currentThreadId, message, branch, selectedFilePath, attachmentsToSent, settings.agents)
      setChatMessages(prev => [...prev, { role: "assistant", content: res.message, fixes: res.fixes?.filter((f: any) => f.path !== "_command"), command: res.command }])
      
      // Auto-preview fixes if any
      if (res.fixes && res.fixes.length > 0) {
        const newPreviews = { ...previewFixes }
        for (const fix of res.fixes) {
          if (fix.path) {
            newPreviews[fix.path] = fix.content
          }
        }
        setPreviewFixes(newPreviews)
      }
    } catch (err: any) {
      toast.error(err.message)
      setChatMessages(prev => [...prev, { role: "assistant", content: "Error: " + err.message }])
    } finally {
      setAnalyzing(false)
    }
  }

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement("canvas")
        let { width, height } = img
        const maxDim = 800
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = (height / width) * maxDim
            width = maxDim
          } else {
            width = (width / height) * maxDim
            height = maxDim
          }
        }
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext("2d")
        ctx?.drawImage(img, 0, 0, width, height)
        const compressedBase64 = canvas.toDataURL("image/jpeg", 0.7)
        setChatAttachments(prev => [...prev, compressedBase64])
      }
      img.src = event.target?.result as string
    }
    reader.readAsDataURL(file)
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  const handleClearChat = async () => {
    try {
      await clearChatHistory(owner, repoName)
      setChatMessages([])
      setThreads([])
      setActiveThreadId("new")
      setPendingFixes([])
      toast.success("All chat history cleared for this project")
    } catch (err: any) {
      toast.error(err.message || "Failed to clear chat")
    }
  }

  const handleRun = async () => {
    if (!xtermRef.current) return
    setRunning(true)
    setPreviewUrl(null)
    xtermRef.current.writeln("\r\n$ Starting WebContainer...")
    try {
      const wc = await getWebContainer()
      
      // Ensure we only bind this once, or clean it up if bound multiple times.
      // But for simplicity, we bind it here.
      wc.on('server-ready', (_port: number, url: string) => {
        setPreviewUrl(url)
        xtermRef.current?.writeln(`\r\n[Web Preview Ready at ${url}]`)
        toast.success("Web Preview Started")
      })

      await mountRepoAndRun(owner, repoName, branch, (data) => {
        xtermRef.current?.write(data)
      })
      
      toast.success("Project executed")
    } catch (err: any) {
      xtermRef.current.writeln(`\r\nError: ${err.message}`)
      toast.error(err.message || "Failed to run project")
      setRunning(false)
    }
  }

  const handleExecuteCommand = async (command: string) => {
    if (!xtermRef.current) return
    setExecuting(true)
    xtermRef.current.writeln(`\r\n$ ${command}`)
    try {
      const wc = await getWebContainer()
      const process = await wc.spawn('sh', ['-c', command])
      process.output.pipeTo(new WritableStream({
        write(data) {
          xtermRef.current?.write(data)
        }
      }))
      const exitCode = await process.exit
      xtermRef.current.writeln(`\r\n[Exit Code: ${exitCode}]`)
    } catch (err: any) {
      xtermRef.current.writeln(`\r\nError: ${err.message}`)
      toast.error(err.message || "Failed to execute command")
    } finally {
      setExecuting(false)
    }
  }

  const handlePushFixes = async (fixesToApply: any[] = pendingFixes) => {
    if (!fixesToApply || fixesToApply.length === 0) return
    setPushing(true)
    
    // Normalize fixes to ensure content is a string
    const normalizedFixes = fixesToApply.map(fix => {
      let contentString = fix.content || ""
      if (typeof contentString !== "string") {
        try {
          contentString = JSON.stringify(contentString, null, 2)
        } catch (e) {
          contentString = String(contentString)
        }
      }
      return { ...fix, content: contentString }
    })
    
    try {
      await projectPushFixes(owner, repoName, branch, "CodeSage: Applied AI fixes", normalizedFixes)
      toast.success("Fixes pushed to GitHub successfully!")
      setPendingFixes([])
      
      // Clear these files from unsaved changes since they are pushed
      setUnsavedChanges(prev => {
        const next = { ...prev }
        fixesToApply.forEach(f => delete next[f.path])
        return next
      })
    } catch (err: any) {
      toast.error(err.message || "Failed to push fixes")
    } finally {
      setPushing(false)
    }
  }

  const handleApplyToEditor = (fixesToApply: any[]) => {
    if (!fixesToApply || !Array.isArray(fixesToApply) || fixesToApply.length === 0) return
    const newPreviews = { ...previewFixes }
    let validFixFound = false
    fixesToApply.forEach(fix => {
      if (fix && fix.path) {
        let contentString = fix.content || ""
        if (typeof contentString !== "string") {
          try {
            contentString = JSON.stringify(contentString, null, 2)
          } catch (e) {
            contentString = String(contentString)
          }
        }
        newPreviews[fix.path] = contentString
        validFixFound = true
      }
    })
    
    if (!validFixFound) {
      toast.error("AI returned fixes in an invalid format.")
      return
    }
    
    setPreviewFixes(newPreviews)
    
    const primaryFix = fixesToApply.find(f => f && f.path)
    if (primaryFix) {
      handleFileSelect(primaryFix.path)
      toast.success("Previewing fixes. Accept or reject changes in the editor.")
    }
  }

  const handleAcceptFix = async (path: string) => {
    const newContent = previewFixes[path]
    if (newContent !== undefined) {
      setUnsavedChanges(prev => ({ ...prev, [path]: newContent }))
      if (selectedFilePath === path) {
        setFileContent(newContent)
      }
      try {
        await writeFileToCheerpX(owner, repoName, path, newContent);
        await writeFileToWebContainer(path, newContent);
      } catch (e) {
        console.warn("Failed to sync to VMs", e);
      }
    }
    handleRejectFix(path)
  }

  const handleRejectFix = (path: string) => {
    setPreviewFixes(prev => {
      const next = { ...prev }
      delete next[path]
      return next
    })
  }

  const handleFileSelect = (path: string) => {
    setOpenFiles(prev => {
      if (!prev.includes(path)) return [...prev, path]
      return prev
    })
    setSelectedFilePath(path)
  }

  const handleCloseFile = (path: string) => {
    setOpenFiles(prev => {
      const next = prev.filter(p => p !== path)
      if (selectedFilePath === path) {
        setSelectedFilePath(next.length > 0 ? next[next.length - 1] : null)
      }
      return next
    })
  }

  const handleSaveFile = async () => {
    if (!selectedFilePath) return
    setSavingFile(true)
    try {
      await projectPushFixes(owner, repoName, branch, `CodeSage: Manual save of ${selectedFilePath}`, [
        { path: selectedFilePath, content: fileContent }
      ])
      
      try {
        await writeFileToCheerpX(owner, repoName, selectedFilePath, fileContent);
        await writeFileToWebContainer(selectedFilePath, fileContent);
      } catch (e) {
        console.warn("Failed to sync to VMs", e);
      }
      
      toast.success("File saved successfully!")
      setUnsavedChanges(prev => {
        const next = { ...prev }
        delete next[selectedFilePath]
        return next
      })
    } catch (err: any) {
      toast.error(err.message || "Failed to save file")
    } finally {
      setSavingFile(false)
    }
  }


  const handleFileChange = (value: string | undefined) => {
    if (value !== undefined) {
      setFileContent(value)
      if (selectedFilePath) {
        setUnsavedChanges(prev => ({ ...prev, [selectedFilePath]: value }))
      }
    }
  }

  const handleSearch = async () => {
    if (!searchQuery.trim()) return
    setIsSearching(true)
    try {
      // Minimal implementation for file-name search across the tree
      const res = await fetch(`https://api.github.com/repos/${owner}/${repoName}/git/trees/${branch}?recursive=1`)
      const data = await res.json()
      if (data.tree) {
        const matches = data.tree.filter((f: any) => f.type === 'blob' && f.path.toLowerCase().includes(searchQuery.toLowerCase()))
        setSearchResults(matches)
      }
    } catch (err: any) {
      toast.error("Search failed: " + err.message)
    } finally {
      setIsSearching(false)
    }
  }

  const unsavedCount = Object.keys(unsavedChanges).length


  // ─── UI ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-screen w-full bg-background overflow-hidden text-foreground">
      {/* Header */}
      <header className="shrink-0 flex items-center justify-between px-6 py-3 border-b border-border bg-card shadow-sm z-30">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={onBack} className="rounded-xl hover:bg-muted size-9 transition-colors">
            <ArrowLeft className="size-4" />
          </Button>
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-semibold tracking-tight">{repo.name}</h2>
            <span className="w-1 h-4 bg-border rounded-full" />
            <p className="text-xs text-primary font-mono flex items-center gap-1.5">
              <GitCommitHorizontal className="size-3" /> {branch}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <Select value={activeThreadId} onValueChange={setActiveThreadId}>
            <SelectTrigger className="h-8 w-[180px] text-xs bg-muted border-none shadow-sm focus:ring-1 focus:ring-primary font-medium rounded-xl">
              <SelectValue placeholder="Select a chat" />
            </SelectTrigger>
            <SelectContent className="rounded-xl border-border shadow-md bg-popover">
              <SelectItem value="new" className="rounded-md cursor-pointer">+ New Chat</SelectItem>
              {threads.map(t => (
                <SelectItem key={t.id} value={t.id} className="rounded-md cursor-pointer">
                  {t.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="w-1 h-4 bg-border rounded-full" />
          <Button 
            onClick={handleClearChat}
            variant="ghost"
            size="sm"
            className="h-8 text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-xl transition-colors"
          >
            Clear History
          </Button>
          <span className="w-1 h-4 bg-border rounded-full" />
          <Button 
            onClick={handleRun} 
            disabled={running}
            size="sm"
            className="gap-2 h-8 text-xs bg-green-600 hover:bg-green-700 text-white rounded-xl transition-colors font-medium shadow-sm"
          >
            {running ? <Loader2 className="size-3 animate-spin" /> : <Play className="size-3" />}
            Execute
          </Button>
        </div>
      </header>

      {/* Main IDE Layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Activity Bar */}
        <div className="w-12 bg-background border-r border-border flex flex-col items-center py-4 z-20 shrink-0">
          <div className="flex flex-col gap-4 w-full items-center">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => setActiveSidebarTab('explorer')}
              className={`rounded-xl transition-colors ${activeSidebarTab === 'explorer' ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}
            >
              <Files className="size-5" />
            </Button>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => setActiveSidebarTab('search')}
              className={`rounded-xl transition-colors ${activeSidebarTab === 'search' ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}
            >
              <Search className="size-5" />
            </Button>
            <div className="relative">
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => setActiveSidebarTab('scm')}
                className={`rounded-xl transition-colors ${activeSidebarTab === 'scm' ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}
              >
                <GitBranch className="size-5" />
              </Button>
              {unsavedCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-[9px] font-bold h-4 w-4 flex items-center justify-center rounded-full">
                  {unsavedCount}
                </span>
              )}
            </div>
          </div>
          
          <div className="mt-auto flex flex-col gap-4 w-full items-center">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => setShowSettings(true)}
              className="rounded-xl text-muted-foreground hover:text-foreground transition-colors"
            >
              <Settings className="size-5" />
            </Button>
          </div>
        </div>

        <ResizablePanelGroup orientation="horizontal" className="flex-1 bg-card border-none shadow-none">
          {/* Left Sidebar: Dynamic View */}
          <ResizablePanel defaultSize={20} minSize={15} className="flex flex-col bg-muted/20 border-r border-border">
            {activeSidebarTab === 'explorer' && (
              <>
                <div className="px-4 py-3 border-b border-border text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  Explorer
                </div>
                <FileTree 
                  owner={owner} 
                  repo={repoName} 
                  branch={branch} 
                  onSelectFile={handleFileSelect} 
                />
              </>
            )}

            {activeSidebarTab === 'search' && (
              <>
                <div className="px-4 py-3 border-b border-border text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  Search
                </div>
                <div className="p-4 flex flex-col h-full overflow-hidden">
                  <div className="flex gap-2 mb-4 shrink-0">
                    <input 
                      type="text" 
                      placeholder="Search file names..." 
                      className="flex-1 bg-background border border-border rounded-md px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-primary"
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleSearch()}
                    />
                  </div>
                  <div className="flex-1 overflow-y-auto">
                    {isSearching ? (
                      <div className="flex justify-center p-4"><Loader2 className="size-4 animate-spin text-muted-foreground" /></div>
                    ) : searchResults.length > 0 ? (
                      <ul className="space-y-1">
                        {searchResults.map(f => (
                          <li key={f.path} 
                              onClick={() => handleFileSelect(f.path)}
                              className="text-xs font-mono truncate px-2 py-1.5 rounded-md hover:bg-muted cursor-pointer transition-colors text-muted-foreground hover:text-foreground">
                            {f.path}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <div className="text-xs text-muted-foreground text-center mt-4">No results</div>
                    )}
                  </div>
                </div>
              </>
            )}

            {activeSidebarTab === 'scm' && (
              <>
                <div className="px-4 py-3 border-b border-border text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  Source Control
                </div>
                <div className="p-4 flex flex-col h-full overflow-hidden">
                  <div className="mb-4 shrink-0">
                    <Button 
                      disabled={unsavedCount === 0 || pushing} 
                      onClick={() => handlePushFixes(Object.keys(unsavedChanges).map(p => ({ path: p, content: unsavedChanges[p] })))}
                      className="w-full text-xs h-8 gap-2 bg-blue-600 hover:bg-blue-700 text-white"
                    >
                      {pushing ? <Loader2 className="size-3 animate-spin" /> : <GitCommitHorizontal className="size-3" />}
                      Commit & Push
                    </Button>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto">
                    <div className="text-xs font-semibold uppercase text-muted-foreground mb-2 flex justify-between">
                      <span>Changes</span>
                      <Badge variant="secondary" className="text-[9px] px-1.5 py-0 h-4">{unsavedCount}</Badge>
                    </div>
                    {unsavedCount > 0 ? (
                      <ul className="space-y-1">
                        {Object.keys(unsavedChanges).map(path => (
                          <li key={path} 
                              onClick={() => handleFileSelect(path)}
                              className="flex items-center justify-between text-xs font-mono px-2 py-1.5 rounded-md hover:bg-muted cursor-pointer transition-colors group">
                            <span className="truncate text-yellow-500">{path.split('/').pop()}</span>
                            <span className="text-[10px] text-muted-foreground group-hover:text-foreground opacity-50">M</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <div className="text-xs text-muted-foreground italic mt-2">No pending changes</div>
                    )}
                  </div>
                </div>
              </>
            )}
          </ResizablePanel>
        
        <ResizableHandle withHandle className="bg-border w-1 hover:bg-primary/30 transition-colors" />

        {/* Middle: Code Editor & Analysis */}
        <ResizablePanel defaultSize={55} className="flex flex-col border-x border-border">
          <ResizablePanelGroup orientation="vertical">
            {/* Top: Editor */}
            <ResizablePanel defaultSize={70} className="flex flex-col relative">
              {/* Editor Header Tabs */}
              <div className="flex bg-card border-b border-border justify-between items-center pr-4">
                <div className="flex overflow-x-auto scrollbar-hide">
                  {openFiles.length > 0 ? (
                    openFiles.map((path, idx) => (
                      <div 
                        key={path || idx}
                        onClick={() => path && setSelectedFilePath(path)}
                        className={`px-4 py-3 text-sm border-r border-border flex items-center gap-2 cursor-pointer whitespace-nowrap min-w-fit transition-colors ${selectedFilePath === path ? 'bg-primary/5 border-t-2 border-t-primary text-primary font-medium' : 'bg-transparent border-t-2 border-t-transparent text-muted-foreground hover:bg-muted hover:text-foreground'}`}
                      >
                        <FileCode2 className={`size-4 ${selectedFilePath === path ? 'text-primary' : 'opacity-70'}`} />
                        {path ? path.split("/").pop() : "Unknown"}
                        {path && unsavedChanges[path] !== undefined && (
                          <span className="w-2 h-2 rounded-full bg-yellow-500 ml-1 animate-pulse"></span>
                        )}
                        <button 
                          onClick={(e) => {
                            e.stopPropagation()
                            handleCloseFile(path)
                          }}
                          className={`ml-2 p-1 rounded-md flex items-center justify-center transition-all ${selectedFilePath === path ? 'hover:bg-primary/10 text-primary' : 'opacity-50 hover:opacity-100 hover:bg-muted text-foreground'}`}
                        >
                          <span className="sr-only">Close</span>
                          <X className="size-3" />
                        </button>
                      </div>
                    ))
                  ) : (
                    <div className="px-4 py-3 text-sm text-muted-foreground italic">No files open</div>
                  )}
                </div>
                {selectedFilePath && (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={handleSaveFile} 
                    disabled={savingFile}
                    className="h-8 text-xs text-muted-foreground hover:text-foreground hover:bg-muted gap-1.5 rounded-xl px-4"
                  >
                    {savingFile ? <Loader2 className="size-3 animate-spin text-primary" /> : <Save className="size-3" />}
                    Save
                  </Button>
                )}
              </div>

              {/* Editor Content */}
              <div className="flex-1 relative">
                {loadingFile ? (
                  <div className="absolute inset-0 flex items-center justify-center bg-background/50 backdrop-blur-sm z-10">
                    <Loader2 className="size-8 animate-spin text-primary" />
                  </div>
                ) : null}
                
                {selectedFilePath ? (
                  previewFixes[selectedFilePath] !== undefined ? (
                    <div className="flex flex-col h-full relative">
                      <div className="absolute z-10 top-4 right-8 flex items-center gap-2 bg-background border border-border p-1.5 rounded-md shadow-lg">
                        <Button size="sm" onClick={() => handleAcceptFix(selectedFilePath)} className="h-7 text-xs bg-blue-600 hover:bg-blue-700 text-white">Accept Changes</Button>
                        <Button size="sm" variant="ghost" onClick={() => handleRejectFix(selectedFilePath)} className="h-7 text-xs hover:bg-muted">Reject</Button>
                      </div>
                      <DiffEditor
                        height="100%"
                        language={selectedFilePath.split('.').pop() || "plaintext"}
                        theme="vs-dark"
                        original={fileContent}
                        modified={previewFixes[selectedFilePath]}
                        options={{
                          renderSideBySide: false,
                          minimap: { enabled: showMinimap },
                          fontSize: 14,
                          wordWrap: "on",
                          padding: { top: 16 }
                        }}
                      />
                    </div>
                  ) : (
                    <Editor
                      height="100%"
                      language={selectedFilePath.split('.').pop() || "plaintext"}
                      theme="vs-dark"
                      value={fileContent}
                      onChange={handleFileChange}
                      onMount={(editor, monaco) => {
                        editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
                          handleSaveFile()
                        })
                      }}
                      options={{
                        minimap: { enabled: showMinimap },
                        fontSize: 14,
                        wordWrap: "on",
                        padding: { top: 16 }
                      }}
                    />
                  )
                ) : (
                  <div className="flex h-full items-center justify-center text-muted-foreground">
                    <div className="text-center">
                      <FileCode2 className="size-12 mx-auto mb-4 opacity-20" />
                      <p>Select a file to start editing</p>
                    </div>
                  </div>
                )}
                </div>
              </ResizablePanel>

              <ResizableHandle withHandle className="bg-border h-1 hover:bg-primary/30 transition-colors" />

              {/* Bottom: Terminal & Preview */}
              <ResizablePanel defaultSize={30} minSize={10} className="flex flex-col bg-card">
                <Tabs defaultValue="server" className="flex flex-col h-full">
                  <TabsList className="w-full justify-start rounded-none bg-muted/50 border-b border-border h-10 p-0 overflow-x-auto overflow-y-hidden">
                    <TabsTrigger value="server" className="rounded-none data-[state=active]:bg-card data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-primary h-full px-5 text-xs font-mono shrink-0 transition-colors hover:bg-muted">Server Logs</TabsTrigger>
                    <TabsTrigger value="manual" className="rounded-none data-[state=active]:bg-card data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-primary h-full px-5 text-xs font-mono shrink-0 transition-colors hover:bg-muted">Manual Terminal</TabsTrigger>
                    <TabsTrigger value="cheerpx" className="rounded-none data-[state=active]:bg-card data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-primary h-full px-5 text-xs font-mono shrink-0 transition-colors hover:bg-muted">WebVM (Linux)</TabsTrigger>
                    {previewUrl && (
                      <TabsTrigger value="preview" className="rounded-none data-[state=active]:bg-card data-[state=active]:border-b-2 data-[state=active]:border-blue-500 data-[state=active]:text-blue-500 h-full px-5 text-xs font-mono shrink-0 transition-colors hover:bg-muted">Web Preview</TabsTrigger>
                    )}
                  </TabsList>
                  
                  <TabsContent value="server" className="flex-1 p-0 m-0 overflow-hidden flex flex-col relative bg-zinc-950">
                    <WebContainerTerminal owner={owner} repo={repoName} branch={branch} />
                  </TabsContent>

                  <TabsContent value="cheerpx" className="flex-1 p-0 m-0 overflow-hidden flex flex-col relative bg-zinc-950">
                    <CheerpXTerminal owner={owner} repo={repoName} branch={branch} />
                  </TabsContent>

                  <TabsContent value="manual" className="flex-1 p-0 m-0 overflow-hidden flex flex-col relative bg-zinc-950">
                    <ManualTerminal />
                  </TabsContent>
                  
                  {previewUrl && (
                    <TabsContent value="preview" className="flex-1 p-0 m-0 overflow-hidden bg-white">
                      <iframe src={previewUrl} className="w-full h-full border-none" title="Web Preview" />
                    </TabsContent>
                  )}
                </Tabs>
              </ResizablePanel>
            </ResizablePanelGroup>
          </ResizablePanel>

          <ResizableHandle withHandle className="bg-border w-1 hover:bg-primary/30 transition-colors" />

          {/* Right Panel: AI Chat */}
          <ResizablePanel defaultSize={25} minSize={20} className="flex flex-col bg-card">
            <div className="w-full bg-muted/50 border-b border-border h-10 flex items-center px-5 text-xs font-mono shrink-0 transition-colors text-primary border-b-2 border-primary">
              AI Assistant
            </div>
            <div className="flex-1 p-0 m-0 overflow-hidden flex flex-col bg-background text-foreground">
                <div className="flex-1 overflow-y-auto p-4">
                  {chatMessages.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Sparkles className="size-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">Ask me to analyze the project or a specific file.</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {chatMessages.map((msg, idx) => (
                        <div key={idx} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                          <div className={`px-4 py-2 rounded-lg max-w-[90%] text-sm ${msg.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground'}`}>
                            {msg.attachments && msg.attachments.length > 0 && (
                              <div className="flex flex-wrap gap-2 mb-2">
                                {msg.attachments.map((src: string, i: number) => (
                                  <img key={i} src={src} alt="attachment" className="max-w-[200px] max-h-[200px] rounded border border-white/20 object-contain" />
                                ))}
                              </div>
                            )}
                            <div className="whitespace-pre-wrap">{msg.content}</div>
                            {msg.command && (
                              <div className="mt-3 bg-background/50 p-3 rounded border border-border space-y-2">
                                <div className="font-semibold text-xs text-muted-foreground uppercase tracking-wider">Suggested Command:</div>
                                <div className="text-xs font-mono bg-background p-2 rounded break-all">{msg.command}</div>
                                <Button 
                                  onClick={() => handleExecuteCommand(msg.command)} 
                                  disabled={executing}
                                  size="sm" 
                                  className="w-full bg-blue-600 hover:bg-blue-700 text-white h-7 text-xs"
                                >
                                  {executing ? <Loader2 className="size-3 animate-spin mr-1" /> : <Terminal className="size-3 mr-1" />}
                                  Execute Command
                                </Button>
                              </div>
                            )}
                            {msg.fixes && msg.fixes.length > 0 && (
                              <div className="mt-3 bg-background/50 p-3 rounded border border-border space-y-2">
                                <div className="font-semibold text-xs text-muted-foreground uppercase tracking-wider">Suggested Fixes:</div>
                                {msg.fixes.map((f: any, fIdx: number) => (
                                  <div key={fIdx} className="text-xs font-mono bg-background p-1.5 rounded">{f.path}</div>
                                ))}
                                <div className="flex gap-2 mt-2">
                                  <Button 
                                    onClick={() => handleApplyToEditor(msg.fixes)} 
                                    size="sm" 
                                    variant="outline"
                                    className="flex-1 bg-background hover:bg-muted h-7 text-xs"
                                  >
                                    <FileCode2 className="size-3 mr-1" />
                                    Apply to Editor
                                  </Button>
                                  <Button 
                                    onClick={() => handlePushFixes(msg.fixes)} 
                                    disabled={pushing} 
                                    size="sm" 
                                    className="flex-1 bg-green-600 hover:bg-green-700 text-white h-7 text-xs"
                                  >
                                    {pushing ? <Loader2 className="size-3 animate-spin mr-1" /> : <GitCommitHorizontal className="size-3 mr-1" />}
                                    Push to GitHub
                                  </Button>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                      {analyzing && (
                        <div className="flex items-start">
                          <div className="px-4 py-2 rounded-lg bg-muted text-foreground flex items-center gap-2">
                            <Loader2 className="size-4 animate-spin text-primary" />
                            <span className="text-sm">Thinking...</span>
                          </div>
                        </div>
                      )}
                      <div ref={chatEndRef} />
                    </div>
                  )}
                </div>
                
                <div className="p-3 border-t border-border bg-card">
                  {chatAttachments.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-2 px-1">
                      {chatAttachments.map((src, i) => (
                        <div key={i} className="relative group">
                          <img src={src} alt="preview" className="h-16 w-16 object-cover rounded border border-border" />
                          <button 
                            onClick={() => setChatAttachments(prev => prev.filter((_, idx) => idx !== i))}
                            className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <X className="size-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="relative flex items-center">
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      ref={fileInputRef}
                      onChange={handleImageUpload}
                    />
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-9 w-9 p-0 rounded-r-none border border-r-0 border-border bg-background"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={analyzing}
                    >
                      <ImageIcon className="size-4 text-muted-foreground hover:text-foreground" />
                    </Button>
                    <input
                      type="text"
                      className="flex-1 bg-background border border-border rounded-r-md px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                      placeholder="Ask AI to analyze or fix code..."
                      value={chatInput}
                      onChange={e => setChatInput(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && handleChatSubmit()}
                      disabled={analyzing}
                    />
                    <Button
                      size="sm"
                      variant="ghost"
                      className="absolute right-1 top-1 h-7 w-7 p-0"
                      onClick={handleChatSubmit}
                      disabled={analyzing || (!chatInput.trim() && chatAttachments.length === 0)}
                    >
                      <Sparkles className="size-4 text-primary" />
                    </Button>
                  </div>
                </div>
              </div>
            </ResizablePanel>
          </ResizablePanelGroup>
        </div>

        {/* Status Bar */}
        <div className="h-6 shrink-0 bg-primary text-primary-foreground flex items-center justify-between px-4 text-[10px] font-mono shadow-sm">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5 font-semibold">
              <GitBranch className="size-3" />
              {branch}
            </span>
            <span className="flex items-center gap-1.5 opacity-80 cursor-pointer hover:opacity-100" onClick={() => setActiveSidebarTab('scm')}>
              <CheckCircle2 className="size-3" />
              {unsavedCount} pending changes
            </span>
          </div>
          <div className="flex items-center gap-4">
            {selectedFilePath && (
              <span className="opacity-80 flex items-center gap-1">
                <FileCode2 className="size-3" />
                {selectedFilePath.split('.').pop()?.toUpperCase() || 'TEXT'}
              </span>
            )}
            <span 
              className="flex items-center gap-1.5 cursor-pointer hover:opacity-100"
              onClick={() => setShowMinimap(!showMinimap)}
            >
              <LayoutPanelLeft className={`size-3 ${showMinimap ? '' : 'opacity-50'}`} />
              Minimap
            </span>
          </div>
        </div>

        {/* Settings Modal */}
        <SettingsDialog open={showSettings} onClose={() => setShowSettings(false)} />
    </div>
  )
}
