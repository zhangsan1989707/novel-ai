import { describe, expect, it } from 'vitest'
import {
  normalizeCommittedChapterContent,
  normalizePersistedAgentType,
} from '@/lib/engine/chapter-projections'

describe('chapter projection normalization', () => {
  it('normalizes reviewer-like agent types to Prisma-safe values', () => {
    expect(normalizePersistedAgentType('WRITER')).toBe('WRITER')
    expect(normalizePersistedAgentType('REVIEWER')).toBe('POLISHER')
    expect(normalizePersistedAgentType('DESLOPPER')).toBe('POLISHER')
    expect(normalizePersistedAgentType('unknown')).toBeUndefined()
  })

  it('unwraps revised content from the serialized chapter payload', () => {
    const wrappedContent = String.raw`{
  "revisedContent": "# 血脉觉醒\n\n晨雾还没散尽，林家广场上已经站满了人。\n\n林尘站在后排，踮着脚尖往前看。`

    expect(normalizeCommittedChapterContent(wrappedContent)).toBe(
      '# 血脉觉醒\n\n晨雾还没散尽，林家广场上已经站满了人。\n\n林尘站在后排，踮着脚尖往前看。'
    )
  })

  it('falls back to the original content when it cannot parse the wrapper', () => {
    const brokenWrappedContent = String.raw`{
  "revisedContent": "# 血脉觉醒\n\n晨雾还没散尽，林家广场上已经站满了人。`

    expect(normalizeCommittedChapterContent(brokenWrappedContent)).toBe(
      '# 血脉觉醒\n\n晨雾还没散尽，林家广场上已经站满了人。'
    )
  })
})
