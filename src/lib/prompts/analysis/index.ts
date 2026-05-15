/**
 * 拆书分析提示词
 */
import { AnalysisDimension } from '@/types'

interface PlotAnalysisInput {
  projectTitle: string
  genre?: string
  worldSetting?: string
  powerSystem?: string
  protagonistProfile?: string
  antagonistSetting?: string
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
  const dimensionLabels: Record<AnalysisDimension, string> = {
    [AnalysisDimension.CHARACTER_RELATION]: '人物关系分析',
    [AnalysisDimension.PLOT_LINE]: '剧情线梳理',
    [AnalysisDimension.FORESHADOWING]: '伏笔悬念标记',
    [AnalysisDimension.CHAPTER_STRUCTURE]: '章节结构分析',
    [AnalysisDimension.WORLD_SETTING]: '世界观设定提取',
  }

  // 各维度格式模板
  const formatTemplates: Record<AnalysisDimension, string> = {
    [AnalysisDimension.CHARACTER_RELATION]: `{
  "characters": [
    {
      "name": "角色名",
      "role": "protagonist|antagonist|supporting|minor",
      "description": "角色描述（50-100字）",
      "relationships": [
        { "target": "相关角色", "type": "关系类型如：兄弟/敌对/爱慕", "description": "关系描述" }
      ]
    }
  ],
  "summary": "人物关系整体概述（100-200字）"
}`,
    [AnalysisDimension.PLOT_LINE]: `{
  "mainPlot": [
    { "title": "主线标题", "keyEvents": ["关键事件1", "关键事件2"], "emotionalArc": "情感弧线描述" }
  ],
  "subPlots": [
    { "title": "副线标题", "keyEvents": ["关键事件"], "relationship": "与主线关联" }
  ],
  "timeline": [
    { "event": "事件", "chapter": 章节号, "significance": "重要程度:major|minor" }
  ]
}`,
    [AnalysisDimension.FORESHADOWING]: `{
  "items": [
    {
      "setup": "伏笔内容（首次出现）",
      "description": "伏笔描述（30-50字）",
      "payoff": "回收位置（章节号或待回收）",
      "chapter": 章节号,
      "importance": "major|minor",
      "type": "plot|character|world|prophecy"
    }
  ],
  "unresolved": ["未回收伏笔列表"]
}`,
    [AnalysisDimension.CHAPTER_STRUCTURE]: `{
  "chapters": [
    {
      "number": 1,
      "title": "章节标题",
      "function": "setup|development|climax|resolution|transition",
      "keyEvents": ["关键事件"],
      "wordCount": 字数,
      "emotionalBeat": "本章情感基调"
    }
  ],
  "arcAnalysis": "整体结构分析（200-300字）",
  "pacingAssessment": "节奏评估"
}`,
    [AnalysisDimension.WORLD_SETTING]: `{
  "settings": [
    {
      "name": "设定名称",
      "description": "详细描述（100-200字）",
      "rules": ["规则1", "规则2"],
      "firstAppear": "首次出现章节"
    }
  ],
  "powerSystem": {
    "name": "力量体系名称",
    "levels": ["等级1", "等级2"],
    "rules": ["修炼规则1", "规则2"]
  },
  "locations": [
    { "name": "地名", "description": "描述", "significance": "重要程度" }
  ]
}`,
  }

  parts.push(`\n【输出要求】`)
  parts.push(`请对以上内容进行深度分析，按指定维度输出结构化结果。`)

  for (const dim of dimensions) {
    parts.push(`\n【${dimensionLabels[dim]}】`)
    parts.push('字段说明：')
    parts.push(formatTemplates[dim])
  }

  return parts.join('\n')
}

// 类型导出
export type { PlotAnalysisInput, PlotAnalysisOptions }
