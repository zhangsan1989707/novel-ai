import { describe, expect, it } from 'vitest'
import { buildFallbackNovelTitle, isLikelyNovelTitle, normalizeNovelTitle } from '@/lib/novel-title'

describe('novel title helpers', () => {
  it('normalizes labeled title output', () => {
    expect(normalizeNovelTitle('标题：《万界归途》\n请继续输出')).toBe('万界归途')
  })

  it('rejects title identical to source inspiration', () => {
    expect(isLikelyNovelTitle('规则怪谈 × 智斗反转', '规则怪谈 × 智斗反转')).toBe(false)
  })

  it('rejects explanatory sentences', () => {
    expect(isLikelyNovelTitle('请根据这个卖点生成标题')).toBe(false)
    expect(isLikelyNovelTitle('这是一个很适合这本书的标题。')).toBe(false)
  })

  it('accepts short commercial novel titles', () => {
    expect(isLikelyNovelTitle('万界归途', '社畜穿越修仙界')).toBe(true)
  })

  it('builds fallback title from pitch seed instead of reusing source verbatim', () => {
    expect(buildFallbackNovelTitle({ corePitch: '规则怪谈 × 智斗反转：主角在规则世界求生' })).toBe('规则怪谈录')
  })
})
