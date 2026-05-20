import type { PromptContext } from './types'
import type { ProjectDTO, ChapterDTO } from '@/types/dto'

/**
 * 根据章节号计算所属卷阶段
 */
export function calculateStage(chapterNumber: number, totalVolumes: number = 4): number {
  // 假设总共约 100 章，每卷约 25 章
  const chaptersPerVolume = Math.ceil(100 / totalVolumes)
  return Math.min(totalVolumes, Math.ceil(chapterNumber / chaptersPerVolume))
}

/**
 * 根据卷号计算章节范围
 */
export function getVolumeChapterRange(
  volumeNumber: number,
  totalVolumes: number,
  totalChapters: number
): { start: number; end: number } {
  if (volumeNumber < 1 || volumeNumber > totalVolumes) {
    return { start: 1, end: totalChapters }
  }
  const chaptersPerVolume = Math.ceil(totalChapters / totalVolumes)
  return {
    start: (volumeNumber - 1) * chaptersPerVolume + 1,
    end: Math.min(volumeNumber * chaptersPerVolume, totalChapters),
  }
}

/**
 * 获取阶段名称
 */
export function getStageName(stage: number): string {
  const stageNames: Record<number, string> = {
    1: '开篇阶段（第1卷）',
    2: '发展阶段（第2卷）',
    3: '中期阶段（第3卷）',
    4: '结局阶段（第4卷）',
  }
  return stageNames[stage] || `第${stage}卷`
}

/**
 * 获取阶段的章节范围
 */
export function getStageChapterRange(
  stage: number,
  totalVolumes: number = 4,
  totalChapters: number = 100
): { start: number; end: number } {
  const chaptersPerVolume = Math.ceil(totalChapters / totalVolumes)
  return {
    start: (stage - 1) * chaptersPerVolume + 1,
    end: Math.min(stage * chaptersPerVolume, totalChapters),
  }
}

/**
 * 从项目和大纲中提取阶段大纲
 */
interface OutlineStageItem {
  title: string
  summary: string
}

interface OutlineStageNewItem {
  name: string
  description?: string
  coreEvents?: string[]
  chapterRatio?: number
  chapterPlan?: string
}

type OutlineStages = Record<string, OutlineStageItem[]> & {
  stages?: OutlineStageNewItem[]
}

export function extractStageOutline(
  outlineStages: OutlineStages | null | undefined,
  stage: number
): string | undefined {
  if (!outlineStages) return undefined

  if (outlineStages.stages && Array.isArray(outlineStages.stages)) {
    const stageData = outlineStages.stages[stage - 1]
    if (!stageData) return undefined
    const parts: string[] = []
    parts.push(`${stageData.name}：${stageData.description || ''}`)
    if (stageData.coreEvents && stageData.coreEvents.length > 0) {
      parts.push(`核心事件：${stageData.coreEvents.join('、')}`)
    }
    if (stageData.chapterPlan) {
      parts.push(`章节规划：${stageData.chapterPlan}`)
    }
    return parts.join('\n')
  }

  const stageKey = `stage${stage}`
  const stageData = outlineStages[stageKey]

  if (!stageData || !Array.isArray(stageData)) return undefined

  return stageData
    .map((item, index) => `${index + 1}. ${item.title}：${item.summary}`)
    .join('\n')
}

/**
 * 构建提示词上下文
 */
export async function buildPromptContext(
  project: ProjectDTO,
  currentChapter: ChapterDTO,
  previousChapters: ChapterDTO[],
  options: {
    useContext: boolean
    contextChapterCount: number
    includeStageOutline: boolean
    maxCharsPerChapter?: number
    memoryContext?: string
  }
): Promise<PromptContext> {
  const maxCharsPerChapter = options.maxCharsPerChapter || 600
  const contextChapterCount = currentChapter.chapterNumber <= 3
    ? 1
    : Math.max(1, Math.min(options.contextChapterCount, 2))

  // 处理前文 - 正确地取章节开头部分，确保上下文连贯
  const processedPreviousChapters = options.useContext
    ? previousChapters
        .filter((ch) => ch.content && ch.status === 'COMPLETED')
        .slice(-contextChapterCount) // 取最后 N 章
        .map((ch) => ({
          chapterNumber: ch.chapterNumber,
          title: ch.title,
          content: ch.content?.slice(0, maxCharsPerChapter) || '', // 正确：取章节开头部分
        }))
    : []

  // 计算当前阶段
  const currentStage = calculateStage(currentChapter.chapterNumber, project.totalVolumes)

  // 获取阶段大纲
  let stageOutline: string | undefined
  if (options.includeStageOutline) {
    stageOutline = extractStageOutline(project.outlineStages as OutlineStages | null | undefined, currentStage)
  }

  // 处理虚拟作家风格
  let virtualWriterStyle: PromptContext['virtualWriterStyle']
  if (currentChapter.virtualWriter) {
    const writer = currentChapter.virtualWriter
    virtualWriterStyle = {
      styleFeatures: writer.styleFeatures || undefined,
      vocabularyFeatures: writer.vocabularyFeatures || undefined,
      sentenceFeatures: writer.sentenceFeatures || undefined,
      rhetoricFeatures: writer.rhetoricFeatures || undefined,
      themeFeatures: writer.themeFeatures || undefined,
    }
  }

  return {
    projectTitle: project.title,
    genre: project.genre || undefined,
    writingStyle: project.writingStyle || undefined,
    worldSetting: project.worldSetting || undefined,
    powerSystem: project.powerSystem || undefined,
    protagonistProfile: project.protagonistProfile || undefined,
    protagonistGoal: project.protagonistGoal || undefined,
    antagonistSetting: project.antagonistSetting || undefined,
    endingPlan: project.endingPlan || undefined,
    writingPrompt: project.writingPrompt || undefined,
    currentChapterNumber: currentChapter.chapterNumber,
    currentChapterTitle: currentChapter.title,
    currentChapterSummary: currentChapter.summary || undefined,
    memoryContext: options.memoryContext,
    previousChapters: processedPreviousChapters.length > 0 ? processedPreviousChapters : undefined,
    stageOutline,
    virtualWriterStyle,
  }
}

/**
 * 获取上下文摘要（用于调试）
 */
export function getContextSummary(context: PromptContext): string {
  const parts: string[] = []

  parts.push(`项目：${context.projectTitle}`)
  parts.push(`当前章节：第${context.currentChapterNumber}章 "${context.currentChapterTitle}"`)

  if (context.previousChapters && context.previousChapters.length > 0) {
    parts.push(`前文章节数：${context.previousChapters.length}`)
  }

  if (context.stageOutline) {
    parts.push(`阶段大纲：已设置`)
  }

  if (context.virtualWriterStyle) {
    parts.push(`虚拟作家风格：已设置`)
  }

  return parts.join(' | ')
}
