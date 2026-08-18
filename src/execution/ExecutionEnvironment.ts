export type ExecutionStatus =
  | "CREATED"
  | "BOOTING"
  | "READY"
  | "RUNNING"
  | "PAUSED"
  | "STOPPING"
  | "STOPPED"
  | "ERROR"

export interface CommandExecutionOptions {
  cwd?: string
  timeoutMs?: number
  env?: Record<string, string>
}

export interface CommandExecutionResult {
  command: string
  cwd: string
  stdout: string
  stderr: string
  exitCode: number
  durationMs: number
  commandId: string
  processState: "completed" | "timeout" | "cancelled" | "running"
}

export interface FileEntry {
  name: string
  path: string
  type: "file" | "dir"
  size?: number
}

export interface ExecutionEnvironment {
  boot: (screenContainer?: HTMLElement | null) => Promise<void>
  shutdown: () => Promise<void>
  restart: () => Promise<void>
  execute: (command: string, options?: CommandExecutionOptions) => Promise<CommandExecutionResult>
  writeFile: (path: string, content: string) => Promise<void>
  readFile: (path: string) => Promise<string>
  deleteFile: (path: string) => Promise<void>
  listFiles: (path: string) => Promise<FileEntry[]>
  uploadFiles: (files: Array<{ path: string; content: string }>) => Promise<void>
  downloadFiles: (path: string) => Promise<Array<{ path: string; content: string }>>
  getWorkingDirectory: () => Promise<string>
  installPackage: (name: string, manager?: string) => Promise<CommandExecutionResult>
  getProcessStatus: () => Promise<{ pid?: number; running: boolean; status: string }>
  getEnvironmentInfo: () => Promise<Record<string, string | number | boolean | undefined>>
  getStatus: () => ExecutionStatus
}
