import { NextRequest, NextResponse } from 'next/server'
import { createJob } from '@/lib/engine/generation-job'

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

    const jobId = await createJob(projectId)

    return NextResponse.json({
      success: true,
      data: { jobId, projectId, status: 'pending' },
    })
  } catch (error) {
    console.error('Pipeline start error:', error)
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: '启动流水线失败' } },
      { status: 500 }
    )
  }
}