import { prisma } from '@/lib/prisma'
import { shouldExpandWorld, generateExpansionPrompt } from './world-expansion'

interface WorldStateDelta {
  mapLevelDelta: number
  factionCountDelta: number
  powerLevelDelta: number
  civilizationLevelDelta: number
  newRegions: string[]
  newFactions: string[]
  triggerExpansion: boolean
}

const REGION_KEYWORDS = [
  '来到', '进入', '抵达', '前往', '穿越', '踏足', '现身于',
  '出现在', '踏入', '步入',
]

const REGION_SUFFIXES = [
  '殿', '宫', '阁', '楼', '府', '城', '镇', '村', '谷',
  '山', '海', '林', '园', '街', '市', '院', '堂', '寺',
  '庙', '塔', '洞', '窟', '崖', '岛', '湖', '河', '沼',
  '原', '岭', '界', '域', '国', '州', '区', '境', '渊',
  '峰', '大陆', '帝国', '秘境', '遗迹',
]

const FACTION_KEYWORDS = [
  '势力', '宗门', '家族', '联盟', '商会', '帮派', '组织',
  '王朝', '帝国', '教派', '学院', '军',
]

const POWER_LEVEL_KEYWORDS = [
  '突破', '晋级', '升阶', '进化', '蜕变', '觉醒',
  '领悟', '进阶', '破境', '渡劫', '飞升',
  '新的力量', '更上一层', '实力大增', '修为暴涨',
]

const CIVILIZATION_KEYWORDS = [
  '上古文明', '远古遗迹', '失落的文明', '更高维度',
  '神级', '圣级', '传说级', '史诗级', '神话级',
  '仙', '神', '圣', '至尊', '主宰', '掌控者',
]

function extractNewRegions(
  content: string,
  existingRegions: string[]
): string[] {
  const found: Set<string> = new Set(existingRegions.map(r => r.toLowerCase()))
  const newRegions: string[] = []

  const regionPattern = new RegExp(
    `(${REGION_KEYWORDS.map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})\\s*([\\u4e00-\\u9fa5]{2,8}(?:${REGION_SUFFIXES.map(s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')}))`,
    'g'
  )

  let match: RegExpExecArray | null
  while ((match = regionPattern.exec(content)) !== null) {
    const name = match[2]
    if (name.length >= 2 && name.length <= 8 && !found.has(name.toLowerCase())) {
      found.add(name.toLowerCase())
      newRegions.push(name)
    }
  }

  return newRegions.slice(0, 5)
}

function detectFactionGrowth(
  content: string,
  existingFactions: string[]
): string[] {
  const existingLower = existingFactions.map(f => f.toLowerCase())
  const newFactions: string[] = []

  for (const keyword of FACTION_KEYWORDS) {
    const pattern = new RegExp(`([\\u4e00-\\u9fa5]{2,6}${keyword})`, 'g')
    let match: RegExpExecArray | null
    while ((match = pattern.exec(content)) !== null) {
      const name = match[1]
      if (!existingLower.includes(name.toLowerCase())) {
        existingLower.push(name.toLowerCase())
        newFactions.push(name)
      }
    }
  }

  return newFactions.slice(0, 5)
}

function detectPowerProgression(content: string): number {
  let score = 0
  for (const keyword of POWER_LEVEL_KEYWORDS) {
    const matches = content.match(new RegExp(keyword, 'g'))
    if (matches) {
      score += matches.length * 0.25
    }
  }
  return Math.min(Math.round(score), 1)
}

function detectCivilizationProgression(content: string): number {
  let score = 0
  for (const keyword of CIVILIZATION_KEYWORDS) {
    if (content.includes(keyword)) {
      score += 0.5
    }
  }
  return Math.min(Math.round(score), 1)
}

export function analyzeChapterForWorldState(
  content: string,
  existingRegions: string[],
  existingFactions: string[]
): WorldStateDelta {
  const newRegions = extractNewRegions(content, existingRegions)
  const newFactions = detectFactionGrowth(content, existingFactions)

  const mapLevelDelta = newRegions.length > 0 ? 1 : 0
  const factionCountDelta = newFactions.length > 0 ? Math.min(newFactions.length, 2) : 0
  const powerLevelDelta = detectPowerProgression(content)
  const civilizationLevelDelta = detectCivilizationProgression(content)

  const triggerExpansion =
    mapLevelDelta > 0 ||
    factionCountDelta > 0 ||
    powerLevelDelta > 0 ||
    civilizationLevelDelta > 0

  return {
    mapLevelDelta,
    factionCountDelta,
    powerLevelDelta,
    civilizationLevelDelta,
    newRegions,
    newFactions,
    triggerExpansion,
  }
}

export async function updateWorldStateAfterChapter(
  projectId: number,
  chapterContent: string
): Promise<boolean> {
  const worldState = await prisma.worldState.findUnique({
    where: { projectId },
  })

  if (!worldState) return false

  const existingRegions: string[] = (worldState.regions as string[]) || []
  const classStructure: string[] = (worldState.classStructure as string[]) || []

  const existingFactions = classStructure.filter(item =>
    FACTION_KEYWORDS.some(kw => item.includes(kw))
  )

  const delta = analyzeChapterForWorldState(chapterContent, existingRegions, existingFactions)

  if (!delta.triggerExpansion) return false

  const newMapLevel = Math.min(10, (worldState.mapLevel || 1) + delta.mapLevelDelta)
  const newFactionCount = Math.min(20, (worldState.factionCount || 1) + delta.factionCountDelta)
  const newPowerLevel = Math.min(10, (worldState.powerLevel || 1) + delta.powerLevelDelta)
  const newCivilizationLevel = Math.min(8, (worldState.civilizationLevel || 1) + delta.civilizationLevelDelta)

  const mergedRegions = [...existingRegions, ...delta.newRegions].slice(0, 30)
  const mergedFactions = [...classStructure, ...delta.newFactions].slice(0, 30)

  await prisma.worldState.update({
    where: { projectId },
    data: {
      mapLevel: newMapLevel,
      factionCount: newFactionCount,
      powerLevel: newPowerLevel,
      civilizationLevel: newCivilizationLevel,
      regions: mergedRegions,
      classStructure: mergedFactions,
      lastExpandedAt: new Date(),
    },
  })

  return true
}

export async function checkAndTriggerWorldExpansion(
  projectId: number,
  chapterNo: number,
  arcStage?: string | null
): Promise<string> {
  const worldState = await prisma.worldState.findUnique({
    where: { projectId },
  })

  if (!worldState) return ''

  const state = {
    mapLevel: worldState.mapLevel || 1,
    factionCount: worldState.factionCount || 1,
    powerLevel: worldState.powerLevel || 1,
    civilizationLevel: worldState.civilizationLevel || 1,
    regions: (worldState.regions as string[]) || [],
    currentExpansion: worldState.currentExpansion || undefined,
  }

  const stage = (arcStage || 'growth') as 'opening' | 'growth' | 'expansion' | 'mid_conflict' | 'pre_finale' | 'finale'

  if (shouldExpandWorld(stage, state)) {
    return generateExpansionPrompt(stage, state)
  }

  return ''
}