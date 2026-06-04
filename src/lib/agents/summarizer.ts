/**
 * 摘要 Agent - 生成章节摘要
 */
import { AIService } from '@/lib/ai/service'
import type { AIProvider } from '@/lib/ai/types'
import { buildSummarizerPrompt } from './prompts'
import type { ChapterSummaryData } from '../engine/types'
import { parseAiJsonObject } from '@/lib/engine/ai-json'

interface SummarizerInput {
  projectId: number
  chapterNo: number
  chapterTitle: string
  chapterContent: string
  memoryContext?: string
  worldSetting?: string | null
  protagonistProfile?: string | null
  provider?: AIProvider
}

export async function summarizerAgent(
  input: SummarizerInput
): Promise<ChapterSummaryData> {
  const { projectId, chapterNo, chapterTitle, chapterContent, worldSetting, protagonistProfile } = input

  // 获取可追踪的 AI Provider
  const provider = input.provider || await AIService.createProvider({
    projectId,
    usageType: 'SUMMARIZER',
  })

  // 构建提示词
  const prompt = buildSummarizerPrompt({
    chapterNo,
    chapterTitle,
    chapterContent,
    memoryContext: input.memoryContext,
    worldSetting,
    protagonistProfile,
  })

  // 执行生成
  const result = await provider.generate(prompt, {
    temperature: 0.5,
    maxTokens: 1000,
  })

  // 解析 JSON
  try {
    const summary = parseAiJsonObject<ChapterSummaryData>(result.content)
    return summary
  } catch {
    // 解析失败，返回空摘要
    return {
      summary: '（摘要生成失败）',
      keyEvents: [],
      emotionalTone: null,
      plantedPlotlines: [],
      resolvedPlotlines: [],
    }
  }
}
