/**
 * 创意生成提示词
 */

interface IdeaGenerationInput {
  theme: string
  genre?: string
  writingStyle?: string
}

/**
 * 构建创意生成提示词
 */
export function buildIdeaGenerationPrompt(input: IdeaGenerationInput): string {
  const parts: string[] = []

  // 【基础信息】
  parts.push(`【基础信息】`)
  parts.push(`创作主题：${input.theme}`)
  if (input.genre) parts.push(`期望类型：${input.genre}`)
  if (input.writingStyle) parts.push(`期望风格：${input.writingStyle}`)

  // 【任务】
  parts.push(`\n【任务】`)
  parts.push(`请基于以上主题，生成一套完整的网络小说创意设定。`)

  // 【输出格式】
  parts.push(`\n【输出格式】`)
  parts.push(`请以 JSON 格式输出，字段说明：`)
  parts.push(`- worldSetting: string, 世界观设定描述（200-500字）`)
  parts.push(`- powerSystem: string, 力量体系说明（100-300字）`)
  parts.push(`- protagonistProfile: string, 主角人设描述（150-300字，含外貌、性格、背景）`)
  parts.push(`- protagonistGoal: string, 主角目标（50-100字）`)
  parts.push(`- antagonistSetting: string, 反派设定（100-200字）`)
  parts.push(`- endingPlan: string, 结局规划（100-200字）`)
  parts.push(`- hooks: string[], 章节钩子设计示例（3-5个，30-50字/个）`)
  parts.push(`- highlights: string[], 爽点设计示例（3-5个，20-30字/个）`)
  parts.push(`\n示例输出：`)
  parts.push(`{
  "worldSetting": "灵气复苏时代，人类可通过修炼突破极限...",
  "powerSystem": "九品修炼制：一品炼体、九品通天，每品有明确特征...",
  "protagonistProfile": "林凡，20岁，看似普通的大学毕业生，实为千年难遇...",
  "protagonistGoal": "找到失踪的父母，揭开远古秘密",
  "antagonistSetting": "暗影教团，表面正义实则另有目的...",
  "endingPlan": "最终揭示父母下落，主角突破九品但选择隐退...",
  "hooks": ["看似普通的室友实为隐藏身份", "考试第一名却遭遇神秘势力"],
  "highlights": ["越级战胜强敌", "获得稀有宝物", "红颜知己倾心"]
}`)

  return parts.join('\n')
}

// 类型导出
export type { IdeaGenerationInput }
