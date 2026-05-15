/**
 * GET /api/novel/engine/status
 * 查询章节生成状态
 */
import { NextRequest, NextResponse } from 'next/server'
import { getChapterGenerationStatus } from '@/lib/engine/orchestrator'
import { z } from 'zod'

const statusSchema = z.object({
  projectId: z.number().int().positive(),
  chapterNo: z.number().int().positive(),
})

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const projectId = parseInt(searchParams.get('projectId') || '')
    const chapterNo = parseInt(searchParams.get('chapterNo') || '')

    if (isNaN(projectId) || isNaN(chapterNo)) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_PARAMS', message: '参数错误' } },
        { status: 400 }
      )
    }

    const status = await getChapterGenerationStatus(projectId, chapterNo)

    return NextResponse.json({
      success: true,
      data: status,
    })
  } catch (error) {
    logError(error instanceof Error ? error : new Error(String(error)), { type: 'get_generation_status', projectId, chapterNo })
    return NextResponse.json(
      { success: false, error: { code: 'STATUS_ERROR', message: '查询状态失败' } },
      { status: 500 }
    )
  }
}
