import { prisma } from '@/lib/prisma'
import { getJobRecoveryTarget } from './generation-job'
import type { ResumePlan } from './pipeline-types'

export async function isJobPaused(jobId: number): Promise<boolean> {
  const job = await prisma.generationJob.findUnique({
    where: { id: jobId },
    select: { status: true },
  })
  return job?.status === 'PAUSED' || job?.status === 'FAILED'
}

export async function resolveResumePlan(jobId: number): Promise<ResumePlan> {
  const [job, target] = await Promise.all([
    prisma.generationJob.findUnique({
      where: { id: jobId },
      include: {
        checkpoints: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    }),
    getJobRecoveryTarget(jobId),
  ])

  if (target?.mode === 'retry_batch') {
    return { startFrom: 'chapter_list' }
  }
  if (target?.mode === 'retry_chapter') {
    return { startFrom: 'write', resumeFromChapterNumber: target.chapterNumber }
  }

  if (!job) return { startFrom: 'blueprint' }

  if (job.currentStep === 'CHAPTER_LIST') {
    return { startFrom: 'chapter_list' }
  }
  if (job.currentStep === 'WRITE' && job.currentChapter > 0) {
    return { startFrom: 'write', resumeFromChapterNumber: job.currentChapter }
  }

  const lastCheckpoint = job.checkpoints[0]
  if (lastCheckpoint?.step === 'CHAPTER_LIST') {
    return { startFrom: 'write', resumeFromChapterNumber: job.currentChapter || undefined }
  }
  if (lastCheckpoint?.step === 'ARC_PLAN') {
    return { startFrom: 'chapter_list' }
  }

  return { startFrom: 'blueprint' }
}