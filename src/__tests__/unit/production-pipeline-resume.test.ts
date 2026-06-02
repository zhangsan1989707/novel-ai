import { describe, expect, it } from 'vitest'
import { resolveResumeChapter } from '@/lib/engine/production-pipeline'

describe('resolveResumeChapter', () => {
  it('skips completed and written reviewing chapters when resuming', () => {
    const next = resolveResumeChapter([
      { chapterNumber: 1, status: 'REVIEWING', wordCount: 3027 },
      { chapterNumber: 2, status: 'DRAFT', wordCount: 0 },
    ], 1)

    expect(next).toBe(2)
  })

  it('retries empty reviewing chapters because they were not produced', () => {
    const next = resolveResumeChapter([
      { chapterNumber: 1, status: 'REVIEWING', wordCount: 0, content: '' },
      { chapterNumber: 2, status: 'DRAFT', wordCount: 0 },
    ], 1)

    expect(next).toBe(1)
  })
})
