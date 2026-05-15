/**
 * 润色 Agent - 文风优化
 */
import { prisma } from '@/lib/prisma'
import { getAIProvider, createProviderFromDefaultConfig } from '@/lib/ai/factory'
import { AIVendor } from '@/types'
import { buildPolisherPrompt } from './prompts'

interface PolisherInput {
  projectId: number
  chapterNo: number
  content: string
  styleGuide?: string | null
}

export async function polisherAgent(
  input: PolisherInput,
  onChunk?: (text: string) => void
): Promise<{ content: string; tokens?: number }> {
  const { projectId, chapterNo, content, styleGuide } = input

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
  const prompt = buildPolisherPrompt({
    chapterNo,
    content,
    styleGuide,
  })

  // 流式生成
  const tokens: string[] = []
  for await (const token of provider.generateStream(prompt, { temperature: 0.5 })) {
    tokens.push(token)
    onChunk?.(token)
  }

  return {
    content: tokens.join(''),
    tokens: tokens.length,
  }
}
