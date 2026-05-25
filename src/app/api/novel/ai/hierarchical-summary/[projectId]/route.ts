import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getHierarchicalContext, checkAndGenerateLayeredSummary } from '@/lib/engine/summarizer'
import { getAllVolumeSummaries } from '@/lib/memory/volume-summary'
import { getBookSummary } from '@/lib/memory/book-summary'
import { logError } from '@/lib/logger'

const requestSchema = z.object({
  projectId: z.number().int().positive(),
  currentChapter: z.number().int().positive().optional(),
  includeVolumeSummary: z.boolean().default(true),
  includeBookSummary: z.boolean().default(true),
})

/**
 * GET /api/novel/ai/hierarchical-summary/[projectId]
 * 获取分层摘要上下文（用于 AI 生成时的上下文压缩）
 */
export async function GET(
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

    const { searchParams } = new URL(request.url)
    const currentChapter = parseInt(searchParams.get('currentChapter') || '1', 10)
    const includeVolumeSummary = searchParams.get('includeVolumeSummary') !== 'false'
    const includeBookSummary = searchParams.get('includeBookSummary') !== 'false'

    const context = await getHierarchicalContext(projectIdNum, currentChapter, {
      maxTokens: 8000,
      includeVolumeSummary,
      includeBookSummary,
    })

    return NextResponse.json({
      success: true,
      data: context,
    })
  } catch (error) {
    logError(error instanceof Error ? error : new Error(String(error)), { type: 'get_hierarchical_summary', projectId: projectIdNum })
    return NextResponse.json(
      { success: false, error: { code: 'FETCH_ERROR', message: '获取分层摘要失败' } },
      { status: 500 }
    )
  }
}

/**
 * POST /api/novel/ai/hierarchical-summary/[projectId]
 * 触发分层摘要生成检查
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
    const completedChapter = body.completedChapter || 1

    const result = await checkAndGenerateLayeredSummary(projectIdNum, completedChapter)
    const context = await getHierarchicalContext(projectIdNum, completedChapter, {
      maxTokens: 8000,
      includeVolumeSummary: true,
      includeBookSummary: true,
    })

    // 返回当前分层摘要状态
    const [volumeSummaries, bookSummary] = await Promise.all([
      getAllVolumeSummaries(projectIdNum),
      getBookSummary(projectIdNum),
    ])

    return NextResponse.json({
      success: true,
      data: {
        volumeTriggered: result.volumeTriggered,
        bookTriggered: result.bookTriggered,
        volumeSummaries,
        bookSummary,
        context,
      },
    })
  } catch (error) {
    logError(error instanceof Error ? error : new Error(String(error)), { type: 'trigger_hierarchical_summary', projectId: projectIdNum })
    return NextResponse.json(
      { success: false, error: { code: 'TRIGGER_ERROR', message: '触发分层摘要失败' } },
      { status: 500 }
    )
  }
}
