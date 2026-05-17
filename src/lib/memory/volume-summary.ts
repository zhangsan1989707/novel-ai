/**
 * 卷摘要 Memory 模块
 * L2 层摘要：每卷 500-800 字
 */
import { prisma } from '@/lib/prisma'

export interface VolumeSummaryData {
  volumeNumber: number
  summary: string
  keyEvents: string[]
  emotionalArc: { chapterNo: number; value: number }[]
  plantedPlotlines: string[]
  resolvedPlotlines: string[]
  chapterOverview: { chapterNo: number; title: string; summary: string }[]
}

export interface VolumeSummaryWithChapter extends VolumeSummaryData {
  projectId: number
  createdAt: Date
  updatedAt: Date
}

/**
 * 获取指定卷的摘要
 */
export async function getVolumeSummary(
  projectId: number,
  volumeNumber: number
): Promise<VolumeSummaryData | null> {
  const summary = await prisma.volumeSummary.findUnique({
    where: {
      projectId_volumeNumber: { projectId, volumeNumber },
    },
  })

  if (!summary) return null

  return {
    volumeNumber: summary.volumeNumber,
    summary: summary.summary,
    keyEvents: summary.keyEvents || [],
    emotionalArc: summary.emotionalArc as { chapterNo: number; value: number }[] || [],
    plantedPlotlines: summary.plantedPlotlines || [],
    resolvedPlotlines: summary.resolvedPlotlines || [],
    chapterOverview: summary.chapterOverview as { chapterNo: number; title: string; summary: string }[] || [],
  }
}

/**
 * 获取项目所有卷摘要
 */
export async function getAllVolumeSummaries(
  projectId: number
): Promise<VolumeSummaryData[]> {
  const summaries = await prisma.volumeSummary.findMany({
    where: { projectId },
    orderBy: { volumeNumber: 'asc' },
  })

  return summaries.map(s => ({
    volumeNumber: s.volumeNumber,
    summary: s.summary,
    keyEvents: s.keyEvents || [],
    emotionalArc: s.emotionalArc as { chapterNo: number; value: number }[] || [],
    plantedPlotlines: s.plantedPlotlines || [],
    resolvedPlotlines: s.resolvedPlotlines || [],
    chapterOverview: s.chapterOverview as { chapterNo: number; title: string; summary: string }[] || [],
  }))
}

/**
 * 保存卷摘要
 */
export async function saveVolumeSummary(
  projectId: number,
  data: VolumeSummaryData
): Promise<void> {
  await prisma.volumeSummary.upsert({
    where: {
      projectId_volumeNumber: { projectId, volumeNumber: data.volumeNumber },
    },
    update: {
      summary: data.summary,
      keyEvents: data.keyEvents,
      emotionalArc: data.emotionalArc,
      plantedPlotlines: data.plantedPlotlines,
      resolvedPlotlines: data.resolvedPlotlines,
      chapterOverview: data.chapterOverview,
    },
    create: {
      projectId,
      volumeNumber: data.volumeNumber,
      summary: data.summary,
      keyEvents: data.keyEvents,
      emotionalArc: data.emotionalArc,
      plantedPlotlines: data.plantedPlotlines,
      resolvedPlotlines: data.resolvedPlotlines,
      chapterOverview: data.chapterOverview,
    },
  })
}

/**
 * 删除卷摘要
 */
export async function deleteVolumeSummary(
  projectId: number,
  volumeNumber: number
): Promise<void> {
  await prisma.volumeSummary.delete({
    where: {
      projectId_volumeNumber: { projectId, volumeNumber },
    },
  })
}

/**
 * 根据章节号计算所在卷
 */
export function calculateVolume(
  chapterNo: number,
  totalVolumes: number = 4,
  totalChapters: number = 100
): number {
  const chaptersPerVolume = Math.ceil(totalChapters / totalVolumes)
  return Math.min(totalVolumes, Math.ceil(chapterNo / chaptersPerVolume))
}

/**
 * 获取指定卷的章节范围
 */
export function getVolumeChapterRange(
  volumeNumber: number,
  totalVolumes: number = 4,
  totalChapters: number = 100
): { start: number; end: number } {
  const chaptersPerVolume = Math.ceil(totalChapters / totalVolumes)
  const start = (volumeNumber - 1) * chaptersPerVolume + 1
  const end = Math.min(volumeNumber * chaptersPerVolume, totalChapters)
  return { start, end }
}

/**
 * 从章节摘要构建卷摘要数据
 */
export async function buildVolumeSummaryFromChapterSummaries(
  projectId: number,
  volumeNumber: number,
  totalVolumes: number,
  totalChapters: number
): Promise<VolumeSummaryData> {
  const range = getVolumeChapterRange(volumeNumber, totalVolumes, totalChapters)

  // 获取该卷所有章节摘要
  const chapterSummaries = await prisma.chapterSummary.findMany({
    where: {
      projectId,
      chapterNo: { gte: range.start, lte: range.end },
    },
    orderBy: { chapterNo: 'asc' },
  })

  // 获取章节信息
  const chapters = await prisma.novelChapter.findMany({
    where: {
      projectId,
      chapterNumber: { gte: range.start, lte: range.end },
    },
    orderBy: { chapterNumber: 'asc' },
    select: { chapterNumber: true, title: true },
  })

  // 构建章节概览
  const chapterOverview = chapters.map(ch => {
    const summary = chapterSummaries.find(s => s.chapterNo === ch.chapterNumber)
    return {
      chapterNo: ch.chapterNumber,
      title: ch.title,
      summary: summary?.summary || '',
    }
  })

  // 聚合伏笔
  const plantedPlotlines = chapterSummaries.flatMap(s => s.plantedPlotlines || [])
  const resolvedPlotlines = chapterSummaries.flatMap(s => s.resolvedPlotlines || [])

  // 构建情绪曲线
  const emotionalArc = chapterSummaries.map(s => ({
    chapterNo: s.chapterNo,
    value: s.emotionalTone === '紧张' ? 80 : s.emotionalTone === '温馨' ? 40 : 60,
  }))

  // 提取关键事件（每个章节的第一个事件）
  const keyEvents = chapterSummaries
    .flatMap(s => s.keyEvents?.slice(0, 2) || [])
    .slice(0, 10)

  return {
    volumeNumber,
    summary: `第${volumeNumber}卷共${chapterSummaries.length}章，主要讲述...`, // 将在生成时填充
    keyEvents,
    emotionalArc,
    plantedPlotlines: [...new Set(plantedPlotlines)],
    resolvedPlotlines: [...new Set(resolvedPlotlines)],
    chapterOverview,
  }
}