import { NextRequest, NextResponse } from 'next/server'
import { readProjectPipelineSnapshot } from '@/lib/engine/project-pipeline-snapshot'
import { projectNotFoundResponse, requireProjectOwner } from '@/lib/server/project-access'

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

    if (!await requireProjectOwner(projectId)) {
      return projectNotFoundResponse()
    }

    const snapshot = await readProjectPipelineSnapshot(projectId, { reconcileStale: true })
    if (!snapshot) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: '项目不存在' } },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: snapshot,
    })
  } catch (error) {
    console.error('Pipeline status error:', error)
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: '查询生成状态失败' } },
      { status: 500 }
    )
  }
}
