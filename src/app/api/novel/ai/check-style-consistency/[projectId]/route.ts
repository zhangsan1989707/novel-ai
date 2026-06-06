import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { checkStyleConsistency } from '@/lib/ai/style-analyzer'
import { AIVendor } from '@/types'
import { logError } from '@/lib/logger'
import { requireProjectOwner, projectNotFoundResponse } from '@/lib/server/project-access'

const vendorEnum = z.enum(['OPENAI', 'ANTHROPIC', 'ALIBABA', 'DEEPSEEK', 'MINIMAX', 'VOLCENGINE', 'ZHIPU'])

const requestSchema = z.object({
  content: z.string().min(100, '内容太短，无法检测'),
  vendor: vendorEnum.default('DEEPSEEK'),
})

/**
 * POST /api/novel/ai/check-style-consistency/[projectId]
 * 检查文风一致性
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

    const project = await requireProjectOwner(projectIdNum)
    if (!project) {
      return projectNotFoundResponse()
    }

    const body = await request.json()
    const { content, vendor } = requestSchema.parse(body)

    const result = await checkStyleConsistency(projectIdNum, content, vendor as AIVendor)

    return NextResponse.json({
      success: result.success,
      data: result.result,
      error: result.error ? { message: result.error } : null,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: error.issues[0]?.message } },
        { status: 400 }
      )
    }
    logError(error instanceof Error ? error : new Error(String(error)), { type: 'check_style_consistency', projectId: projectIdNum })
    return NextResponse.json(
      { success: false, error: { code: 'CHECK_ERROR', message: '检查文风一致性失败' } },
      { status: 500 }
    )
  }
}