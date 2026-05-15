/**
 * 写作 Agent - 生成章节正文
 */
import { prisma } from '@/lib/prisma'
import { getAIProvider, createProviderFromDefaultConfig } from '@/lib/ai/factory'
import { AIVendor } from '@/types'
import { buildWriterPrompt } from './prompts'
import type { ChapterOutline, CharacterProfile, AgentContext } from '../engine/types'

interface WriterInput extends AgentContext {
  outline: ChapterOutline
  characterProfiles: CharacterProfile[]
  recentSummaries: { chapterNo: number; summary: string }[]
  targetWordCount: number
}

export async function writerAgent(
  input: WriterInput,
  onChunk?: (text: string) => void
): Promise<{ content: string; tokens?: number }> {
  const { projectId, chapterNo, outline, characterProfiles, recentSummaries, ...context } = input

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
