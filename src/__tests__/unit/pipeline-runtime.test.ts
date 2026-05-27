import { describe, expect, it } from 'vitest'
import {
  appendChapterLiveContent,
  createPipelineRuntimeState,
  sanitizePipelineRuntime,
  type PipelineChapterRuntime,
} from '@/lib/engine/pipeline-runtime'

function makeChapterRuntime(overrides: Partial<PipelineChapterRuntime> = {}): PipelineChapterRuntime {
  return {
    chapterNumber: 1,
    status: 'RUNNING',
    currentWordCount: 0,
    targetWordCount: 3000,
    startedAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    phaseTimings: {},
    ...overrides,
  }
}

describe('pipeline runtime live content', () => {
  it('keeps live content when sanitizing runtime snapshots', () => {
    const runtime = sanitizePipelineRuntime({
      currentChapter: makeChapterRuntime({ liveContent: '正在写作的正文' }),
      recentChapters: [],
      streamRevision: 2,
    })

    expect(runtime.currentChapter?.liveContent).toBe('正在写作的正文')
  })

  it('appends and resets live content for the active chapter', () => {
    const runtime = createPipelineRuntimeState('fast')
    runtime.currentChapter = makeChapterRuntime()

    const appended = appendChapterLiveContent(runtime, '第一句')
    expect(appended.currentChapter?.liveContent).toBe('第一句')

    const reset = appendChapterLiveContent(appended, '第二句', { reset: true })
    expect(reset.currentChapter?.liveContent).toBe('第二句')
  })
})
