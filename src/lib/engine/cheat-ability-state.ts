import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'

export interface CheatAbilityUsageEntry {
  chapterNo: number
  abilityName: string
  costDescription: string
  markValueChange: number
  backlashValueChange: number
  cooldownUntilChapter?: number | null
}

export async function ensureCheatAbilityState(projectId: number, cheatName: string, oneLineRule: string, initialAbilities: string[]): Promise<void> {
  await prisma.cheatAbilityState.upsert({
    where: { projectId },
    update: {
      cheatName,
      oneLineRule,
    },
    create: {
      projectId,
      cheatName,
      oneLineRule,
      unlockedAbilities: initialAbilities,
      currentMarkValue: 0,
      currentBacklashValue: 0,
    },
  })
}

export async function getCheatAbilityState(projectId: number) {
  return prisma.cheatAbilityState.findUnique({
    where: { projectId },
  })
}

export async function appendCheatUsage(projectId: number, entry: CheatAbilityUsageEntry): Promise<void> {
  const current = await prisma.cheatAbilityState.findUnique({ where: { projectId } })
  if (!current) {
    throw new Error('CheatAbilityState not initialized')
  }

  const nextHistory = Array.isArray(current.usageHistory) ? [...(current.usageHistory as unknown as CheatAbilityUsageEntry[]), entry] : [entry]
  const nextMark = Math.max(0, (current.currentMarkValue || 0) + (entry.markValueChange || 0))
  const nextBacklash = Math.max(0, (current.currentBacklashValue || 0) + (entry.backlashValueChange || 0))

  await prisma.cheatAbilityState.update({
    where: { projectId },
    data: {
      usageHistory: nextHistory as unknown as Prisma.InputJsonValue,
      currentMarkValue: nextMark,
      currentBacklashValue: nextBacklash,
      cooldownActiveUntilChapter: entry.cooldownUntilChapter ?? current.cooldownActiveUntilChapter,
    },
  })
}

export function buildCheatAbilityPromptContext(state: Awaited<ReturnType<typeof getCheatAbilityState>>): string {
  if (!state) {
    return '未检测到金手指状态配置，默认要求：每章必须有代价，能力不得无副作用使用。'
  }

  const unlocked = Array.isArray(state.unlockedAbilities) ? (state.unlockedAbilities as unknown as string[]) : []
  return [
    `金手指名称：${state.cheatName}`,
    `核心规则：${state.oneLineRule}`,
    `已解锁能力：${unlocked.length > 0 ? unlocked.join('、') : '未设定'}`,
    `当前标记值：${state.currentMarkValue}`,
    `当前反噬值：${state.currentBacklashValue}`,
    `冷却状态：${state.cooldownActiveUntilChapter ? `到第${state.cooldownActiveUntilChapter}章前受限` : '当前无冷却'}`,
    `禁止事项：不得使用未解锁能力；每次使用必须记录代价或反噬；不得在冷却期内重复使用同能力。`,
  ].join('\n')
}
