import { describe, expect, it } from 'vitest'
import { runRuleFantasyValidator } from '@/lib/engine/rule-fantasy-validator'

describe('runRuleFantasyValidator', () => {
  it('requires cheat cost and penalizes zero-cost usage', () => {
    const result = runRuleFantasyValidator({
      chapterNo: 5,
      content: '主角使用了金手指，却没有付出代价',
      cheatUsage: null,
      popularFiction: {
        readability: 8,
        emotion: 7,
        cheatPayoff: 6,
        conflict: 7,
        hook: 8,
        character: 7,
        pacing: 8,
        total: 7.3,
        issues: [],
        suggestions: [],
      },
    })

    expect(result.passed).toBe(false)
    expect(result.findings.some(item => item.code === 'CHEAT_COST_MISSING')).toBe(true)
  })

  it('rewards stable cost tracking and passes when score is high', () => {
    const result = runRuleFantasyValidator({
      chapterNo: 10,
      content: '主角承受反噬后打脸对手',
      cheatUsage: {
        chapterNo: 10,
        abilityName: '镜像反制',
        costDescription: '反噬内伤',
        markValueChange: 6,
        backlashValueChange: 4,
        cooldownUntilChapter: null,
      },
      cheatAbilityUnlockedAbilities: ['镜像反制'],
      popularFiction: {
        readability: 8,
        emotion: 8,
        cheatPayoff: 8,
        conflict: 8,
        hook: 8,
        character: 8,
        pacing: 8,
        total: 8,
        issues: [],
        suggestions: [],
      },
    })

    expect(result.passed).toBe(true)
    expect(result.score).toBeGreaterThanOrEqual(80)
  })
})
