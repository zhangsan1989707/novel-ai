/**
 * 简介生成/润色提示词
 */

interface SynopsisGenerationInput {
  projectTitle: string
  existingSynopsis?: string
  targetAudience?: 'MALE' | 'FEMALE'
  genre?: string
  writingStyle?: string
  worldSetting?: string
  powerSystem?: string
  protagonistProfile?: string
  protagonistGoal?: string
  antagonistSetting?: string
  endingPlan?: string
  outline?: string
  targetWordCount?: number
}

/**
 * 构建简介生成/润色提示词
 */
export function buildSynopsisGenerationPrompt(params: SynopsisGenerationInput): string {
  const parts: string[] = []

  // 【基础信息】
  parts.push(`【基础信息】`)
  parts.push(`标题：${params.projectTitle}`)
  if (params.targetAudience) {
    parts.push(`目标受众：${params.targetAudience === 'MALE' ? '男频（男性读者为主）' : '女频（女性读者为主）'}`)
  }
  if (params.genre) parts.push(`类型：${params.genre}`)
  if (params.writingStyle) parts.push(`写作风格：${params.writingStyle}`)
  if (params.targetWordCount) parts.push(`目标字数：${params.targetWordCount}字`)

  // 【设定】
  if (params.worldSetting) {
    parts.push(`\n【设定 - 世界观】`)
    parts.push(params.worldSetting)
  }

  if (params.powerSystem) {
    parts.push(`\n【设定 - 力量体系】`)
    parts.push(params.powerSystem)
  }

  if (params.protagonistProfile) {
    parts.push(`\n【设定 - 主角人设】`)
    parts.push(params.protagonistProfile)
  }

  if (params.protagonistGoal) {
    parts.push(`\n【设定 - 主角目标】`)
    parts.push(params.protagonistGoal)
  }

  if (params.antagonistSetting) {
    parts.push(`\n【设定 - 反派设定】`)
    parts.push(params.antagonistSetting)
  }

  if (params.endingPlan) {
    parts.push(`\n【设定 - 结局规划】`)
    parts.push(params.endingPlan)
  }

  if (params.outline) {
    parts.push(`\n【设定 - 故事大纲】`)
    parts.push(params.outline)
  }

  // 【任务】
  parts.push(`\n【任务】`)

  if (params.existingSynopsis) {
    parts.push(`\n【现有简介】`)
    parts.push(params.existingSynopsis)
    parts.push(`\n请对以上简介进行润色和改进，使其更加吸引人、有感染力。`)
    parts.push(`保持原有的核心信息和风格，可以适当扩展和深化。`)
  } else {
    parts.push(`请根据以上小说设定，生成一个吸引人的小说简介。`)
    parts.push(`简介应该：`)
    parts.push(`1. 突出故事的独特卖点和核心冲突`)
    parts.push(`2. 简要介绍主角及其面临的挑战`)
    parts.push(`3. 营造悬念，吸引读者继续阅读`)
    parts.push(`4. 体现小说的类型特点和风格`)
  }

  // 【简介写作要求】
  parts.push(`\n【简介写作要求】`)
  parts.push(`1. 前3句话必须包含最大悬念或最强冲突点`)
  parts.push(`2. 突出"爽点"和"看点"，让读者感受到阅读收益`)
  parts.push(`3. 主角名字和关键设定需在前100字内出现`)
  parts.push(`4. 避免平铺直叙，要有节奏感和张力`)
  parts.push(`5. 字数控制在200-500字之间`)

  parts.push(`\n请直接输出简介内容，不要添加标题或格式。`)

  return parts.join('\n')
}

// 类型导出
export type { SynopsisGenerationInput }
