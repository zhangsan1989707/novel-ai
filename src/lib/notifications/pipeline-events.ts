import { prisma } from '@/lib/prisma'
import { getCurrentUserId } from '@/lib/auth'
import type { Prisma } from '@prisma/client'

export async function notifyChapterGenerated(
  projectId: number,
  projectTitle: string,
  chapterNumber: number,
  chapterTitle: string
): Promise<void> {
  const userId = await getCurrentUserId()
  await prisma.notification.create({
    data: {
      userId,
      type: 'TASK',
      priority: 'NORMAL',
      title: `章节生成完成：${projectTitle}`,
      content: `第${chapterNumber}章「${chapterTitle}」已生成完成`,
      link: `/projects/${projectId}`,
      projectId,
      metadata: { kind: 'chapter_generated', chapterNumber } as Prisma.InputJsonValue,
    },
  })
}

export async function notifyPipelineFailed(
  projectId: number,
  projectTitle: string,
  errorMessage: string
): Promise<void> {
  const userId = await getCurrentUserId()
  await prisma.notification.create({
    data: {
      userId,
      type: 'ERROR',
      priority: 'HIGH',
      title: `生成失败：${projectTitle}`,
      content: `流水线执行失败：${errorMessage.slice(0, 200)}`,
      link: `/projects/${projectId}`,
      projectId,
      metadata: { kind: 'pipeline_failed', error: errorMessage } as Prisma.InputJsonValue,
    },
  })
}

export async function notifyBatchComplete(
  projectId: number,
  projectTitle: string,
  batchStart: number,
  batchEnd: number
): Promise<void> {
  const userId = await getCurrentUserId()
  await prisma.notification.create({
    data: {
      userId,
      type: 'TASK',
      priority: 'NORMAL',
      title: `批次生成完成：${projectTitle}`,
      content: `第${batchStart}章至第${batchEnd}章已全部生成完成`,
      link: `/projects/${projectId}`,
      projectId,
      metadata: { kind: 'batch_complete', batchStart, batchEnd } as Prisma.InputJsonValue,
    },
  })
}
