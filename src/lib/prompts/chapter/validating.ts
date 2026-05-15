/**
 * 校验 Agent Prompt - 检查前后矛盾
 */

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

// 类型导出
export type { ValidatorPromptInput }
