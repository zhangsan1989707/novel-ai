/**
 * 策划 Agent - 生成章节大纲
 */
import { prisma } from '@/lib/prisma'
import { AIService } from '@/lib/ai/service'
import { buildPlannerPrompt as buildPlannerPromptV1 } from '../prompts/chapter/planning'
import { buildPlannerPrompt as buildPlannerPromptV2 } from '../prompts/chapter/planning-v2'
import type { ChapterOutline, AgentContext } from '../engine/types'

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
    temperature: 0.7,
    maxTokens: 1500,
  })

  // 解析 JSON
  const jsonMatch = result.content.match(/\{[\s\S]*\}/)
  if (jsonMatch) {
    try {
      const outline = JSON.parse(jsonMatch[0]) as ChapterOutline
      return { outline, tokens: result.usage?.totalTokens }
    } catch {
      throw new Error('策划 Agent 输出格式错误：无法解析 JSON')
    }
  }

  throw new Error('策划 Agent 输出格式错误：未找到 JSON')
}
