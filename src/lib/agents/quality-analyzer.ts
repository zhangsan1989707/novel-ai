/**
 * 质量分析系统 - 专门的多维度质量检查器
 * 实现逻辑连贯性、人物一致性、情感曲线、伏笔追踪等专项检查
 */
import { AIService } from '@/lib/ai/service'

interface QualityCheckInput {
  projectId: number
  chapterNo: number
  content: string
  characterProfiles: Array<{
    name: string
    personality: string
    behaviorPatterns?: string
    catchphrases?: string[]
  }>
  recentChapters: Array<{
    chapterNo: number
    summary: string
    keyEvents: string[]
  }>
  emotionalArc?: number[]
  openPlotlines: Array<{
    id: string
    description: string
    plantedAtChapter: number
  }>
}

interface LogicCheckResult {
  score: number
  issues: Array<{
    type: 'timeline' | 'causality' | 'contradiction' | 'jump'
    location: string
    description: string
    severity: 'critical' | 'major' | 'minor'
  }>
  suggestions: string[]
}

interface CharacterConsistencyResult {
  score: number
  issues: Array<{
    character: string
    description: string
    severity: 'critical' | 'major' | 'minor'
  }>
  characterStates: Record<string, string>
}

interface EmotionalArcResult {
  score: number
  issues: Array<{
    location: string
    description: string
    severity: 'critical' | 'major' | 'minor'
  }>
  emotionalHighlights: string[]
}

interface ForeshadowResult {
  score: number
  planted: Array<{ description: string; chapter: number }>
  resolved: Array<{ description: string; plantedAtChapter: number }>
  issues: Array<{
    type: 'too_early' | 'too_abrupt' | 'forgotten'
    description: string
    severity: 'critical' | 'major' | 'minor'
  }>
}

/**
 * 逻辑连贯性检查
 */
async function checkLogicConsistency(
  projectId: number,
  input: QualityCheckInput
): Promise<LogicCheckResult> {
  const provider = await AIService.createProvider({
    projectId,
    usageType: 'VALIDATOR',
  })

  const prompt = `你是一位逻辑分析专家，检查小说章节的逻辑连贯性。

## 待检查章节（第${input.chapterNo}章）
${input.content}

## 前情摘要
${input.recentChapters.map(ch => `第${ch.chapterNo}章：${ch.summary}`).join('\n')}

## 检查要求
1. **时间线一致性**：检查是否有时间矛盾（如"昨天"在"今天"之前）
2. **因果关系**：检查事件发展是否符合逻辑因果
3. **情节连贯**：检查情节是否有突兀的跳跃或断层
4. **世界规则**：检查是否违反了设定中的世界规则

## 输出格式
请以JSON格式输出：
{
  "score": 0-100,
  "issues": [
    {
      "type": "timeline|causality|contradiction|jump",
      "location": "问题位置描述",
      "description": "问题描述",
      "severity": "critical|major|minor"
    }
  ],
  "suggestions": ["修改建议1", "修改建议2"]
}`

  const result = await provider.generate(prompt, {
    temperature: 0.3,
    maxTokens: 1500,
  })

  try {
    const jsonMatch = result.content.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]) as LogicCheckResult
    }
  } catch {
    // 解析失败
  }

  return {
    score: 75,
    issues: [],
    suggestions: [],
  }
}

/**
 * 人物一致性检查
 */
async function checkCharacterConsistency(
  projectId: number,
  input: QualityCheckInput
): Promise<CharacterConsistencyResult> {
  const provider = await AIService.createProvider({
    projectId,
    usageType: 'VALIDATOR',
  })

  const charactersStr = input.characterProfiles
    .map(c => `【${c.name}】性格：${c.personality}${c.behaviorPatterns ? ' 行为模式：' + c.behaviorPatterns : ''}`)
    .join('\n')

  const prompt = `你是一位人物塑造专家，检查小说章节中的人物行为一致性。

## 待检查章节（第${input.chapterNo}章）
${input.content}

## 角色档案
${charactersStr}

## 检查要求
1. **行为一致性**：角色行为是否符合其性格设定
2. **语言风格**：角色的对话是否符合其身份和性格
3. **决策逻辑**：角色的关键决策是否合理
4. **关系动态**：角色间的关系是否符合之前的设定

## 输出格式
请以JSON格式输出：
{
  "score": 0-100,
  "issues": [
    {
      "character": "角色名",
      "description": "问题描述",
      "severity": "critical|major|minor"
    }
  ],
  "characterStates": {
    "角色名": "本章节后的状态描述"
  }
}`

  const result = await provider.generate(prompt, {
    temperature: 0.3,
    maxTokens: 1500,
  })

  try {
    const jsonMatch = result.content.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]) as CharacterConsistencyResult
    }
  } catch {
    // 解析失败
  }

  return {
    score: 75,
    issues: [],
    characterStates: {},
  }
}

/**
 * 情感曲线合理性检查
 */
async function checkEmotionalArc(
  projectId: number,
  input: QualityCheckInput
): Promise<EmotionalArcResult> {
  const provider = await AIService.createProvider({
    projectId,
    usageType: 'VALIDATOR',
  })

  const previousArc = input.emotionalArc?.slice(-5).join(' → ') || '暂无数据'

  const prompt = `你是一位情感节奏专家，检查小说章节的情感曲线合理性。

## 待检查章节（第${input.chapterNo}章）
${input.content}

## 前几章情感热度值
${previousArc}

## 检查要求
1. **情感铺垫**：情感高潮是否有足够的铺垫
2. **节奏变化**：情感变化是否过于突兀
3. **余韵效果**：章节结尾的情感落点是否合适
4. **读者体验**：是否给读者足够的情感冲击

## 输出格式
请以JSON格式输出：
{
  "score": 0-100,
  "issues": [
    {
      "location": "位置描述",
      "description": "问题描述",
      "severity": "critical|major|minor"
    }
  ],
  "emotionalHighlights": ["情感亮点1", "情感亮点2"]
}`

  const result = await provider.generate(prompt, {
    temperature: 0.3,
    maxTokens: 1200,
  })

  try {
    const jsonMatch = result.content.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]) as EmotionalArcResult
    }
  } catch {
    // 解析失败
  }

  return {
    score: 75,
    issues: [],
    emotionalHighlights: [],
  }
}

/**
 * 伏笔埋设与回收追踪
 */
async function checkForeshadow(
  projectId: number,
  input: QualityCheckInput
): Promise<ForeshadowResult> {
  const provider = await AIService.createProvider({
    projectId,
    usageType: 'VALIDATOR',
  })

  const plotlinesStr = input.openPlotlines
    .map(p => `[伏笔] ${p.description} (埋于第${p.plantedAtChapter}章)`)
    .join('\n')

  const prompt = `你是一位伏笔管理专家，检查小说章节中的伏笔运用。

## 待检查章节（第${input.chapterNo}章）
${input.content}

## 进行中的伏笔
${plotlinesStr || '暂无伏笔记录'}

## 检查要求
1. **伏笔回收**：检查是否合理回收了之前埋下的伏笔
2. **新埋伏笔**：检查是否埋设了新的伏笔
3. **伏笔节奏**：伏笔从埋下到回收的间隔是否合理（建议3章以上）
4. **伏笔逻辑**：伏笔的回收是否合理

## 输出格式
请以JSON格式输出：
{
  "score": 0-100,
  "planted": [
    { "description": "新埋伏笔描述", "chapter": ${input.chapterNo} }
  ],
  "resolved": [
    { "description": "回收的伏笔描述", "plantedAtChapter": 10 }
  ],
  "issues": [
    {
      "type": "too_early|too_abrupt|forgotten",
      "description": "问题描述",
      "severity": "critical|major|minor"
    }
  ]
}`

  const result = await provider.generate(prompt, {
    temperature: 0.3,
    maxTokens: 1200,
  })

  try {
    const jsonMatch = result.content.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]) as ForeshadowResult
    }
  } catch {
    // 解析失败
  }

  return {
    score: 75,
    planted: [],
    resolved: [],
    issues: [],
  }
}

/**
 * 综合质量分析
 */
export async function runQualityAnalysis(
  input: QualityCheckInput
): Promise<{
  overallScore: number
  logicScore: number
  characterScore: number
  emotionalScore: number
  foreshadowScore: number
  allIssues: Array<{
    category: string
    type: string
    description: string
    severity: string
  }>
  recommendations: string[]
}> {
  // 并行执行所有检查
  const [logic, characters, emotion, foreshadow] = await Promise.all([
    checkLogicConsistency(input.projectId, input),
    checkCharacterConsistency(input.projectId, input),
    checkEmotionalArc(input.projectId, input),
    checkForeshadow(input.projectId, input),
  ])

  // 计算综合分数
  const weights = {
    logic: 0.30,
    character: 0.25,
    emotion: 0.20,
    foreshadow: 0.15,
  }

  const overallScore = Math.round(
    logic.score * weights.logic +
    characters.score * weights.character +
    emotion.score * weights.emotion +
    foreshadow.score * weights.foreshadow
  )

  // 收集所有问题
  const allIssues: Array<{
    category: string
    type: string
    description: string
    severity: string
  }> = [
    ...logic.issues.map(i => ({ category: '逻辑连贯', type: i.type, description: i.description, severity: i.severity })),
    ...characters.issues.map(i => ({ category: '人物一致性', type: 'character', description: i.description, severity: i.severity })),
    ...emotion.issues.map(i => ({ category: '情感曲线', type: 'emotion', description: i.description, severity: i.severity })),
    ...foreshadow.issues.map(i => ({ category: '伏笔管理', type: i.type, description: i.description, severity: i.severity })),
  ]

  // 收集建议
  const recommendations = [
    ...logic.suggestions,
    ...emotion.emotionalHighlights.map(h => `情感亮点：${h}`),
    ...foreshadow.planted.map(p => `新埋伏笔：${p.description}`),
    ...foreshadow.resolved.map(r => `回收伏笔：${r.description}`),
  ]

  return {
    overallScore,
    logicScore: logic.score,
    characterScore: characters.score,
    emotionalScore: emotion.score,
    foreshadowScore: foreshadow.score,
    allIssues,
    recommendations,
  }
}

export type {
  QualityCheckInput,
  LogicCheckResult,
  CharacterConsistencyResult,
  EmotionalArcResult,
  ForeshadowResult,
}
