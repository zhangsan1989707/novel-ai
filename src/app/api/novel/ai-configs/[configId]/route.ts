import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { AIVendor } from '@/types'
import { logError } from '@/lib/logger'

// ============================================
// Schema 验证
// ============================================

const updateAIConfigSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  vendor: z.nativeEnum(AIVendor).optional(),
  modelId: z.string().min(1).optional(),
  apiKey: z.string().optional(), // 允许为空，表示不更新
  apiEndpoint: z.string().optional(),
  embeddingVendor: z.nativeEnum(AIVendor).optional(),
  embeddingApiKey: z.string().optional(),
  embeddingApiEndpoint: z.string().optional(),
  embeddingModelId: z.string().optional(),
  embeddingDimensions: z.number().int().positive().optional(),
  isDefault: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
})

// ============================================
// GET /api/novel/ai-configs/[configId]
// 获取单个 AI 配置
// ============================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ configId: string }> }
) {
  let id: number | null = null
  try {
    const { configId } = await params
    id = parseInt(configId)

    if (isNaN(id)) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_ID', message: '无效的 ID' } },
        { status: 400 }
      )
    }

    const config = await prisma.aIModelConfig.findUnique({
      where: { id },
    })

    if (!config) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: '配置不存在' } },
        { status: 404 }
      )
    }

    // 隐藏 API Key
    const safeConfig = {
      ...config,
      apiKey: config.apiKey ? `${config.apiKey.slice(0, 4)}${'*'.repeat(Math.max(0, config.apiKey.length - 8))}${config.apiKey.slice(-4)}` : null,
      embeddingApiKey: config.embeddingApiKey ? `${config.embeddingApiKey.slice(0, 4)}${'*'.repeat(Math.max(0, config.embeddingApiKey.length - 8))}${config.embeddingApiKey.slice(-4)}` : null,
    }

    return NextResponse.json({ success: true, data: safeConfig })
  } catch (error) {
    logError(error instanceof Error ? error : new Error(String(error)), { type: 'get_ai_config', configId: id })
    return NextResponse.json(
      { success: false, error: { code: 'GET_ERROR', message: '获取配置失败' } },
      { status: 500 }
    )
  }
}

// ============================================
// PUT /api/novel/ai-configs/[configId]
// 更新 AI 配置
// ============================================

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ configId: string }> }
) {
  let id: number | null = null
  try {
    const { configId } = await params
    id = parseInt(configId)

    if (isNaN(id)) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_ID', message: '无效的 ID' } },
        { status: 400 }
      )
    }

    const body = await request.json()
    const data = updateAIConfigSchema.parse(body)

    // 获取现有配置，用于保留 API Key（如果未提供新的）
    const existingConfig = await prisma.aIModelConfig.findUnique({
      where: { id },
    })

    if (!existingConfig) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: '配置不存在' } },
        { status: 404 }
      )
    }

    // 如果取消默认且当前是唯一默认，阻止操作
    if (data.isDefault === false && existingConfig.isDefault) {
      const otherDefaults = await prisma.aIModelConfig.count({
        where: { isDefault: true, id: { not: id } },
      })

      if (otherDefaults === 0) {
        return NextResponse.json(
          { success: false, error: { code: 'LAST_DEFAULT', message: '无法取消最后一个默认配置，请先将其他配置设为默认' } },
          { status: 400 }
        )
      }
    }

    // 如果设置为默认，先取消其他默认
    if (data.isDefault) {
      await prisma.aIModelConfig.updateMany({
        where: { isDefault: true, id: { not: id } },
        data: { isDefault: false },
      })
    }

    // 准备更新数据，如果 apiKey 为空则保留原值
    const updateData: any = { ...data }
    if (!updateData.apiKey || updateData.apiKey.trim() === '') {
      delete updateData.apiKey
    }

    const config = await prisma.aIModelConfig.update({
      where: { id },
      data: updateData,
    })

    return NextResponse.json({ success: true, data: config })
  } catch (error) {
    if (error instanceof z.ZodError) {
      
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: error.issues[0]?.message || '验证失败' } },
        { status: 400 }
      )
    }
    logError(error instanceof Error ? error : new Error(String(error)), { type: 'update_ai_config', configId: id })
    return NextResponse.json(
      { success: false, error: { code: 'UPDATE_ERROR', message: '更新配置失败' } },
      { status: 500 }
    )
  }
}

// ============================================
// DELETE /api/novel/ai-configs/[configId]
// 删除 AI 配置
// ============================================

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ configId: string }> }
) {
  let id: number | null = null
  try {
    const { configId } = await params
    id = parseInt(configId)

    if (isNaN(id)) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_ID', message: '无效的 ID' } },
        { status: 400 }
      )
    }

    // 检查是否为当前默认配置
    const config = await prisma.aIModelConfig.findUnique({
      where: { id },
    })

    if (!config) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: '配置不存在' } },
        { status: 404 }
      )
    }

    if (config.isDefault) {
      // 检查是否还有其他配置
      const otherConfigs = await prisma.aIModelConfig.count({
        where: { id: { not: id } },
      })

      if (otherConfigs === 0) {
        return NextResponse.json(
          { success: false, error: { code: 'LAST_CONFIG', message: '无法删除最后一个配置' } },
          { status: 400 }
        )
      }
    }

    await prisma.aIModelConfig.delete({
      where: { id },
    })

    return NextResponse.json({ success: true, data: null })
  } catch (error) {
    logError(error instanceof Error ? error : new Error(String(error)), { type: 'delete_ai_config', configId: id })
    return NextResponse.json(
      { success: false, error: { code: 'DELETE_ERROR', message: '删除配置失败' } },
      { status: 500 }
    )
  }
}
