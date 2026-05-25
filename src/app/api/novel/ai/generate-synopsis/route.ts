import { NextRequest, NextResponse } from 'next/server'
import { buildSynopsisGenerationPrompt } from '@/lib/ai/prompts'
import { createProviderFromEnv, createProviderFromDefaultConfig } from '@/lib/ai'
import { logError } from '@/lib/logger'
import { countChineseWords } from '@/lib/utils'

/**
 * POST /api/novel/ai/generate-synopsis
 * AI 生成/润色小说简介
 */
export async function POST(request: NextRequest) {
  let projectTitle: string | null = null
  try {
    const body = await request.json()
    projectTitle = body.projectTitle
    const {
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
      vendor,
    } = body

    if (!projectTitle) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_INPUT', message: '项目标题不能为空' } },
        { status: 400 }
      )
    }

    // 获取 AI Provider - 优先使用数据库默认配置，支持指定 vendor 回退环境变量
    let provider
    if (vendor) {
      provider = createProviderFromEnv(vendor)
    } else {
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
        wordCount: countChineseWords(result.content),
      },
    })
  } catch (error) {
    logError(error instanceof Error ? error : new Error(String(error)), { type: 'generate_synopsis', projectTitle })
    return NextResponse.json(
      { success: false, error: { code: 'GENERATION_ERROR', message: '生成简介失败' } },
      { status: 500 }
    )
  }
}
