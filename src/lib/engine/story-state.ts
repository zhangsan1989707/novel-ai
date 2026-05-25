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
 */
export async function initStoryState(
  projectId: number,
  totalPlanned: number = 100
): Promise<void> {
  await prisma.storyState.upsert({
    where: { projectId },
    update: {
      emotionalArc: [],
      mainConflict: null,
      subConflicts: [],
      currentChapter: 0,
      totalPlanned,
    },
    create: {
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
  await prisma.worldState.upsert({
    where: { projectId },
    update: {
      mapLevel: 1,
      factionCount: 1,
      powerLevel: 1,
      civilizationLevel: 1,
      classStructure: [],
      regions: [],
      currentExpansion: null,
      lastExpandedAt: null,
    },
    create: {
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

  // 更新或添加新节点
  const existingIndex = emotionalArc.findIndex(p => p.chapterNo === chapterNo)
  if (existingIndex >= 0) {
    emotionalArc[existingIndex].value = value
  } else {
    emotionalArc.push({ chapterNo, value })
  }

  // 保持最近 20 章的数据
  const trimmedArc = emotionalArc
    .sort((a, b) => a.chapterNo - b.chapterNo)
    .slice(-20)

  await prisma.storyState.update({
    where: { projectId },
    data: { emotionalArc: trimmedArc as unknown as Prisma.InputJsonValue },
  })
}

/**
 * 计算下一章的建议情绪热度
 * 基于当前热度和章节位置
 */
export async function suggestNextEmotionalValue(
  projectId: number
): Promise<number> {
  const state = await getStoryState(projectId)
  if (!state || state.emotionalArc.length === 0) return 50

  const lastPoint = state.emotionalArc[state.emotionalArc.length - 1]
  const chapterRatio = state.currentChapter / state.totalPlanned

  // 开篇期（前 20%）：建议逐渐升温
  if (chapterRatio < 0.2) {
    return Math.min(100, lastPoint.value + 5)
  }

  // 中期（20%-70%）：可以大起大落
  if (chapterRatio < 0.7) {
    // 随机波动，但保持在合理范围
    const fluctuation = (Math.random() - 0.5) * 30
    return Math.max(20, Math.min(90, lastPoint.value + fluctuation))
  }

  // 高潮期（70%-100%）：建议持续高能或短暂缓冲后爆发
  const remainingChapters = state.totalPlanned - state.currentChapter
  if (remainingChapters < 10) {
    // 最后10章，逐渐推向高潮
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
