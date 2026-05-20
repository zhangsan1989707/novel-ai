import { NextRequest, NextResponse } from 'next/server'
import { buildBlueprintConsoleSnapshot, refreshBlueprintConsole } from '@/lib/engine/blueprint-console'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId: projectIdStr } = await params
    const projectId = parseInt(projectIdStr)

    if (isNaN(projectId)) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_ID', message: '无效的项目ID' } },
        { status: 400 }
      )
    }

    const snapshot = await buildBlueprintConsoleSnapshot(projectId)
    return NextResponse.json({ success: true, data: snapshot })
  } catch (error) {
    console.error('Get blueprint console error:', error)
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: '获取 AI 控制台失败' } },
      { status: 500 }
    )
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId: projectIdStr } = await params
    const projectId = parseInt(projectIdStr)

    if (isNaN(projectId)) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_ID', message: '无效的项目ID' } },
        { status: 400 }
      )
    }

    const body = await request.json().catch(() => ({}))
    const guidance = typeof body.guidance === 'string' ? body.guidance : undefined

    const snapshot = await refreshBlueprintConsole(projectId, guidance)
    return NextResponse.json({ success: true, data: snapshot })
  } catch (error) {
    console.error('Refresh blueprint console error:', error)
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: error instanceof Error ? error.message : '刷新 AI 控制台失败' } },
      { status: 500 }
    )
  }
}
