import { describe, expect, it } from 'vitest'
import { scoreTitle, totalScore, rankCandidates } from '@/lib/title-strategy/scorer'
import { buildTitleFactoryPrompt } from '@/lib/title-strategy/prompt'
import type { TitleCandidate, TitleStrategyInput } from '@/lib/title-strategy/types'

describe('title-strategy scorer', () => {
  describe('scoreTitle', () => {
    it('gives high scores to market-oriented female titles with strong hooks', () => {
      const breakdown = scoreTitle('重生后，真千金和替身都杀疯了', 'fanqie', '言情')
      const score = totalScore(breakdown)
      expect(score).toBeGreaterThanOrEqual(60)
      expect(breakdown.hookStrength).toBeGreaterThanOrEqual(10)
      expect(breakdown.conflictDensity).toBeGreaterThanOrEqual(5)
    })

    it('gives low scores to literary/abstract titles', () => {
      const breakdown = scoreTitle('她与她都在求生', 'fanqie', '言情')
      const score = totalScore(breakdown)
      expect(score).toBeLessThan(60)
    })

    it('scores male-frequency titles appropriately', () => {
      const breakdown = scoreTitle('万古神帝重生归来', 'qidian', '玄幻')
      expect(breakdown.genreRecognition).toBeGreaterThanOrEqual(10)
    })

    it('scores short-drama style titles', () => {
      const breakdown = scoreTitle('离婚后前夫疯了', 'fanqie', '言情')
      const score = totalScore(breakdown)
      expect(score).toBeGreaterThanOrEqual(50)
    })
  })

  describe('rankCandidates', () => {
    it('sorts candidates by combined AI and local score', () => {
      const candidates: TitleCandidate[] = [
        { title: '她在写诗', style: 'literary', score: 90, tags: [], reason: '', risk: '' },
        { title: '重生后，假千金拉我一起逃婚', style: 'hot', score: 70, tags: [], reason: '', risk: '' },
        { title: '离婚后前夫夜夜跪求复合', style: 'hot', score: 65, tags: [], reason: '', risk: '' },
      ]
      const ranked = rankCandidates(candidates, 'fanqie', '言情')
      // The hot titles should rank higher due to local scoring boost
      expect(ranked[0].title).not.toBe('她在写诗')
    })

  it('returns empty array for empty input', () => {
    expect(rankCandidates([])).toEqual([])
  })

  it('breaks ties deterministically using secondary signals', () => {
    const candidates: TitleCandidate[] = [
      { title: '乙重生后翻盘', style: 'hot', score: 70, tags: [], reason: '', risk: '' },
      { title: '甲重生后翻盘', style: 'hot', score: 70, tags: [], reason: '', risk: '' },
    ]
    const ranked = rankCandidates(candidates, 'fanqie', '言情')
    expect(ranked[0].title).toBe('甲重生后翻盘')
    expect(ranked[1].title).toBe('乙重生后翻盘')
  })
  })
})

describe('title-strategy prompt', () => {
  it('builds a valid prompt with all inputs', () => {
    const input: TitleStrategyInput = {
      platform: 'fanqie',
      channel: 'female',
      genre: '言情',
      targetStyle: 'market',
      coreHook: '两个被命运互换的女人重生后，不再互斗，而是联手掀翻豪门棋局。',
      protagonistIdentity: '真千金',
      conflict: '真假千金对立',
      emotionalPromise: '爽感+姐妹情',
    }
    const prompt = buildTitleFactoryPrompt(input)
    expect(prompt).toContain('番茄小说')
    expect(prompt).toContain('女频')
    expect(prompt).toContain('言情')
    expect(prompt).toContain('15 个候选标题')
    expect(prompt).toContain('真千金')
    expect(prompt).toContain('JSON')
  })

  it('includes forbidden words when specified', () => {
    const input: TitleStrategyInput = {
      platform: 'general',
      channel: 'female',
      genre: '言情',
      targetStyle: 'market',
      coreHook: '测试卖点',
      forbiddenWords: ['禁词A', '禁词B'],
    }
    const prompt = buildTitleFactoryPrompt(input)
    expect(prompt).toContain('禁词A')
    expect(prompt).toContain('禁词B')
  })

  it('handles minimal inputs', () => {
    const input: TitleStrategyInput = {
      platform: 'general',
      channel: 'male',
      genre: '玄幻',
      targetStyle: 'quality',
      coreHook: '少年修炼成神',
    }
    const prompt = buildTitleFactoryPrompt(input)
    expect(prompt).toContain('玄幻')
    expect(prompt).toContain('男频')
  })
})
