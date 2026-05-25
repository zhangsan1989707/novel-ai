/**
 * 策划 Agent - 生成章节大纲
 */
import { prisma } from '@/lib/prisma'
import { AIService } from '@/lib/ai/service'
import type { AIProvider } from '@/lib/ai/types'
import { logger } from '@/lib/logger'
import { buildPlannerPrompt as buildPlannerPromptV2 } from '../prompts/chapter/planning-v2'
import type { ChapterOutline, AgentContext } from '../engine/types'
import { parseAiJsonObject } from '@/lib/engine/ai-json'
import type { PopularFictionProfile } from '../engine/popular-fiction'

interface PlannerInput extends AgentContext {
  characterProfiles: { name: string; role: string; description: string }[]
  openPlotlines: { id: string; description: string }[]
  emotionalArc: { chapterNo: number; value: number }[]
  recentChapterSummaries?: { chapterNo: number; summary: string }[]
  recentChapterCount: number
  targetWordCount: number
  memoryContext?: string
  useEnhancedPrompt?: boolean
  provider?: AIProvider
  popularFictionProfile?: PopularFictionProfile | null
}

// 默认使用增强版提示词
const buildPlannerPrompt = buildPlannerPromptV2

function buildFallbackOutline(input: PlannerInput & AgentContext): ChapterOutline {
  const previousSummary = input.recentChapterCount > 0 ? input.chapterNo - 1 : input.chapterNo
  const latestPlotline = input.openPlotlines[0]?.description || '当前核心矛盾'
  const emotionalValue = input.emotionalArc[input.emotionalArc.length - 1]?.value ?? 50
  const tone = emotionalValue >= 70 ? '高压' : emotionalValue <= 30 ? '缓冲' : '推进'
  const genrePrefix = input.genre ? `${input.genre}` : '本章'

  return {
    chapterTitle: `${genrePrefix}推进：第${input.chapterNo}章`,
    chapterGoal: `承接第${previousSummary}章的剧情，围绕${latestPlotline}继续推进，并保持${tone}节奏`,
    mainConflict: `主角需要直面${latestPlotline}带来的新阻力，同时避免前文伏笔在此处过早收束`,
    emotionTarget: input.popularFictionProfile?.emotionEngine.primaryEmotion || '期待',
    conflictTarget: latestPlotline,
    payoffTarget: input.popularFictionProfile?.emotionEngine.readerPayoff || '给读者一个阶段性回报',
    cliffhanger: '在章节结尾留下新的威胁或承诺，强迫读者进入下一章',
    cheatUsage: input.popularFictionProfile?.cheatAbility.oneLineRule || '让主角优势在本章至少触发一次',
    characterTagProof: input.popularFictionProfile?.characterTagEngine.behaviorProofs[0]?.requiredScene || '用关键选择证明主角标签',
    forbiddenMistakes: ['禁止大段设定说明', '禁止冲突不足', '禁止结尾无钩子'],
    keyScenes: [
      {
        scene: '开场场景：沿用上一章末尾的紧张点，快速把读者拉回当前矛盾。',
        characters: ['主角'],
        emotion: tone,
      },
      {
        scene: '发展场景：让主角做出一次明确选择，并让选择带来代价。',
        characters: ['主角', '关键配角'],
        emotion: '对抗',
      },
      {
        scene: '高潮场景：将本章核心冲突推到台面上，形成新的悬念或交换条件。',
        characters: ['主角', '对手'],
        emotion: '悬念',
      },
    ],
    ending: `在${latestPlotline}上留下新的未解问题，为下一章埋钩子，不在本章内提前结局。`,
    foreshadows: [`${latestPlotline}的后续代价`, '下一章需要延续的隐性冲突'],
    resolvedPlotlines: [],
  }
}

export async function plannerAgent(
  input: PlannerInput
): Promise<{ outline: ChapterOutline; tokens?: number }> {
  const { projectId, chapterNo, ...context } = input

  // 获取可追踪的 AI Provider
  const provider = input.provider || await AIService.createProvider({
    projectId,
    usageType: 'PLANNER',
  })

  // 获取前 N 章摘要（优先复用编排器传入的记忆包）
  const recentChapters = input.recentChapterSummaries || await prisma.chapterSummary.findMany({
    where: { projectId },
    orderBy: { chapterNo: 'desc' },
    take: input.recentChapterCount || 3,
  })

  // 构建提示词
  const prompt = buildPlannerPrompt({
    ...context,
    chapterNo,
    memoryContext: input.memoryContext,
    recentChapterSummaries: recentChapters.map(ch => ({
      chapterNo: ch.chapterNo,
      summary: ch.summary,
    })),
    openPlotlines: input.openPlotlines,
    emotionalArc: input.emotionalArc,
    popularFictionProfile: input.popularFictionProfile,
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
  "emotionTarget": "string",
  "conflictTarget": "string",
  "payoffTarget": "string",
  "cliffhanger": "string",
  "cheatUsage": "string",
  "characterTagProof": "string",
  "forbiddenMistakes": ["string"],
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
      logger.warn(
        {
          projectId: input.projectId,
          chapterNo: input.chapterNo,
          originalError: error instanceof Error ? error.message : 'JSON 解析失败',
        },
        'Planner Agent JSON parse failed, using fallback outline'
      )
      return {
        outline: buildFallbackOutline(input),
        tokens: repaired.usage?.totalTokens,
      }
    }
  }
}
