/**
 * GET /api/novel/engine/[projectId]/memory
 * 查询记忆系统快照
 */
import { NextRequest, NextResponse } from 'next/server'
import { getCharacterProfiles } from '@/lib/memory/character-memory'
import { getRecentChapterSummaries } from '@/lib/memory/chapter-summary'
import { getOpenPlotlines } from '@/lib/memory/plotline-tracker'
import { getStoryState } from '@/lib/engine/story-state'
import { logError } from '@/lib/logger'

interface RouteParams {
  params: Promise<{ projectId: string }>
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { projectId } = await params
    const projectIdNum = parseInt(projectId)

    if (isNaN(projectIdNum)) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_ID', message: '无效的项目ID' } },
        { status: 400 }
      )
    }

    const [
      characters,
      recentSummaries,
      openPlotlines,
      storyState,
    ] = await Promise.all([
      getCharacterProfiles(projectIdNum),
      getRecentChapterSummaries(projectIdNum, 10),
      getOpenPlotlines(projectIdNum),
      getStoryState(projectIdNum),
    ])

    return NextResponse.json({
      success: true,
      data: {
        characters,
        recentSummaries,
        openPlotlines,
        storyState,
      },
    })
  } catch (error) {
    logError(error instanceof Error ? error : new Error(String(error)), { type: $1 })
    return NextResponse.json(
      { success: false, error: { code: 'MEMORY_ERROR', message: '获取记忆快照失败' } },
      { status: 500 }
    )
  }
}
