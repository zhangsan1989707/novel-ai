import { prisma } from '@/lib/prisma'
import { shouldExpandWorld, generateExpansionPrompt } from './world-expansion'
import { getVillainPrompt } from './villain-lifecycle'
import type { Villain } from './villain-lifecycle'

interface WorldStateData {
  mapLevel: number
  factionCount: number
  powerLevel: number
  civilizationLevel: number
  regions: string[]
  currentExpansion?: string
}

interface VillainData {
  name: string
  tier: 'stage' | 'arc' | 'final'
  isFinalBoss: boolean
  introducedAt: number | null
  defeatedAt: number | null
  lifecycle: 'active' | 'defeated' | 'escaped' | 'transformed'
}

export async function getWorldState(projectId: number): Promise<WorldStateData | null> {
  const state = await prisma.worldState.findUnique({
    where: { projectId },
  })

  if (!state) return null
  return {
    mapLevel: state.mapLevel ?? 1,
    factionCount: state.factionCount ?? 1,
    powerLevel: state.powerLevel ?? 1,
    civilizationLevel: state.civilizationLevel ?? 1,
    regions: (state.regions as string[]) || [],
    currentExpansion: state.currentExpansion ?? undefined,
  }
}

export async function getVillains(projectId: number): Promise<VillainData[]> {
  const villains = await prisma.villain.findMany({
    where: { projectId },
  })

  return villains.map(v => ({
    name: v.name,
    tier: (v.tier as 'stage' | 'arc' | 'final') || 'stage',
    isFinalBoss: v.isFinalBoss || false,
    introducedAt: v.introducedAt,
    defeatedAt: v.defeatedAt,
    lifecycle: (v.lifecycle as 'active' | 'defeated' | 'escaped' | 'transformed') || 'active',
  }))
}

export function getWorldExpansionContext(
  worldState: WorldStateData | null,
  chapterNo: number,
  totalChapters: number,
  arcPlan?: { stage?: string | null; targetWordCount?: number | null; status?: string | null } | null
): string {
  const parts: string[] = []

  if (worldState) {
    const progressRatio = totalChapters > 0 ? chapterNo / totalChapters : 0
    const internalStage = arcPlan?.stage || 'growth'

    const shouldExpand = shouldExpandWorld(
      internalStage as 'opening' | 'growth' | 'expansion' | 'mid_conflict' | 'pre_finale' | 'finale',
      worldState
    )

    if (shouldExpand) {
      const prompt = generateExpansionPrompt(
        internalStage as 'opening' | 'growth' | 'expansion' | 'mid_conflict' | 'pre_finale' | 'finale',
        worldState
      )
      parts.push(`## 世界扩张提醒\n当前地图层级: ${worldState.mapLevel}，势力数: ${worldState.factionCount}，修炼上限: ${worldState.powerLevel}，文明层级: ${worldState.civilizationLevel}\n${prompt}`)
    } else {
      parts.push(`## 世界状态\n当前地图层级: ${worldState.mapLevel}/10，势力数: ${worldState.factionCount}/20，修炼上限: ${worldState.powerLevel}/10，文明层级: ${worldState.civilizationLevel}/8\n已解锁区域: ${worldState.regions?.join('、') || '暂无'}`)
    }
  }

  return parts.join('\n\n')
}

export function getVillainContext(
  villains: VillainData[],
  chapterNo: number,
  totalChapters: number
): string {
  if (villains.length === 0) return ''

  const progressRatio = totalChapters > 0 ? chapterNo / totalChapters : 0
  const villainPrompt = getVillainPrompt(
    villains.map(v => ({
      name: v.name,
      tier: v.tier,
      isFinalBoss: v.isFinalBoss,
      introducedAt: v.introducedAt ?? undefined,
      defeatedAt: v.defeatedAt ?? undefined,
      lifecycle: v.lifecycle,
    })),
    chapterNo,
    progressRatio
  )

  return villainPrompt
}