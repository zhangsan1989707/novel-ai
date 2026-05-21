import { NextRequest, NextResponse } from 'next/server'
import { analysisTaskManager } from '@/lib/engine/analysis-task-manager'
import { logError } from '@/lib/logger'

/**
 * POST /api/novel/analysis-task/[taskId]/cancel
 * 取消分析任务
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  try {
    const { taskId } = await params

    const task = await analysisTaskManager.getTask(taskId)
    if (!task) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: '任务不存在' } },
        { status: 404 }
      )
    }

    if (task.status !== 'PENDING' && task.status !== 'RUNNING') {
      return NextResponse.json({
        success: true,
        data: { task, message: `任务已处于 ${task.status} 状态，无需取消` },
      })
    }

    await analysisTaskManager.cancelTask(taskId)

    const updatedTask = await analysisTaskManager.getTask(taskId)
    return NextResponse.json({
      success: true,
      data: updatedTask,
    })
  } catch (error) {
    logError(error instanceof Error ? error : new Error(String(error)), { type: 'cancel_analysis_task' })
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: '取消任务失败' } },
      { status: 500 }
    )
  }
}
