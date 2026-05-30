/**
 * 章节修复模块 - 处理字数不足/过多的情况
 */
import type { AIProvider } from '@/lib/ai/types'
import { countChineseWords } from '@/lib/utils'

export interface RepairResult {
  success: boolean
  content: string
  wordCount: number
  action: 'expand' | 'compress' | 'none'
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
}): Promise<RepairResult> {
  const { content, targetWordCount, currentWordCount, chapterTitle, chapterNo, provider } = params
  
  const needWords = targetWordCount - currentWordCount
  if (needWords <= 0) {
    return { success: true, content, wordCount: currentWordCount, action: 'none' }
  }

  // 取最后 500 字作为上下文
  const lastContext = content.slice(-500)

  const prompt = `你是小说续写专家。以下章节被截断了，请继续完成。

章节标题：${chapterTitle}（第${chapterNo}章）
当前字数：${currentWordCount}
目标字数：${targetWordCount}

续写要求：
1. 从截断处继续，保持情节连贯
2. 完成当前场景或情节
3. 确保章节有完整的结尾
4. 保持原文风格和语气

截断位置（最后 500 字）：
${lastContext}

请从截断处继续写，输出续写内容（不需要重复已有内容）。`

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
