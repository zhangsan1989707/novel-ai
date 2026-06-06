import { NextResponse } from 'next/server'
import { runNextPipelineJob } from '@/lib/engine/pipeline-worker'
import { projectNotFoundResponse, requireProjectOwner } from '@/lib/server/project-access'

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId: projectIdStr } = await params
    const projectId = Number.parseInt(projectIdStr, 10)

    if (Number.isNaN(projectId)) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_ID', message: '无效的项目ID' } },
        { status: 400 }
      )
    }

    const projectOwner = await requireProjectOwner(projectId)
    if (!projectOwner) {
      return projectNotFoundResponse()
    }

    const result = await runNextPipelineJob({ projectId })

    return NextResponse.json({
      success: true,
      data: result,
    })
  } catch (error) {
    console.error('Pipeline run-next error:', error)
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: '推进 AI 生成失败' } },
      { status: 500 }
    )
  }
}
