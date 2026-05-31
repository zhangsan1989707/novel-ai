/**
 * 故事状态机
 * 管理情绪热度、冲突状态、章节进度
 */
import { prisma } from '@/lib/prisma'
import type { Prisma } from '@prisma/client'
import type { StoryState, EmotionalArcPoint, SubConflict } from '@/lib/engine/types'

/**
 * 获取故事状态
 */
export async function getStoryState(projectId: number): Promise<StoryState | null> {
  const state = await prisma.storyState.findUnique({
    where: { projectId },
  })

  if (!state) return null

  return {
    emotionalArc: (state.emotionalArc as unknown as EmotionalArcPoint[]) || [],
    mainConflict: state.mainConflict || null,
    subConflicts: (state.subConflicts as unknown as SubConflict[]) || [],
    currentChapter: state.currentChapter,
    totalPlanned: state.totalPlanned,
  }
}

/**
 * 创建或初始化故事状态
 * 仅在不存在时创建，已存在则不覆盖已有数据
 */
export async function initStoryState(
  projectId: number,
  totalPlanned: number = 100
): Promise<void> {
  const existing = await prisma.storyState.findUnique({
    where: { projectId },
  })

  if (existing) {
    if (existing.totalPlanned !== totalPlanned) {
      await prisma.storyState.update({
        where: { projectId },
        data: { totalPlanned },
      })
    }
    return
  }

  await prisma.storyState.create({
    data: {
      projectId,
      emotionalArc: [],
      mainConflict: null,
      subConflicts: [],
      currentChapter: 0,
    totalPlanned,
    },
  })
}

/**
 * 创建或初始化世界状态
 */
export async function initWorldState(projectId: number): Promise<void> {
  const existing = await prisma.worldState.findUnique({
    where: { projectId },
  })

  if (existing) return

  await prisma.worldState.create({
    data: {
      projectId,
      mapLevel: 1,
      factionCount: 1,
      powerLevel: 1,
      civilizationLevel: 1,
      classStructure: [],
      regions: [],
      currentExpansion: null,
      lastExpandedAt: null,
    },
  })
}

/**
 * 更新情绪热度曲线
 * 保留全量弧线数据以支持长线趋势分析
 */
export async function updateEmotionalArc(
  projectId: number,
  chapterNo: number,
  value: number
): Promise<void> {
  const state = await prisma.storyState.findUnique({
    where: { projectId },
  })

  if (!state) return

  const emotionalArc = (state.emotionalArc as unknown as EmotionalArcPoint[]) || []

  const existingIndex = emotionalArc.findIndex(p => p.chapterNo === chapterNo)
  if (existingIndex >= 0) {
    emotionalArc[existingIndex].value = value
  } else {
    emotionalArc.push({ chapterNo, value })
  }

  const fullArc = emotionalArc.sort((a, b) => a.chapterNo - b.chapterNo)

  await prisma.storyState.update({
    where: { projectId },
    data: { emotionalArc: fullArc as unknown as Prisma.InputJsonValue },
  })

  if (chapterNo % 30 === 0 && fullArc.length >= 5) {
    await generateArcPhaseSummary(projectId, fullArc, chapterNo)
  }
}

/**
 * 生成情绪弧线阶段性摘要
 * 每30章生成一次，记录该阶段的情绪趋势
 */
async function generateArcPhaseSummary(
  projectId: number,
  fullArc: EmotionalArcPoint[],
  chapterNo: number
): Promise<void> {
  const startChapter = Math.max(1, chapterNo - 29)
  const phasePoints = fullArc.filter(p => p.chapterNo >= startChapter && p.chapterNo <= chapterNo)

  if (phasePoints.length === 0) return

  const avgValue = phasePoints.reduce((sum, p) => sum + p.value, 0) / phasePoints.length
  const minValue = Math.min(...phasePoints.map(p => p.value))
  const maxValue = Math.max(...phasePoints.map(p => p.value))
  const volatility = maxValue - minValue

  const phaseTrend = phasePoints.length >= 2
    ? phasePoints[phasePoints.length - 1].value - phasePoints[0].value
    : 0

  const state = await prisma.storyState.findUnique({
    where: { projectId },
  })

  if (!state) return

  const existingSummaries = (state.emotionalArcSummaries as unknown as ArcPhaseSummary[]) || []

  const existingIndex = existingSummaries.findIndex(s => s.phaseEndChapter === chapterNo)
  const summary: ArcPhaseSummary = {
    phaseStartChapter: startChapter,
    phaseEndChapter: chapterNo,
    avgValue: Math.round(avgValue),
    minValue,
    maxValue,
    volatility,
    phaseTrend,
    trendDirection: phaseTrend > 5 ? 'rising' : phaseTrend < -5 ? 'falling' : 'stable',
  }

  if (existingIndex >= 0) {
    existingSummaries[existingIndex] = summary
  } else {
    existingSummaries.push(summary)
  }

  await prisma.storyState.update({
    where: { projectId },
    data: { emotionalArcSummaries: existingSummaries as unknown as Prisma.InputJsonValue },
  })
}

interface ArcPhaseSummary {
  phaseStartChapter: number
  phaseEndChapter: number
  avgValue: number
  minValue: number
  maxValue: number
  volatility: number
  phaseTrend: number
  trendDirection: 'rising' | 'falling' | 'stable'
}

export async function getArcPhaseSummaries(projectId: number): Promise<ArcPhaseSummary[]> {
  const state = await prisma.storyState.findUnique({
    where: { projectId },
  })
  return (state?.emotionalArcSummaries as unknown as ArcPhaseSummary[]) || []
}

/**
 * 计算下一章的建议情绪热度
 * 基于全量弧线数据和阶段性摘要进行长线趋势分析
 */
export async function suggestNextEmotionalValue(
  projectId: number
): Promise<number> {
  const state = await getStoryState(projectId)
  if (!state || state.emotionalArc.length === 0) return 50

  const fullArc = state.emotionalArc.sort((a, b) => a.chapterNo - b.chapterNo)
  const lastPoint = fullArc[fullArc.length - 1]
  const chapterRatio = state.currentChapter / state.totalPlanned

  const recentArc = fullArc.slice(-5)
  const recentTrend = recentArc.length >= 2
    ? recentArc[recentArc.length - 1].value - recentArc[0].value
    : 0

  const summaries = await getArcPhaseSummaries(projectId)
  const latestPhaseSummary = summaries.length > 0 ? summaries[summaries.length - 1] : null

  if (chapterRatio < 0.2) {
    return Math.min(100, lastPoint.value + 5)
  }

  if (chapterRatio < 0.7) {
    if (latestPhaseSummary && latestPhaseSummary.volatility > 40) {
      const correction = latestPhaseSummary.trendDirection === 'rising'
        ? -8
        : latestPhaseSummary.trendDirection === 'falling'
          ? 8
          : 0
      return Math.max(20, Math.min(90, lastPoint.value + correction + (Math.random() - 0.5) * 25))
    }

    const fluctuation = (Math.random() - 0.5) * 30
    if (recentTrend > 15) {
      return Math.max(30, Math.min(85, lastPoint.value - 5 + (Math.random() - 0.3) * 20))
    }
    if (recentTrend < -15) {
      return Math.max(25, Math.min(90, lastPoint.value + 8 + (Math.random() - 0.3) * 20))
    }
    return Math.max(20, Math.min(90, lastPoint.value + fluctuation))
  }

  const remainingChapters = state.totalPlanned - state.currentChapter
  if (remainingChapters < 10) {
    return Math.min(100, lastPoint.value + 8)
  }

  return lastPoint.value
}

/**
 * 更新主线冲突状态
 */
export async function updateMainConflict(
  projectId: number,
  conflict: string | null
): Promise<void> {
  await prisma.storyState.update({
    where: { projectId },
    data: { mainConflict: conflict },
  })
}

/**
 * 添加支线冲突
 */
export async function addSubConflict(
  projectId: number,
  description: string
): Promise<string> {
  const state = await prisma.storyState.findUnique({
    where: { projectId },
  })

  if (!state) throw new Error('Story state not found')

  const subConflicts = (state.subConflicts as unknown as SubConflict[]) || []
  const newConflict: SubConflict = {
    id: `sub_${Date.now()}`,
    description,
    status: 'OPEN',
  }

  subConflicts.push(newConflict)

  await prisma.storyState.update({
    where: { projectId },
    data: { subConflicts: subConflicts as unknown as Prisma.InputJsonValue },
  })

  return newConflict.id
}

/**
 * 更新支线冲突状态
 */
export async function updateSubConflictStatus(
  projectId: number,
  conflictId: string,
  status: SubConflict['status']
): Promise<void> {
  const state = await prisma.storyState.findUnique({
    where: { projectId },
  })

  if (!state) return

  const subConflicts = (state.subConflicts as unknown as SubConflict[]) || []
  const index = subConflicts.findIndex(c => c.id === conflictId)

  if (index >= 0) {
    subConflicts[index].status = status
    await prisma.storyState.update({
      where: { projectId },
      data: { subConflicts: subConflicts as unknown as Prisma.InputJsonValue },
    })
  }
}

/**
 * 更新章节进度
 */
export async function updateChapterProgress(
  projectId: number,
  chapterNo: number
): Promise<void> {
  await prisma.storyState.update({
    where: { projectId },
    data: { currentChapter: chapterNo },
  })
}

/**
 * 记录故事事件
 */
export async function recordStoryEvent(
  projectId: number,
  eventType: string,
  description: string,
  chapterNo?: number,
  metadata?: Record<string, unknown>
): Promise<void> {
  await prisma.storyEvent.create({
    data: {
      projectId,
      eventType,
      description,
      chapterNo,
      metadata: (metadata || {}) as Prisma.InputJsonValue,
    },
  })
}

/**
 * 获取故事事件历史
 */
export async function getStoryEventHistory(
  projectId: number,
  limit: number = 50
): Promise<{ eventType: string; description: string; chapterNo: number | null; createdAt: Date }[]> {
  const events = await prisma.storyEvent.findMany({
    where: { projectId },
    orderBy: { createdAt: 'desc' },
    take: limit,
  })

  return events.map(e => ({
    eventType: e.eventType,
    description: e.description,
    chapterNo: e.chapterNo || null,
    createdAt: e.createdAt,
  }))
}

export async function verifyStoryState(projectId: number): Promise<{
  ok: boolean
  issues: string[]
}> {
  const issues: string[] = []

  const state = await prisma.storyState.findUnique({ where: { projectId } })
  if (!state) {
    issues.push('StoryState 未初始化')
  } else {
    if (state.currentChapter === null || state.currentChapter === undefined) {
      issues.push('currentChapter 为 null')
    }
    if (state.totalPlanned === null || state.totalPlanned === undefined) {
      issues.push('totalPlanned 为 null')
    }
  }

  const world = await prisma.worldState.findUnique({ where: { projectId } })
  if (!world) {
    issues.push('WorldState 未初始化')
  } else {
    if (world.mapLevel === null || world.mapLevel === undefined) {
      issues.push('mapLevel 为 null')
    }
  }

  return { ok: issues.length === 0, issues }
}
