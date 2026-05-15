/**
 * 小说引擎 Agent Prompts
 * 严格按照规格文档规范编写
 */
import type { ChapterOutline } from '../engine/types'

// ============================================
// 策划 Agent Prompt
// ============================================

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
  parts.push(`目标字数：约${Math.floor(input.targetWordCount * 0.8)}-${Math.floor(input.targetWordCount * 1.2)}字`)

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

// ============================================
// 写作 Agent Prompt
// ============================================

interface WriterPromptInput {
  projectTitle: string
  genre?: string | null
  writingStyle?: string | null
  worldSetting?: string | null
  powerSystem?: string | null
  chapterNo: number
  outline: ChapterOutline
  characterProfiles: string
  recentSummaries: string
  targetWordCount: number
}

export function buildWriterPrompt(input: WriterPromptInput): string {
  const parts: string[] = []

  parts.push(`【基础信息】`)
  parts.push(`标题：${input.projectTitle}`)
  if (input.genre) parts.push(`类型：${input.genre}`)
  if (input.writingStyle) parts.push(`写作风格：${input.writingStyle}`)

  if (input.worldSetting) {
    parts.push(`\n【世界观】`)
    parts.push(input.worldSetting)
  }

  if (input.powerSystem) {
    parts.push(`\n【力量体系】`)
    parts.push(input.powerSystem)
  }

  parts.push(`\n【出场角色档案】`)
  parts.push(input.characterProfiles)

  parts.push(`\n【前情摘要（最近3章）】`)
  parts.push(input.recentSummaries)

  parts.push(`\n【章节大纲】`)
  parts.push(JSON.stringify(input.outline, null, 2))

  parts.push(`\n【网文写作要求】`)
  parts.push(`1. 章节开头需设置悬念/钩子，吸引读者继续阅读`)
  parts.push(`2. 内容需有"爽点"或"爆点"，让读者获得情感满足`)
  parts.push(`3. 合理控制节奏：铺垫（20%）→ 发展（50%）→ 高潮（30%）`)
  parts.push(`4. 避免与前文重复的内容和表达，禁止"水字数"`)
  parts.push(`5. 保持人物性格一致性，注意对话的心理动机`)

  parts.push(`\n【任务】`)
  parts.push(`请根据以上大纲写出第${input.chapterNo}章正文。`)
  parts.push(`字数要求：${Math.floor(input.targetWordCount * 0.8)}-${Math.floor(input.targetWordCount * 1.2)}字`)
  parts.push(`输出格式：纯 Markdown 正文，不加任何 JSON 包装。`)

  return parts.join('\n')
}

// ============================================
// 润色 Agent Prompt
// ============================================

interface PolisherPromptInput {
  chapterNo: number
  content: string
  styleGuide?: string | null
}

export function buildPolisherPrompt(input: PolisherPromptInput): string {
  const parts: string[] = []

  parts.push(`你是一位文字编辑，专注于文风统一和语言优化。`)
  parts.push(`核心约束：不得改动任何情节、人名、时间线，只调整遣词造句。`)

  if (input.styleGuide) {
    parts.push(`\n【风格参考】`)
    parts.push(input.styleGuide)
    parts.push(`请严格按照上述风格进行润色。`)
  }

  parts.push(`\n【待润色内容】`)
  parts.push(input.content)

  parts.push(`\n【任务】`)
  parts.push(`请对以上内容进行润色优化，直接输出优化后的正文，不加任何说明。`)

  return parts.join('\n')
}

// ============================================
// 校验 Agent Prompt
// ============================================

interface ValidatorPromptInput {
  chapterNo: number
  newChapterContent: string
  characterProfiles: string
  recentSummaries: string
  worldSetting?: string | null
  openPlotlines: string
}

export function buildValidatorPrompt(input: ValidatorPromptInput): string {
  const parts: string[] = []

  parts.push(`你是一位严格的小说编辑，专门检查前后矛盾。`)
  parts.push(`检查维度：角色性格/外貌/能力、时间线、地理位置、伏笔状态、世界观规则`)

  if (input.worldSetting) {
    parts.push(`\n【世界观规则】`)
    parts.push(input.worldSetting)
  }

  parts.push(`\n【角色档案】`)
  parts.push(input.characterProfiles)

  parts.push(`\n【前情摘要】`)
  parts.push(input.recentSummaries)

  parts.push(`\n【进行中的伏笔】`)
  parts.push(input.openPlotlines)

  parts.push(`\n【待校验章节内容】`)
  parts.push(input.newChapterContent)

  parts.push(`\n【输出格式】`)
  parts.push(`请以严格 JSON 格式输出，字段说明：`)
  parts.push(`- result: "pass" | "retry", 校验结果`)
  parts.push(`- score: number (0-100), 一致性评分`)
  parts.push(`- issues: array, 发现的问题列表，每个问题包含 {type, description, location, reference}`)
  parts.push(`- characterUpdates: object, 需要更新角色档案的字段`)
  parts.push(`- newPlotlines: array, 新发现的伏笔描述`)
  parts.push(`- resolvedPlotlines: array, 确认回收的伏笔ID`)

  return parts.join('\n')
}

// ============================================
// 摘要 Agent Prompt
// ============================================

interface SummarizerPromptInput {
  chapterNo: number
  chapterTitle: string
  chapterContent: string
  worldSetting?: string | null
  protagonistProfile?: string | null
}

export function buildSummarizerPrompt(input: SummarizerPromptInput): string {
  const parts: string[] = []

  parts.push(`你是一位小说策划编辑，负责生成章节摘要。`)

  parts.push(`\n【章节信息】`)
  parts.push(`第${input.chapterNo}章 "${input.chapterTitle}"`)

  if (input.worldSetting) {
    parts.push(`\n【世界观】`)
    parts.push(input.worldSetting)
  }

  if (input.protagonistProfile) {
    parts.push(`\n【主角人设】`)
    parts.push(input.protagonistProfile)
  }

  parts.push(`\n【章节内容】`)
  parts.push(input.chapterContent.slice(0, 5000))  // 限制内容长度

  parts.push(`\n【任务】`)
  parts.push(`请生成本章摘要（200-300字），包含：`)
  parts.push(`1. 本章核心事件`)
  parts.push(`2. 关键场景`)
  parts.push(`3. 情感基调`)
  parts.push(`4. 埋下的伏笔`)
  parts.push(`5. 回收的伏笔`)

  parts.push(`\n【输出格式】`)
  parts.push(`请以严格 JSON 格式输出：`)
  parts.push(`- summary: string, 摘要正文（200-300字）`)
  parts.push(`- keyEvents: string[], 关键事件列表（3-5个）`)
  parts.push(`- emotionalTone: string, 情感基调（如：紧张、温馨、悲伤）`)
  parts.push(`- plantedPlotlines: string[], 埋下的伏笔描述`)
  parts.push(`- resolvedPlotlines: string[], 回收的伏笔ID`)

  return parts.join('\n')
}
