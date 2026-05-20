/**
 * 智能上下文压缩系统
 * 为超长篇小说提供高效的上下文管理
 */
import { AIService } from '@/lib/ai/service'

interface CompressionConfig {
  maxTokens: number
  preserveRecentChapters: number
  preserveKeyEvents: boolean
  preserveCharacterStates: boolean
  compressionRatio: number
}

interface ContextSegment {
  type: 'chapter' | 'summary' | 'character' | 'plotline' | 'setting'
  content: string
  importance: 'critical' | 'high' | 'medium' | 'low'
  chapterNo?: number
  metadata?: Record<string, unknown>
}

interface CompressedContext {
  segments: ContextSegment[]
  totalTokens: number
  compressionRatio: number
  preservedInfo: {
    recentChapterCount: number
    summaryChapterCount: number
    characterCount: number
    activePlotlineCount: number
  }
}

const DEFAULT_CONFIG: CompressionConfig = {
  maxTokens: 8000,
  preserveRecentChapters: 3,
  preserveKeyEvents: true,
  preserveCharacterStates: true,
  compressionRatio: 0.6,
}

/**
 * 分析上下文的重要性
 */
function analyzeImportance(
  segment: ContextSegment,
  currentChapter: number
): number {
  let score = 0

  switch (segment.type) {
    case 'chapter':
      const chaptersAgo = currentChapter - (segment.chapterNo || 0)
      if (chaptersAgo <= 3) score += 100
      else if (chaptersAgo <= 10) score += 80 - chaptersAgo * 5
      else score += Math.max(20, 50 - chaptersAgo * 2)
      break
    case 'character':
      score += segment.importance === 'critical' ? 90 : segment.importance === 'high' ? 70 : 50
      break
    case 'plotline':
      score += segment.importance === 'critical' ? 95 : segment.importance === 'high' ? 75 : 55
      break
    case 'summary':
      score += 60
      break
    case 'setting':
      score += 40
      break
  }

  return score
}

/**
 * 智能上下文压缩
 */
export async function compressContext(
  context: {
    recentChapters: Array<{
      chapterNo: number
      content: string
      keyEvents: string[]
    }>
    chapterSummaries: Array<{
      chapterNo: number
      summary: string
      keyEvents: string[]
    }>
    characters: Array<{
      name: string
      currentState: string
      recentActions: string[]
    }>
    activePlotlines: Array<{
      id: string
      description: string
      status: string
      plantedAtChapter: number
    }>
    worldSettings: string[]
  },
  currentChapter: number,
  config: Partial<CompressionConfig> = {}
): Promise<CompressedContext> {
  const cfg = { ...DEFAULT_CONFIG, ...config }
  const segments: ContextSegment[] = []

  // 1. 保留最近的章节（原文）
  const recentChapterContent = context.recentChapters
    .filter(ch => ch.chapterNo > currentChapter - cfg.preserveRecentChapters)
    .sort((a, b) => a.chapterNo - b.chapterNo)

  for (const chapter of recentChapterContent) {
    segments.push({
      type: 'chapter',
      content: `【第${chapter.chapterNo}章】\n${chapter.content}`,
      importance: 'critical',
      chapterNo: chapter.chapterNo,
      metadata: { keyEvents: chapter.keyEvents },
    })
  }

  // 2. 早期章节用摘要
  const olderChapters = context.chapterSummaries.filter(
    ch => ch.chapterNo < currentChapter - cfg.preserveRecentChapters
  )

  // 按重要性排序，选择最重要的
  const sortedOlderChapters = olderChapters
    .map(ch => ({
      ...ch,
      importance: analyzeImportance({ type: 'summary', chapterNo: ch.chapterNo } as ContextSegment, currentChapter),
    }))
    .sort((a, b) => b.importance - a.importance)

  // 计算可用空间
  const currentTokens = segments.reduce((sum, s) => sum + s.content.length / 4, 0)
  const maxOlderChapterTokens = (cfg.maxTokens - currentTokens) * cfg.compressionRatio

  let olderChapterTokens = 0
  for (const chapter of sortedOlderChapters) {
    const chapterTokens = chapter.summary.length / 4
    if (olderChapterTokens + chapterTokens > maxOlderChapterTokens) break

    segments.push({
      type: 'summary',
      content: `【第${chapter.chapterNo}章摘要】${chapter.summary}${chapter.keyEvents.length > 0 ? '\n关键事件：' + chapter.keyEvents.join('；') : ''}`,
      importance: 'high',
      chapterNo: chapter.chapterNo,
    })
    olderChapterTokens += chapterTokens
  }

  // 3. 角色状态
  if (cfg.preserveCharacterStates) {
    const characterSummary = context.characters
      .map(c => `${c.name}：${c.currentState}`)
      .join('\n')

    if (characterSummary.length > 0) {
      segments.push({
        type: 'character',
        content: `【当前角色状态】\n${characterSummary}`,
        importance: 'high',
        metadata: { characterCount: context.characters.length },
      })
    }
  }

  // 4. 活跃剧情线
  if (cfg.preserveKeyEvents) {
    const activePlotlines = context.activePlotlines
      .filter(p => p.status === 'active' || p.status === 'developing')
      .map(p => `[伏笔#${p.id}] ${p.description}`)
      .join('\n')

    if (activePlotlines.length > 0) {
      segments.push({
        type: 'plotline',
        content: `【进行中的剧情线】\n${activePlotlines}`,
        importance: 'critical',
        metadata: { plotlineCount: context.activePlotlines.length },
      })
    }
  }

  // 5. 世界设定（精简版）
  if (context.worldSettings.length > 0) {
    const settingsSummary = context.worldSettings.slice(0, 3).join('\n')
    segments.push({
      type: 'setting',
      content: `【重要世界观设定】\n${settingsSummary}`,
      importance: 'medium',
    })
  }

  // 计算总 token 数
  const totalTokens = segments.reduce((sum, s) => sum + s.content.length / 4, 0)

  return {
    segments,
    totalTokens: Math.round(totalTokens),
    compressionRatio: totalTokens > 0 ? (cfg.maxTokens - totalTokens) / cfg.maxTokens : 0,
    preservedInfo: {
      recentChapterCount: recentChapterContent.length,
      summaryChapterCount: segments.filter(s => s.type === 'summary').length,
      characterCount: context.characters.length,
      activePlotlineCount: context.activePlotlines.length,
    },
  }
}

/**
 * 生成章节关联性摘要
 */
export async function generateChapterCorrelation(
  projectId: number,
  chapterNo: number,
  targetChapter: number
): Promise<string> {
  const provider = await AIService.createProvider({
    projectId,
    usageType: 'WRITER',
  })

  const prompt = `你是章节关联分析专家，分析第${chapterNo}章和第${targetChapter}章之间的关联性。

## 任务
1. 识别两章之间的情节关联
2. 指出需要衔接的内容
3. 提供过渡建议

## 输出要求
请简洁输出两章之间的关联分析和过渡建议，控制在200字以内。`

  const result = await provider.generate(prompt, {
    temperature: 0.3,
    maxTokens: 500,
  })

  return result.content
}

/**
 * 智能章节分组
 * 用于长篇小说的卷/部划分
 */
export function groupChaptersByArc(
  chapters: Array<{ chapterNo: number; summary: string; keyEvents: string[] }>,
  chaptersPerArc: number = 25
): Array<{
  arcNo: number
  startChapter: number
  endChapter: number
  chapters: Array<{ chapterNo: number; summary: string }>
  arcSummary: string
}> {
  const arcs: Array<{
    arcNo: number
    startChapter: number
    endChapter: number
    chapters: Array<{ chapterNo: number; summary: string }>
    arcSummary: string
  }> = []

  for (let i = 0; i < chapters.length; i += chaptersPerArc) {
    const arcChapters = chapters.slice(i, i + chaptersPerArc)
    const arcSummary = arcChapters.length > 0
      ? arcChapters[0].summary
      : ''

    arcs.push({
      arcNo: arcs.length + 1,
      startChapter: arcChapters[0]?.chapterNo || 0,
      endChapter: arcChapters[arcChapters.length - 1]?.chapterNo || 0,
      chapters: arcChapters.map(ch => ({
        chapterNo: ch.chapterNo,
        summary: ch.summary,
      })),
      arcSummary,
    })
  }

  return arcs
}

export type { CompressionConfig, ContextSegment, CompressedContext }
