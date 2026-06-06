import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { generateBookSummary } from '@/lib/engine/summarizer'
import { AIVendor } from '@/types'
import { logError } from '@/lib/logger'
import { requireProjectOwner, projectNotFoundResponse } from '@/lib/server/project-access'

const vendorEnum = z.enum(['OPENAI', 'ANTHROPIC', 'ALIBABA', 'DEEPSEEK', 'MINIMAX', 'VOLCENGINE', 'ZHIPU'])

const requestSchema = z.object({
  projectId: z.number().int().positive(),
  vendor: vendorEnum.default('DEEPSEEK'),
})

/**
 * POST /api/novel/ai/generate-book-summary
 * 生成全书摘要 (L3)
 */
export async function POST(request: NextRequest) {
  let projectId: number | null = null
  try {
    const body = await request.json()
    const parsed = requestSchema.parse(body)
    projectId = parsed.projectId
    const { vendor } = parsed

    // 项目所有权校验
    const projectAccess = await requireProjectOwner(projectId)
    if (!projectAccess) {
      return projectNotFoundResponse()
    }

    const result = await generateBookSummary(projectId, vendor as AIVendor)

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
    logError(error instanceof Error ? error : new Error(String(error)), { type: 'generate_book_summary', projectId })
    return NextResponse.json(
      { success: false, error: { code: 'GENERATE_ERROR', message: '生成全书摘要失败' } },
      { status: 500 }
    )
  }
}