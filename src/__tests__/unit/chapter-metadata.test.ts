import { describe, expect, it } from 'vitest'
import {
  buildSeedOutlineFromChapterState,
  normalizeChapterTitle,
  resolveCommittedChapterTitle,
} from '@/lib/engine/chapter-metadata'

describe('chapter metadata helpers', () => {
  it('removes duplicated chapter number prefixes when a real subtitle exists', () => {
    expect(normalizeChapterTitle(1, '第1章 慢修者的耻辱')).toBe('慢修者的耻辱')
    expect(normalizeChapterTitle(5, '第5章：设局反击')).toBe('设局反击')
  })

  it('keeps the richer persisted title when incoming commit title is only chapter number', () => {
    expect(resolveCommittedChapterTitle(1, '第1章', '第1章 慢修者的耻辱')).toBe('慢修者的耻辱')
  })

  it('builds a fast-mode seed outline from the persisted chapter plan', () => {
    const outline = buildSeedOutlineFromChapterState(1, {
      title: '第1章 慢修者的耻辱',
      summary: '主角在羞辱中反击，确立当前阶段主冲突。',
      chapterOutline: {
        title: '第1章 慢修者的耻辱',
        summary: '主角在羞辱中反击，确立当前阶段主冲突。',
      },
    })

    expect(outline.chapterTitle).toBe('慢修者的耻辱')
    expect(outline.chapterGoal).toBe('主角在羞辱中反击，确立当前阶段主冲突。')
    expect(outline.keyScenes).toHaveLength(3)
  })
})
