/**
 * 自定义上下文策略管理
 * 支持多种上下文范围策略
 */
import { prisma } from '@/lib/prisma'
import { calculateVolume } from '@/lib/memory/volume-summary'

export type ContextStrategyType =
  | 'recent'
  | 'key_chapters'
  | 'character_perspective'
  | 'volume'
  | 'custom'

export interface ContextStrategy {
  type: ContextStrategyType
  description: string
}

export interface RecentStrategy extends ContextStrategy {
  type: 'recent'
  chapterCount: number
}

export interface KeyChaptersStrategy extends ContextStrategy {
  type: 'key_chapters'
  chapterNumbers: number[]
}

export interface CharacterPerspectiveStrategy extends ContextStrategy {
  type: 'character_perspective'
  characterName: string
}

export interface VolumeStrategy extends ContextStrategy {
  type: 'volume'
  volumeNumber: number
}

export interface CustomRangeStrategy extends ContextStrategy {
  type: 'custom'
  startChapter: number
  endChapter: number
}

export type AnyContextStrategy =
  | RecentStrategy
  | KeyChaptersStrategy
  | CharacterPerspectiveStrategy
  | VolumeStrategy
  | CustomRangeStrategy

/**
 * 获取特定策略的章节上下文
 */
export async function getContextByStrategy(
  projectId: number,
  strategy: AnyContextStrategy
): Promise<{ chapterNo: number; title: string; content: string }[]> {
  switch (strategy.type) {
    case 'recent':
      return getRecentChapters(projectId, strategy.chapterCount)

    case 'key_chapters':
      return getKeyChapters(projectId, strategy.chapterNumbers)

    case 'character_perspective':
      return getCharacterPerspectiveChapters(projectId, strategy.characterName)

    case 'volume':
      return getVolumeChapters(projectId, strategy.volumeNumber)

    case 'custom':
      return getChaptersInRange(projectId, strategy.startChapter, strategy.endChapter)

    default:
      return []
  }
}

/**
 * 获取最近 N 章
 */
async function getRecentChapters(
  projectId: number,
  count: number
): Promise<{ chapterNo: number; title: string; content: string }[]> {
  const chapters = await prisma.novelChapter.findMany({
    where: { projectId, status: 'COMPLETED', content: { not: null } },
    orderBy: { chapterNumber: 'desc' },
    take: count,
    select: { chapterNumber: true, title: true, content: true },
  })

  return chapters
    .sort((a, b) => a.chapterNumber - b.chapterNumber)
    .map(c => ({
      chapterNo: c.chapterNumber,
      title: c.title,
      content: c.content || '',
    }))
}

/**
 * 获取指定章节
 */
async function getKeyChapters(
  projectId: number,
  chapterNumbers: number[]
): Promise<{ chapterNo: number; title: string; content: string }[]> {
  const chapters = await prisma.novelChapter.findMany({
    where: {
      projectId,
      chapterNumber: { in: chapterNumbers },
      content: { not: null },
    },
    select: { chapterNumber: true, title: true, content: true },
  })

  return chapters
    .sort((a, b) => a.chapterNumber - b.chapterNumber)
    .map(c => ({
      chapterNo: c.chapterNumber,
      title: c.title,
      content: c.content || '',
    }))
}

/**
 * 获取特定角色的视角章节（角色出现的章节）
 */
async function getCharacterPerspectiveChapters(
  projectId: number,
  characterName: string
): Promise<{ chapterNo: number; title: string; content: string }[]> {
  // 查找角色
  const character = await prisma.character.findFirst({
    where: {
      projectId,
      name: characterName,
    },
  })

  if (!character) {
    return []
  }

  // 查找包含该角色名称的章节
  const chapters = await prisma.novelChapter.findMany({
    where: {
      projectId,
      status: 'COMPLETED',
      content: { not: null },
    },
    select: { chapterNumber: true, title: true, content: true },
  })

  // 过滤出包含该角色名称的章节
  return chapters
    .filter(ch => ch.content?.includes(characterName))
    .sort((a, b) => a.chapterNumber - b.chapterNumber)
    .map(c => ({
      chapterNo: c.chapterNumber,
      title: c.title,
      content: c.content || '',
    }))
}

/**
 * 获取特定卷的所有章节
 */
async function getVolumeChapters(
  projectId: number,
  volumeNumber: number
): Promise<{ chapterNo: number; title: string; content: string }[]> {
  const project = await prisma.novelProject.findUnique({
    where: { id: projectId },
    select: { totalVolumes: true },
  })

  if (!project) {
    return []
  }

  const totalChapters = await prisma.novelChapter.count({
    where: { projectId, status: 'COMPLETED' },
  })

  const chaptersPerVolume = Math.ceil(totalChapters / project.totalVolumes)
  const startChapter = (volumeNumber - 1) * chaptersPerVolume + 1
  const endChapter = Math.min(volumeNumber * chaptersPerVolume, totalChapters)

  return getChaptersInRange(projectId, startChapter, endChapter)
}

/**
 * 获取指定范围的章节
 */
async function getChaptersInRange(
  projectId: number,
  startChapter: number,
  endChapter: number
): Promise<{ chapterNo: number; title: string; content: string }[]> {
  const chapters = await prisma.novelChapter.findMany({
    where: {
      projectId,
      chapterNumber: { gte: startChapter, lte: endChapter },
      status: 'COMPLETED',
      content: { not: null },
    },
    orderBy: { chapterNumber: 'asc' },
    select: { chapterNumber: true, title: true, content: true },
  })

  return chapters.map(c => ({
    chapterNo: c.chapterNumber,
    title: c.title,
    content: c.content || '',
  }))
}

/**
 * 估算策略的 token 消耗
 */
export function estimateTokenCost(
  strategy: AnyContextStrategy,
  chapters: { content: string }[]
): number {
  // 简单估算：按字符数的 1/4 作为 token 数
  const totalChars = chapters.reduce((sum, ch) => sum + ch.content.length, 0)
  return Math.ceil(totalChars / 4)
}

/**
 * 获取可用策略列表
 */
export function getAvailableStrategies(): ContextStrategy[] {
  return [
    { type: 'recent', description: '最近章节（默认 3-5 章）' },
    { type: 'key_chapters', description: '关键章节（指定章节号）' },
    { type: 'character_perspective', description: '角色视角（只看某角色出现的章节）' },
    { type: 'volume', description: '整卷（特定卷的全部章节）' },
    { type: 'custom', description: '自定义范围（第 X 章 ~ 第 Y 章）' },
  ]
}