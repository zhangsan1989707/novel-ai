import { describe, expect, it } from 'vitest'
import {
  auditChapterContinuity,
  buildChapterContinuitySnapshot,
  buildContinuityAnchor,
  formatContinuityAnchorSection,
} from '@/lib/engine/chapter-continuity'

describe('chapter continuity', () => {
  const anchor = buildContinuityAnchor({
    chapterNo: 2,
    previousChapterEnding: '林曜在逃生舱里第五次尝试破解恒星动力加密分区。第五次。屏幕上的提示变了。',
    characterProfiles: [{ name: '林曜', role: 'PROTAGONIST' }],
  })

  it('builds a writer-facing continuation anchor', () => {
    expect(anchor).not.toBeNull()
    const section = formatContinuityAnchorSection(anchor!)

    expect(section).toContain('必须无缝承接第1章结尾')
    expect(section).toContain('林曜')
    expect(section).toContain('逃生舱')
    expect(section).toContain('不得无过渡跳转')
  })

  it('fails protagonist name drift', () => {
    const result = auditChapterContinuity({
      chapterNo: 2,
      anchor,
      content: '第2章\n\n林烬睁开眼，黑市的灯牌在头顶闪烁。他已经决定买下一艘海鸥级飞船。',
    })

    expect(result.passed).toBe(false)
    expect(result.issues.some(issue => issue.type === 'protagonist_name_drift' && issue.severity === 'critical')).toBe(true)
  })

  it('fails unanchored escape-pod to black-market jumps', () => {
    const result = auditChapterContinuity({
      chapterNo: 2,
      anchor,
      content: '第2章\n\n黑市的船贩子把古董货推到林曜面前。陈戈拍着船壳，催她立刻买下这艘海鸥级飞船。',
    })

    expect(result.passed).toBe(false)
    expect(result.issues.some(issue => issue.type === 'previous_ending_not_continued')).toBe(true)
    expect(result.issues.some(issue => issue.type === 'location_jump')).toBe(true)
  })

  it('flags incomplete endings that stop at a changed screen prompt', () => {
    const result = auditChapterContinuity({
      chapterNo: 1,
      anchor: {
        previousChapterNo: 0,
        previousEnding: '林曜正在逃生舱中尝试入侵系统。',
        mustContinueFrom: '林曜正在逃生舱中尝试入侵系统。',
        expectedOpeningLocation: '逃生舱',
        protagonistName: '林曜',
        forbiddenJumps: [],
      },
      content: '第1章\n\n林曜盯着终端，终于按下确认键。第五次。屏幕上的提示变了。',
    })

    expect(result.passed).toBe(false)
    expect(result.issues.some(issue => issue.type === 'incomplete_ending')).toBe(true)
  })

  it('creates a compact handoff snapshot', () => {
    const snapshot = buildChapterContinuitySnapshot({
      chapterNo: 1,
      anchor,
      content: '第1章\n\n林曜留在逃生舱里，燃料只够最后一次变轨。\n\n屏幕上的提示显示：加密分区已打开，但警报也开始倒计时。',
    })

    expect(snapshot.chapterNo).toBe(1)
    expect(snapshot.activeCharacters).toContain('林曜')
    expect(snapshot.nextChapterMustContinueFrom).toContain('警报')
    expect(snapshot.continuityLocks.protagonistName).toBe('林曜')
  })
})
