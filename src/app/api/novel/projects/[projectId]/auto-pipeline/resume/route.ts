import { NextRequest, NextResponse } from 'next/server'
import { autoPipelineScheduler } from '@/lib/pipeline/scheduler'

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params
    const pid = parseInt(projectId)

    if (isNaN(pid)) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_ID', message: '无效的项目ID' } },
        { status: 400 }
      )
    }

    const resumed = autoPipelineScheduler.resume(pid)
    if (!resumed) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_STATE', message: '当前没有可恢复的自动流水线' } },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      data: { projectId: pid, status: 'running' },
    })
  } catch (error) {
    console.error('Auto pipeline resume error:', error)
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: '恢复自动流水线失败' } },
      { status: 500 }
    )
  }
}
