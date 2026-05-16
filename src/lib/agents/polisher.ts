/**
 * 润色 Agent - 文风优化
 */
import { AIService } from '@/lib/ai/service'
import { buildPolisherPrompt as buildPolisherPromptV1 } from '../prompts/chapter/polishing'
import { buildPolisherPrompt as buildPolisherPromptV2 } from '../prompts/chapter/polishing-v2'

interface PolisherInput {
  projectId: number
  chapterNo: number
  content: string
  styleGuide?: string | null
  writingStyle?: string | null
  genre?: string | null
  chapterTitle?: string
  useEnhancedPrompt?: boolean
}

// 默认使用增强版提示词
const buildPolisherPrompt = buildPolisherPromptV2

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
    writingStyle: input.writingStyle || null,
    genre: input.genre || null,
    chapterTitle: input.chapterTitle,
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
