import { describe, expect, it } from 'vitest'
import { buildChapterCompletionReport } from '@/lib/engine/chapter-completion'

describe('buildChapterCompletionReport', () => {
  it('penalizes short chapters and missing ending hooks', () => {
    const report = buildChapterCompletionReport({
      content: '主角进入了新的修炼空间，但没有完成目标。',
      targetWordCount: 3000,
      outline: {
        chapterTitle: '测试章节',
        chapterGoal: '推进主线',
        mainConflict: '追杀',
        keyScenes: [],
        ending: '留下悬念',
        foreshadows: [],
        resolvedPlotlines: [],
      },
    })

    expect(report.completionScore).toBeLessThan(80)
    expect(report.chapterGoalCompleted).toBe(false)
    expect(report.endingHookExists).toBe(false)
    expect(report.issues.some(issue => issue.code === 'WORD_COUNT_SHORT')).toBe(true)
  })

  it('rewards longer content with a hook', () => {
    const longContent = '主角突破了封锁，拿到了关键资源。'.repeat(120) + '然而，他没想到这只是开始？'
    const report = buildChapterCompletionReport({
      content: longContent,
      targetWordCount: 3000,
      outline: {
        chapterTitle: '测试章节',
        chapterGoal: '推进主线',
        mainConflict: '追杀',
        keyScenes: [],
        ending: '留下悬念',
        foreshadows: [],
        resolvedPlotlines: [],
      },
    })

    expect(report.chapterGoalCompleted).toBe(true)
    expect(report.endingHookExists).toBe(true)
    expect(report.mainConflictProgressed).toBe(true)
    expect(report.completionScore).toBeGreaterThanOrEqual(80)
  })
})
