/**
 * 摘要 Agent - 生成章节摘要
 */
import { prisma } from '@/lib/prisma'
import { getAIProvider, createProviderFromDefaultConfig } from '@/lib/ai/factory'
import { AIVendor } from '@/types'
import { buildSummarizerPrompt } from './prompts'
import type { ChapterSummaryData } from '../engine/types'

interface SummarizerInput {
  projectId: number
  chapterNo: number
  chapterTitle: string
  chapterContent: string
  worldSetting?: string | null
  protagonistProfile?: string | null
}

export async function summarizerAgent(
  input: SummarizerInput
): Promise<ChapterSummaryData> {
  const { projectId, chapterNo, chapterTitle, chapterContent, worldSetting, protagonistProfile } = input

  // 获取 AI Provider
  let provider
  const project = await prisma.novelProject.findUnique({
    where: { id: projectId },
    include: { aiModelConfig: true },
  })

  if (project?.aiModelConfig) {
    provider = getAIProvider(project.aiModelConfig.vendor as AIVendor, {
      vendor: project.aiModelConfig.vendor as AIVendor,
      modelId: project.aiModelConfig.modelId,
      apiKey: project.aiModelConfig.apiKey || '',
      apiEndpoint: project.aiModelConfig.apiEndpoint || undefined,
    })
  } else {
    provider = await createProviderFromDefaultConfig()
  }

  // 构建提示词
  const prompt = buildSummarizerPrompt({
    chapterNo,
    chapterTitle,
    chapterContent,
    worldSetting,
    protagonistProfile,
  })

  // 执行生成
  const result = await provider.generate(prompt, {
    temperature: 0.5,
    maxTokens: 1000,
  })

  // 解析 JSON
  const jsonMatch = result.content.match(/\{[\s\S]*\}/)
  if (jsonMatch) {
    try {
      const summary = JSON.parse(jsonMatch[0]) as ChapterSummaryData
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

  return {
    summary: result.content.slice(0, 300),
    keyEvents: [],
    emotionalTone: null,
    plantedPlotlines: [],
    resolvedPlotlines: [],
  }
}
