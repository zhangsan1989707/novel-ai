import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { AIVendor } from '@/types'
import { logError } from '@/lib/logger'

// ============================================
// Schema 验证
// ============================================

const createAIConfigSchema = z.object({
  name: z.string().min(1, '请输入配置名称').max(100),
  vendor: z.nativeEnum(AIVendor),
  modelId: z.string().min(1, '请输入模型 ID'),
  apiKey: z.string().min(1, '请输入 API Key'),
  apiEndpoint: z.string().optional(),
  embeddingModelId: z.string().optional(),
  embeddingDimensions: z.number().int().positive().optional(),
  isDefault: z.boolean().default(false),
})

const updateAIConfigSchema = createAIConfigSchema.partial()

// ============================================
// GET /api/novel/ai-configs
// 获取 AI 配置列表
// ============================================

export async function GET() {
  try {
    const configs = await prisma.aIModelConfig.findMany({
      orderBy: [{ isDefault: 'desc' }, { sortOrder: 'asc' }, { createdAt: 'desc' }],
    })

    // 隐藏 API Key 的完整值
    const safeConfigs = configs.map((config) => ({
      ...config,
      apiKey: config.apiKey ? `${config.apiKey.slice(0, 4)}${'*'.repeat(Math.max(0, config.apiKey.length - 8))}${config.apiKey.slice(-4)}` : null,
    }))

    return NextResponse.json({
      success: true,
      data: safeConfigs,
    })
  } catch (error) {
    logError(error instanceof Error ? error : new Error(String(error)), { type: 'get_ai_configs' })
    return NextResponse.json(
      { success: false, error: { code: 'GET_ERROR', message: '获取配置失败' } },
      { status: 500 }
    )
  }
}

// ============================================
// POST /api/novel/ai-configs
// 创建 AI 配置
// ============================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const data = createAIConfigSchema.parse(body)

    // 如果设置为默认，先取消其他默认
    if (data.isDefault) {
      await prisma.aIModelConfig.updateMany({
        where: { isDefault: true },
        data: { isDefault: false },
      })
    }

    const config = await prisma.aIModelConfig.create({
      data,
    })

    return NextResponse.json({ success: true, data: config }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: error.issues[0]?.message || '验证失败' } },
        { status: 400 }
      )
    }
    logError(error instanceof Error ? error : new Error(String(error)), { type: 'create_ai_config' })
    return NextResponse.json(
      { success: false, error: { code: 'CREATE_ERROR', message: '创建配置失败' } },
      { status: 500 }
    )
  }
}
