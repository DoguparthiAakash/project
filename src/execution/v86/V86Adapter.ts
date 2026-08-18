import { V86Environment } from "@/execution/v86/V86Environment"

export class V86Adapter {
  constructor(private readonly environment = new V86Environment()) {}

  async boot(screenContainer?: HTMLElement | null) {
    await this.environment.boot(screenContainer ?? null)
  }

  async restart() {
    await this.environment.restart()
  }

  async shutdown() {
    await this.environment.shutdown()
  }

  async execute(command: string, cwd?: string, timeoutMs?: number) {
    return this.environment.execute(command, { cwd, timeoutMs })
  }

  async writeFile(path: string, content: string) {
    await this.environment.writeFile(path, content)
  }

  async readFile(path: string) {
    return this.environment.readFile(path)
  }

  async listFiles(path: string) {
    return this.environment.listFiles(path)
  }
}
