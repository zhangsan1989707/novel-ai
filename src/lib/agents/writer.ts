/**
 * 写作 Agent - 生成章节正文
 */
import { AIService } from '@/lib/ai/service'
import type { AIProvider } from '@/lib/ai/types'
import { buildWriterPrompt as buildWriterPromptV1 } from '../prompts/chapter/writing'
import { buildWriterPrompt as buildWriterPromptV2 } from '../prompts/chapter/writing-v2'
import type { ChapterOutline, CharacterProfile, AgentContext } from '../engine/types'

interface WriterInput extends AgentContext {
  outline: ChapterOutline
  characterProfiles: CharacterProfile[]
  recentSummaries: { chapterNo: number; summary: string }[]
  targetWordCount: number
  useEnhancedPrompt?: boolean
  provider?: AIProvider
}

// 默认使用增强版提示词
const buildWriterPrompt = buildWriterPromptV2

export async function writerAgent(
  input: WriterInput,
  onChunk?: (text: string) => void
): Promise<{ content: string; tokens?: number }> {
  const { projectId, chapterNo, outline, characterProfiles, recentSummaries, ...context } = input

  // 获取可追踪的 AI Provider
  const provider = input.provider || await AIService.createProvider({
    projectId,
    usageType: 'WRITER',
  })

  // 构建角色档案字符串
  const characterProfilesStr = characterProfiles
    .map(c => `【${c.name}】${c.role === 'PROTAGONIST' ? '(主角)' : c.role === 'ANTAGONIST' ? '(反派)' : '(配角)'}: ${c.appearance || ''} ${c.personality || ''} ${c.catchphrases?.length ? '口头禅：' + c.catchphrases.join('、') : ''}`)
    .join('\n\n')

  // 构建提示词
  const prompt = buildWriterPrompt({
    projectTitle: context.projectTitle,
    genre: context.genre,
    writingStyle: context.writingStyle,
    worldSetting: context.worldSetting,
    powerSystem: context.powerSystem,
    chapterNo,
    outline,
    characterProfiles: characterProfilesStr,
    recentSummaries: recentSummaries.map(s => `第${s.chapterNo}章：${s.summary}`).join('\n'),
    targetWordCount: input.targetWordCount,
  })

  // 流式生成
  const tokens: string[] = []
  for await (const token of provider.generateStream(prompt, { temperature: 0.7 })) {
    tokens.push(token)
    onChunk?.(token)
  }

  return {
    content: tokens.join(''),
    tokens: tokens.length,
  }
}
