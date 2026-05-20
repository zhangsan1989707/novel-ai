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

    const paused = autoPipelineScheduler.pause(pid)
    if (!paused) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_STATE', message: '当前没有可暂停的自动流水线' } },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      data: { projectId: pid, status: 'paused' },
    })
  } catch (error) {
    console.error('Auto pipeline pause error:', error)
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: '暂停自动流水线失败' } },
      { status: 500 }
    )
  }
}
