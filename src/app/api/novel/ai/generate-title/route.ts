import { NextRequest, NextResponse } from 'next/server'
import { buildTitleGenerationPrompt } from '@/lib/prompts'
import { createProviderFromEnv, createProviderFromConfigId, createProviderFromDefaultConfig } from '@/lib/ai'
import { AIVendor } from '@/types'
import { logError } from '@/lib/logger'
import { buildFallbackNovelTitle, isLikelyNovelTitle, normalizeNovelTitle } from '@/lib/novel-title'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      inspirationTitle,
      inspirationDescription,
      genre,
      writingStyle,
      targetAudience,
      vendor,
      aiModelId,
      fallbackTitle,
    } = body

    if (!inspirationTitle) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_INPUT', message: '灵感标题不能为空' } },
        { status: 400 }
      )
    }

    let provider
    if (aiModelId) {
      const dbProvider = await createProviderFromConfigId(aiModelId)
      if (dbProvider) {
        provider = dbProvider
      }
    }
    if (!provider) {
      if (vendor) {
        provider = createProviderFromEnv(vendor as AIVendor)
      } else {
        provider = await createProviderFromDefaultConfig()
      }
    }

    const prompt = buildTitleGenerationPrompt({
      inspirationTitle,
      inspirationDescription: inspirationDescription || '',
      genre,
      writingStyle,
      targetAudience,
    })

    const result = await provider.generate(prompt, {
      temperature: 0.9,
      maxTokens: 500,
    })

    const sourceText = [inspirationTitle, inspirationDescription].filter(Boolean).join(' ')
    let title: string | null = null
    let alternatives: string[] = []

    try {
      const jsonMatch = result.content.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0])
        title = typeof parsed.title === 'string' ? normalizeNovelTitle(parsed.title) : null
        alternatives = Array.isArray(parsed.alternatives)
          ? parsed.alternatives
            .filter((item: unknown): item is string => typeof item === 'string')
            .map((item: string) => normalizeNovelTitle(item))
            .filter((item: string) => isLikelyNovelTitle(item, sourceText))
          : []
      }
    } catch {
      const firstLine = normalizeNovelTitle(result.content)
      if (isLikelyNovelTitle(firstLine, sourceText)) {
        title = firstLine
      }
    }

    if (!title || !isLikelyNovelTitle(title, sourceText)) {
      title = buildFallbackNovelTitle({
        corePitch: inspirationDescription || inspirationTitle,
        description: `${inspirationTitle} ${inspirationDescription || ''}`,
        genre,
        fallbackTitle: typeof fallbackTitle === 'string' ? fallbackTitle : undefined,
      })
    }

    return NextResponse.json({
      success: true,
      data: {
        title,
        alternatives,
      },
    })
  } catch (error) {
    logError(error instanceof Error ? error : new Error(String(error)), { type: 'generate_title' })
    return NextResponse.json(
      { success: false, error: { code: 'GENERATION_ERROR', message: '生成标题失败' } },
      { status: 500 }
    )
  }
}
