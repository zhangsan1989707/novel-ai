import { NextRequest, NextResponse } from 'next/server'
import { buildTitleGenerationPrompt } from '@/lib/prompts'
import { createProviderFromEnv, createProviderFromConfigId, getDefaultVendor } from '@/lib/ai'
import { AIVendor } from '@/types'
import { logError } from '@/lib/logger'

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
      const selectedVendor = (vendor || getDefaultVendor()) as AIVendor
      provider = createProviderFromEnv(selectedVendor)
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

    let title: string | null = null
    let alternatives: string[] = []

    try {
      const jsonMatch = result.content.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0])
        title = parsed.title || null
        alternatives = Array.isArray(parsed.alternatives) ? parsed.alternatives : []
      }
    } catch {
      const firstLine = result.content.trim().split('\n')[0].replace(/["""「」《》]/g, '').trim()
      if (firstLine && firstLine.length <= 20) {
        title = firstLine
      }
    }

    if (!title) {
      title = inspirationTitle
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
