import { prisma } from '@/lib/prisma'
import { normalizeGenerationSpeedMode, type GenerationSpeedMode } from '@/lib/ai/speed-mode'
import { failStaleRunningJobs } from './generation-job'
import { runProductionPipeline } from './production-pipeline'

export type PipelineWorkerTickResult =
  | {
    status: 'IDLE'
    projectId?: number
    failedStaleJobs: number
    message: string
  }
  | {
    status: 'processed'
    jobId: number
    projectId: number
    speedMode: GenerationSpeedMode
    failedStaleJobs: number
  }

export async function runNextPipelineJob(options: { projectId?: number } = {}): Promise<PipelineWorkerTickResult> {
  const failedStaleJobs = await failStaleRunningJobs({ projectId: options.projectId })
  const job = await prisma.generationJob.findFirst({
    where: {
      ...(options.projectId ? { projectId: options.projectId } : {}),
      status: 'PENDING',
    },
    orderBy: { createdAt: 'asc' },
  })

  if (!job) {
    return {
      status: 'IDLE',
      projectId: options.projectId,
      failedStaleJobs,
      message: '没有待推进的生成任务',
    }
  }

  const payload = job.payload && typeof job.payload === 'object'
    ? job.payload as Record<string, unknown>
    : {}
  const speedMode = normalizeGenerationSpeedMode(payload.speedMode)
  const claimed = await prisma.generationJob.updateMany({
    where: {
      id: job.id,
      status: 'PENDING',
    },
    data: {
      status: 'RUNNING',
    },
  })

  if (claimed.count !== 1) {
    return {
      status: 'IDLE',
      projectId: options.projectId,
      failedStaleJobs,
      message: '待推进任务已被其他 worker 接管',
    }
  }

  await runProductionPipeline(job.id, { speedMode })

  return {
    status: 'processed',
    jobId: job.id,
    projectId: job.projectId,
    speedMode,
    failedStaleJobs,
  }
}
