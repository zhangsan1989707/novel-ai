import { NextResponse } from 'next/server'
import { handleApiError, success } from '@/lib/api-response'
import { getScheduler } from '@/lib/queue'

/**
 * GET /api/novel/queue/metrics
 * 获取详细队列指标
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
