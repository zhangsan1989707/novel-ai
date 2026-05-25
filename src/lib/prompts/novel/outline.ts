/**
 * 大纲生成提示词
 */

interface OutlineGenerationInput {
  projectTitle: string
  genre?: string
  writingStyle?: string
  worldSetting?: string
  protagonistProfile?: string
  protagonistGoal?: string
  antagonistSetting?: string
  endingPlan?: string
}

/**
 * 构建大纲生成提示词
 */
export function buildOutlineGenerationPrompt(input: OutlineGenerationInput): string {
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
  parts.push(`请为这部小说生成一个完整的分阶段大纲。`)
  parts.push(`大纲应分为4个阶段：开篇、发展、中期、结局。`)
  parts.push(`每个阶段应包含：阶段名称、核心事件、章节规划。`)

  // 【输出格式】
  parts.push(`\n【输出格式】`)
  parts.push(`请以 JSON 格式输出，字段说明：`)
  parts.push(`- stages: 阶段数组，每个阶段包含 {name, description, coreEvents, chapterRatio, chapterPlan}`)
  parts.push(`- stages[].name: string, 阶段名称（如"开篇"）`)
  parts.push(`- stages[].description: string, 阶段概述（50-100字）`)
  parts.push(`- stages[].coreEvents: string[], 核心事件列表（3-5个）`)
  parts.push(`- stages[].chapterRatio: number, 该阶段占全书的比例（0-1之间，所有阶段比例之和必须等于1）`)
  parts.push(`- stages[].chapterPlan: string, 章节规划说明（100-200字），使用比例描述而非固定章节数`)
  parts.push(`\n⚠️ 重要：chapterRatio 和 chapterPlan 中不要出现固定章节数（如"第1-10章"），必须使用比例（如"约占全书15%"）。因为后续生成目录时用户可能指定任意总章数，固定章节数会导致不匹配。`)
  parts.push(`\n示例输出：`)
  parts.push(`{
  "stages": [
    {
      "name": "开篇",
      "description": "主人公意外获得异能，面临第一个重大挑战",
      "coreEvents": ["获得异能", "遭遇敌人", "结交伙伴"],
      "chapterRatio": 0.15,
      "chapterPlan": "约占全书15%，重点建立世界观和主角初始能力，完成人物出场和核心设定铺垫"
    }
  ]
}`)

  return parts.join('\n')
}

// 类型导出
export type { OutlineGenerationInput }
