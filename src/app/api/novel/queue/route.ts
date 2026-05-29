import { NextRequest, NextResponse } from 'next/server'
import { success, handleApiError } from '@/lib/api-response'
import { AppError, ErrorCodes } from '@/lib/errors'
import { getScheduler } from '@/lib/queue'

/**
 * GET /api/novel/queue
 * 获取队列状态
 */
export async function GET() {
  try {
    const scheduler = getScheduler()
    const metrics = await scheduler.getMetrics()

    return NextResponse.json(success({
      status: scheduler.getStatus(),
      ...metrics,
    }))
  } catch (err) {
    return handleApiError(err)
  }
}

/**
 * POST /api/novel/queue
 * 启动/停止调度器
 * body: { action: 'start' | 'stop' }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { action } = body

    const scheduler = getScheduler()

    if (action === 'start') {
      scheduler.start()
      return NextResponse.json(success({ status: scheduler.getStatus() }, '调度器已启动'))
    }

    if (action === 'stop') {
      await scheduler.stop()
      return NextResponse.json(success({ status: scheduler.getStatus() }, '调度器已停止'))
    }

    throw new AppError(ErrorCodes.VALIDATION_ERROR, '无效的 action，支持 start/stop', 400)
  } catch (err) {
    return handleApiError(err)
  }
}
