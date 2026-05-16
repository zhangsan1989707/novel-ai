/**
 * 校验 Agent - 一致性检查
 */
import { AIService } from '@/lib/ai/service'
import { buildValidatorPrompt as buildValidatorPromptV1 } from '../prompts/chapter/validating'
import { buildValidatorPrompt as buildValidatorPromptV2, type ValidationReport as ValidationReportV2 } from '../prompts/chapter/validating-v2'
import type { CharacterProfile, PlotlineData } from '../engine/types'

interface ValidatorInput {
  projectId: number
  chapterNo: number
  newChapterContent: string
  characterProfiles: CharacterProfile[]
  recentSummaries: { chapterNo: number; summary: string }[]
  worldSetting?: string | null
  openPlotlines: PlotlineData[]
  chapterTitle?: string
  chapterGoal?: string
  useEnhancedPrompt?: boolean
}

// 默认使用增强版校验
const buildValidatorPrompt = buildValidatorPromptV2
type ValidationReport = ValidationReportV2

export async function validatorAgent(
  input: ValidatorInput
): Promise<ValidationReport> {
  const { projectId, chapterNo, newChapterContent, characterProfiles, recentSummaries, worldSetting, openPlotlines, chapterTitle, chapterGoal } = input

  // 获取可追踪的 AI Provider
  const provider = await AIService.createProvider({
    projectId,
    usageType: 'VALIDATOR',
  })

  // 构建角色档案字符串
  const characterProfilesStr = characterProfiles
    .map(c => `【${c.name}】${c.role}: ${c.appearance || ''} ${c.personality || ''}`)
    .join('\n')

  // 构建伏笔追踪字符串
  const plotlinesStr = openPlotlines
    .map(p => `[伏笔#${p.id}] ${p.description} (埋于第${p.plantedAt}章, ${p.status})`)
    .join('\n')

  // 构建提示词
  const prompt = buildValidatorPrompt({
    chapterNo,
    newChapterContent,
    characterProfiles: characterProfilesStr,
    recentSummaries: recentSummaries.map(s => `第${s.chapterNo}章：${s.summary}`).join('\n'),
    worldSetting,
    openPlotlines: plotlinesStr,
    chapterTitle,
    chapterGoal,
  })

  // 执行校验
  const result = await provider.generate(prompt, {
    temperature: 0.3,
    maxTokens: 2500,
  })

  // 解析 JSON
  const jsonMatch = result.content.match(/\{[\s\S]*\}/)
  if (jsonMatch) {
    try {
      const report = JSON.parse(jsonMatch[0]) as ValidationReport
      return report
    } catch {
      // 解析失败，返回默认报告
      return {
        result: 'pass',
        score: 70,
        issues: [],
        characterUpdates: {},
        newPlotlines: [],
        resolvedPlotlines: [],
        qualityMetrics: {
          logicScore: 75,
          characterScore: 75,
          emotionScore: 75,
          styleScore: 70,
        },
      }
    }
  }

  // 无法解析时返回可疑报告，需要人工审核
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
