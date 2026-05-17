import { NextRequest, NextResponse } from 'next/server'
import { buildIdeaGenerationPrompt } from '@/lib/ai/prompts'
import { createProviderFromEnv, getDefaultVendor } from '@/lib/ai'
import { logError } from '@/lib/logger'

/**
 * POST /api/novel/ai/generate-idea
 * AI 生成小说创意设定（世界观、主角人设、力量体系等）
 */
export async function POST(request: NextRequest) {
  let projectTitle: string | null = null
  try {
    const body = await request.json()
    projectTitle = body.projectTitle
    const {
      genre,
      writingStyle,
      existingWorldSetting,
      existingPowerSystem,
      existingProtagonistProfile,
      existingProtagonistGoal,
      existingAntagonistSetting,
      existingEndingPlan,
      vendor,
    } = body

    if (!projectTitle) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_INPUT', message: '项目标题不能为空' } },
        { status: 400 }
      )
    }

    // 获取 AI Provider - 直接使用环境变量
    const selectedVendor = vendor || getDefaultVendor()
    const provider = createProviderFromEnv(selectedVendor)

    // 构建提示词
    const prompt = buildIdeaGenerationPrompt({
      theme: projectTitle!,
      genre,
      writingStyle
    })

    // 生成内容
    const result = await provider.generate(prompt, {
      temperature: 0.8,
      maxTokens: 4000,
    })

    // 解析生成的 JSON
    let generatedIdea
    try {
      const jsonMatch = result.content.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        generatedIdea = JSON.parse(jsonMatch[0])
      } else {
        return NextResponse.json({
          success: true,
          data: {
            raw: result.content,
          },
        })
      }
    } catch {
      return NextResponse.json({
        success: true,
        data: {
          raw: result.content,
        },
      })
    }

    // 合并已有设定和生成设定
    const formatField = (existing: string | undefined, generated: unknown): string => {
      if (existing) return existing
      if (!generated) return ''
      if (typeof generated === 'string') return generated
      if (typeof generated === 'object') return JSON.stringify(generated, null, 2)
      return String(generated)
    }

    return NextResponse.json({
      success: true,
      data: {
        worldSetting: formatField(existingWorldSetting, generatedIdea.worldSetting || generatedIdea.worldSettingDescription),
        powerSystem: formatField(existingPowerSystem, generatedIdea.powerSystem || generatedIdea.powerSystemDescription),
        protagonistProfile: formatField(existingProtagonistProfile, generatedIdea.protagonistProfile || generatedIdea.mainCharacter || generatedIdea.protagonist),
        protagonistGoal: formatField(existingProtagonistGoal, generatedIdea.protagonistGoal || generatedIdea.mainCharacterGoal),
        antagonistSetting: formatField(existingAntagonistSetting, generatedIdea.antagonistSetting || generatedIdea.antagonist),
        endingPlan: formatField(existingEndingPlan, generatedIdea.endingPlan || generatedIdea.ending),
      },
    })
  } catch (error) {
    logError(error instanceof Error ? error : new Error(String(error)), { type: 'generate_idea', projectTitle })
    return NextResponse.json(
      { success: false, error: { code: 'GENERATION_ERROR', message: '生成创意设定失败' } },
      { status: 500 }
    )
  }
}
