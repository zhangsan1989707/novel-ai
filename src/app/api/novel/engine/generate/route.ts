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

    // 生成 jobId
    const jobId = `job_${projectId}_${chapterNo}_${Date.now()}`

    // 返回 jobId，前端通过 SSE 流式获取进度
    return NextResponse.json({
      success: true,
      data: {
        jobId,
        projectId,
        chapterNo,
        streamUrl: `/api/novel/engine/${projectId}/${chapterNo}`,
        estimatedTime: 45,
      },
    })
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
