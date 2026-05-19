import { prisma } from '@/lib/prisma'
import { PipelineStep } from '@/types'

interface JobProgress {
  jobId: number
  status: string
  currentStep: string | null
  stepIndex: number
  totalChapters: number
  currentChapter: number
  progress: number
}

export async function createJob(projectId: number, type: string = 'FULL_PIPELINE'): Promise<number> {
  const job = await prisma.generationJob.create({
    data: {
      projectId,
      type,
      status: 'PENDING',
      payload: {},
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
  await prisma.generationJob.update({
    where: { id: jobId },
    data: {
      status: 'COMPLETED',
      currentStep: null,
      completedAt: new Date(),
    },
  })

  const job = await prisma.generationJob.findUnique({ where: { id: jobId } })
  if (job) {
    await prisma.novelProject.update({
      where: { id: job.projectId },
      data: { pipelineJobId: null },
    })
  }
}

export async function failJob(jobId: number, errorMessage: string): Promise<void> {
  await prisma.generationJob.update({
    where: { id: jobId },
    data: {
      status: 'FAILED',
      errorMessage,
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
  }
}

export async function resumeJob(jobId: number): Promise<boolean> {
  const job = await prisma.generationJob.findUnique({
    where: { id: jobId },
    include: { checkpoints: { orderBy: { createdAt: 'desc' }, take: 1 } },
  })

  if (!job || job.status !== 'FAILED') return false

  const lastCheckpoint = job.checkpoints[0]
  const stepIndex = lastCheckpoint ? job.stepIndex : 0

  await prisma.generationJob.update({
    where: { id: jobId },
    data: {
      status: 'PENDING',
      stepIndex,
      retryCount: job.retryCount + 1,
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