/**
 * 写作 Agent - 生成章节正文
 */
import { AIService } from '@/lib/ai/service'
import type { AIProvider } from '@/lib/ai/types'
import { buildWriterPrompt as buildWriterPromptV2 } from '../prompts/chapter/writing-v2'
import type { ChapterOutline, CharacterProfile, AgentContext } from '../engine/types'
import type { PopularFictionProfile } from '../engine/popular-fiction'
import type { GenerationSpeedMode } from '@/lib/ai/speed-mode'
import type { StyleVector } from '../engine/style-engine'
import { buildStyleModulationPrompt } from '../engine/style-engine'
import type { CharacterVoice } from '../memory/character-memory'
import { formatCharacterVoiceConstraint } from '../memory/character-memory'
import type { CorrectionPlan } from './correction-builder'
import { buildCorrectionPrompt } from './correction-builder'
import { buildCorrectionSystemPrompt, buildCorrectionUserPrompt } from '../prompts/chapter/correction'
import type { StyleProfilePromptCard, StyleSafetyMode } from '@/types/style'

interface WriterInput extends AgentContext {
  outline: ChapterOutline
  characterProfiles: CharacterProfile[]
  recentSummaries: { chapterNo: number; summary: string }[]
  targetWordCount: number
  maxTokens?: number
  speedMode?: GenerationSpeedMode
  memoryContext?: string
  useEnhancedPrompt?: boolean
  provider?: AIProvider
  popularFictionProfile?: PopularFictionProfile | null
  /** 修正计划（修正模式下使用） */
  correctionPlan?: CorrectionPlan
  /** 原始内容（修正模式下使用） */
  originalContent?: string
  /** 角色声音指纹（注入对话风格约束） */
  characterVoices?: CharacterVoice[]
  /** 风格向量（调制写作风格） */
  styleVector?: StyleVector
  /** 风格预设名称 */
  stylePresetName?: string
  styleProfilePromptCard?: StyleProfilePromptCard | null
  styleStrength?: number
  styleSafetyMode?: StyleSafetyMode
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

  // 注入角色声音约束
  const voiceConstraints = (input.characterVoices || [])
    .filter(v => characterProfiles.some(c => c.name === v.name))
    .map(v => formatCharacterVoiceConstraint(v))
    .join('\n\n')

  // 修正模式：使用定向修正 prompt 替代创作 prompt
  let prompt: string
  let temperature = 0.7

  if (input.correctionPlan && input.originalContent) {
    prompt = buildCorrectionUserPrompt({
      chapterNo,
      chapterTitle: outline.chapterTitle,
      characterProfiles: characterProfilesStr,
      correctionInstructions: buildCorrectionPrompt(input.correctionPlan, input.originalContent),
      preserveSections: input.correctionPlan.preserveSections,
      originalContent: input.originalContent,
      worldSetting: context.worldSetting,
      targetWordCount: input.targetWordCount,
    })
    temperature = 0.4  // 修正模式需要更精确
  } else {
    prompt = buildWriterPrompt({
      projectTitle: context.projectTitle || "",
      genre: context.genre || "",
      writingStyle: context.writingStyle || "",
      memoryContext: input.memoryContext,
      worldSetting: context.worldSetting,
      powerSystem: context.powerSystem,
      chapterNo,
      outline,
      characterProfiles: characterProfilesStr,
      recentSummaries: recentSummaries.map(s => `第${s.chapterNo}章：${s.summary}`).join('\n'),
      targetWordCount: input.targetWordCount,
      popularFictionProfile: input.popularFictionProfile,
      voiceConstraints: voiceConstraints || undefined,
      styleDirective: input.styleVector ? buildStyleModulationPrompt(input.styleVector, input.stylePresetName) : undefined,
      styleProfilePromptCard: input.styleProfilePromptCard || null,
      styleStrength: input.styleStrength,
      styleSafetyMode: input.styleSafetyMode,
    })
  }

  // 流式生成
  const tokens: string[] = []
  for await (const token of provider.generateStream(prompt, {
    temperature,
    maxTokens: input.maxTokens,
  })) {
    tokens.push(token)
    onChunk?.(token)
  }

  return {
    content: tokens.join(''),
    tokens: tokens.length,
  }
}
