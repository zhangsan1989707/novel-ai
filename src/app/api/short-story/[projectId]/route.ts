import { NextRequest, NextResponse } from 'next/server'
import { getShortStory } from '@/lib/short-story/service'
import { handleApiError } from '@/lib/api-response'

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

    const story = await getShortStory(projectIdNum)

    if (!story) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: '短篇故事不存在' } },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true, data: story })
  } catch (error) {
    return handleApiError(error)
  }
}
