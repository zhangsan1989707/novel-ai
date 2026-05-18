import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { analyzeOriginalStyle } from '@/lib/ai/style-analyzer'
import { AIVendor } from '@/types'
import { logError } from '@/lib/logger'

const vendorEnum = z.enum(['OPENAI', 'ANTHROPIC', 'ALIBABA', 'DEEPSEEK', 'MINIMAX', 'VOLCENGINE', 'ZHIPU'])

const requestSchema = z.object({
  vendor: vendorEnum.default('DEEPSEEK'),
})

/**
 * POST /api/novel/ai/analyze-style/[projectId]
 * 分析原文风格
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  let projectIdNum: number | null = null
  try {
    const { projectId } = await params
    projectIdNum = parseInt(projectId, 10)

    if (isNaN(projectIdNum)) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: '无效的项目ID' } },
        { status: 400 }
      )
    }

    const body = await request.json().catch(() => ({}))
    const { vendor } = requestSchema.parse(body)

    const result = await analyzeOriginalStyle(projectIdNum, vendor as AIVendor)

    return NextResponse.json({
      success: result.success,
      data: result.styleProfile,
      error: result.error ? { message: result.error } : null,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: error.issues[0]?.message } },
        { status: 400 }
      )
    }
    logError(error instanceof Error ? error : new Error(String(error)), { type: 'analyze_style', projectId: projectIdNum })
    return NextResponse.json(
      { success: false, error: { code: 'ANALYZE_ERROR', message: '分析文风失败' } },
      { status: 500 }
    )
  }
}