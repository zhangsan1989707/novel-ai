import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createProviderFromEnv, createProviderFromConfigId, buildOutlineGenerationPrompt, getDefaultVendor } from '@/lib/ai'
import { AIVendor } from '@/types'
import { logError } from '@/lib/logger'

const vendorEnum = z.enum(['OPENAI', 'ANTHROPIC', 'ALIBABA', 'DEEPSEEK', 'MINIMAX', 'VOLCENGINE'])

const generateOutlineSchema = z.object({
  projectTitle: z.string().min(1, '请输入小说标题'),
  genre: z.string().optional(),
  writingStyle: z.string().optional(),
  worldSetting: z.string().optional(),
  protagonistProfile: z.string().optional(),
  protagonistGoal: z.string().optional(),
  antagonistSetting: z.string().optional(),
  endingPlan: z.string().optional(),
  aiModelId: z.number().int().positive().optional(),
  vendor: vendorEnum.optional(),
  temperature: z.number().min(0).max(2).default(0.7),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      projectTitle,
      genre,
      writingStyle,
      worldSetting,
      protagonistProfile,
      protagonistGoal,
      antagonistSetting,
      endingPlan,
      aiModelId,
      vendor: requestedVendor,
      temperature,
    } = generateOutlineSchema.parse(body)

    const prompt = buildOutlineGenerationPrompt({
      projectTitle,
      genre,
      writingStyle,
      worldSetting,
      protagonistProfile,
      protagonistGoal,
      antagonistSetting,
      endingPlan
    })

    // 优先使用指定的 AI 模型配置，其次使用 vendor，最后使用默认
    let provider
    if (aiModelId) {
      const dbProvider = await createProviderFromConfigId(aiModelId)
      if (dbProvider) {
        provider = dbProvider
      }
    }
    if (!provider) {
      const vendor = (requestedVendor || getDefaultVendor()) as AIVendor
      provider = createProviderFromEnv(vendor)
    }

    const result = await provider.generate(prompt, { temperature })

    let outlineStages = null
    try {
      const jsonMatch = result.content.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        outlineStages = JSON.parse(jsonMatch[0])
      }
    } catch {
      // 解析失败，返回原始内容
    }

    return NextResponse.json({
      success: true,
      data: {
        outline: result.content,
        outlineStages,
        usage: result.usage,
      },
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: error.issues[0]?.message || '验证失败' } },
        { status: 400 }
      )
    }
    logError(error instanceof Error ? error : new Error(String(error)), { type: 'generate_outline' })
    return NextResponse.json(
      { success: false, error: { code: 'GENERATE_ERROR', message: error instanceof Error ? error.message : '生成大纲失败' } },
      { status: 500 }
    )
  }
}
