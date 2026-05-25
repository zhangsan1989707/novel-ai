import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { generateVolumeSummary } from '@/lib/engine/summarizer'
import { AIVendor } from '@/types'
import { logError } from '@/lib/logger'

const vendorEnum = z.enum(['OPENAI', 'ANTHROPIC', 'ALIBABA', 'DEEPSEEK', 'MINIMAX', 'VOLCENGINE', 'ZHIPU'])

const requestSchema = z.object({
  projectId: z.number().int().positive(),
  volumeNumber: z.number().int().min(1),
  vendor: vendorEnum.default('DEEPSEEK'),
})

/**
 * POST /api/novel/ai/generate-volume-summary
 * 生成指定卷的摘要 (L2)
 */
export async function POST(request: NextRequest) {
  let projectId: number | null = null
  let volumeNumber: number | null = null
  try {
    const body = await request.json()
    const parsed = requestSchema.parse(body)
    projectId = parsed.projectId
    volumeNumber = parsed.volumeNumber
    const { vendor } = parsed

    const result = await generateVolumeSummary(projectId, volumeNumber, vendor as AIVendor)

    return NextResponse.json({
      success: result.success,
      data: {
        level: result.level,
        summary: result.summary,
      },
      error: result.error ? { message: result.error } : null,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: error.issues[0]?.message } },
        { status: 400 }
      )
    }
    logError(error instanceof Error ? error : new Error(String(error)), { type: 'generate_volume_summary', projectId, volumeNumber })
    return NextResponse.json(
      { success: false, error: { code: 'GENERATE_ERROR', message: '生成卷摘要失败' } },
      { status: 500 }
    )
  }
}