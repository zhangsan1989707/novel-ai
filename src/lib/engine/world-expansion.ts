import { ArcStage } from '@/types'

interface WorldState {
  mapLevel: number
  factionCount: number
  powerLevel: number
  civilizationLevel: number
  regions: string[]
  currentExpansion?: string
}

const expansionThresholds: Record<ArcStage, { maps: number; factions: number; power: number; civilization: number }> = {
  opening: { maps: 2, factions: 3, power: 3, civilization: 2 },
  growth: { maps: 4, factions: 6, power: 5, civilization: 3 },
  expansion: { maps: 7, factions: 12, power: 7, civilization: 5 },
  mid_conflict: { maps: 8, factions: 15, power: 8, civilization: 6 },
  pre_finale: { maps: 9, factions: 18, power: 9, civilization: 7 },
  finale: { maps: 10, factions: 20, power: 10, civilization: 8 },
}

export function shouldExpandWorld(currentArc: ArcStage, worldState: WorldState): boolean {
  const threshold = expansionThresholds[currentArc]
  if (!threshold) return false

  return (
    worldState.mapLevel < threshold.maps ||
    worldState.factionCount < threshold.factions ||
    worldState.powerLevel < threshold.power ||
    worldState.civilizationLevel < threshold.civilization
  )
}

export function generateExpansionPrompt(currentArc: ArcStage, worldState: WorldState): string {
  const threshold = expansionThresholds[currentArc]
  const gaps: string[] = []

  if (worldState.mapLevel < threshold.maps) {
    gaps.push(`地图层级 ${worldState.mapLevel}/${threshold.maps}，需要扩展地理范围`)
  }
  if (worldState.factionCount < threshold.factions) {
    gaps.push(`势力数量 ${worldState.factionCount}/${threshold.factions}，需要引入新势力`)
  }
  if (worldState.powerLevel < threshold.power) {
    gaps.push(`修炼上限 ${worldState.powerLevel}/${threshold.power}，需要扩展力量体系`)
  }
  if (worldState.civilizationLevel < threshold.civilization) {
    gaps.push(`文明层级 ${worldState.civilizationLevel}/${threshold.civilization}，需要引入更高文明`)
  }

  if (gaps.length === 0) return ''

  return `世界扩张需求（当前阶段：${currentArc}）：\n${gaps.map(g => `- ${g}`).join('\n')}\n\n请在当前批次的章节中适当引入新的地域、势力、力量层级或文明设定，避免前期把世界范围写死。`
}

export function getWorldExpansionDimensions(): string[] {
  return ['地图范围', '势力数量', '修炼体系上限', '阶级结构', '文明层级']
}