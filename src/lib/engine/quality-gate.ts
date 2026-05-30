/**
 * Quality Gate - 章节质量门禁
 * 章节保存为 completed 之前必须通过的质量检查
 */
import { countChineseWords } from '@/lib/utils'
import { isLikelyTruncated, type TruncationCheckResult } from './truncation-detector'
import type { ChapterGenerationContract } from './chapter-contract'

export type QualityGateStatus = 'passed' | 'failed' | 'needs_repair'

export interface QualityGateResult {
  status: QualityGateStatus
  checks: {
    wordCount: { passed: boolean; actual: number; min: number; max: number; message?: string }
    truncation: { passed: boolean; result: TruncationCheckResult }
    chapterNo: { passed: boolean; message?: string }
    title: { passed: boolean; message?: string }
    chapterLeak: { passed: boolean; message?: string }
  }
  canSave: boolean
  needsRepair: 'expand' | 'compress' | 'continue' | null
  errors: string[]
}

/**
 * 运行质量门禁检查
 */
export function runQualityGate(params: {
  content: string
  contract: ChapterGenerationContract
  finishReason?: string
}): QualityGateResult {
  const { content, contract, finishReason } = params
  const errors: string[] = []
  
  // 1. 字数范围校验
  const wordCount = countChineseWords(content)
  const wordCountPassed = wordCount >= contract.minWordCount && wordCount <= contract.maxWordCount
  let wordCountMessage: string | undefined
  if (!wordCountPassed) {
    if (wordCount < contract.minWordCount) {
      wordCountMessage = `字数不足：${wordCount} < ${contract.minWordCount}`
    } else {
      wordCountMessage = `字数过多：${wordCount} > ${contract.maxWordCount}`
    }
    errors.push(wordCountMessage)
  }

  // 2. 截断检测
  const truncationResult = isLikelyTruncated(content, finishReason, contract.minWordCount)
  if (truncationResult.isTruncated) {
    errors.push(...truncationResult.reasons)
  }

  // 3. chapterNo 校验（检查内容中是否出现错误的章节号）
  const chapterNoPassed = !hasWrongChapterNumber(content, contract.chapterNo)
  if (!chapterNoPassed) {
    errors.push(`内容中出现错误的章节号（期望第${contract.chapterNo}章）`)
  }

  // 4. 标题校验
  const titlePassed = !hasWrongChapterTitle(content, contract.expectedTitle, contract.chapterNo)
  if (!titlePassed) {
    errors.push('章节标题不匹配')
  }

  // 5. 是否误入下一章
  const chapterLeakPassed = !hasChapterLeak(content, contract.chapterNo)
  if (!chapterLeakPassed) {
    errors.push('内容中出现了下一章的内容')
  }

  // 判断是否可以保存
  const canSave = wordCountPassed && !truncationResult.isTruncated && chapterNoPassed && titlePassed && chapterLeakPassed
  
  // 判断需要什么修复
  let needsRepair: 'expand' | 'compress' | 'continue' | null = null
  if (!canSave) {
    if (truncationResult.isTruncated) {
      needsRepair = 'continue'
    } else if (wordCount < contract.minWordCount) {
      needsRepair = 'expand'
    } else if (wordCount > contract.maxWordCount) {
      needsRepair = 'compress'
    }
  }

  return {
    status: canSave ? 'passed' : 'failed',
    checks: {
      wordCount: { passed: wordCountPassed, actual: wordCount, min: contract.minWordCount, max: contract.maxWordCount, message: wordCountMessage },
      truncation: { passed: !truncationResult.isTruncated, result: truncationResult },
      chapterNo: { passed: chapterNoPassed },
      title: { passed: titlePassed },
      chapterLeak: { passed: chapterLeakPassed },
    },
    canSave,
    needsRepair,
    errors,
  }
}

/**
 * 检查内容中是否出现错误的章节号
 */
function hasWrongChapterNumber(content: string, expectedChapterNo: number): boolean {
  // 匹配 "第X章" 格式
  const chapterMatches = content.match(/第(\d+)章/g)
  if (!chapterMatches) return false
  
  for (const match of chapterMatches) {
    const num = parseInt(match.replace('第', '').replace('章', ''))
    // 如果出现的章节号与当前章节号相差超过 1，可能是错误的
    if (Math.abs(num - expectedChapterNo) > 1) {
      return true
    }
  }
  return false
}

/**
 * 检查章节标题是否匹配
 */
function hasWrongChapterTitle(content: string, expectedTitle: string, chapterNo: number): boolean {
  // 如果标题是默认格式 "第X章"，不强制检查
  if (expectedTitle === `第${chapterNo}章`) return false
  
  // 检查内容开头是否包含章节标题
  const first500Chars = content.slice(0, 500)
  // 允许标题有轻微差异
  return !first500Chars.includes(expectedTitle.slice(0, 10))
}

/**
 * 检查是否误入下一章
 */
function hasChapterLeak(content: string, currentChapterNo: number): boolean {
  // 检查是否出现下一章的标题
  const nextChapterPattern = new RegExp(`第${currentChapterNo + 1}章`)
  return nextChapterPattern.test(content)
}
