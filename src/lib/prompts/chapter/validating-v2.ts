/**
 * 增强版校验 Agent Prompt - 精细化一致性检查
 */

interface ValidatorPromptInput {
  chapterNo: number
  newChapterContent: string
  characterProfiles: string
  recentSummaries: string
  memoryContext?: string
  worldSetting?: string | null
  openPlotlines: string
  chapterTitle?: string
  chapterGoal?: string
}

interface ValidationIssue {
  type: 'logic' | 'character' | 'worldview' | 'emotion' | 'foreshadow' | 'style'
  severity: 'critical' | 'major' | 'minor'
  description: string
  location: string
  reference?: string
  suggestion?: string
}

interface ValidationReport {
  result: 'pass' | 'fail' | 'retry'
  score: number
  issues: ValidationIssue[]
  characterUpdates: Record<string, Record<string, unknown>>
  newPlotlines: string[]
  resolvedPlotlines: string[]
  qualityMetrics: {
    logicScore: number
    characterScore: number
    emotionScore: number
    styleScore: number
  }
}

export function buildValidatorPrompt(input: ValidatorPromptInput): string {
  const parts: string[] = []

  parts.push(`# 章节质量校验任务`)
  parts.push(`\n## 基本信息`)
  parts.push(`- 章节编号：第${input.chapterNo}章`)
  if (input.chapterTitle) parts.push(`- 章节标题：${input.chapterTitle}`)
  if (input.chapterGoal) parts.push(`- 章节目标：${input.chapterGoal}`)

  if (input.characterProfiles) {
    parts.push(`\n## 角色档案`)
    parts.push(input.characterProfiles)
  }

  if (input.memoryContext) {
    parts.push(`\n## 记忆编排上下文`)
    parts.push(input.memoryContext)
  }

  if (input.recentSummaries) {
    parts.push(`\n## 前情摘要（最近3章）`)
    parts.push(input.recentSummaries)
  }

  if (input.worldSetting) {
    parts.push(`\n## 世界观设定`)
    parts.push(input.worldSetting)
  }

  if (input.openPlotlines) {
    parts.push(`\n## 进行中的伏笔/剧情线`)
    parts.push(input.openPlotlines)
    parts.push(`\n**重要**：检查本章是否推进、提及、或回收了这些伏笔`)
  }

  parts.push(`\n## 校验标准`)
  
  parts.push(`\n### 1. 逻辑连贯性检查（权重：30%）`)
  parts.push(`- 检查情节发展是否合理，是否有跳跃或矛盾`)
  parts.push(`- 检查时间线是否一致（不能出现"昨天"在"今天"之前等）`)
  parts.push(`- 检查因果关系是否成立`)
  parts.push(`- 检查高潮是否源于前面的铺垫`)

  parts.push(`\n### 2. 人物一致性检查（权重：25%）`)
  parts.push(`- 检查角色行为是否符合其性格设定`)
  parts.push(`- 检查角色语言风格是否一致`)
  parts.push(`- 检查角色间关系是否合理`)
  parts.push(`- 检查角色成长/变化是否有铺垫`)

  parts.push(`\n### 3. 情感曲线检查（权重：20%）`)
  parts.push(`- 检查情感变化是否有铺垫和过渡`)
  parts.push(`- 检查情绪高潮是否足够强烈`)
  parts.push(`- 检查章节结尾的情感落点`)

  parts.push(`\n### 4. 风格一致性检查（权重：15%）`)
  parts.push(`- 检查是否去除了 AI 写作痕迹`)
  parts.push(`- 检查叙事风格是否统一`)
  parts.push(`- 检查对话风格是否有差异性`)

  parts.push(`\n### 5. 伏笔管理检查（权重：10%）`)
  parts.push(`- 检查是否埋设了新伏笔`)
  parts.push(`- 检查伏笔是否有足够的铺垫（至少3章前埋下）`)
  parts.push(`- 检查回收的伏笔是否合理`)

  parts.push(`\n## 输出要求`)
  parts.push(`请以严格 JSON 格式输出：`)
  parts.push(`\`\`\`json`)
  parts.push(`{`)
  parts.push(`  "result": "pass|fail|retry",`)
  parts.push(`  "score": 0-100,`)
  parts.push(`  "qualityMetrics": {`)
  parts.push(`    "logicScore": 0-100,`)
  parts.push(`    "characterScore": 0-100,`)
  parts.push(`    "emotionScore": 0-100,`)
  parts.push(`    "styleScore": 0-100`)
  parts.push(`  },`)
  parts.push(`  "issues": [`)
  parts.push(`    {`)
  parts.push(`      "type": "logic|character|worldview|emotion|foreshadow|style",`)
  parts.push(`      "severity": "critical|major|minor",`)
  parts.push(`      "description": "问题描述",`)
  parts.push(`      "location": "问题位置",`)
  parts.push(`      "reference": "参考内容",`)
  parts.push(`      "suggestion": "修改建议（可选）"`)
  parts.push(`    }`)
  parts.push(`  ],`)
  parts.push(`  "characterUpdates": { "角色名": "角色状态更新描述" },`)
  parts.push(`  "newPlotlines": ["新埋伏笔描述"],`)
  parts.push(`  "resolvedPlotlines": ["回收的伏笔描述"]`)
  parts.push(`}`)
  parts.push(`\`\`\``)

  parts.push(`\n**评分标准**：`)
  parts.push(`- 90-100分：优秀，无需修改`)
  parts.push(`- 70-89分：良好，有少量minor问题`)
  parts.push(`- 50-69分：一般，有major问题，需要修改`)
  parts.push(`- 50分以下：较差，有critical问题，必须重写`)
  parts.push(`- 当有critical问题时，result应为"fail"`)
  parts.push(`- 当有major问题时，result应为"retry"`)

  parts.push(`\n---\n## 待校验内容`)
  parts.push(input.newChapterContent)

  return parts.join('\n')
}

// 类型导出
export type { ValidatorPromptInput, ValidationIssue, ValidationReport }
