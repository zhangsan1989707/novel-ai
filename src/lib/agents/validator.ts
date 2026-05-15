/**
 * 校验 Agent - 一致性检查
 */
import { prisma } from '@/lib/prisma'
import { getAIProvider, createProviderFromDefaultConfig } from '@/lib/ai/factory'
import { AIVendor } from '@/types'
import { buildValidatorPrompt } from './prompts'
import type { ValidationReport, CharacterProfile, PlotlineData } from '../engine/types'

interface ValidatorInput {
  projectId: number
  chapterNo: number
  newChapterContent: string
  characterProfiles: CharacterProfile[]
  recentSummaries: { chapterNo: number; summary: string }[]
  worldSetting?: string | null
  openPlotlines: PlotlineData[]
}

export async function validatorAgent(
  input: ValidatorInput
): Promise<ValidationReport> {
  const { projectId, chapterNo, newChapterContent, characterProfiles, recentSummaries, worldSetting, openPlotlines } = input

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
  })

  // 执行校验
  const result = await provider.generate(prompt, {
    temperature: 0.3,
    maxTokens: 2000,
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
      }
    }
  }

  // 无法解析时返回可疑报告，需要人工审核
  return {
    result: 'retry',
    score: 50,
    issues: [{
      type: 'worldview',
      description: '无法解析校验结果，可能存在格式问题',
      location: '全文',
      reference: '校验输出',
    }],
    characterUpdates: {},
    newPlotlines: [],
    resolvedPlotlines: [],
  }
}
