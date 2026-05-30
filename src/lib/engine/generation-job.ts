import { prisma } from '@/lib/prisma'
import type { Prisma } from '@prisma/client'
import { PipelineStep } from '@/types'
import {
  archiveChapterRuntime,
  createPipelineRuntimeState,
  sanitizePipelineRuntime,
  type PipelineRuntimeState,
} from './pipeline-runtime'
import type { GenerationSpeedMode } from '@/lib/ai/speed-mode'

interface JobProgress {
  jobId: number
  status: string
  currentStep: string | null
  stepIndex: number
  totalChapters: number
  currentChapter: number
  progress: number
  runtime?: PipelineRuntimeState
  error?: string
}

export type JobRecoveryTarget =
  | { mode: 'continue' }
  | { mode: 'retry_batch' }
  | { mode: 'retry_chapter'; chapterNumber: number }

const DEFAULT_STALE_RUNNING_JOB_MS = 10 * 60 * 1000

function normalizePayload(payload: unknown): Record<string, unknown> {
  return payload && typeof payload === 'object' && !Array.isArray(payload)
    ? payload as Record<string, unknown>
    : {}
}

function readLastRuntimeEventAt(payload: Record<string, unknown>, fallback: Date): Date {
  const runtime = sanitizePipelineRuntime(payload.runtime)
  if (runtime.lastEventAt) {
    const parsed = new Date(runtime.lastEventAt)
    if (!Number.isNaN(parsed.getTime())) return parsed
  }
  return fallback
}

function normalizeRecoveryTarget(value: unknown): JobRecoveryTarget | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const candidate = value as Record<string, unknown>
  if (candidate.mode === 'continue') return { mode: 'continue' }
  if (candidate.mode === 'retry_batch') return { mode: 'retry_batch' }
  if (candidate.mode === 'retry_chapter' && typeof candidate.chapterNumber === 'number') {
    return { mode: 'retry_chapter', chapterNumber: candidate.chapterNumber }
  }
  return null
}

export async function createJob(
  projectId: number,
  type: string = 'FULL_PIPELINE',
  speedMode: GenerationSpeedMode = 'balanced'
): Promise<number> {
  const job = await prisma.generationJob.create({
    data: {
      projectId,
      type,
      status: 'PENDING',
      payload: ({ speedMode, runtime: createPipelineRuntimeState(speedMode) } as unknown) as Prisma.InputJsonValue,
    },
  })

  await prisma.novelProject.update({
    where: { id: projectId },
    data: { pipelineJobId: job.id },
  })

  return job.id
}

export async function saveCheckpoint(
  jobId: number,
  step: PipelineStep,
  input: Record<string, unknown> = {},
  output: Record<string, unknown> = {}
): Promise<void> {
  await prisma.pipelineCheckpoint.create({
    data: {
      jobId,
      step: step.toUpperCase() as any,
      input: input as any,
      output: output as any,
      status: 'COMPLETED',
    },
  })
}

export async function updateJobStep(
  jobId: number,
  step: PipelineStep,
  stepIndex: number,
  totalChapters?: number,
  currentChapter?: number
): Promise<void> {
  const data: Record<string, unknown> = {
    currentStep: step.toUpperCase() as any,
    stepIndex,
    status: 'RUNNING',
  }
  if (totalChapters !== undefined) data.totalChapters = totalChapters
  if (currentChapter !== undefined) data.currentChapter = currentChapter

  await prisma.generationJob.update({
    where: { id: jobId },
    data: data as any,
  })
}

export async function completeJob(jobId: number): Promise<void> {
  const job = await prisma.generationJob.findUnique({ where: { id: jobId } })
  const payload = job?.payload && typeof job.payload === 'object'
    ? job.payload as Record<string, unknown>
    : {}
  const runtime = sanitizePipelineRuntime(payload.runtime)

  await prisma.generationJob.update({
    where: { id: jobId },
    data: {
      status: 'COMPLETED',
      currentStep: null,
      completedAt: new Date(),
      payload: {
        ...payload,
        runtime: {
          ...runtime,
          currentChapter: null,
          lastEventAt: new Date().toISOString(),
          streamRevision: runtime.streamRevision + 1,
        },
      } as any,
    },
  })

  if (job) {
    await prisma.novelProject.update({
      where: { id: job.projectId },
      data: { pipelineJobId: null },
    })
  }
}

export async function failJob(jobId: number, errorMessage: string): Promise<void> {
  const job = await prisma.generationJob.findUnique({ where: { id: jobId } })
  const payload = job?.payload && typeof job.payload === 'object'
    ? job.payload as Record<string, unknown>
    : {}
  const runtime = sanitizePipelineRuntime(payload.runtime)
  const currentChapter = runtime.currentChapter
    ? {
      ...runtime.currentChapter,
      status: 'FAILED' as const,
      error: errorMessage,
      updatedAt: new Date().toISOString(),
    }
    : null

  await prisma.generationJob.update({
    where: { id: jobId },
    data: {
      status: 'FAILED',
      errorMessage,
      payload: {
        ...payload,
        runtime: {
          ...runtime,
          currentChapter,
          lastEventAt: new Date().toISOString(),
          streamRevision: runtime.streamRevision + 1,
        },
      } as any,
    },
  })
}

export async function updateJobRuntime(jobId: number, runtime: PipelineRuntimeState): Promise<void> {
  const job = await prisma.generationJob.findUnique({
    where: { id: jobId },
    select: { payload: true },
  })
  const payload = job?.payload && typeof job.payload === 'object'
    ? job.payload as Record<string, unknown>
    : {}

  await prisma.generationJob.update({
    where: { id: jobId },
    data: {
      payload: {
        ...payload,
        runtime,
      } as any,
    },
  })
}

export async function setJobRecoveryTarget(jobId: number, target: JobRecoveryTarget): Promise<void> {
  const job = await prisma.generationJob.findUnique({
    where: { id: jobId },
    select: { payload: true },
  })
  const payload = normalizePayload(job?.payload)

  await prisma.generationJob.update({
    where: { id: jobId },
    data: {
      payload: {
        ...payload,
        recoveryTarget: target,
      } as any,
    },
  })
}

export async function clearJobRecoveryTarget(jobId: number): Promise<void> {
  const job = await prisma.generationJob.findUnique({
    where: { id: jobId },
    select: { payload: true },
  })
  const payload = normalizePayload(job?.payload)
  const nextPayload = { ...payload }
  delete nextPayload.recoveryTarget

  await prisma.generationJob.update({
    where: { id: jobId },
    data: {
      payload: nextPayload as any,
    },
  })
}

export async function getJobRecoveryTarget(jobId: number): Promise<JobRecoveryTarget | null> {
  const job = await prisma.generationJob.findUnique({
    where: { id: jobId },
    select: { payload: true },
  })
  return normalizeRecoveryTarget(normalizePayload(job?.payload).recoveryTarget)
}

export async function getJobProgress(jobId: number): Promise<JobProgress | null> {
  const job = await prisma.generationJob.findUnique({
    where: { id: jobId },
  })

  if (!job) return null

  const totalSteps = 8
  const stepProgress = totalSteps > 0 ? (job.stepIndex / totalSteps) * 100 : 0

  return {
    jobId: job.id,
    status: job.status,
    currentStep: job.currentStep,
    stepIndex: job.stepIndex,
    totalChapters: job.totalChapters,
    currentChapter: job.currentChapter,
    progress: Math.round(stepProgress),
    runtime: sanitizePipelineRuntime(
      job.payload && typeof job.payload === 'object'
        ? (job.payload as Record<string, unknown>).runtime
        : undefined
    ),
    error: job.errorMessage || undefined,
  }
}

export async function failStaleRunningJobs(
  options: {
    projectId?: number
    staleMs?: number
  } = {}
): Promise<number> {
  const staleMs = options.staleMs || DEFAULT_STALE_RUNNING_JOB_MS
  const now = Date.now()
  const jobs = await prisma.generationJob.findMany({
    where: {
      status: 'RUNNING',
      ...(options.projectId ? { projectId: options.projectId } : {}),
    },
    select: {
      id: true,
      payload: true,
      updatedAt: true,
    },
  })

  let failedCount = 0
  for (const job of jobs) {
    const payload = normalizePayload(job.payload)
    const lastEventAt = readLastRuntimeEventAt(payload, job.updatedAt)
    if (now - lastEventAt.getTime() < staleMs) continue

    await failJob(
      job.id,
      `生成任务超过 ${Math.round(staleMs / 60000)} 分钟没有进度事件，已标记为失败，可从恢复入口继续`
    )
    failedCount++
  }

  return failedCount
}

export async function resumeJob(jobId: number): Promise<boolean> {
  const job = await prisma.generationJob.findUnique({
    where: { id: jobId },
    include: { checkpoints: { orderBy: { createdAt: 'desc' }, take: 1 } },
  })

  if (!job || (job.status !== 'FAILED' && job.status !== 'PAUSED')) return false

  const lastCheckpoint = job.checkpoints[0]
  const stepIndex = lastCheckpoint ? job.stepIndex : 0

  await prisma.generationJob.update({
    where: { id: jobId },
    data: {
      status: 'PENDING',
      stepIndex,
      retryCount: job.status === 'FAILED' ? job.retryCount + 1 : job.retryCount,
      errorMessage: null,
    },
  })

  return true
}

export async function prepareJobRecovery(jobId: number, target: JobRecoveryTarget): Promise<boolean> {
  const job = await prisma.generationJob.findUnique({
    where: { id: jobId },
  })

  if (!job || (job.status !== 'FAILED' && job.status !== 'PAUSED')) return false

  const payload = normalizePayload(job.payload)
  await prisma.generationJob.update({
    where: { id: jobId },
    data: {
      status: 'PENDING',
      errorMessage: null,
      retryCount: job.status === 'FAILED' ? job.retryCount + 1 : job.retryCount,
      payload: {
        ...payload,
        recoveryTarget: target,
      } as any,
    },
  })

  return true
}

export async function pauseJob(jobId: number): Promise<void> {
  await prisma.generationJob.update({
    where: { id: jobId },
    data: { status: 'PAUSED' },
  })
}

export async function cancelJob(jobId: number): Promise<void> {
  const job = await prisma.generationJob.findUnique({ where: { id: jobId } })
  const payload = job?.payload && typeof job.payload === 'object'
    ? job.payload as Record<string, unknown>
    : {}
  const runtime = sanitizePipelineRuntime(payload.runtime)
  const currentChapter = runtime.currentChapter
    ? {
      ...runtime.currentChapter,
      status: 'CANCELLED' as const,
      updatedAt: new Date().toISOString(),
    }
    : null

  await prisma.generationJob.update({
    where: { id: jobId },
    data: {
      status: 'FAILED',
      errorMessage: '用户手动停止生成',
      payload: {
        ...payload,
        runtime: {
          ...runtime,
          currentChapter,
          lastEventAt: new Date().toISOString(),
          streamRevision: runtime.streamRevision + 1,
        },
      } as any,
    },
  })

  if (job) {
    await prisma.novelProject.update({
      where: { id: job.projectId },
      data: { pipelineJobId: null },
    })
  }
}

export async function reconcileReplayedChapterRuntime(jobId: number, chapterNo: number): Promise<void> {
  const job = await prisma.generationJob.findUnique({
    where: { id: jobId },
    select: {
      payload: true,
      currentStep: true,
      stepIndex: true,
      totalChapters: true,
      currentChapter: true,
    },
  })

  if (!job) return

  const payload = job.payload && typeof job.payload === 'object'
    ? job.payload as Record<string, unknown>
    : {}
  const runtime = sanitizePipelineRuntime(payload.runtime)
  const currentChapter = runtime.currentChapter

  if (!currentChapter || currentChapter.chapterNumber !== chapterNo) return

  const now = new Date().toISOString()
  const recoveredChapter = {
    ...currentChapter,
    status: 'COMPLETED' as const,
    currentPhase: 'completed',
    error: undefined,
    completedAt: currentChapter.completedAt || now,
    updatedAt: now,
    lastMessage: '章节提交已重放恢复，等待继续生成',
  }

  const nextRuntime = archiveChapterRuntime(
    {
      ...runtime,
      currentChapter: recoveredChapter,
    },
    recoveredChapter
  )

  await prisma.generationJob.update({
    where: { id: jobId },
    data: {
      status: 'PAUSED',
      currentStep: 'WRITE',
      stepIndex: Math.max(job.stepIndex, 4),
      totalChapters: job.totalChapters,
      currentChapter: chapterNo,
      errorMessage: null,
      payload: {
        ...payload,
        runtime: nextRuntime,
      } as unknown as Prisma.InputJsonValue,
    },
  })
}
