import { AIService } from '@/lib/ai/service'
import { scanForbiddenWords, scanForbiddenPatterns, scanWordsByLevel, getAntiAiPrompt, type ForbiddenWord } from '@/lib/knowledge/anti-ai'
import { buildChapterDeslopPrompt } from '@/lib/prompts/deslop'

interface ChapterDeslopInput {
  projectId: number
  chapterId: number
  content: string
  chapterNumber?: number
  chapterTitle?: string
  genre?: string | null
  writingStyle?: string | null
  strictness?: 'light' | 'medium' | 'heavy'
  autoOptimize?: boolean
}

interface DeslopChange {
  type: 'word' | 'pattern' | 'structure' | 'rhythm' | 'immersive'
  original: string
  revised: string
  reason: string
  position?: { start: number; end: number }
}

interface ChapterDeslopResult {
  chapterId: number
  originalContent: string
  revisedContent: string
  changes: DeslopChange[]
  originalScore: number
  revisedScore: number
  improvement: number
  tokens?: number
  duration?: number
  autoApplied?: boolean
}

// 快速评分计算
export function quickScore(content: string): number {
  const wordScan = scanForbiddenWords(content)
  const patternScan = scanForbiddenPatterns(content)
  
  let score = 100
  for (const w of wordScan) {
    score -= w.word.level === 'critical' ? 5 : w.word.level === 'warning' ? 2 : 0.5
  }
  for (const p of patternScan) {
    score -= p.severity * 8
  }
  
  return Math.max(0, Math.min(100, Math.round(score)))
}

export type { ChapterDeslopInput as DeslopInput, ChapterDeslopResult as DeslopResult, DeslopChange }

/**
 * 章节去AI味处理
 */
export async function chapterDeslopper(input: ChapterDeslopInput): Promise<ChapterDeslopResult> {
  const startTime = Date.now()
  const { projectId, chapterId, content, chapterNumber, chapterTitle, genre, writingStyle, strictness = 'medium' } = input

  // 记录原始评分
  const originalScore = quickScore(content)

  // 获取项目信息构建上下文
  const provider = await AIService.createProvider({
    projectId,
    usageType: 'DESLOPPER',
  })

  // 构建增强的提示词
  const prompt = buildChapterDeslopPrompt({
    content,
    chapterNumber,
    chapterTitle,
    genre,
    writingStyle,
    strictness,
  })

  // 调用AI进行改写
  const result = await provider.generate(prompt, {
    temperature: 0.7,
    maxTokens: Math.max(4000, content.length * 2),
  })

  // 解析结果
  let revisedContent = content
  let changes: DeslopChange[] = []

  const jsonMatch = result.content.match(/\{[\s\S]*\}/)
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0])
      if (typeof parsed.revisedContent === 'string') {
        revisedContent = parsed.revisedContent
      }
      if (Array.isArray(parsed.changes)) {
        changes = parsed.changes.filter(
          (c: DeslopChange) =>
            c.type && c.original && c.revised && c.reason &&
            ['word', 'pattern', 'structure', 'rhythm', 'immersive'].includes(c.type)
        )
      }
    } catch {
      // 解析失败，尝试直接使用返回内容
      revisedContent = result.content
    }
  } else {
    revisedContent = result.content
  }

  // 计算改进后的评分
  const revisedScore = quickScore(revisedContent)
  const improvement = revisedScore - originalScore
  const duration = Date.now() - startTime

  return {
    chapterId,
    originalContent: content,
    revisedContent,
    changes,
    originalScore,
    revisedScore,
    improvement,
    tokens: result.totalTokens,
    duration,
  }
}

/**
 * 批量章节去AI味
 */
export async function batchChapterDeslopper(
  chapters: Array<{
    chapterId: number
    chapterNumber?: number
    chapterTitle?: string
    content: string
  }>,
  projectId: number,
  options: {
    genre?: string | null
    writingStyle?: string | null
    strictness?: 'light' | 'medium' | 'heavy'
    onProgress?: (current: number, total: number, chapterId: number) => void
  }
): Promise<Array<ChapterDeslopResult & { success: boolean; error?: string }>> {
  const results: Array<ChapterDeslopResult & { success: boolean; error?: string }> = []
  const total = chapters.length

  for (let i = 0; i < chapters.length; i++) {
    const chapter = chapters[i]
    options.onProgress?.(i + 1, total, chapter.chapterId)

    try {
      const result = await chapterDeslopper({
        projectId,
        chapterId: chapter.chapterId,
        content: chapter.content,
        chapterNumber: chapter.chapterNumber,
        chapterTitle: chapter.chapterTitle,
        genre: options.genre,
        writingStyle: options.writingStyle,
        strictness: options.strictness,
      })
      results.push({ ...result, success: true })
    } catch (err) {
      results.push({
        chapterId: chapter.chapterId,
        originalContent: chapter.content,
        revisedContent: chapter.content,
        changes: [],
        originalScore: 0,
        revisedScore: 0,
        improvement: 0,
        success: false,
        error: err instanceof Error ? err.message : '未知错误',
      })
    }
  }

  return results
}

// 别名导出，供 adapters.ts 使用
export const deslopperAgent = chapterDeslopper
