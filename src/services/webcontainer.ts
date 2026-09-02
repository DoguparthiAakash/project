/**
 * webcontainer.ts — Singleton WebContainer service
 *
 * • Uses the VITE_WEBCONTAINER_API_KEY env var for authentication
 * • Provides: boot, mount-repo, interactive shell, dev-server preview URL
 * • Dynamic import defers the crossOriginIsolated check until the terminal opens
 *   (avoids crashing the entire bundle if the page is not yet isolated)
 */

import type { FileSystemTree, WebContainerProcess } from '@webcontainer/api'
import { ghGetContents, ghGetFile } from './api'

// ─── Types ─────────────────────────────────────────────────────────────────────

export type WCStatus =
  | 'idle'
  | 'booting'
  | 'fetching'
  | 'mounting'
  | 'installing'
  | 'ready'
  | 'error'

interface WCStore {
  instance:         any | null
  status:           WCStatus
  statusMessage:    string
  error?:           string
  previewUrl:       string | null
  isMounted:        boolean
  devProcess:       WebContainerProcess | null
}

const store: WCStore = {
  instance:      null,
  status:        'idle',
  statusMessage: 'WebContainer not started',
  previewUrl:    null,
  isMounted:     false,
  devProcess:    null,
}

// ─── Status listeners ─────────────────────────────────────────────────────────

const statusListeners = new Set<() => void>()

function notify() {
  statusListeners.forEach(fn => fn())
}

export function subscribeWCStatus(fn: () => void) {
  statusListeners.add(fn)
  return () => statusListeners.delete(fn)
}

export function getWCStore() {
  return store
}

// ─── Terminal output broadcasting ─────────────────────────────────────────────

const terminalHistory: string[] = []
const terminalListeners = new Set<(data: string) => void>()

function broadcastTerminal(data: string) {
  terminalHistory.push(data)
  if (terminalHistory.length > 2000) terminalHistory.shift()
  terminalListeners.forEach(l => l(data))
}

export function subscribeTerminal(fn: (data: string) => void) {
  // Replay history so switching tabs doesn't lose output
  for (const chunk of terminalHistory) fn(chunk)
  terminalListeners.add(fn)
  return () => terminalListeners.delete(fn)
}

// ─── Boot ──────────────────────────────────────────────────────────────────────

let bootPromise: Promise<any> | null = null

export async function getWebContainer(): Promise<any> {
  if (store.instance) return store.instance

  if (!bootPromise) {
    bootPromise = (async () => {
      store.status = 'booting'
      store.statusMessage = 'Booting WebContainer runtime...'
      notify()

      const { WebContainer } = await import('@webcontainer/api')

      const apiKey = import.meta.env.VITE_WEBCONTAINER_API_KEY as string | undefined

      store.instance = await WebContainer.boot(apiKey ? { workdirName: 'project' } : {})

      // Listen for dev server URL
      store.instance.on('server-ready', (_port: number, url: string) => {
        store.previewUrl = url
        notify()
      })

      store.status = 'ready'
      store.statusMessage = 'WebContainer ready'
      notify()

      return store.instance
    })().catch(err => {
      store.status = 'error'
      store.statusMessage = `Boot error: ${err.message}`
      store.error = err.message
      bootPromise = null
      notify()
      throw err
    })
  }

  return bootPromise
}

// ─── Repo fetching ────────────────────────────────────────────────────────────

const IGNORED_EXTS = ['png','jpg','jpeg','gif','ico','mp4','mp3','zip','tar','gz','lock','woff','woff2','ttf','eot']
const IGNORED_DIRS = ['node_modules','dist','build','.git','.vscode','.idea','.next','coverage']

export async function fetchRepoTree(
  owner: string,
  repo: string,
  branch: string,
  dirPath: string = ''
): Promise<FileSystemTree> {
  const tree: FileSystemTree = {}

  let contents: any[] = []
  try {
    contents = await ghGetContents(owner, repo, dirPath, branch)
  } catch (err) {
    console.warn(`[WC] Failed to fetch ${dirPath}:`, err)
    return tree
  }

  for (const item of contents) {
    if (item.type === 'file') {
      const ext = item.name.split('.').pop()?.toLowerCase() ?? ''
      if (IGNORED_EXTS.includes(ext)) continue
      try {
        const fileData = await ghGetFile(owner, repo, item.path, branch)
        tree[item.name] = { file: { contents: fileData.content } }
      } catch (err) {
        console.warn(`[WC] Failed to fetch file ${item.path}:`, err)
      }
    } else if (item.type === 'dir') {
      if (IGNORED_DIRS.includes(item.name)) continue
      try {
        tree[item.name] = {
          directory: await fetchRepoTree(owner, repo, branch, item.path),
        }
      } catch (err) {
        console.warn(`[WC] Failed to fetch dir ${item.path}:`, err)
      }
    }
  }

  return tree
}

// ─── Mount + run dev server ───────────────────────────────────────────────────

export async function mountRepoAndRun(
  owner: string,
  repo: string,
  branch: string,
  onTerminal: (data: string) => void
) {
  const unsub = subscribeTerminal(onTerminal)

  if (store.isMounted && store.devProcess) return { unsub }

  try {
    const wc = await getWebContainer()

    if (!store.isMounted) {
      store.status = 'fetching'
      store.statusMessage = 'Fetching project files from GitHub...'
      notify()
      broadcastTerminal('📥 Fetching project files from GitHub...\r\n')

      const tree = await fetchRepoTree(owner, repo, branch)

      store.status = 'mounting'
      store.statusMessage = 'Mounting files...'
      notify()
      broadcastTerminal('📂 Mounting files to WebContainer...\r\n')
      await wc.mount(tree)

      store.status = 'installing'
      store.statusMessage = 'Running npm install...'
      notify()
      broadcastTerminal('📦 Running npm install...\r\n')

      const installProc = await wc.spawn('npm', ['install', '--no-audit', '--no-fund', '--legacy-peer-deps'])
      installProc.output.pipeTo(new WritableStream({ write(data) { broadcastTerminal(data) } }))

      const installExit = await installProc.exit
      if (installExit !== 0) {
        broadcastTerminal(`\r\n❌ npm install failed (exit ${installExit})\r\n`)
        throw new Error('npm install failed')
      }

      store.isMounted = true
    }

    if (!store.devProcess) {
      broadcastTerminal('🚀 Starting dev server...\r\n')
      store.devProcess = await wc.spawn('npm', ['run', 'dev'])
      store.devProcess!.output.pipeTo(new WritableStream({ write(data) { broadcastTerminal(data) } }))
    }

    store.status = 'ready'
    store.statusMessage = 'WebContainer ready'
    notify()

    return { unsub }
  } catch (err: any) {
    store.status = 'error'
    store.statusMessage = err.message
    store.error = err.message
    notify()
    return { unsub }
  }
}

// ─── Interactive shell ────────────────────────────────────────────────────────

/**
 * Spawn an interactive shell session.
 * Returns a process whose stdin/stdout you wire to an xterm instance.
 */
export async function spawnShell(): Promise<WebContainerProcess> {
  const wc = await getWebContainer()
  // jsh is WebContainer's built-in POSIX-compatible shell
  const shellProcess = await wc.spawn('/bin/jsh', {
    terminal: { cols: 80, rows: 24 },
  })
  return shellProcess
}

/**
 * Resize a shell process terminal (call when the xterm panel resizes)
 */
export function resizeShell(process: WebContainerProcess, cols: number, rows: number) {
  try {
    process.resize({ cols, rows })
  } catch {
    // Shell may have exited
  }
}

// ─── Write file ───────────────────────────────────────────────────────────────

export async function writeFileToWebContainer(filePath: string, content: string) {
  if (!store.isMounted) return
  try {
    const wc = await getWebContainer()
    const parts = filePath.split('/')
    if (parts.length > 1) {
      const dir = parts.slice(0, -1).join('/')
      await wc.fs.mkdir(dir, { recursive: true })
    }
    await wc.fs.writeFile(filePath, content)
  } catch (err) {
    console.warn(`[WC] Failed to write ${filePath}`, err)
  }
}

// ─── Execute a one-shot command ───────────────────────────────────────────────

export async function executeCommand(
  cmd: string,
  args: string[],
  onData?: (data: string) => void
) {
  const wc = await getWebContainer()
  const proc = await wc.spawn(cmd, args)
  proc.output.pipeTo(new WritableStream({
    write(data) {
      if (onData) onData(data)
      broadcastTerminal(data)
    },
  }))
  return proc.exit
}

// ─── Cleanup ──────────────────────────────────────────────────────────────────

export function cleanupTerminalListener(listener: (data: string) => void) {
  terminalListeners.delete(listener)
}
