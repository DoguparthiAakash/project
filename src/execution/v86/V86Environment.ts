import type {
  CommandExecutionOptions,
  CommandExecutionResult,
  ExecutionEnvironment,
  ExecutionStatus,
  FileEntry,
} from "@/execution/ExecutionEnvironment"

const DEFAULT_ASSET_BASE =
  (import.meta.env.VITE_V86_ASSET_BASE as string | undefined) ??
  "https://cdn.jsdelivr.net/gh/copy/v86@master/build"

const DEFAULT_LINUX_IMAGE =
  (import.meta.env.VITE_V86_LINUX_IMAGE as string | undefined) ??
  "https://raw.githubusercontent.com/copy/v86/master/images/linux3.iso"

const DEFAULT_TIMEOUT_MS = Number(import.meta.env.VITE_V86_EXEC_TIMEOUT ?? 120000)
const DEFAULT_PROJECT_PATH = (import.meta.env.VITE_V86_PROJECT_PATH as string | undefined) ?? "/workspace/project"

declare global {
  interface Window {
    V86Starter?: new (config: Record<string, unknown>) => any
  }
}

export class V86Environment implements ExecutionEnvironment {
  private emulator: any | null = null
  private bootPromise: Promise<void> | null = null
  private statusValue: ExecutionStatus = "CREATED"
  private readonly assetBase: string
  private readonly linuxImageUrl: string
  private readonly workingDirectory: string
  private serialBuffer = ""
  private terminalOutputHandler: ((chunk: string) => void) | null = null
  private bootedAt: number | null = null

  constructor(assetBase = DEFAULT_ASSET_BASE, linuxImageUrl = DEFAULT_LINUX_IMAGE, workingDirectory = DEFAULT_PROJECT_PATH) {
    this.assetBase = assetBase
    this.linuxImageUrl = linuxImageUrl
    this.workingDirectory = workingDirectory
  }

  getStatus(): ExecutionStatus {
    return this.statusValue
  }

  setTerminalOutputHandler(handler: ((chunk: string) => void) | null) {
    this.terminalOutputHandler = handler
  }

  private setStatus(next: ExecutionStatus) {
    this.statusValue = next
  }

  private handleSerialOutput(chunk: string) {
    this.serialBuffer += chunk
    if (this.terminalOutputHandler) {
      this.terminalOutputHandler(chunk)
    }
  }

  private async ensureV86Loader(): Promise<any> {
    if (typeof window === "undefined") {
      throw new Error("v86 can only be started in a browser context.")
    }

    if (window.V86Starter) {
      return window.V86Starter
    }

    await new Promise<void>((resolve, reject) => {
      const existing = document.querySelector("script[data-v86-loader='true']") as HTMLScriptElement | null
      if (existing) {
        existing.addEventListener("load", () => resolve(), { once: true })
        existing.addEventListener("error", () => reject(new Error("Failed to load v86 library.")), { once: true })
        return
      }

      const script = document.createElement("script")
      script.src = `${this.assetBase}/libv86.js`
      script.dataset.v86Loader = "true"
      script.onload = () => resolve()
      script.onerror = () => reject(new Error("Failed to load v86 library."))
      document.body.appendChild(script)
    })

    if (!window.V86Starter) {
      throw new Error("v86 library loaded but V86Starter was not initialized.")
    }

    return window.V86Starter
  }

  async boot(screenContainer?: HTMLElement | null): Promise<void> {
    if (this.bootPromise) {
      await this.bootPromise
      return
    }

    this.bootPromise = (async () => {
      this.setStatus("BOOTING")

      const V86Starter = await this.ensureV86Loader()
      const container = screenContainer ?? document.createElement("div")

      this.emulator = new V86Starter({
        wasm_path: `${this.assetBase}/v86.wasm`,
        memory_size: 512 * 1024 * 1024,
        vga_memory_size: 8 * 1024 * 1024,
        screen_container: container,
        bios: { url: `${this.assetBase}/seabios.bin` },
        vga_bios: { url: `${this.assetBase}/vgabios.bin` },
        cdrom: { url: this.linuxImageUrl },
        autostart: true,
      })

      this.emulator.add_listener("serial0-output", (chunk: Uint8Array | string | ArrayBuffer) => {
        const text = typeof chunk === "string" ? chunk : new TextDecoder().decode(chunk as Uint8Array)
        this.handleSerialOutput(text)
      })

      await new Promise<void>((resolve, reject) => {
        const timer = window.setTimeout(() => reject(new Error("v86 boot timeout reached.")), 120000)
        const onReady = () => {
          window.clearTimeout(timer)
          resolve()
        }

        this.emulator.add_listener("emulator-ready", onReady)
      })

      this.bootedAt = Date.now()
      this.setStatus("READY")
      await this.execute(`mkdir -p "${this.workingDirectory}"`, { cwd: "/", timeoutMs: 15000 })
      await this.execute(`printf '%s\n' "${this.workingDirectory}"`, { cwd: "/", timeoutMs: 15000 })
    })()

    try {
      await this.bootPromise
    } catch (error) {
      this.statusValue = "ERROR"
      throw error
    }
  }

  async shutdown(): Promise<void> {
    this.setStatus("STOPPING")
    if (this.emulator) {
      try {
        this.emulator.destroy()
      } catch {
        // Ignore destroy errors during shutdown
      }
      this.emulator = null
    }
    this.bootPromise = null
    this.serialBuffer = ""
    this.setStatus("STOPPED")
  }

  async restart(): Promise<void> {
    await this.shutdown()
    await this.boot()
  }

  private ensureEmulatorReady(): void {
    if (!this.emulator || this.statusValue !== "READY") {
      throw new Error("Linux VM is not ready. Boot it before executing commands.")
    }
  }

  private escapeSingleQuotes(value: string): string {
    return value.replace(/'/g, `'\\''`)
  }

  private async waitForExecutionMarker(marker: string, timeoutMs: number): Promise<string> {
    const endAt = Date.now() + timeoutMs
    let captured = ""

    while (Date.now() < endAt) {
      captured += this.serialBuffer
      if (captured.includes(marker)) {
        return captured
      }
      await new Promise((resolve) => window.setTimeout(resolve, 50))
    }

    throw new Error(`Command execution timed out after ${timeoutMs} ms.`)
  }

  async execute(command: string, options: CommandExecutionOptions = {}): Promise<CommandExecutionResult> {
    this.ensureEmulatorReady()

    const commandId = `cmd-${Date.now()}-${Math.random().toString(16).slice(2)}`
    const cwd = options.cwd ?? this.workingDirectory
    const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
    const safeCommand = this.escapeSingleQuotes(command)
    const safeCwd = this.escapeSingleQuotes(cwd)
    const script = `bash -lc 'cd '${safeCwd}' && out=$(mktemp) && err=$(mktemp) && { ${safeCommand}; } > "$out" 2> "$err"; status=$?; printf "__CODESAGE_STDOUT_${commandId}__\\n"; cat "$out"; printf "\\n__CODESAGE_STDOUT_END_${commandId}__\\n"; printf "__CODESAGE_STDERR_${commandId}__\\n"; cat "$err"; printf "\\n__CODESAGE_STDERR_END_${commandId}__\\n"; printf "__CODESAGE_EXIT_${commandId}__:%s\\n" "$status"'`

    this.serialBuffer = ""
    const startedAt = Date.now()
    this.statusValue = "RUNNING"
    this.emulator.serial0_send(`${script}\n`)

    const output = await this.waitForExecutionMarker(`__CODESAGE_EXIT_${commandId}__`, timeoutMs)
    const stdoutMatch = output.match(new RegExp(`__CODESAGE_STDOUT_${commandId}__\\n([\\s\\S]*?)__CODESAGE_STDOUT_END_${commandId}__`))
    const stderrMatch = output.match(new RegExp(`__CODESAGE_STDERR_${commandId}__\\n([\\s\\S]*?)__CODESAGE_STDERR_END_${commandId}__`))
    const exitMatch = output.match(new RegExp(`__CODESAGE_EXIT_${commandId}__:(\\d+)`))

    const stdout = stdoutMatch ? stdoutMatch[1].replace(/\r/g, "") : ""
    const stderr = stderrMatch ? stderrMatch[1].replace(/\r/g, "") : ""
    const exitCode = exitMatch ? Number(exitMatch[1]) : 1
    const durationMs = Date.now() - startedAt

    this.statusValue = "READY"

    return {
      command,
      cwd,
      stdout,
      stderr,
      exitCode,
      durationMs,
      commandId,
      processState: exitCode === 0 ? "completed" : "completed",
    }
  }

  async writeFile(path: string, content: string): Promise<void> {
    const escapedContent = this.escapeSingleQuotes(content)
    const safePath = this.escapeSingleQuotes(path)
    const command = `mkdir -p "$(dirname '${safePath}')" && cat > '${safePath}' <<'EOF'\n${content}\nEOF`
    await this.execute(command, { cwd: this.workingDirectory, timeoutMs: 30000 })
  }

  async readFile(path: string): Promise<string> {
    const safePath = this.escapeSingleQuotes(path)
    const response = await this.execute(`cat '${safePath}'`, { cwd: this.workingDirectory, timeoutMs: 30000 })
    return response.stdout || response.stderr || ""
  }

  async deleteFile(path: string): Promise<void> {
    const safePath = this.escapeSingleQuotes(path)
    await this.execute(`rm -f '${safePath}'`, { cwd: this.workingDirectory, timeoutMs: 15000 })
  }

  async listFiles(path: string): Promise<FileEntry[]> {
    const safePath = this.escapeSingleQuotes(path)
    const response = await this.execute(`find '${safePath}' -maxdepth 1 -mindepth 1 -printf '%f\t%y\t%s\\n'`, { cwd: this.workingDirectory, timeoutMs: 15000 })

    if (!response.stdout.trim()) {
      return []
    }

    return response.stdout
      .split(/\n/)
      .filter(Boolean)
      .map((line) => {
        const [name, type, sizeString] = line.split(/\t/)
        return {
          name,
          path: `${path.replace(/\/$/, "")}/${name}`,
          type: type === "d" ? "dir" : "file",
          size: sizeString ? Number(sizeString) : undefined,
        }
      })
      .filter((entry) => Boolean(entry.name))
  }

  async uploadFiles(files: Array<{ path: string; content: string }>): Promise<void> {
    for (const file of files) {
      await this.writeFile(file.path, file.content)
    }
  }

  async downloadFiles(path: string): Promise<Array<{ path: string; content: string }>> {
    const entries = await this.listFiles(path)
    const results: Array<{ path: string; content: string }> = []

    for (const entry of entries) {
      if (entry.type === "file") {
        results.push({ path: entry.path, content: await this.readFile(entry.path) })
      }
    }

    return results
  }

  async getWorkingDirectory(): Promise<string> {
    const response = await this.execute("pwd", { cwd: this.workingDirectory, timeoutMs: 15000 })
    return (response.stdout || this.workingDirectory).trim() || this.workingDirectory
  }

  async installPackage(name: string, manager = "apt") {
    const normalizedManager = manager || "apt"
    const command =
      normalizedManager === "npm"
        ? `npm install ${name}`
        : normalizedManager === "pip"
          ? `pip install ${name}`
          : normalizedManager === "cargo"
            ? `cargo install ${name}`
            : `apt-get update && apt-get install -y ${name}`

    return this.execute(command, { cwd: this.workingDirectory, timeoutMs: 180000 })
  }

  async getProcessStatus(): Promise<{ pid?: number; running: boolean; status: string }> {
    const response = await this.execute("ps -eo pid,comm --no-headers | head -n 5", { cwd: this.workingDirectory, timeoutMs: 15000 })
    return {
      running: response.exitCode === 0,
      status: response.exitCode === 0 ? "active" : "idle",
      pid: undefined,
    }
  }

  async getEnvironmentInfo(): Promise<Record<string, string | number | boolean | undefined>> {
    return {
      status: this.statusValue,
      bootedAt: this.bootedAt ?? undefined,
      projectPath: this.workingDirectory,
      isReady: this.statusValue === "READY",
      assetBase: this.assetBase,
      linuxImage: this.linuxImageUrl,
    }
  }
}

export const defaultV86Environment = new V86Environment()
