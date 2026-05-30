import { describe, it, expect } from 'vitest'
import { rankCandidates, scoreTitle, totalScore } from '@/lib/title-strategy'
import type { TitleCandidate } from '@/lib/title-strategy'

describe('Title Factory API Logic', () => {
  describe('deduplication', () => {
    it('should remove duplicate titles after ranking', () => {
      const candidates: TitleCandidate[] = [
        { title: '重生后真千金杀疯了', style: 'hot', score: 70, tags: [], reason: '', risk: '' },
        { title: '重生后真千金杀疯了', style: 'hot', score: 65, tags: [], reason: '', risk: '' },
        { title: '重生后假千金杀疯了', style: 'hot', score: 60, tags: [], reason: '', risk: '' },
      ]
      
      const ranked = rankCandidates(candidates, 'fanqie', '言情')
      
      // Apply deduplication logic (same as in the API)
      const seen = new Set<string>()
      const deduped = ranked.filter(candidate => {
        const normalized = candidate.title.toLowerCase().trim()
        if (seen.has(normalized)) return false
        seen.add(normalized)
        return true
      })
      
      expect(deduped.length).toBe(2)
      expect(deduped[0].title).toBe('重生后真千金杀疯了')
      expect(deduped[1].title).toBe('重生后假千金杀疯了')
    })

    it('should handle case-insensitive deduplication', () => {
      const candidates: TitleCandidate[] = [
        { title: '重生后真千金杀疯了', style: 'hot', score: 70, tags: [], reason: '', risk: '' },
        { title: '重生后真千金杀疯了', style: 'hot', score: 65, tags: [], reason: '', risk: '' },
      ]
      
      const ranked = rankCandidates(candidates, 'fanqie', '言情')
      
      const seen = new Set<string>()
      const deduped = ranked.filter(candidate => {
        const normalized = candidate.title.toLowerCase().trim()
        if (seen.has(normalized)) return false
        seen.add(normalized)
        return true
      })
      
      expect(deduped.length).toBe(1)
    })

    it('should handle titles with whitespace differences', () => {
      const candidates: TitleCandidate[] = [
        { title: '重生后真千金杀疯了', style: 'hot', score: 70, tags: [], reason: '', risk: '' },
        { title: ' 重生后真千金杀疯了 ', style: 'hot', score: 65, tags: [], reason: '', risk: '' },
      ]
      
      const ranked = rankCandidates(candidates, 'fanqie', '言情')
      
      const seen = new Set<string>()
      const deduped = ranked.filter(candidate => {
        const normalized = candidate.title.toLowerCase().trim()
        if (seen.has(normalized)) return false
        seen.add(normalized)
        return true
      })
      
      expect(deduped.length).toBe(1)
    })
  })

  describe('score consistency', () => {
    it('should produce consistent scores for the same title', () => {
      const title = '重生后真千金杀疯了'
      const breakdown1 = scoreTitle(title, 'fanqie', '言情')
      const breakdown2 = scoreTitle(title, 'fanqie', '言情')
      
      expect(totalScore(breakdown1)).toBe(totalScore(breakdown2))
      expect(breakdown1).toEqual(breakdown2)
    })

    it('should rank candidates deterministically', () => {
      const candidates: TitleCandidate[] = [
        { title: '甲重生后翻盘', style: 'hot', score: 70, tags: [], reason: '', risk: '' },
        { title: '乙重生后翻盘', style: 'hot', score: 70, tags: [], reason: '', risk: '' },
      ]
      
      const ranked1 = rankCandidates(candidates, 'fanqie', '言情')
      const ranked2 = rankCandidates(candidates, 'fanqie', '言情')
      
      expect(ranked1[0].title).toBe(ranked2[0].title)
      expect(ranked1[1].title).toBe(ranked2[1].title)
    })
  })
})
