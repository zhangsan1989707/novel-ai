/**
 * 全书摘要 Memory 模块
 * L3 层摘要：全文 1000-1500 字
 */
import { prisma } from '@/lib/prisma'

export interface BookSummaryData {
  summary: string
  mainPlot: string
  subPlots: string[]
  characterArcs: { characterId: string; name: string; arcDescription: string }[]
  thematicElements: string[]
  totalPlotlines: number
  resolvedPlotlines: number
  openPlotlines: number
  structureAnalysis: {
    openingChapters: number
    developmentChapters: number
    climaxChapters: number
    resolutionChapters: number
  }
}

export interface BookSummaryWithMeta extends BookSummaryData {
  projectId: number
  createdAt: Date
  updatedAt: Date
}

/**
 * 获取全书摘要
 */
export async function getBookSummary(
  projectId: number
): Promise<BookSummaryData | null> {
  const summary = await prisma.bookSummary.findUnique({
    where: { projectId },
  })

  if (!summary) return null

  return {
    summary: summary.summary,
    mainPlot: summary.mainPlot,
    subPlots: summary.subPlots || [],
    characterArcs: summary.characterArcs as { characterId: string; name: string; arcDescription: string }[] || [],
    thematicElements: summary.thematicElements || [],
    totalPlotlines: summary.totalPlotlines,
    resolvedPlotlines: summary.resolvedPlotlines,
    openPlotlines: summary.openPlotlines,
    structureAnalysis: summary.structureAnalysis as BookSummaryData['structureAnalysis'] || {
      openingChapters: 0,
      developmentChapters: 0,
      climaxChapters: 0,
      resolutionChapters: 0,
    },
  }
}

/**
 * 保存全书摘要
 */
export async function saveBookSummary(
  projectId: number,
  data: BookSummaryData
): Promise<void> {
  await prisma.bookSummary.upsert({
    where: { projectId },
    update: {
      summary: data.summary,
      mainPlot: data.mainPlot,
      subPlots: data.subPlots,
      characterArcs: data.characterArcs,
      thematicElements: data.thematicElements,
      totalPlotlines: data.totalPlotlines,
      resolvedPlotlines: data.resolvedPlotlines,
      openPlotlines: data.openPlotlines,
      structureAnalysis: data.structureAnalysis,
    },
    create: {
      projectId,
      summary: data.summary,
      mainPlot: data.mainPlot,
      subPlots: data.subPlots,
      characterArcs: data.characterArcs,
      thematicElements: data.thematicElements,
      totalPlotlines: data.totalPlotlines,
      resolvedPlotlines: data.resolvedPlotlines,
      openPlotlines: data.openPlotlines,
      structureAnalysis: data.structureAnalysis,
    },
  })
}

/**
 * 删除全书摘要
 */
export async function deleteBookSummary(
  projectId: number
): Promise<void> {
  await prisma.bookSummary.delete({
    where: { projectId },
  })
}

/**
 * 从卷摘要构建全书摘要数据
 */
export async function buildBookSummaryFromVolumeSummaries(
  projectId: number,
  totalVolumes: number
): Promise<Partial<BookSummaryData>> {
  // 获取所有卷摘要
  const volumeSummaries = await prisma.volumeSummary.findMany({
    where: { projectId },
    orderBy: { volumeNumber: 'asc' },
  })

  if (volumeSummaries.length === 0) {
    return {
      summary: '',
      mainPlot: '',
      subPlots: [],
      characterArcs: [],
      thematicElements: [],
      totalPlotlines: 0,
      resolvedPlotlines: 0,
      openPlotlines: 0,
      structureAnalysis: {
        openingChapters: 0,
        developmentChapters: 0,
        climaxChapters: 0,
        resolutionChapters: 0,
      },
    }
  }

  // 聚合伏笔统计
  const allPlantedPlotlines = volumeSummaries.flatMap(v => v.plantedPlotlines || [])
  const allResolvedPlotlines = volumeSummaries.flatMap(v => v.resolvedPlotlines || [])
  const uniquePlanted = [...new Set(allPlantedPlotlines)]
  const uniqueResolved = [...new Set(allResolvedPlotlines)]

  // 获取角色弧线
  const characters = await prisma.character.findMany({
    where: { projectId },
    select: { id: true, name: true },
  })

  const characterArcs = characters.map(char => ({
    characterId: char.id,
    name: char.name,
    arcDescription: '', // 将在生成时填充
  }))

  // 计算结构分布（假设 4 卷分别对应 开篇/发展/高潮/结局）
  const chaptersPerVolume = Math.ceil(
    volumeSummaries.reduce((sum, v) => sum + (v.chapterOverview as unknown[] || []).length, 0) / totalVolumes
  )

  return {
    subPlots: [],
    thematicElements: [],
    totalPlotlines: uniquePlanted.length,
    resolvedPlotlines: uniqueResolved.length,
    openPlotlines: uniquePlanted.length - uniqueResolved.length,
    characterArcs,
    structureAnalysis: {
      openingChapters: Math.floor(chaptersPerVolume * 0.2),
      developmentChapters: Math.floor(chaptersPerVolume * 0.4),
      climaxChapters: Math.floor(chaptersPerVolume * 0.2),
      resolutionChapters: Math.floor(chaptersPerVolume * 0.2),
    },
  }
}