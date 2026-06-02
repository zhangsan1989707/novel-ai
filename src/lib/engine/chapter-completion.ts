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
  const tail = content.slice(-400) // 扩大检查范围到 400 字

  // 1. 悬念式钩子：未解答的问题、不确定性结尾
  const suspensePatterns = [
    /(?:不知道|不清楚|无法确定|难以预料|还未).*(?:什么|怎么|如何|为何|会不会)/,
    /(?:究竟|到底|莫非|难道).*[？?]/,
    /(?:会不会|是不是|能不能).*[？?]/,
    /(?:到底|究竟)发生了什么/,
    /[？?](?![\s]*[。！\n])/, // 以问号结尾（后面没有其他完整句号）
  ]

  // 2. 转折式钩子：新信息、意外发现、反转
  const twistPatterns = [
    /然而.{5,}$/,
    /没想到.{5,}$/,
    /却.{5,}$/,
    /但.{5,}$/,
    /(?:突然|忽然|就在这时|正在这时).{10,}$/,
    /(?:只见|定睛一看|仔细一瞧).{10,}$/,
    /(?:竟然|居然|万万).{5,}$/,
    /(?:殊不知|哪里知道|哪曾想).{5,}$/,
  ]

  // 3. 承诺式钩子：建立下一章预期
  const promisePatterns = [
    /(?:明天|明日|下一次|下一章|接下来|等着.{2,4}的)将会/,
    /(?:而|但|可).*(?:等着|等待|即将|就要)/,
    /他.{1,3}(?:不知道|尚未知晓|完全没意识到)的是/,
    /(?:真正的|更大的|新的).*(?:挑战|危机|危险|考验|阴谋).*(?:才|刚|正|即将)/,
  ]

  // 4. 情感式钩子：情绪高潮结尾
  const emotionPatterns = [
    /[！!]{2,}$/, // 双感叹号结尾
    /(?:泪水|眼泪|怒吼|嘶吼|颤抖|握紧).{0,10}[！!]/,
    /……$/,
    /——$/,
  ]

  const allPatterns = [...suspensePatterns, ...twistPatterns, ...promisePatterns, ...emotionPatterns]
  return allPatterns.some(p => p.test(tail))
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
