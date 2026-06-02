import { describe, expect, it } from 'vitest'
import { AIVendor } from '@/types'
import {
  estimateMaxTokensForTargetWordCount,
  resolveEffectiveChapterWordCount,
  normalizeGenerationSpeedMode,
  resolveMiMoModelId,
  resolveModelIdForRole,
} from '@/lib/ai/speed-mode'

describe('generation speed mode strategy', () => {
  it('defaults unknown speed values to FINAL_POLISH', () => {
    expect(normalizeGenerationSpeedMode(undefined)).toBe('FINAL_POLISH')
    expect(normalizeGenerationSpeedMode('invalid')).toBe('FINAL_POLISH')
    expect(normalizeGenerationSpeedMode('fast')).toBe('FAST_ACCEPTANCE')
  })

  it('maps legacy modes to new modes', () => {
    expect(normalizeGenerationSpeedMode('fast')).toBe('FAST_ACCEPTANCE')
    expect(normalizeGenerationSpeedMode('quick_acceptance')).toBe('FAST_ACCEPTANCE')
    expect(normalizeGenerationSpeedMode('balanced')).toBe('FINAL_POLISH')
    expect(normalizeGenerationSpeedMode('balanced_quality')).toBe('FINAL_POLISH')
    expect(normalizeGenerationSpeedMode('quality')).toBe('FINAL_POLISH')
    expect(normalizeGenerationSpeedMode('polished_quality')).toBe('FINAL_POLISH')
  })

  it('maps MiMo roles to FAST_ACCEPTANCE models', () => {
    expect(resolveMiMoModelId('FAST_ACCEPTANCE', 'planner')).toBe('mimo-v2.5')
    expect(resolveMiMoModelId('FAST_ACCEPTANCE', 'writer')).toBe('mimo-v2.5')
    expect(resolveMiMoModelId('FAST_ACCEPTANCE', 'summarizer')).toBe('mimo-v2.5')
  })

  it('maps FINAL_POLISH mode to MiMo pro for all text roles', () => {
    expect(resolveMiMoModelId('FINAL_POLISH', 'writer')).toBe('mimo-v2.5-pro')
    expect(resolveMiMoModelId('FINAL_POLISH', 'reviewer')).toBe('mimo-v2.5-pro')
    expect(resolveMiMoModelId('FINAL_POLISH', 'deslopper')).toBe('mimo-v2.5-pro')
  })

  it('does not override non-MiMo models', () => {
    expect(resolveModelIdForRole({
      vendor: AIVendor.DEEPSEEK,
      currentModelId: 'deepseek-chat',
      speedMode: 'FAST_ACCEPTANCE',
      role: 'writer',
    })).toBe('deepseek-chat')
  })

  it('estimates stream max tokens from requested word count', () => {
    expect(estimateMaxTokensForTargetWordCount(2000)).toBe(5000)
    expect(estimateMaxTokensForTargetWordCount(0)).toBe(3)
  })

  it('reduces the chapter target word count according to the speed mode', () => {
    expect(resolveEffectiveChapterWordCount(3000, 'FAST_ACCEPTANCE')).toBe(2400)
    expect(resolveEffectiveChapterWordCount(3000, 'FINAL_POLISH')).toBe(3000)
  })
})
