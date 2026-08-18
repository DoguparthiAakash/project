import { executeVmCommand, getVmStatus, getVmWorkingDirectory, syncProjectToVm } from "@/services/v86Execution"

export interface ExecuteCommandRequest {
  command: string
  cwd?: string
  timeout?: number
}

export interface AgentToolResponse<T> {
  ok: boolean
  data?: T
  error?: string
}

export async function executeCommandTool(input: ExecuteCommandRequest) {
  try {
    const result = await executeVmCommand(input.command, {
      cwd: input.cwd ?? "/workspace/project",
      timeoutMs: input.timeout ?? 120000,
    })

    return {
      ok: true,
      data: result,
    } satisfies AgentToolResponse<typeof result>
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown execution error"
    return {
      ok: false,
      error: message,
    } satisfies AgentToolResponse<never>
  }
}

export async function getVmToolStatus() {
  return {
    ok: true,
    data: {
      status: getVmStatus(),
      workingDirectory: await getVmWorkingDirectory(),
    },
  }
}

export async function syncProjectToVmTool(projectRoot: string) {
  try {
    const result = await syncProjectToVm(projectRoot)
    return { ok: true, data: result }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown sync error"
    return { ok: false, error: message }
  }
}
