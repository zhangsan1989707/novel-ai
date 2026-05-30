import { countChineseWords } from '@/lib/utils'
import type { ChapterOutline } from './types'

export interface ChapterCompletionIssue {
  code: string
  message: string
  severity: 'critical' | 'major' | 'minor'
}

export interface ChapterCompletionReport {
  actualWordCount: number
  targetWordCount: number
  chapterGoalCompleted: boolean
  mainConflictProgressed: boolean
  mainConflictResolved: boolean
  endingHookExists: boolean
  abruptTruncationDetected: boolean
  completionScore: number
  issues: ChapterCompletionIssue[]
}

function detectEndingHook(content: string): boolean {
  const tail = content.slice(-300)
  return /[？?！!]|然而|没想到|下一刻|忽然|却在这时/.test(tail)
}

function detectAbruptTruncation(content: string): boolean {
  const tail = content.trimEnd()
  if (!tail) return false
  const lastChar = tail[tail.length - 1]
  return !['。', '！', '？', '…', '"', '」', '）', ')', '】', '>'].includes(lastChar)
}

export function buildChapterCompletionReport(params: {
  content: string
  targetWordCount: number
  outline?: ChapterOutline | null
  mainConflict?: string | null
  previousMainConflict?: string | null
}): ChapterCompletionReport {
  const issues: ChapterCompletionIssue[] = []
  const actualWordCount = countChineseWords(params.content)

  const wordRatio = params.targetWordCount > 0 ? actualWordCount / params.targetWordCount : 1
  if (wordRatio < 0.85) {
    issues.push({
      code: 'WORD_COUNT_SHORT',
      message: `字数不足，当前 ${actualWordCount}，目标 ${params.targetWordCount}。`,
      severity: 'major',
    })
  }

  const chapterGoalCompleted = Boolean(params.outline?.chapterGoal) && actualWordCount >= Math.min(params.targetWordCount, 1200)
  if (!chapterGoalCompleted) {
    issues.push({
      code: 'CHAPTER_GOAL_WEAK',
      message: '未检测到章节目标完成证据，章节目标可能未落地。',
      severity: 'major',
    })
  }

  const mainConflictProgressed = Boolean(params.outline?.mainConflict) || (params.mainConflict ? params.content.includes(params.mainConflict.slice(0, 8)) : false)
  const mainConflictResolved = params.content.includes('解决') || params.content.includes('落幕') || params.content.includes('尘埃落定')
  if (!mainConflictProgressed) {
    issues.push({
      code: 'MAIN_CONFLICT_STALL',
      message: '主冲突未明显推进，章节节奏可能停滞。',
      severity: 'critical',
    })
  }

  const endingHookExists = detectEndingHook(params.content)
  if (!endingHookExists) {
    issues.push({
      code: 'ENDING_HOOK_MISSING',
      message: '章节结尾钩子不足，缺少悬念、反转或承诺。',
      severity: 'major',
    })
  }

  const abruptTruncationDetected = detectAbruptTruncation(params.content)
  if (abruptTruncationDetected) {
    issues.push({
      code: 'ABRUPT_TRUNCATION',
      message: '章节结尾疑似异常截断。',
      severity: 'critical',
    })
  }

  const criticalCount = issues.filter(item => item.severity === 'critical').length
  const majorCount = issues.filter(item => item.severity === 'major').length
  const completionScore = Math.max(0, Math.min(100, 100 - criticalCount * 15 - majorCount * 10 - (wordRatio < 0.85 ? 8 : 0)))

  return {
    actualWordCount,
    targetWordCount: params.targetWordCount,
    chapterGoalCompleted,
    mainConflictProgressed,
    mainConflictResolved,
    endingHookExists,
    abruptTruncationDetected,
    completionScore,
    issues,
  }
}
