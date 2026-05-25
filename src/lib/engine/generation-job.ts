import { prisma } from '@/lib/prisma'
import type { Prisma } from '@prisma/client'
import { PipelineStep } from '@/types'
import {
  archiveChapterRuntime,
  createPipelineRuntimeState,
  sanitizePipelineRuntime,
  type PipelineRuntimeState,
} from './pipeline-runtime'

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

export async function createJob(projectId: number, type: string = 'FULL_PIPELINE'): Promise<number> {
  const job = await prisma.generationJob.create({
    data: {
      projectId,
      type,
      status: 'PENDING',
      payload: ({ runtime: createPipelineRuntimeState() } as unknown) as Prisma.InputJsonValue,
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

export async function pauseJob(jobId: number): Promise<void> {
  await prisma.generationJob.update({
    where: { id: jobId },
    data: { status: 'PAUSED' },
  })
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
