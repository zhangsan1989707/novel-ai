import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getAIProvider } from '@/lib/ai'
import { AIVendor } from '@/types'
import { logError } from '@/lib/logger'

// ============================================
// POST /api/novel/ai-configs/[configId]/test
// 测试 AI 配置
// ============================================

export async function POST(
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

    // 获取配置
    const config = await prisma.aIModelConfig.findUnique({
      where: { id },
    })

    if (!config) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: '配置不存在' } },
        { status: 404 }
      )
    }

    // 获取 Provider 并配置
    const provider = getAIProvider(config.vendor as AIVendor, {
      vendor: config.vendor as AIVendor,
      modelId: config.modelId,
      apiKey: config.apiKey || '',
      apiEndpoint: config.apiEndpoint || undefined,
    })

    // 发送测试请求
    const testPrompt = '你好，请回复"测试成功"确认连接正常。'

    try {
      const result = await provider.generate(testPrompt, {
        temperature: 0.7,
        maxTokens: 100,
      })

      return NextResponse.json({
        success: true,
        data: {
          message: '测试成功',
          response: result.content,
          usage: result.usage,
        },
      })
    } catch (apiError) {
      const errorMessage = apiError instanceof Error ? apiError.message : 'API 调用失败'

      // 提取更有用的错误信息
      let detailMessage = errorMessage
      if (errorMessage.includes('401')) {
        detailMessage = 'API Key 无效或已过期'
      } else if (errorMessage.includes('403')) {
        detailMessage = 'API Key 权限不足'
      } else if (errorMessage.includes('429')) {
        detailMessage = '请求过于频繁，请稍后重试'
      } else if (errorMessage.includes('500') || errorMessage.includes('502') || errorMessage.includes('503')) {
        detailMessage = 'AI 服务端错误，请稍后重试'
      } else if (errorMessage.includes('fetch') || errorMessage.includes('network')) {
        detailMessage = '网络连接失败，请检查网络或 API 端点'
      }

      return NextResponse.json({
        success: false,
        error: {
          code: 'API_ERROR',
          message: detailMessage,
          original: errorMessage,
        },
      }, { status: 200 })
    }
  } catch (error) {
    logError(error instanceof Error ? error : new Error(String(error)), { type: 'test_ai_config', configId: id })
    return NextResponse.json(
      { success: false, error: { code: 'TEST_ERROR', message: '测试失败' } },
      { status: 500 }
    )
  }
}
