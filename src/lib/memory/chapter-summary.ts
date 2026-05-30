/**
 * 章节摘要 Memory 模块
 */
import { prisma } from '@/lib/prisma'
import type { ChapterSummaryData } from '@/lib/engine/types'

/**
 * 获取最近 N 章摘要
 */
export async function getRecentChapterSummaries(
  projectId: number,
  count: number = 5
): Promise<{ chapterNo: number; summary: string }[]> {
  const summaries = await prisma.chapterSummary.findMany({
    where: { projectId },
    orderBy: { chapterNo: 'desc' },
    take: count,
  })

  return summaries
    .sort((a, b) => a.chapterNo - b.chapterNo)
    .map(s => ({ chapterNo: s.chapterNo, summary: s.summary }))
}

/**
 * 获取特定章节范围的所有摘要
 */
export async function getChapterSummariesInRange(
  projectId: number,
  startChapter: number,
  endChapter: number
): Promise<{ chapterNo: number; summary: string }[]> {
  const summaries = await prisma.chapterSummary.findMany({
    where: {
      projectId,
      chapterNo: { gte: startChapter, lte: endChapter },
    },
    orderBy: { chapterNo: 'asc' },
  })

  return summaries.map(s => ({ chapterNo: s.chapterNo, summary: s.summary }))
}

/**
 * 保存章节摘要
 */
export async function saveChapterSummary(
  projectId: number,
  chapterNo: number,
  data: ChapterSummaryData
): Promise<void> {
  await prisma.chapterSummary.upsert({
    where: {
      projectId_chapterNo: { projectId, chapterNo },
    },
    update: {
      summary: data.summary,
      keyEvents: data.keyEvents,
      emotionalTone: data.emotionalTone,
      plantedPlotlines: (data.plantedPlotlines || []).map((p: unknown) => String(p)),
      resolvedPlotlines: (data.resolvedPlotlines || []).map((p: unknown) => String(p)),
    },
    create: {
      projectId,
      chapterNo,
      summary: data.summary,
      keyEvents: data.keyEvents,
      emotionalTone: data.emotionalTone,
      plantedPlotlines: (data.plantedPlotlines || []).map((p: unknown) => String(p)),
      resolvedPlotlines: (data.resolvedPlotlines || []).map((p: unknown) => String(p)),
    },
  })
}

/**
 * 删除章节摘要
 */
export async function deleteChapterSummary(
  projectId: number,
  chapterNo: number
): Promise<void> {
  await prisma.chapterSummary.delete({
    where: {
      projectId_chapterNo: { projectId, chapterNo },
    },
  })
}

/**
 * 获取章节摘要（单个）
 */
export async function getChapterSummary(
  projectId: number,
  chapterNo: number
): Promise<ChapterSummaryData | null> {
  const summary = await prisma.chapterSummary.findUnique({
    where: {
      projectId_chapterNo: { projectId, chapterNo },
    },
  })

  if (!summary) return null

  return {
    summary: summary.summary,
    keyEvents: summary.keyEvents || [],
    emotionalTone: summary.emotionalTone || null,
    plantedPlotlines: summary.plantedPlotlines || [],
    resolvedPlotlines: summary.resolvedPlotlines || [],
  }
}
