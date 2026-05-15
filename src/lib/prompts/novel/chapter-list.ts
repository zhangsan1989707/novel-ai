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
}

/**
 * 构建章节列表生成提示词
 */
export function buildChapterListPrompt(input: ChapterListGenerationInput): string {
  const parts: string[] = []

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

  // 【任务】
  parts.push(`\n【任务】`)
  parts.push(`请为这部小说生成一个完整的章节列表，共${input.totalChapters}章。`)

  // 【网文章节要求】
  parts.push(`\n【网文章节要求】`)
  parts.push(`1. 每个章节需有吸睛标题，能激发读者好奇心`)
  parts.push(`2. 章节之间需有合理的情节推进和连贯性`)
  parts.push(`3. 每章结尾需设置悬念或钩子，吸引继续阅读`)
  parts.push(`4. 前10章为开篇期，需快速建立人设和世界观`)
  parts.push(`5. 中期（${Math.floor(input.totalChapters * 0.4)}-${Math.floor(input.totalChapters * 0.7)}章）需有持续冲突升级`)
  parts.push(`6. 后期（${Math.floor(input.totalChapters * 0.7)}-${input.totalChapters}章）需有重大转折和高潮`)

  // 【标题风格】
  const titleStyleGuide = {
    [TITLE_STYLES.WEBNOVEL]: '网文风格：吸睛、有悬念，例如"第3章 他竟然是隐藏的首富？" 或 "第5章 雨夜中的神秘告白"',
    [TITLE_STYLES.TRADITIONAL]: '传统风格：简洁、概括，例如"第3章 意外的相遇" 或 "第5章 暗流涌动"',
    [TITLE_STYLES.POETRY]: '诗词风格：文艺、对仗、有意境，例如"第3回 风雪夜归人" 或 "第5回 暗香浮动月黄昏"',
  }
  parts.push(`\n【标题风格】${titleStyleGuide[input.titleStyle]}`)

  // 【输出格式】
  parts.push(`\n【输出格式】`)
  parts.push(`请以 JSON 格式输出，字段说明：`)
  parts.push(`- chapters: 章节数组`)
  parts.push(`- chapters[].chapterNumber: number, 章节序号（1-${input.totalChapters}）`)
  parts.push(`- chapters[].title: string, 章节标题`)
  parts.push(`- chapters[].summary: string, 章节概要（50-100字，概括本章核心事件）`)
  parts.push(`- chapters[].wordCount: number, 预估字数（2000-5000之间）`)
  parts.push(`- chapters[].plotType: string, 情节类型（setup/develop/climax/resolution/transition）`)
  parts.push(`\n示例输出：`)
  parts.push(`{
  "chapters": [
    {
      "chapterNumber": 1,
      "title": "第1章 平凡少年的意外",
      "summary": "即将毕业的大学生林凡在兼职途中意外撞见一场神秘事件...",
      "wordCount": 3500,
      "plotType": "setup"
    }
  ]
}`)

  return parts.join('\n')
}

// 类型导出
export type { ChapterListGenerationInput }
