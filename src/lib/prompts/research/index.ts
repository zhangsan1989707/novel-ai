interface ResearchPromptInput {
  topic: string
  context: string
  genre?: string | null
  worldSetting?: string | null
  chapterNo?: number
  existingResearch?: string[]
}

export function buildResearchPrompt(input: ResearchPromptInput): string {
  const parts: string[] = []

  parts.push('你是一位专业的小说资料研究员，负责为小说创作提供详实、准确的背景资料。')

  parts.push('\n【研究主题】')
  parts.push(input.topic)

  if (input.context) {
    parts.push('\n【研究背景】')
    parts.push(input.context)
  }

  if (input.genre) {
    parts.push('\n【小说类型】')
    parts.push(input.genre)
  }

  if (input.worldSetting) {
    parts.push('\n【世界观设定】')
    parts.push(input.worldSetting)
  }

  if (input.chapterNo) {
    parts.push('\n【当前章节】')
    parts.push(`第${input.chapterNo}章`)
  }

  if (input.existingResearch && input.existingResearch.length > 0) {
    parts.push('\n【已有研究资料】')
    parts.push(input.existingResearch.join('；'))
    parts.push('请避免重复已有资料，提供新的研究视角和补充信息。')
  }

  parts.push('\n【任务】')
  parts.push('请围绕研究主题，生成结构化的研究资料，要求：')
  parts.push('1. 主题概述：用1-2段话概括主题的核心内容')
  parts.push('2. 关键事实点：列出5-10个与主题相关的重要事实')
  parts.push('3. 创作素材：提供可用于小说创作的具体素材，包括场景描写、细节刻画、专业术语等')
  parts.push('4. 可信度评估：对资料的可信度进行评估')
  parts.push('5. 建议引用方式：说明如何在小说中自然地融入这些资料')

  parts.push('\n【输出格式】')
  parts.push('请以严格 JSON 格式输出：')
  parts.push('- summary: string, 主题概述（100-200字）')
  parts.push('- keyFacts: string[], 关键事实点列表（5-10个）')
  parts.push('- creativeMaterials: string[], 可用于小说创作的素材列表（3-6个）')
  parts.push('- confidence: "high" | "medium" | "low", 资料可信度评估')
  parts.push('- usageSuggestions: string[], 建议引用方式列表（2-4个）')

  return parts.join('\n')
}

export type { ResearchPromptInput }
