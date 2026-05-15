/**
 * 策划 Agent Prompt - 生成章节大纲
 */
import { CHAPTER_WORD_COUNT, CHAPTER_PACING } from '../shared/constants'

interface PlannerPromptInput {
  projectTitle: string
  genre?: string | null
  writingStyle?: string | null
  worldSetting?: string | null
  powerSystem?: string | null
  protagonistProfile?: string | null
  antagonistSetting?: string | null
  chapterNo: number
  recentChapterSummaries: { chapterNo: number; summary: string }[]
  openPlotlines: { id: string; description: string }[]
  emotionalArc: { chapterNo: number; value: number }[]
  targetWordCount: number
}

export function buildPlannerPrompt(input: PlannerPromptInput): string {
  const parts: string[] = []

  parts.push(`【基础信息】`)
  parts.push(`标题：${input.projectTitle}`)
  if (input.genre) parts.push(`类型：${input.genre}`)
  if (input.writingStyle) parts.push(`写作风格：${input.writingStyle}`)

  if (input.worldSetting) {
    parts.push(`\n【设定 - 世界观】`)
    parts.push(input.worldSetting)
  }

  if (input.powerSystem) {
    parts.push(`\n【设定 - 力量体系】`)
    parts.push(input.powerSystem)
  }

  if (input.protagonistProfile) {
    parts.push(`\n【设定 - 主角人设】`)
    parts.push(input.protagonistProfile)
  }

  if (input.antagonistSetting) {
    parts.push(`\n【设定 - 反派设定】`)
    parts.push(input.antagonistSetting)
  }

  if (input.recentChapterSummaries.length > 0) {
    parts.push(`\n【前情摘要】`)
    for (const ch of input.recentChapterSummaries) {
      parts.push(`第${ch.chapterNo}章：${ch.summary}`)
    }
  }

  if (input.openPlotlines.length > 0) {
    parts.push(`\n【进行中的伏笔】`)
    for (const pl of input.openPlotlines) {
      parts.push(`- ${pl.description}`)
    }
  }

  if (input.emotionalArc.length > 0) {
    parts.push(`\n【情绪热度曲线】`)
    parts.push(`（最近5章热度值：${input.emotionalArc.slice(-5).map(p => p.value).join(' → ')}）`)
    const currentHeat = input.emotionalArc[input.emotionalArc.length - 1]?.value || 50
    if (currentHeat < 30) {
      parts.push(`当前情绪偏低，本章适合升温或设置新冲突`)
    } else if (currentHeat > 70) {
      parts.push(`当前情绪偏高，本章适合高潮延续或短暂缓冲`)
    } else {
      parts.push(`当前情绪平稳，本章适合推进主线冲突`)
    }
  }

  parts.push(`\n【任务】`)
  parts.push(`请为第${input.chapterNo}章生成章节大纲。`)
  parts.push(`目标字数：约${Math.floor(input.targetWordCount * (1 - CHAPTER_WORD_COUNT.TOLERANCE))}-${Math.floor(input.targetWordCount * (1 + CHAPTER_WORD_COUNT.TOLERANCE))}字`)

  parts.push(`\n【输出格式】`)
  parts.push(`请以严格 JSON 格式输出，字段说明：`)
  parts.push(`- chapterTitle: string, 章节标题`)
  parts.push(`- chapterGoal: string, 本章目标（一句话）`)
  parts.push(`- mainConflict: string, 主要冲突`)
  parts.push(`- keyScenes: array, 2-4个关键场景，每个场景包含 {scene, characters, emotion}`)
  parts.push(`- ending: string, 章节结局（留悬念/解决/转折）`)
  parts.push(`- foreshadows: array, 本章新埋伏笔描述数组`)
  parts.push(`- resolvedPlotlines: array, 本章回收的伏笔ID数组`)

  return parts.join('\n')
}

// 类型导出
export type { PlannerPromptInput }
