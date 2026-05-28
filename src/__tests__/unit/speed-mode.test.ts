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
  it('defaults unknown speed values to balanced', () => {
    expect(normalizeGenerationSpeedMode(undefined)).toBe('balanced')
    expect(normalizeGenerationSpeedMode('invalid')).toBe('balanced')
    expect(normalizeGenerationSpeedMode('fast')).toBe('fast')
  })

  it('maps MiMo roles to fast models', () => {
    expect(resolveMiMoModelId('fast', 'planner')).toBe('mimo-v2-flash')
    expect(resolveMiMoModelId('fast', 'writer')).toBe('mimo-v2.5')
    expect(resolveMiMoModelId('fast', 'summarizer')).toBe('mimo-v2-flash')
  })

  it('maps MiMo roles to balanced models', () => {
    expect(resolveMiMoModelId('balanced', 'blueprint')).toBe('mimo-v2.5')
    expect(resolveMiMoModelId('balanced', 'writer')).toBe('mimo-v2.5')
    expect(resolveMiMoModelId('balanced', 'validator')).toBe('mimo-v2-flash')
  })

  it('maps quality mode to MiMo pro for all text roles', () => {
    expect(resolveMiMoModelId('quality', 'writer')).toBe('mimo-v2.5-pro')
    expect(resolveMiMoModelId('quality', 'reviewer')).toBe('mimo-v2.5-pro')
    expect(resolveMiMoModelId('quality', 'deslopper')).toBe('mimo-v2.5-pro')
  })

  it('does not override non-MiMo models', () => {
    expect(resolveModelIdForRole({
      vendor: AIVendor.DEEPSEEK,
      currentModelId: 'deepseek-chat',
      speedMode: 'fast',
      role: 'writer',
    })).toBe('deepseek-chat')
  })

  it('estimates stream max tokens from requested word count', () => {
    expect(estimateMaxTokensForTargetWordCount(2000)).toBe(2200)
    expect(estimateMaxTokensForTargetWordCount(0)).toBe(2)
  })

  it('reduces the chapter target word count according to the speed mode', () => {
    expect(resolveEffectiveChapterWordCount(3000, 'fast')).toBe(2400)
    expect(resolveEffectiveChapterWordCount(3000, 'balanced')).toBe(2700)
    expect(resolveEffectiveChapterWordCount(3000, 'quality')).toBe(3000)
  })
})
