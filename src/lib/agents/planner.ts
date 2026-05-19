/**
 * 策划 Agent - 生成章节大纲
 */
import { prisma } from '@/lib/prisma'
import { AIService } from '@/lib/ai/service'
import { buildPlannerPrompt as buildPlannerPromptV2 } from '../prompts/chapter/planning-v2'
import type { ChapterOutline, AgentContext } from '../engine/types'
import { parseAiJsonObject } from '@/lib/engine/ai-json'

interface PlannerInput extends AgentContext {
  characterProfiles: { name: string; role: string; description: string }[]
  openPlotlines: { id: string; description: string }[]
  emotionalArc: { chapterNo: number; value: number }[]
  recentChapterCount: number
  targetWordCount: number
  useEnhancedPrompt?: boolean
}

// 默认使用增强版提示词
const buildPlannerPrompt = buildPlannerPromptV2

export async function plannerAgent(
  input: PlannerInput
): Promise<{ outline: ChapterOutline; tokens?: number }> {
  const { projectId, chapterNo, ...context } = input

  // 获取可追踪的 AI Provider
  const provider = await AIService.createProvider({
    projectId,
    usageType: 'PLANNER',
  })

  // 获取前 N 章摘要
  const recentChapters = await prisma.chapterSummary.findMany({
    where: { projectId },
    orderBy: { chapterNo: 'desc' },
    take: input.recentChapterCount || 3,
  })

  // 构建提示词
  const prompt = buildPlannerPrompt({
    ...context,
    chapterNo,
    recentChapterSummaries: recentChapters.map(ch => ({
      chapterNo: ch.chapterNo,
      summary: ch.summary,
    })),
    openPlotlines: input.openPlotlines,
    emotionalArc: input.emotionalArc,
  })

  // 执行生成
  const result = await provider.generate(prompt, {
    temperature: 0.2,
    maxTokens: 1500,
    responseFormat: { type: 'json_object' },
  })

  try {
    const outline = parseAiJsonObject<ChapterOutline>(result.content)
    return { outline, tokens: result.usage?.totalTokens }
  } catch (error) {
    const repairPrompt = `你必须只输出一个合法 JSON 对象，不要解释，不要代码块，不要多余文本。

原始任务：
${prompt}

JSON 格式要求：
{
  "chapterTitle": "string",
  "chapterGoal": "string",
  "mainConflict": "string",
  "keyScenes": [
    { "scene": "string", "characters": ["string"], "emotion": "string" }
  ],
  "ending": "string",
  "foreshadows": ["string"],
  "resolvedPlotlines": ["string"]
}`
    const repaired = await provider.generate(repairPrompt, {
      temperature: 0.1,
      maxTokens: 1200,
      responseFormat: { type: 'json_object' },
    })
    try {
      const outline = parseAiJsonObject<ChapterOutline>(repaired.content)
      return { outline, tokens: repaired.usage?.totalTokens }
    } catch {
      throw new Error(`策划 Agent 输出格式错误：${error instanceof Error ? error.message : 'JSON 解析失败'}`)
    }
  }
}
