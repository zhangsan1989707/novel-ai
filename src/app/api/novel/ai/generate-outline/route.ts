import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createProviderFromDefaultConfig, buildOutlineGenerationPrompt } from '@/lib/ai'
import { AIVendor } from '@/types'
import { logger, logError } from '@/lib/logger'

// ============================================
// Schema 验证
// ============================================

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
  vendor: vendorEnum.default('DEEPSEEK'),
  temperature: z.number().min(0).max(2).default(0.7),
})

// ============================================
// API Handler
// ============================================

/**
 * POST /api/novel/ai/generate-outline
 * AI 生成小说大纲
 */
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
      vendor,
      temperature,
    } = generateOutlineSchema.parse(body)

    // 构建提示词
    const prompt = buildOutlineGenerationPrompt(
      projectTitle,
      genre,
      writingStyle,
      worldSetting,
      protagonistProfile,
      protagonistGoal,
      antagonistSetting,
      endingPlan
    )

    // 获取 AI Provider - 优先使用数据库默认配置
    const provider = await createProviderFromDefaultConfig()

    // 生成
    const result = await provider.generate(prompt, { temperature })

    // 尝试解析 JSON
    let outlineStages = null
    try {
      // 尝试从结果中提取 JSON
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
      { success: false, error: { code: 'GENERATE_ERROR', message: '生成大纲失败' } },
      { status: 500 }
    )
  }
}
