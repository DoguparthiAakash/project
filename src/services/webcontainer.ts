import { WebContainer } from '@webcontainer/api';
import type { FileSystemTree } from '@webcontainer/api';
import { ghGetContents, ghGetFile } from './api';

let bootPromise: Promise<WebContainer> | null = null;

export async function getWebContainer() {
  if (!bootPromise) {
    bootPromise = WebContainer.boot();
  }
  return bootPromise;
}

export async function fetchRepoTree(owner: string, repo: string, branch: string, path: string = ""): Promise<FileSystemTree> {
  const tree: FileSystemTree = {};
  
  let contents: any[] = [];
  try {
    contents = await ghGetContents(owner, repo, path, branch);
  } catch (err) {
    console.warn(`Failed to fetch contents for path ${path}:`, err);
    return tree;
  }
  
  // Fetch files sequentially to avoid rate limiting or ECONNRESET from GitHub API
  for (const item of contents) {
    if (item.type === "file") {
      // Don't fetch contents for huge binaries or images for now, just text files
      const ext = item.name.split('.').pop()?.toLowerCase();
      const ignoredExts = ["png", "jpg", "jpeg", "gif", "ico", "mp4", "mp3", "zip", "tar", "gz", "lock"];
      if (ignoredExts.includes(ext || "")) continue;
      
      try {
        const fileData = await ghGetFile(owner, repo, item.path, branch);
        tree[item.name] = {
          file: {
            contents: fileData.content
          }
        };
      } catch (err) {
        console.warn(`Failed to fetch file: ${item.path}`, err);
      }
    } else if (item.type === "dir") {
      const ignoredDirs = ["node_modules", "dist", "build", ".git", ".vscode", ".idea"];
      if (ignoredDirs.includes(item.name)) continue;
      
      try {
        tree[item.name] = {
          directory: await fetchRepoTree(owner, repo, branch, item.path)
        };
      } catch (err) {
        console.warn(`Failed to fetch directory: ${item.path}`, err);
      }
    }
  }
  
  return tree;
}

let isMounted = false;
let devProcess: any = null;

// Store a history of terminal output to replay to newly connected terminals
const terminalHistory: string[] = [];
const terminalListeners: Set<(data: string) => void> = new Set();

function broadcastTerminal(data: string) {
  terminalHistory.push(data);
  // Keep last 1000 chunks to prevent memory leaks
  if (terminalHistory.length > 1000) terminalHistory.shift();
  terminalListeners.forEach(listener => listener(data));
}

export async function mountRepoAndRun(owner: string, repo: string, branch: string, onTerminal: (data: string) => void) {
  // Replay history immediately
  for (const chunk of terminalHistory) {
    onTerminal(chunk);
  }
  
  // Register new listener
  terminalListeners.add(onTerminal);

  if (isMounted && devProcess) {
    // Already mounted and running, just return the existing process
    return devProcess;
  }

  broadcastTerminal("Booting WebContainer...\r\n");
  const wc = await getWebContainer();
  
  if (!isMounted) {
    broadcastTerminal("Fetching project files from GitHub...\r\n");
    const tree = await fetchRepoTree(owner, repo, branch);
    
    broadcastTerminal("Mounting files to WebContainer...\r\n");
    await wc.mount(tree);
    
    broadcastTerminal("Running npm install...\r\n");
    const installProcess = await wc.spawn('npm', ['install', '--no-audit', '--no-fund', '--legacy-peer-deps']);
    installProcess.output.pipeTo(new WritableStream({
      write(data) {
        broadcastTerminal(data);
      }
    }));
    
    const installExitCode = await installProcess.exit;
    if (installExitCode !== 0) {
      broadcastTerminal(`\r\nnpm install failed with exit code ${installExitCode}\r\n`);
      throw new Error('npm install failed');
    }
    
    isMounted = true;
  }
  
  if (!devProcess) {
    broadcastTerminal("Starting dev server...\r\n");
    devProcess = await wc.spawn('npm', ['run', 'dev']);
    devProcess.output.pipeTo(new WritableStream({
      write(data) {
        broadcastTerminal(data);
      }
    }));
  }
  
  return devProcess;
}

export function cleanupTerminalListener(listener: (data: string) => void) {
  terminalListeners.delete(listener);
}

export async function executeCommand(cmd: string, args: string[], onData?: (data: string) => void) {
  const wc = await getWebContainer();
  const process = await wc.spawn(cmd, args);
  
  process.output.pipeTo(new WritableStream({
    write(data) {
      if (onData) onData(data);
      broadcastTerminal(data);
    }
  }));
  
  return process.exit;
}
