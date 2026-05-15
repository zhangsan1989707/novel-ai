import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createProviderFromDefaultConfig, getAIProvider } from '@/lib/ai'
import { AIVendor } from '@/types'
import { prisma } from '@/lib/prisma'
import { buildChapterListPrompt } from '@/lib/ai/prompts'
import { logError } from '@/lib/logger'

const vendorEnum = z.enum(['OPENAI', 'ANTHROPIC', 'ALIBABA', 'DEEPSEEK', 'MINIMAX', 'VOLCENGINE'])

const generateChapterListSchema = z.object({
  projectTitle: z.string().min(1, '请输入小说标题'),
  genre: z.string().optional(),
  writingStyle: z.string().optional(),
  worldSetting: z.string().optional(),
  protagonistProfile: z.string().optional(),
  protagonistGoal: z.string().optional(),
  antagonistSetting: z.string().optional(),
  endingPlan: z.string().optional(),
  totalChapters: z.number().int().positive().max(500).default(50),
  titleStyle: z.enum(['webnovel', 'traditional', 'poetry']).default('webnovel'),
  aiModelId: z.number().int().positive().optional(),
  vendor: vendorEnum.default('DEEPSEEK'),
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
      totalChapters,
      titleStyle,
      aiModelId,
      vendor,
      temperature,
    } = generateChapterListSchema.parse(body)

    const prompt = buildChapterListPrompt(
      projectTitle,
      genre,
      writingStyle,
      worldSetting,
      protagonistProfile,
      protagonistGoal,
      antagonistSetting,
      endingPlan,
      totalChapters,
      titleStyle
    )

    let provider
    let configError = ''

    if (aiModelId) {
      const config = await prisma.aIModelConfig.findUnique({
        where: { id: aiModelId },
      })
      if (config && config.apiKey && config.apiKey !== 'your-api-key-placeholder') {
        provider = getAIProvider(config.vendor as AIVendor, {
          vendor: config.vendor as AIVendor,
          modelId: config.modelId,
          apiKey: config.apiKey,
          apiEndpoint: config.apiEndpoint || undefined,
        })
      } else {
        configError = 'AI模型配置无效或未设置API密钥'
        provider = await createProviderFromDefaultConfig()
      }
    } else {
      provider = await createProviderFromDefaultConfig()
    }

    if (configError) {
      return NextResponse.json(
        { success: false, error: { code: 'CONFIG_ERROR', message: configError } },
        { status: 400 }
      )
    }

    const result = await provider.generate(prompt, { temperature })

    let chapterList = null
    try {
      const jsonMatch = result.content.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        // 清理 AI 常见的 JSON 格式问题（尾随逗号）
        const cleaned = jsonMatch[0]
          .replace(/,\s*([\]}])/g, '$1')
        chapterList = JSON.parse(cleaned)
      }
    } catch {
      // 解析失败
    }

    return NextResponse.json({
      success: true,
      data: {
        content: result.content,
        chapterList,
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
    logError(error instanceof Error ? error : new Error(String(error)), { type: 'generate_chapter_list' })
    return NextResponse.json(
      { success: false, error: { code: 'GENERATE_ERROR', message: '生成章节列表失败' } },
      { status: 500 }
    )
  }
}
