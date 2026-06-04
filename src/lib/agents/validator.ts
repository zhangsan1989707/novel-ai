/**
 * 校验 Agent - 一致性检查
 */
import { AIService } from '@/lib/ai/service'
import type { AIProvider } from '@/lib/ai/types'
import { buildValidatorPrompt as buildValidatorPromptV2, type ValidationReport as ValidationReportV2 } from '../prompts/chapter/validating-v2'
import type { CharacterProfile, PlotlineData } from '../engine/types'
import type { PopularFictionProfile } from '../engine/popular-fiction'
import type { CharacterVoice } from '../memory/character-memory'
import { formatCharacterVoiceConstraint } from '../memory/character-memory'
import { parseAiJsonObject } from '@/lib/engine/ai-json'

interface ValidatorInput {
  projectId: number
  chapterNo: number
  newChapterContent: string
  characterProfiles: CharacterProfile[]
  recentSummaries: { chapterNo: number; summary: string }[]
  memoryContext?: string
  worldSetting?: string | null
  openPlotlines: PlotlineData[]
  chapterTitle?: string
  chapterGoal?: string
  useEnhancedPrompt?: boolean
  provider?: AIProvider
  popularFictionProfile?: PopularFictionProfile | null
  characterVoices?: CharacterVoice[]
}

// 默认使用增强版校验
const buildValidatorPrompt = buildValidatorPromptV2
export type ValidatorValidationReport = ValidationReportV2

export async function validatorAgent(
  input: ValidatorInput
): Promise<ValidatorValidationReport> {
  const { projectId, chapterNo, newChapterContent, characterProfiles, recentSummaries, worldSetting, openPlotlines, chapterTitle, chapterGoal } = input

  // 获取可追踪的 AI Provider
  const provider = input.provider || await AIService.createProvider({
    projectId,
    usageType: 'VALIDATOR',
  })

  // 构建角色档案字符串（完整数据）
  const characterProfilesStr = characterProfiles.map(c => {
    const parts = [`【${c.name}】(${c.role})`]
    if (c.appearance) parts.push(`外貌：${c.appearance}`)
    if (c.personality) parts.push(`性格：${c.personality}`)
    if (c.background) parts.push(`背景：${c.background}`)
    if (c.catchphrases?.length) parts.push(`口头禅：${c.catchphrases.join('、')}`)
    if (c.relationships && Object.keys(c.relationships).length > 0) parts.push(`关系：${JSON.stringify(c.relationships)}`)
    if (c.currentState && Object.keys(c.currentState).length > 0) parts.push(`当前状态：${JSON.stringify(c.currentState)}`)
    return parts.join('；')
  }).join('\n')

  // 注入角色声音约束
  const voiceConstraints = (input.characterVoices || [])
    .filter(v => characterProfiles.some(c => c.name === v.name))
    .map(v => formatCharacterVoiceConstraint(v))
    .join('\n\n')

  // 构建伏笔追踪字符串
  const plotlinesStr = openPlotlines
    .map(p => `[伏笔#${p.id}] ${p.description} (埋于第${p.plantedAt}章, ${p.status})`)
    .join('\n')

  // 构建提示词
  const fullCharacterSection = voiceConstraints
    ? `${characterProfilesStr}\n\n${voiceConstraints}`
    : characterProfilesStr

  const prompt = buildValidatorPrompt({
    chapterNo,
    newChapterContent,
    characterProfiles: fullCharacterSection,
    memoryContext: input.memoryContext,
    recentSummaries: recentSummaries.map(s => `第${s.chapterNo}章：${s.summary}`).join('\n'),
    worldSetting,
    openPlotlines: plotlinesStr,
    chapterTitle,
    chapterGoal,
    popularFictionProfile: input.popularFictionProfile,
  })

  // 执行校验
  const result = await provider.generate(prompt, {
    temperature: 0.3,
    maxTokens: 2500,
  })

  // 解析 JSON
  try {
    const report = parseAiJsonObject<ValidatorValidationReport>(result.content)
    return report
  } catch {
    return {
      result: 'retry',
      score: 40,
      issues: [{
        type: 'worldview',
        severity: 'major',
        description: '校验结果解析失败，需要重试',
        location: '全文',
        reference: '校验输出',
      }],
      characterUpdates: {},
      newPlotlines: [],
      resolvedPlotlines: [],
      qualityMetrics: {
        logicScore: 40,
        characterScore: 40,
        emotionScore: 40,
        styleScore: 40,
      },
    }
  }

  return {
    result: 'retry',
    score: 50,
    issues: [{
      type: 'worldview',
      severity: 'major',
      description: '无法解析校验结果，可能存在格式问题',
      location: '全文',
      reference: '校验输出',
    }],
    characterUpdates: {},
    newPlotlines: [],
    resolvedPlotlines: [],
    qualityMetrics: {
      logicScore: 50,
      characterScore: 50,
      emotionScore: 50,
      styleScore: 50,
    },
  }
}
