/**
 * POST /api/novel/engine/generate
 * 触发章节生成（使用 Agent 流水线）
 * 返回 jobId，实际生成通过 SSE 流式获取
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { logError } from '@/lib/logger'
import { requireProjectOwner, projectNotFoundResponse } from '@/lib/server/project-access'

const generateSchema = z.object({
  projectId: z.number().int().positive(),
  chapterNo: z.number().int().positive(),
})

export async function POST(request: NextRequest) {
  let projectId: number | null = null
  let chapterNo: number | null = null
  try {
    const body = await request.json()
    const parsed = generateSchema.parse(body)
    projectId = parsed.projectId
    chapterNo = parsed.chapterNo

    const project = await requireProjectOwner(projectId)
    if (!project) {
      return projectNotFoundResponse()
    }

    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'LEGACY_ENDPOINT',
          message: '旧章节生成入口已停用，请使用项目生产流水线接口',
        },
        data: {
          projectId,
          chapterNo,
          replacement: `/api/novel/projects/${projectId}/pipeline/start`,
        },
      },
      { status: 409 }
    )
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: error.issues[0].message } },
        { status: 400 }
      )
    }
    logError(error instanceof Error ? error : new Error(String(error)), { type: 'engine_generate', projectId, chapterNo })
    return NextResponse.json(
      { success: false, error: { code: 'GENERATION_ERROR', message: '章节生成失败' } },
      { status: 500 }
    )
  }
}
