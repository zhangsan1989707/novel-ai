/**
 * 润色 Agent - 文风优化
 */
import { AIService } from '@/lib/ai/service'
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

  // 获取可追踪的 AI Provider
  const provider = await AIService.createProvider({
    projectId,
    usageType: 'POLISHER',
  })

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
