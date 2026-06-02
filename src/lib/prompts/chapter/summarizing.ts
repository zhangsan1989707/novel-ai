/**
 * 摘要 Agent Prompt - 生成章节摘要
 */
import { SUMMARY_WORD_COUNT } from '../shared/constants'

interface SummarizerPromptInput {
  chapterNo: number
  chapterTitle: string
  chapterContent: string
  memoryContext?: string
  worldSetting?: string | null
  protagonistProfile?: string | null
}

export function buildSummarizerPrompt(input: SummarizerPromptInput): string {
  const parts: string[] = []

  parts.push(`你是一位小说策划编辑，负责生成章节摘要。`)

  parts.push(`\n【章节信息】`)
  parts.push(`第${input.chapterNo}章 "${input.chapterTitle}"`)

  if (input.memoryContext) {
    parts.push(`\n【记忆编排上下文】`)
    parts.push(input.memoryContext)
  }

  if (input.worldSetting) {
    parts.push(`\n【世界观】`)
    parts.push(input.worldSetting)
  }

  if (input.protagonistProfile) {
    parts.push(`\n【主角人设】`)
    parts.push(input.protagonistProfile)
  }

  parts.push(`\n【章节内容】`)
  // 取首尾两部分确保覆盖章节结构：开头 + 高潮/结尾
  // 之前只取前 5000 字会遗漏长章节的结尾钩子
  const contentLength = input.chapterContent.length
  if (contentLength <= 5000) {
    parts.push(input.chapterContent)
  } else {
    const head = input.chapterContent.slice(0, 3000)
    const tail = input.chapterContent.slice(-2000)
    parts.push(head)
    parts.push(`\n（中间省略 ${contentLength - 5000} 字符）\n`)
    parts.push(tail)
  }

  parts.push(`\n【任务】`)
  parts.push(`请生成本章摘要（${SUMMARY_WORD_COUNT.L1_CHAPTER_MIN}-${SUMMARY_WORD_COUNT.L1_CHAPTER_MAX}字），包含：`)
  parts.push(`1. 本章核心事件`)
  parts.push(`2. 关键场景`)
  parts.push(`3. 情感基调`)
  parts.push(`4. 埋下的伏笔`)
  parts.push(`5. 回收的伏笔`)

  parts.push(`\n【输出格式】`)
  parts.push(`请以严格 JSON 格式输出：`)
  parts.push(`- summary: string, 摘要正文（${SUMMARY_WORD_COUNT.L1_CHAPTER_MIN}-${SUMMARY_WORD_COUNT.L1_CHAPTER_MAX}字）`)
  parts.push(`- keyEvents: string[], 关键事件列表（3-5个）`)
  parts.push(`- emotionalTone: string, 情感基调（如：紧张、温馨、悲伤）`)
  parts.push(`- plantedPlotlines: string[], 埋下的伏笔描述`)
  parts.push(`- resolvedPlotlines: string[], 回收的伏笔ID`)

  return parts.join('\n')
}

// 类型导出
export type { SummarizerPromptInput }
