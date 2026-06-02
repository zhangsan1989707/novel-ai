import { describe, expect, it } from 'vitest'
import { runQualityGate } from '@/lib/engine/quality-gate'

describe('runQualityGate continuity checks', () => {
  it('blocks saving when continuity audit has major or critical issues', () => {
    const result = runQualityGate({
      content: '林曜继续查看屏幕提示，警报开始倒计时。',
      contract: {
        projectId: 1,
        chapterNo: 2,
        expectedTitle: '第2章',
        expectedSummary: '',
        targetWordCount: 20,
        minWordCount: 1,
        maxWordCount: 100,
        mode: 'FINAL_POLISH',
      },
      continuityAudit: {
        passed: false,
        score: 55,
        issues: [{
          severity: 'critical',
          type: 'previous_ending_not_continued',
          description: '本章开头没有承接上一章结尾锚点',
          suggestedFix: '从上一章结尾续写。',
        }],
      },
    })

    expect(result.canSave).toBe(false)
    expect(result.checks.continuity.passed).toBe(false)
    expect(result.errors.join('\n')).toContain('章节连续性失败')
  })
})
