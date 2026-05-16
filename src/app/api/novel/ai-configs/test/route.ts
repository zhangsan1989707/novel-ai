import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAIProvider } from '@/lib/ai'
import { AIVendor } from '@/types'
import { logError } from '@/lib/logger'

// ============================================
// Schema 验证
// ============================================

const testConfigSchema = z.object({
  vendor: z.nativeEnum(AIVendor),
  modelId: z.string().min(1, '请输入模型 ID'),
  apiKey: z.string().min(1, '请输入 API Key'),
  apiEndpoint: z.string().optional(),
})

// ============================================
// POST /api/novel/ai-configs/test
// 测试 AI 配置（临时，不保存）
// ============================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { vendor, modelId, apiKey, apiEndpoint } = testConfigSchema.parse(body)

    // 获取 Provider 并配置
    const provider = getAIProvider(vendor, {
      vendor,
      modelId,
      apiKey,
      apiEndpoint: apiEndpoint || undefined,
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
    if (error instanceof z.ZodError) {
      
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: error.issues[0]?.message || '验证失败' } },
        { status: 400 }
      )
    }
    logError(error instanceof Error ? error : new Error(String(error)), { type: 'test_ai_config' })
    return NextResponse.json(
      { success: false, error: { code: 'TEST_ERROR', message: '测试失败' } },
      { status: 500 }
    )
  }
}
