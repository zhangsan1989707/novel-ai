/**
 * GET /api/novel/engine/[projectId]/story-events
 * 查询故事事件历史
 */
import { NextRequest, NextResponse } from 'next/server'
import { getStoryEventHistory } from '@/lib/engine/story-state'
import { logError } from '@/lib/logger'

interface RouteParams {
  params: Promise<{ projectId: string }>
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  let projectIdNum: number | null = null
  try {
    const { projectId } = await params
    projectIdNum = parseInt(projectId)
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '50')

    if (isNaN(projectIdNum)) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_ID', message: '无效的项目ID' } },
        { status: 400 }
      )
    }

    const events = await getStoryEventHistory(projectIdNum, limit)

    return NextResponse.json({
      success: true,
      data: events,
    })
  } catch (error) {
    logError(error instanceof Error ? error : new Error(String(error)), { type: 'get_story_events', projectId: projectIdNum })
    return NextResponse.json(
      { success: false, error: { code: 'EVENTS_ERROR', message: '获取故事事件失败' } },
      { status: 500 }
    )
  }
}
