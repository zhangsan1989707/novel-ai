import { JobStatus, Prisma } from '@prisma/client'
import { logger, logError } from '@/lib/logger'
import { prisma } from '@/lib/prisma'
import { rebuildProjectRAGIndex } from './rag-vector'
import { refreshBlueprintConsole } from './blueprint-console'

type MaintenanceTaskType = 'BOOTSTRAP_PROJECT' | 'REBUILD_RAG_INDEX'

interface ProjectMaintenanceTaskRecord {
  id: string
  projectId: number
  taskType: string
  status: JobStatus
  payload: Prisma.JsonValue | null
  result: Prisma.JsonValue | null
  errorMessage: string | null
  retryCount: number
  maxRetries: number
  priority: number
  nextRunAt: Date | null
  startedAt: Date | null
  completedAt: Date | null
  lockedAt: Date | null
}

export interface MaintenanceSummary {
  bootstrapQueued: boolean
  bootstrapRunning: boolean
  ragQueued: boolean
  ragRunning: boolean
  bootstrapFailed: boolean
  ragFailed: boolean
  queuedTaskCount: number
}

type MaintenanceWorkerState = {
  started: boolean
  draining: boolean
  timer: ReturnType<typeof setInterval> | null
}

const globalState = globalThis as typeof globalThis & {
  __novelAiMaintenanceWorkerState?: MaintenanceWorkerState
}

function getState(): MaintenanceWorkerState {
  if (!globalState.__novelAiMaintenanceWorkerState) {
    globalState.__novelAiMaintenanceWorkerState = {
      started: false,
      draining: false,
      timer: null,
    }
  }
  return globalState.__novelAiMaintenanceWorkerState
}

function now(): Date {
  return new Date()
}

function toJson(value: Record<string, unknown> = {}): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue
}

function isTaskActive(task: ProjectMaintenanceTaskRecord): boolean {
  return task.status === 'PENDING' || task.status === 'RUNNING'
}

function getTaskPriority(taskType: MaintenanceTaskType): number {
  return taskType === 'BOOTSTRAP_PROJECT' ? 100 : 50
}

async function startWorker() {
  const state = getState()
  if (state.started) return
  state.started = true
  state.timer = setInterval(() => {
    void drainQueue()
  }, 4000)
  state.timer.unref?.()
  void drainQueue()
  logger.info('Project maintenance worker started')
}

async function claimNextTask(): Promise<ProjectMaintenanceTaskRecord | null> {
  const candidate = await prisma.projectMaintenanceTask.findFirst({
    where: {
      status: 'PENDING',
      OR: [
        { nextRunAt: null },
        { nextRunAt: { lte: now() } },
      ],
    },
    orderBy: [
      { priority: 'desc' },
      { createdAt: 'asc' },
    ],
  })

  if (!candidate) return null

  const updated = await prisma.projectMaintenanceTask.updateMany({
    where: {
      id: candidate.id,
      status: 'PENDING',
    },
    data: {
      status: 'RUNNING',
      startedAt: now(),
      lockedAt: now(),
    },
  })

  if (updated.count === 0) return null

  return candidate as ProjectMaintenanceTaskRecord
}

async function completeTask(task: ProjectMaintenanceTaskRecord, result: Record<string, unknown>) {
  await prisma.projectMaintenanceTask.update({
    where: { id: task.id },
    data: {
      status: 'COMPLETED',
      result: toJson(result),
      errorMessage: null,
      completedAt: now(),
      lockedAt: null,
    },
  })
}

async function failTask(task: ProjectMaintenanceTaskRecord, error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  const retryCount = task.retryCount + 1
  const retryable = retryCount <= task.maxRetries
  await prisma.projectMaintenanceTask.update({
    where: { id: task.id },
    data: {
      status: retryable ? 'PENDING' : 'FAILED',
      retryCount,
      errorMessage: message,
      nextRunAt: retryable ? new Date(Date.now() + Math.min(120000, 2000 * Math.pow(2, retryCount))) : null,
      completedAt: retryable ? null : now(),
      lockedAt: null,
    },
  })
}

async function queueTask(
  projectId: number,
  taskType: MaintenanceTaskType,
  payload: Record<string, unknown> = {}
): Promise<boolean> {
  await startWorker()

  const active = await prisma.projectMaintenanceTask.findFirst({
    where: {
      projectId,
      taskType,
      status: { in: ['PENDING', 'RUNNING'] },
    },
    orderBy: [
      { priority: 'desc' },
      { createdAt: 'asc' },
    ],
  })

  if (active) return false

  await prisma.projectMaintenanceTask.create({
    data: {
      projectId,
      taskType,
      status: 'PENDING',
      payload: toJson(payload),
      priority: getTaskPriority(taskType),
      nextRunAt: now(),
    },
  })

  void drainQueue()
  return true
}

export async function queueProjectBootstrap(
  projectId: number,
  payload: Record<string, unknown> = {}
): Promise<boolean> {
  return queueTask(projectId, 'BOOTSTRAP_PROJECT', payload)
}

export async function queueRagRebuild(
  projectId: number,
  payload: Record<string, unknown> = {}
): Promise<boolean> {
  return queueTask(projectId, 'REBUILD_RAG_INDEX', payload)
}

export async function getProjectMaintenanceSummary(projectId: number): Promise<MaintenanceSummary> {
  void startWorker()
  const tasks = await prisma.projectMaintenanceTask.findMany({
    where: { projectId },
    orderBy: [
      { createdAt: 'desc' },
    ],
    take: 20,
  })

  const bootstrapTasks = tasks.filter(task => task.taskType === 'BOOTSTRAP_PROJECT')
  const ragTasks = tasks.filter(task => task.taskType === 'REBUILD_RAG_INDEX')
  const queuedTaskCount = tasks.filter(isTaskActive).length

  return {
    bootstrapQueued: bootstrapTasks.some(task => task.status === 'PENDING'),
    bootstrapRunning: bootstrapTasks.some(task => task.status === 'RUNNING'),
    ragQueued: ragTasks.some(task => task.status === 'PENDING'),
    ragRunning: ragTasks.some(task => task.status === 'RUNNING'),
    bootstrapFailed: bootstrapTasks.some(task => task.status === 'FAILED'),
    ragFailed: ragTasks.some(task => task.status === 'FAILED'),
    queuedTaskCount,
  }
}

async function runTask(task: ProjectMaintenanceTaskRecord): Promise<Record<string, unknown>> {
  switch (task.taskType as MaintenanceTaskType) {
    case 'BOOTSTRAP_PROJECT': {
      const { title, chapterWordCount, totalVolumes, chapters, chapterSummaries, volumeSummaries, bookSummary } =
        await prisma.novelProject.findUniqueOrThrow({
          where: { id: task.projectId },
          select: {
            title: true,
            chapterWordCount: true,
            totalVolumes: true,
            chapters: { select: { id: true } },
            chapterSummaries: { select: { id: true } },
            volumeSummaries: { select: { id: true } },
            bookSummary: { select: { id: true } },
          },
        })

      const snapshot = await refreshBlueprintConsole(task.projectId, '系统正在自动初始化创作系统，请补齐蓝图、阶段规划、世界状态与故事状态。')

      const shouldQueueRag = chapters.length > 0 || chapterSummaries.length > 0 || volumeSummaries.length > 0 || Boolean(bookSummary)
      if (shouldQueueRag) {
        await queueRagRebuild(task.projectId, {
          source: 'bootstrap',
          title,
          chapterWordCount,
          totalVolumes,
        })
      }

      return {
        blueprintCard: snapshot.blueprintCard,
        generatedAt: snapshot.generatedAt,
      }
    }
    case 'REBUILD_RAG_INDEX': {
      const result = await rebuildProjectRAGIndex(task.projectId)
      return {
        indexedCount: result.indexedCount,
        rebuiltAt: result.rebuiltAt.toISOString(),
      }
    }
    default:
      throw new Error(`Unsupported maintenance task: ${task.taskType}`)
  }
}

async function drainQueue(): Promise<void> {
  const state = getState()
  if (state.draining) return
  state.draining = true

  try {
    while (true) {
      const task = await claimNextTask()
      if (!task) break

      try {
        const result = await runTask(task)
        await completeTask(task, result)
      } catch (error) {
        await failTask(task, error)
        logError(error instanceof Error ? error : new Error(String(error)), {
          type: 'project_maintenance_task_failed',
          projectId: task.projectId,
          taskType: task.taskType,
        })
      }
    }
  } finally {
    state.draining = false
  }
}

export async function ensureProjectMaintenanceQueued(
  projectId: number,
  input: {
    hasModel: boolean
    hasBlueprint: boolean
    hasArcPlans: boolean
    hasStoryState: boolean
    hasWorldState: boolean
    ragDocumentCount: number
    completedChapters: number
    chapterSummaryCount: number
    volumeSummaryCount: number
    bookSummaryCount: number
  }
): Promise<void> {
  if (input.hasModel && (!input.hasBlueprint || !input.hasArcPlans || !input.hasStoryState || !input.hasWorldState)) {
    await queueProjectBootstrap(projectId, { source: 'project_detail', reason: 'missing_project_state' })
    return
  }

  if (
    input.ragDocumentCount === 0 &&
    (input.completedChapters > 0 || input.chapterSummaryCount > 0 || input.volumeSummaryCount > 0 || input.bookSummaryCount > 0)
  ) {
    await queueRagRebuild(projectId, { source: 'project_detail', reason: 'rag_missing' })
  }
}
