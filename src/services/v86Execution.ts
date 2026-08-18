import { V86Environment } from "@/execution/v86/V86Environment"
import type { CommandExecutionOptions, CommandExecutionResult, ExecutionEnvironment } from "@/execution/ExecutionEnvironment"

export const v86Environment: ExecutionEnvironment = new V86Environment()

export async function bootVm(screenContainer?: HTMLElement | null) {
  await v86Environment.boot(screenContainer ?? null)
}

export async function shutdownVm() {
  await v86Environment.shutdown()
}

export async function restartVm() {
  await v86Environment.restart()
}

export async function executeVmCommand(command: string, options?: CommandExecutionOptions): Promise<CommandExecutionResult> {
  return v86Environment.execute(command, options)
}

export async function writeVmFile(path: string, content: string) {
  await v86Environment.writeFile(path, content)
}

export async function readVmFile(path: string) {
  return v86Environment.readFile(path)
}

export async function listVmFiles(path: string) {
  return v86Environment.listFiles(path)
}

export async function syncProjectToVm(projectRoot: string) {
  return v86Environment.uploadFiles([
    {
      path: `/workspace/project/.codesage-sync-marker`,
      content: JSON.stringify({ syncedAt: new Date().toISOString(), projectRoot }, null, 2),
    },
  ])
}

export function getVmStatus() {
  return v86Environment.getStatus()
}

export async function getVmWorkingDirectory() {
  return v86Environment.getWorkingDirectory()
}
