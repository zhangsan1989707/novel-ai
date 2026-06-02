import { AIService } from '@/lib/ai/service'
import type { AIProvider } from '@/lib/ai/types'
import { scanForbiddenWords, scanForbiddenPatterns, scanWordsByLevel, getAntiAiPrompt, type ForbiddenWord } from '@/lib/knowledge/anti-ai'
import { buildChapterDeslopPrompt } from '@/lib/prompts/deslop'
import { normalizeChapterContentForUser } from '@/lib/chapter-content-normalizer'

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
  provider?: AIProvider
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
 * 尝试把常见的 malformed JSON（例如 revisedContent 中含有未转义换行）修成可解析格式
 */
function tryRepairMalformedJsonObject(source: string): string | null {
  const revisedMatch = source.match(/"revisedContent"\s*:\s*"([\s\S]*?)"/)
  if (!revisedMatch || revisedMatch.index === undefined) return null

  const rawBody = revisedMatch[1]
  const escapedBody = rawBody.replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/\t/g, '\\t')
  const repaired = source.slice(0, revisedMatch.index) + '"revisedContent": "' + escapedBody + '"' + source.slice(revisedMatch.index + revisedMatch[0].length)

  try {
    JSON.parse(repaired)
    return repaired
  } catch {
    return null
  }
}

/**
 * 从模型返回内容中提取 deslop JSON 负载
 */
function extractDeslopPayload(raw: string): { revisedContent?: string; changes: DeslopChange[] } | null {
  const trimmed = raw.trim()

  const fenceMatch = trimmed.match(/^```(?:json)?\s*\n([\s\S]*?)\n?```\s*$/)
  const candidateSource = fenceMatch ? fenceMatch[1].trim() : trimmed

  const repairedCandidate = tryRepairMalformedJsonObject(candidateSource)
  const candidates = [
    candidateSource,
    ...Array.from(candidateSource.matchAll(/\{[\s\S]*?\}/g)).map(m => m[0]),
    ...(repairedCandidate ? [repairedCandidate] : []),
  ].filter(Boolean)

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate) as {
        revisedContent?: unknown
        changes?: unknown
      }

      const revisedContent = typeof parsed.revisedContent === 'string' ? parsed.revisedContent.trim() : undefined
      const changes = Array.isArray(parsed.changes)
        ? parsed.changes.filter(
            (c): c is DeslopChange =>
              typeof c === 'object' &&
              c !== null &&
              'type' in c &&
              'original' in c &&
              'revised' in c &&
              'reason' in c &&
              ['word', 'pattern', 'structure', 'rhythm', 'immersive'].includes((c as DeslopChange).type),
          )
        : []

      if (revisedContent || changes.length) {
        return { revisedContent, changes }
      }
    } catch {
      continue
    }
  }

  return null
}

/**
 * 章节去AI味处理
 */
export async function chapterDeslopper(input: ChapterDeslopInput): Promise<ChapterDeslopResult> {
  const startTime = Date.now()
  const { projectId, chapterId, content, chapterNumber, chapterTitle, genre, writingStyle, strictness = 'medium' } = input

  // 记录原始评分
  const originalScore = quickScore(content)

  // 扫描检测到的问题
  const wordScan = scanForbiddenWords(content)
  const patternScan = scanForbiddenPatterns(content)
  const detectedIssues = {
    forbiddenWords: wordScan.map(r => ({ word: r.word.word, count: r.count })),
    forbiddenPatterns: patternScan.map(r => ({ pattern: r.pattern.pattern, matches: r.matches })),
  }

  // 获取项目信息构建上下文
  const provider = input.provider || await AIService.createProvider({
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
    detectedIssues,
  })

  // 调用AI进行改写
  const result = await provider.generate(prompt, {
    temperature: 0.7,
    maxTokens: Math.min(4096, Math.max(2000, Math.ceil(content.length * 0.6))),
  })

  // 解析结果
  let revisedContent = content
  let changes: DeslopChange[] = []

  const parsedPayload = extractDeslopPayload(result.content)
  if (parsedPayload) {
    if (parsedPayload.revisedContent) {
      revisedContent = normalizeChapterContentForUser(parsedPayload.revisedContent)
    }
    changes = parsedPayload.changes
  } else {
    revisedContent = normalizeChapterContentForUser(result.content)
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
