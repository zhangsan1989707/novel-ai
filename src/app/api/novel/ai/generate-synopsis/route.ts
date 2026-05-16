import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { buildSynopsisGenerationPrompt } from '@/lib/ai/prompts'
import { getAIProvider, createProviderFromDefaultConfig } from '@/lib/ai/factory'
import { AIVendor } from '@/types'
import { logError } from '@/lib/logger'

/**
 * POST /api/novel/ai/generate-synopsis
 * AI 生成/润色小说简介
 */
export async function POST(request: NextRequest) {
  let projectId: number | null = null
  try {
    const body = await request.json()
    projectId = body.projectId
    const {
      projectTitle,
      existingSynopsis,
      targetAudience,
      genre,
      writingStyle,
      worldSetting,
      powerSystem,
      protagonistProfile,
      protagonistGoal,
      antagonistSetting,
      endingPlan,
      outline,
      targetWordCount,
      aiModelId,
    } = body

    if (!projectTitle) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_INPUT', message: '项目标题不能为空' } },
        { status: 400 }
      )
    }

    // 获取 AI Provider
    let provider
    if (aiModelId) {
      const modelConfig = await prisma.aIModelConfig.findUnique({
        where: { id: aiModelId },
      })
      if (modelConfig) {
        provider = getAIProvider(modelConfig.vendor as AIVendor, {
          vendor: modelConfig.vendor as AIVendor,
          modelId: modelConfig.modelId,
          apiKey: modelConfig.apiKey || '',
          apiEndpoint: modelConfig.apiEndpoint || undefined,
        })
      }
    }

    if (!provider) {
      // 使用默认的 AI provider
      provider = await createProviderFromDefaultConfig()
    }

    // 构建提示词
    const prompt = buildSynopsisGenerationPrompt({
      projectTitle,
      existingSynopsis,
      targetAudience,
      genre,
      writingStyle,
      worldSetting,
      powerSystem,
      protagonistProfile,
      protagonistGoal,
      antagonistSetting,
      endingPlan,
      outline,
      targetWordCount,
    })

    // 生成内容
    const result = await provider.generate(prompt, {
      temperature: 0.7,
      maxTokens: 2000,
    })

    return NextResponse.json({
      success: true,
      data: {
        synopsis: result.content,
        wordCount: result.content.length,
      },
    })
  } catch (error) {
    logError(error instanceof Error ? error : new Error(String(error)), { type: 'generate_synopsis', projectId })
    return NextResponse.json(
      { success: false, error: { code: 'GENERATION_ERROR', message: '生成简介失败' } },
      { status: 500 }
    )
  }
}
