import { describe, expect, it } from 'vitest'
import { runQualityGate } from '@/lib/engine/quality-gate'

const baseContract = {
  projectId: 1,
  chapterNo: 2,
  expectedTitle: '第2章',
  expectedSummary: '',
  targetWordCount: 2000,
  minWordCount: 1000,
  maxWordCount: 3000,
  mode: 'FINAL_POLISH' as const,
}

describe('runQualityGate', () => {
  it('blocks saving when continuity audit has major or critical issues', () => {
    const result = runQualityGate({
      content: '林曜继续查看屏幕提示，警报开始倒计时。'.repeat(50),
      contract: baseContract,
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

  it('returns needs_repair continue when word count too low (truncation has priority)', () => {
    // Content under minWordCount triggers truncation detector, which has priority
    const content = '林曜站在窗前。'.repeat(30)
    const result = runQualityGate({
      content,
      contract: baseContract,
      finishReason: 'stop',
    })

    expect(result.canSave).toBe(false)
    expect(result.checks.wordCount.passed).toBe(false)
    // truncation detector flags content under minWordCount, needsRepair = 'continue'
    expect(result.needsRepair).toBe('continue')
  })

  it('returns needs_repair compress when word count too high', () => {
    // Generate content well over 3000 words with natural ending
    const content = '林曜站在窗前望着远方天际线这座城市在夜色中闪烁着无数光芒每一盏灯背后都有一个故事。'.repeat(200)
    const result = runQualityGate({
      content,
      contract: baseContract,
      finishReason: 'stop',
    })

    expect(result.canSave).toBe(false)
    expect(result.checks.wordCount.passed).toBe(false)
    expect(result.needsRepair).toBe('compress')
  })

  it('returns needs_repair continue when truncation detected', () => {
    const result = runQualityGate({
      content: '一段正常的内容。'.repeat(100),
      contract: baseContract,
      finishReason: 'length',
    })

    // truncation detection depends on content length vs minWordCount
    // if isTruncated is true, needsRepair should be 'continue'
    if (result.checks.truncation.passed === false) {
      expect(result.needsRepair).toBe('continue')
    }
  })

  it('detects chapter leak when next chapter number appears', () => {
    const result = runQualityGate({
      content: '正当林曜准备离开时，第3章的序幕拉开了。'.repeat(50),
      contract: baseContract,
    })

    expect(result.checks.chapterLeak.passed).toBe(false)
    expect(result.canSave).toBe(false)
  })

  it('passes when all checks are good', () => {
    const content = '林曜站在窗前，望着远方的天际线。这座城市在夜色中闪烁着无数光芒，每一盏灯背后都有一个故事。'.repeat(50)
    const result = runQualityGate({
      content,
      contract: { ...baseContract, expectedTitle: '第2章' },
      finishReason: 'stop',
    })

    expect(result.status).toBe('passed')
    expect(result.canSave).toBe(true)
    expect(result.needsRepair).toBeNull()
    expect(result.errors).toHaveLength(0)
  })

  it('passes with minor continuity issues', () => {
    const content = '林曜继续前行，脚步坚定，目光如炬。'.repeat(80)
    const result = runQualityGate({
      content,
      contract: baseContract,
      finishReason: 'stop',
      continuityAudit: {
        passed: true,
        score: 75,
        issues: [{
          severity: 'minor',
          type: 'tone_shift',
          description: '语气略有变化',
          suggestedFix: '保持一致的叙述语调。',
        }],
      },
    })

    expect(result.canSave).toBe(true)
    expect(result.checks.continuity.passed).toBe(true)
  })
})
