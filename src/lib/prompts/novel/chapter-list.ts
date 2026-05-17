/**
 * 章节列表生成提示词
 */
import { TITLE_STYLES } from '../shared/constants'

interface ChapterListGenerationInput {
  projectTitle: string
  genre?: string
  writingStyle?: string
  worldSetting?: string
  protagonistProfile?: string
  protagonistGoal?: string
  antagonistSetting?: string
  endingPlan?: string
  totalChapters: number
  titleStyle: 'webnovel' | 'traditional' | 'poetry'
  outline?: string
  outlineStages?: Record<string, any>
  existingChapters?: Array<{
    chapterNumber: number
    title: string
    summary: string
  }>
}

/**
 * 构建章节列表生成提示词
 */
export function buildChapterListPrompt(input: ChapterListGenerationInput): string {
  const parts: string[] = []
  const hasExistingChapters = input.existingChapters && input.existingChapters.length > 0
  const existingCount = hasExistingChapters ? (input.existingChapters || []).length : 0

  // 【基础信息】
  parts.push(`【基础信息】`)
  parts.push(`标题：${input.projectTitle}`)
  if (input.genre) parts.push(`类型：${input.genre}`)
  if (input.writingStyle) parts.push(`写作风格：${input.writingStyle}`)

  // 【设定】
  if (input.worldSetting) {
    parts.push(`\n【设定 - 世界观】`)
    parts.push(input.worldSetting)
  }

  if (input.protagonistProfile) {
    parts.push(`\n【设定 - 主角人设】`)
    parts.push(input.protagonistProfile)
  }

  if (input.protagonistGoal) {
    parts.push(`\n【设定 - 主角目标】`)
    parts.push(input.protagonistGoal)
  }

  if (input.antagonistSetting) {
    parts.push(`\n【设定 - 反派设定】`)
    parts.push(input.antagonistSetting)
  }

  if (input.endingPlan) {
    parts.push(`\n【设定 - 结局规划】`)
    parts.push(input.endingPlan)
  }

  // 【已有章节】- 如果有已有章节
  if (hasExistingChapters) {
    parts.push(`\n【已有章节】`)
    parts.push(`以下是已经存在的章节，请在此基础上继续生成后续章节：`)
    for (const chapter of input.existingChapters!) {
      parts.push(`- 第${chapter.chapterNumber}章: ${chapter.title}`)
      parts.push(`  概要: ${chapter.summary}`)
    }
  }

  // 【大纲参考】- 如果有大纲，优先参考
  if (input.outlineStages && Object.keys(input.outlineStages).length > 0) {
    parts.push(`\n【大纲参考】`)
    parts.push(`请严格按照以下大纲的阶段规划来生成章节列表：`)
    
    // 处理 outlineStages
    if (input.outlineStages.stages && Array.isArray(input.outlineStages.stages)) {
      // 标准格式，遍历阶段
      for (const stage of input.outlineStages.stages) {
        parts.push(`\n【${stage.name}】`)
        parts.push(`阶段概述：${stage.description}`)
        parts.push(`核心事件：${stage.coreEvents?.join('、')}`)
        parts.push(`章节规划：${stage.chapterPlan}`)
      }
    } else {
      // 其他格式，直接输出 JSON
      parts.push(JSON.stringify(input.outlineStages, null, 2))
    }
  } else if (input.outline) {
    // 如果只有文本大纲
    parts.push(`\n【大纲参考】`)
    parts.push(input.outline)
  }

  // 【任务 - 重要：严格控制章节数量】
  parts.push(`\n【任务 - 重要】`)
  if (hasExistingChapters) {
    // 继续生成模式
    const startChapter = existingCount + 1
    const endChapter = input.totalChapters
    const chaptersToGenerate = endChapter - existingCount
    parts.push(`⚠️ 已有 ${existingCount} 章，你需要继续生成从第 ${startChapter} 章到第 ${endChapter} 章，共 ${chaptersToGenerate} 章！`)
    parts.push(`注意：章节号必须从 ${startChapter} 开始连续编号！`)
    parts.push(`⚠️ 确保新增章节能承接最后一章（第${existingCount}章）的剧情，保持情节连贯性！`)
  } else {
    // 全新生成
    parts.push(`⚠️ 你必须严格生成 EXACTLY ${input.totalChapters} 章，不多也不少！`)
    parts.push(`如果生成超过 ${input.totalChapters} 章或少于 ${input.totalChapters} 章，都将导致任务失败。`)
  }

  // 【网文章节要求】
  parts.push(`\n【网文章节要求】`)
  parts.push(`1. 每个章节需有吸睛标题，能激发读者好奇心`)
  parts.push(`2. 章节之间需有合理的情节推进和连贯性`)
  parts.push(`3. 每章结尾需设置悬念或钩子，吸引继续阅读`)
  if (!hasExistingChapters) {
    parts.push(`4. 前10章为开篇期，需快速建立人设和世界观`)
    parts.push(`5. 中期（${Math.floor(input.totalChapters * 0.4)}-${Math.floor(input.totalChapters * 0.7)}章）需有持续冲突升级`)
    parts.push(`6. 后期（${Math.floor(input.totalChapters * 0.7)}-${input.totalChapters}章）需有重大转折和高潮`)
  }

  // 【标题风格】
  const titleStyleGuide = {
    [TITLE_STYLES.WEBNOVEL]: '网文风格：吸睛、有悬念，例如"第3章 他竟然是隐藏的首富？" 或 "第5章 雨夜中的神秘告白"',
    [TITLE_STYLES.TRADITIONAL]: '传统风格：简洁、概括，例如"第3章 意外的相遇" 或 "第5章 暗流涌动"',
    [TITLE_STYLES.POETRY]: '诗词风格：文艺、对仗、有意境，例如"第3回 风雪夜归人" 或 "第5回 暗香浮动月黄昏"',
  }
  parts.push(`\n【标题风格】${titleStyleGuide[input.titleStyle]}`)

  // 【输出格式 - 必须严格遵守】
  parts.push(`\n【输出格式 - 必须严格遵守】`)
  const outputChapterCount = hasExistingChapters ? (input.totalChapters - existingCount) : input.totalChapters
  const startChapterNumber = hasExistingChapters ? (existingCount + 1) : 1
  const endChapterNumber = input.totalChapters

  parts.push(`⚠️ 重要：你必须输出一个包含 EXACTLY ${outputChapterCount} 个章节的 JSON 数组！`)
  parts.push(`输出格式要求：`)
  parts.push(`{`)
  parts.push(`  "chapters": [`)
  parts.push(`    {`)
  parts.push(`      "chapterNumber": ${startChapterNumber},`)
  parts.push(`      "title": "...",`)
  parts.push(`      "summary": "（必填！50-100字的章节概要，不得省略）",`)
  parts.push(`      "wordCount": 3000,`)
  parts.push(`      "plotType": "setup"`)
  parts.push(`    }`)
  parts.push(`    // ... 必须恰好 ${outputChapterCount} 个章节条目`)
  parts.push(`  ]`)
  parts.push(`}`)
  parts.push(`字段说明：`)
  if (hasExistingChapters) {
    parts.push(`- chapters[].chapterNumber: 必须是从 ${startChapterNumber} 到 ${endChapterNumber} 的连续整数`)
  } else {
    parts.push(`- chapters[].chapterNumber: 必须是从 1 到 ${input.totalChapters} 的连续整数`)
  }
  parts.push(`- chapters[].title: 章节标题`)
  parts.push(`- chapters[].summary: ⚠️ 绝对必填！每个章节都必须有50-100字的概要描述！`)
  parts.push(`  ❌ 严禁出现空字符串""、null、undefined或省略该字段！`)
  parts.push(`  ❌ 严禁只写"待补充"、"暂无"等占位文字！`)
  parts.push(`  ✅ 必须为每个章节写出具体的情节概要，包含主要事件和冲突！`)
  parts.push(`  示例："主角在逃亡中触发银色硬币，被拉入时间裂缝，看到三天前的自己手中握着字条"`)
  parts.push(`- chapters[].wordCount: 预估字数（2000-5000之间）`)
  parts.push(`- chapters[].plotType: 情节类型（setup/develop/climax/resolution/transition）`)

  return parts.join('\n')
}

export function buildSummaryCompletionPrompt(
  chapters: Array<{ chapterNumber: number; title: string; summary?: string }>,
  projectTitle: string,
  genre?: string
): string {
  const parts: string[] = []

  parts.push(`你是一个专业的小说编辑。以下是一部小说的章节列表，其中部分章节缺少概要描述。`)
  parts.push(`请为每个缺少概要的章节补充50-100字的具体情节概要。`)
  parts.push(`概要必须包含该章的主要事件、冲突或悬念，不得使用占位文字。`)
  parts.push(``)
  parts.push(`小说标题：${projectTitle}`)
  if (genre) parts.push(`类型：${genre}`)
  parts.push(``)
  parts.push(`章节列表：`)

  for (const ch of chapters) {
    if (ch.summary && ch.summary.trim()) {
      parts.push(`第${ch.chapterNumber}章 ${ch.title}：${ch.summary}`)
    } else {
      parts.push(`第${ch.chapterNumber}章 ${ch.title}：【缺少概要，需要补充】`)
    }
  }

  parts.push(``)
  parts.push(`请输出JSON格式，为每个缺少概要的章节补充：`)
  parts.push(`{`)
  parts.push(`  "summaries": [`)
  parts.push(`    { "index": 章节在数组中的位置(从0开始), "summary": "该章的概要描述" }`)
  parts.push(`  ]`)
  parts.push(`}`)

  return parts.join('\n')
}

// 类型导出
export type { ChapterListGenerationInput }
