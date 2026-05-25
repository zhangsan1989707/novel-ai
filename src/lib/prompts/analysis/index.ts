/**
 * 拆书分析提示词
 */
import { AnalysisDimension } from '@/types'
import { ANALYSIS_DIMENSION_LABELS, ANALYSIS_FORMAT_TEMPLATES } from '@/lib/analysis/config'

interface PlotAnalysisInput {
  projectTitle: string
  genre?: string
  worldSetting?: string
  powerSystem?: string
  protagonistProfile?: string
  antagonistSetting?: string
  memoryContext?: string
  previousChapters?: { chapterNumber: number; title: string; content: string }[]
}

interface PlotAnalysisOptions {
  dimensions: AnalysisDimension[]
  volumeNumber: number
  contextChapterCount: number
  isFullBookAnalysis?: boolean
}

/**
 * 构建拆书分析提示词
 */
export function buildPlotAnalysisPrompt(
  context: PlotAnalysisInput,
  options: PlotAnalysisOptions
): string {
  const parts: string[] = []
  const { dimensions, volumeNumber, contextChapterCount } = options

  // 【基础信息】
  parts.push(`【基础信息】`)
  if (volumeNumber === -1) {
    parts.push(`分析范围：整书分析`)
  } else if (volumeNumber === 0) {
    parts.push(`分析范围：全卷分析`)
  } else {
    parts.push(`分析范围：第${volumeNumber}卷分析`)
  }
  parts.push(`标题：${context.projectTitle}`)
  if (context.genre) parts.push(`类型：${context.genre}`)

  // 【设定】
  if (context.worldSetting) {
    parts.push(`\n【设定 - 世界观】`)
    parts.push(context.worldSetting)
  }
  if (context.powerSystem) {
    parts.push(`\n【设定 - 力量体系】`)
    parts.push(context.powerSystem)
  }
  if (context.protagonistProfile) {
    parts.push(`\n【设定 - 主角人设】`)
    parts.push(context.protagonistProfile)
  }
  if (context.antagonistSetting) {
    parts.push(`\n【设定 - 反派设定】`)
    parts.push(context.antagonistSetting)
  }

  if (context.memoryContext) {
    parts.push(`\n【记忆编排上下文】`)
    parts.push(context.memoryContext)
  }

  // 【待分析内容】
  if (context.previousChapters && context.previousChapters.length > 0) {
    parts.push(`\n【待分析内容】`)
    const relevantChapters = options.isFullBookAnalysis
      ? context.previousChapters
      : context.previousChapters.slice(-contextChapterCount)
    for (const chapter of relevantChapters) {
      parts.push(`\n--- 第${chapter.chapterNumber}章 "${chapter.title}" ---`)
      parts.push(chapter.content)
    }
  }

  // 【输出要求 - 每个维度独立输出】
  parts.push(`\n【输出要求】`)
  parts.push(`请对以上内容进行深度分析，按指定维度输出结构化结果。`)

  for (const dim of dimensions) {
    parts.push(`\n【${ANALYSIS_DIMENSION_LABELS[dim]}】`)
    parts.push('字段说明：')
    parts.push(ANALYSIS_FORMAT_TEMPLATES[dim])
  }

  return parts.join('\n')
}

// 类型导出
export type { PlotAnalysisInput, PlotAnalysisOptions }
