import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  runNextPipelineJob: vi.fn(),
}))

vi.mock('@/lib/engine/pipeline-worker', () => ({
  runNextPipelineJob: mocks.runNextPipelineJob,
}))

describe('global pipeline run-next route', () => {
  const originalSecret = process.env.NOVEL_AI_PIPELINE_WORKER_SECRET

  beforeEach(() => {
    mocks.runNextPipelineJob.mockReset()
    delete process.env.NOVEL_AI_PIPELINE_WORKER_SECRET
  })

  afterEach(() => {
    if (originalSecret === undefined) {
      delete process.env.NOVEL_AI_PIPELINE_WORKER_SECRET
    } else {
      process.env.NOVEL_AI_PIPELINE_WORKER_SECRET = originalSecret
    }
  })

  it('runs one pending job and forwards optional projectId', async () => {
    mocks.runNextPipelineJob.mockResolvedValue({
      status: 'IDLE',
      projectId: 7,
      failedStaleJobs: 0,
      message: '没有待推进的生成任务',
    })
    const { GET } = await import('@/app/api/novel/pipeline/run-next/route')

    const response = await GET(new NextRequest('http://localhost/api/novel/pipeline/run-next?projectId=7'))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(mocks.runNextPipelineJob).toHaveBeenCalledWith({ projectId: 7 })
    expect(body).toMatchObject({ success: true, data: { status: 'IDLE', projectId: 7 } })
  })

  it('requires the worker secret when configured', async () => {
    process.env.NOVEL_AI_PIPELINE_WORKER_SECRET = 'secret-token'
    const { POST } = await import('@/app/api/novel/pipeline/run-next/route')

    const blocked = await POST(new NextRequest('http://localhost/api/novel/pipeline/run-next', { method: 'POST' }))
    const allowed = await POST(new NextRequest('http://localhost/api/novel/pipeline/run-next', {
      method: 'POST',
      headers: { authorization: 'Bearer secret-token' },
    }))

    expect(blocked.status).toBe(401)
    expect(allowed.status).toBe(200)
    expect(mocks.runNextPipelineJob).toHaveBeenCalledTimes(1)
  })
})
