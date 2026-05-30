import { describe, expect, it } from 'vitest'
import { computeWriterFeatureSummaries } from '@/lib/virtual-writer/training'

describe('computeWriterFeatureSummaries', () => {
  it('produces stable summary fields from document stats', () => {
    const features = computeWriterFeatureSummaries(
      [
        { fileName: 'a.txt', wordCount: 1200 },
        { fileName: 'b.txt', wordCount: 2400 },
      ],
      '样本正文'
    )

    expect(features.styleFeatures).toContain('2 篇文档')
    expect(features.vocabularyFeatures).toContain('3600 字')
    expect(features.themeFeatures).toBe('样本正文')
  })
})
