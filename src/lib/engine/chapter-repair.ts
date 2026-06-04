/**
 * 章节修复模块 - 处理字数不足/过多/连续性问题的情况
 */
import type { AIProvider } from '@/lib/ai/types'
import { countChineseWords } from '@/lib/utils'

export interface RepairResult {
  success: boolean
  content: string
  wordCount: number
  action: 'expand' | 'compress' | 'rewrite' | 'none'
  error?: string
}

/**
 * 扩写章节内容
 */
export async function expandChapter(params: {
  content: string
  targetWordCount: number
  currentWordCount: number
  chapterTitle: string
  chapterNo: number
  provider: AIProvider
}): Promise<RepairResult> {
  const { content, targetWordCount, currentWordCount, chapterTitle, chapterNo, provider } = params
  
  const needWords = targetWordCount - currentWordCount
  if (needWords <= 0) {
    return { success: true, content, wordCount: currentWordCount, action: 'none' }
  }

  const prompt = `你是小说扩写专家。请扩写以下章节内容，使其达到 ${targetWordCount} 字左右。

章节标题：${chapterTitle}（第${chapterNo}章）
当前字数：${currentWordCount}
需要扩写：约 ${needWords} 字

扩写要求：
1. 保持原文情节和风格不变
2. 增加细节描写、心理活动、环境描写
3. 扩展对话和场景
4. 不要改变故事走向
5. 不要添加新的主要情节

原文：
${content}

请直接输出扩写后的完整章节内容，不要添加任何说明。`

  try {
    const result = await provider.generate(prompt, {
      temperature: 0.7,
      maxTokens: Math.ceil(targetWordCount * 2),
    })
    
    const newContent = result.content.trim()
    const newWordCount = countChineseWords(newContent)
    
    return {
      success: true,
      content: newContent,
      wordCount: newWordCount,
      action: 'expand',
    }
  } catch (error) {
    return {
      success: false,
      content,
      wordCount: currentWordCount,
      action: 'expand',
      error: error instanceof Error ? error.message : '扩写失败',
    }
  }
}

/**
 * 压缩章节内容
 */
export async function compressChapter(params: {
  content: string
  targetWordCount: number
  currentWordCount: number
  chapterTitle: string
  chapterNo: number
  provider: AIProvider
}): Promise<RepairResult> {
  const { content, targetWordCount, currentWordCount, chapterTitle, chapterNo, provider } = params
  
  const excessWords = currentWordCount - targetWordCount
  if (excessWords <= 0) {
    return { success: true, content, wordCount: currentWordCount, action: 'none' }
  }

  const prompt = `你是小说压缩专家。请压缩以下章节内容，使其达到 ${targetWordCount} 字左右。

章节标题：${chapterTitle}（第${chapterNo}章）
当前字数：${currentWordCount}
需要压缩：约 ${excessWords} 字

压缩要求：
1. 保持主要情节和关键对话不变
2. 删除冗余描写和重复内容
3. 精简环境和心理描写
4. 不要丢失重要剧情信息
5. 保持章节完整性（有开头、发展、结尾）

原文：
${content}

请直接输出压缩后的完整章节内容，不要添加任何说明。`

  try {
    const result = await provider.generate(prompt, {
      temperature: 0.5,
      maxTokens: Math.ceil(targetWordCount * 1.5),
    })
    
    const newContent = result.content.trim()
    const newWordCount = countChineseWords(newContent)
    
    return {
      success: true,
      content: newContent,
      wordCount: newWordCount,
      action: 'compress',
    }
  } catch (error) {
    return {
      success: false,
      content,
      wordCount: currentWordCount,
      action: 'compress',
      error: error instanceof Error ? error.message : '压缩失败',
    }
  }
}

/**
 * 续写截断的章节
 */
export async function continueChapter(params: {
  content: string
  targetWordCount: number
  currentWordCount: number
  chapterTitle: string
  chapterNo: number
  provider: AIProvider
  /** 章节大纲（用于保持情节一致） */
  chapterOutline?: string
  /** 角色档案（用于保持人物一致） */
  characterProfiles?: string
  /** 最近章节摘要（用于保持上下文连贯） */
  recentSummaries?: string
  /** 上一章结尾原文（用于跨章衔接） */
  previousChapterEnding?: string
}): Promise<RepairResult> {
  const { content, targetWordCount, currentWordCount, chapterTitle, chapterNo, provider } = params
  
  const needWords = targetWordCount - currentWordCount
  if (needWords <= 0) {
    return { success: true, content, wordCount: currentWordCount, action: 'none' }
  }

  // 取最后 800 字作为续写起点（修复前为 500）
  const lastContext = content.slice(-800)

  const parts: string[] = []

  parts.push(`你是小说续写专家。以下章节被截断了，请根据完整上下文继续完成。`)
  parts.push(``)
  
  if (params.previousChapterEnding) {
    parts.push(`## 上一章结尾（本章开篇应承接此内容）`)
    parts.push(params.previousChapterEnding)
    parts.push(``)
  }

  if (params.chapterOutline) {
    parts.push(`## 本章大纲（续写必须遵循大纲规划）`)
    parts.push(params.chapterOutline)
    parts.push(``)
  }

  if (params.characterProfiles) {
    parts.push(`## 本章出场角色`)
    parts.push(params.characterProfiles)
    parts.push(``)
  }

  if (params.recentSummaries) {
    parts.push(`## 前情摘要`)
    parts.push(params.recentSummaries)
    parts.push(``)
  }

  parts.push(`## 续写任务`)
  parts.push(`章节标题：${chapterTitle}（第${chapterNo}章）`)
  parts.push(`当前字数：${currentWordCount}`)
  parts.push(`目标字数：${targetWordCount}`)
  parts.push(`需要续写：约 ${needWords} 字`)
  parts.push(``)
  parts.push(`## 续写要求`)
  parts.push(`1. 从截断处自然继续，保持情节、风格、人物一致`)
  parts.push(`2. 完成当前场景或情节后再自然收尾`)
  parts.push(`3. 不要重复已有内容，直接继续写`)
  parts.push(`4. 确保章节有完整的结尾钩子（悬念/承诺/转折）`)
  parts.push(``)
  parts.push(`## 截断位置（已有内容的最后 800 字）`)
  parts.push(lastContext)
  parts.push(``)
  parts.push(`请从截断处直接继续写，输出续写内容（不需要重复已有内容）。`)

  const prompt = parts.join('\n')

  try {
    const result = await provider.generate(prompt, {
      temperature: 0.7,
      maxTokens: Math.ceil(needWords * 2),
    })
    
    const continuation = result.content.trim()
    const newContent = content + '\n\n' + continuation
    const newWordCount = countChineseWords(newContent)
    
    return {
      success: true,
      content: newContent,
      wordCount: newWordCount,
      action: 'expand',
    }
  } catch (error) {
    return {
      success: false,
      content,
      wordCount: currentWordCount,
      action: 'expand',
      error: error instanceof Error ? error.message : '续写失败',
    }
  }
}

/**
 * 修复连续性问题 - 重写开头部分，保持后文不变
 */
export async function rewriteChapter(params: {
  content: string
  rewriteInstruction: string
  chapterTitle: string
  chapterNo: number
  provider: AIProvider
  /** 上一章结尾原文（用于保持衔接） */
  previousChapterEnding?: string
  /** 章节大纲（用于保持情节一致） */
  chapterOutline?: string
  /** 角色档案（用于保持人物一致） */
  characterProfiles?: string
}): Promise<RepairResult> {
  const { content, rewriteInstruction, chapterTitle, chapterNo, provider } = params
  const currentWordCount = countChineseWords(content)

  const parts: string[] = []

  parts.push('你是小说连贯性修复专家。以下章节存在连续性问题，请根据修复指令重写开头部分，保持后文不变。')
  parts.push('')

  if (params.previousChapterEnding) {
    parts.push('## 上一章结尾（本章开篇应承接此内容）')
    parts.push(params.previousChapterEnding)
    parts.push('')
  }

  parts.push('## 修复指令')
  parts.push(rewriteInstruction)
  parts.push('')

  if (params.chapterOutline) {
    parts.push('## 本章大纲')
    parts.push(params.chapterOutline)
    parts.push('')
  }

  if (params.characterProfiles) {
    parts.push('## 本章出场角色')
    parts.push(params.characterProfiles)
    parts.push('')
  }

  parts.push(`## 章节标题：${chapterTitle}（第${chapterNo}章）`)
  parts.push('')
  parts.push('## 修复要求')
  parts.push('1. 只重写开头部分（前 300-800 字），确保与上一章结尾自然衔接')
  parts.push('2. 处理所有修复指令中提到的连续性问题')
  parts.push('3. 保持后续内容不变，不要删除或修改已有情节')
  parts.push('4. 保持人物姓名、地点、资源的一致性')
  parts.push('5. 确保重写部分与后文自然过渡')
  parts.push('')
  parts.push('## 原文')
  parts.push(content)
  parts.push('')
  parts.push('请输出修复后的完整章节内容，不要添加任何说明。')

  const prompt = parts.join('\n')

  try {
    const result = await provider.generate(prompt, {
      temperature: 0.5,
      maxTokens: Math.ceil(currentWordCount * 2),
    })

    const newContent = result.content.trim()
    const newWordCount = countChineseWords(newContent)

    return {
      success: true,
      content: newContent,
      wordCount: newWordCount,
      action: 'rewrite',
    }
  } catch (error) {
    return {
      success: false,
      content,
      wordCount: currentWordCount,
      action: 'rewrite',
      error: error instanceof Error ? error.message : '连续性修复失败',
    }
  }
}
