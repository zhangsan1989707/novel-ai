import { logError } from '@/lib/logger'

const AUTO_TASK_TIMEOUT_MS = 60000

type AutoMaintenanceState = {
  bootstrapInFlight: Set<number>
  ragRebuildInFlight: Set<number>
}

function getAutoMaintenanceState(): AutoMaintenanceState {
  const globalState = globalThis as typeof globalThis & {
    __novelAiAutoMaintenanceState?: AutoMaintenanceState
  }

  if (!globalState.__novelAiAutoMaintenanceState) {
    globalState.__novelAiAutoMaintenanceState = {
      bootstrapInFlight: new Set<number>(),
      ragRebuildInFlight: new Set<number>(),
    }
  }

  return globalState.__novelAiAutoMaintenanceState
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`${label} timed out after ${timeoutMs}ms`))
    }, timeoutMs)

    promise
      .then(value => {
        clearTimeout(timer)
        resolve(value)
      })
      .catch(error => {
        clearTimeout(timer)
        reject(error)
      })
  })
}

export function scheduleProjectBootstrap(
  projectId: number,
  task: () => Promise<unknown>,
  context: Record<string, unknown> = {}
): boolean {
  const state = getAutoMaintenanceState()
  if (state.bootstrapInFlight.has(projectId)) {
    return false
  }

  state.bootstrapInFlight.add(projectId)
  void withTimeout(task(), AUTO_TASK_TIMEOUT_MS, 'auto_project_bootstrap')
    .catch(error => {
      logError(error instanceof Error ? error : new Error(String(error)), {
        type: 'auto_project_bootstrap',
        projectId,
        ...context,
      })
    })
    .finally(() => {
      state.bootstrapInFlight.delete(projectId)
    })

  return true
}

export function scheduleRagRebuild(
  projectId: number,
  task: () => Promise<unknown>,
  context: Record<string, unknown> = {}
): boolean {
  const state = getAutoMaintenanceState()
  if (state.ragRebuildInFlight.has(projectId)) {
    return false
  }

  state.ragRebuildInFlight.add(projectId)
  void withTimeout(task(), AUTO_TASK_TIMEOUT_MS, 'auto_rag_rebuild')
    .catch(error => {
      logError(error instanceof Error ? error : new Error(String(error)), {
        type: 'auto_rag_rebuild',
        projectId,
        ...context,
      })
    })
    .finally(() => {
      state.ragRebuildInFlight.delete(projectId)
    })

  return true
}
