import { describe, expect, it } from 'vitest'
import { buildCheatAbilityPromptContext } from '@/lib/engine/cheat-ability-state'

describe('buildCheatAbilityPromptContext', () => {
  it('returns default guardrails when state is missing', () => {
    expect(buildCheatAbilityPromptContext(null)).toContain('每章必须有代价')
  })

  it('renders current counters and cooldowns', () => {
    const text = buildCheatAbilityPromptContext({
      id: '1',
      projectId: 1,
      cheatName: '镜像反制',
      oneLineRule: '只能复制一次已见过的能力',
      unlockedAbilities: ['镜像反制'] as unknown as import('@prisma/client').Prisma.JsonArray,
      usageHistory: [] as unknown as import('@prisma/client').Prisma.JsonArray,
      currentMarkValue: 12,
      currentBacklashValue: 6,
      cooldownActiveUntilChapter: 15,
      updatedAt: new Date(),
      createdAt: new Date(),
    })

    expect(text).toContain('镜像反制')
    expect(text).toContain('当前标记值：12')
    expect(text).toContain('到第15章前受限')
  })
})
