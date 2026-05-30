import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  findFirst: vi.fn(),
  updateMany: vi.fn(),
  failStaleRunningJobs: vi.fn(),
  runProductionPipeline: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    generationJob: {
      findFirst: mocks.findFirst,
      updateMany: mocks.updateMany,
    },
  },
}))

vi.mock('@/lib/engine/generation-job', () => ({
  failStaleRunningJobs: mocks.failStaleRunningJobs,
}))

vi.mock('@/lib/engine/production-pipeline', () => ({
  runProductionPipeline: mocks.runProductionPipeline,
}))

describe('pipeline worker tick', () => {
  beforeEach(() => {
    mocks.findFirst.mockReset()
    mocks.updateMany.mockReset()
    mocks.failStaleRunningJobs.mockReset()
    mocks.runProductionPipeline.mockReset()
    mocks.failStaleRunningJobs.mockResolvedValue(0)
    mocks.updateMany.mockResolvedValue({ count: 1 })
  })

  it('returns idle when no pending job exists', async () => {
    mocks.findFirst.mockResolvedValue(null)
    const { runNextPipelineJob } = await import('@/lib/engine/pipeline-worker')

    const result = await runNextPipelineJob({ projectId: 12 })

    expect(mocks.failStaleRunningJobs).toHaveBeenCalledWith({ projectId: 12 })
    expect(mocks.findFirst).toHaveBeenCalledWith({
      where: { projectId: 12, status: 'PENDING' },
      orderBy: { createdAt: 'asc' },
    })
    expect(mocks.runProductionPipeline).not.toHaveBeenCalled()
    expect(result).toMatchObject({
      status: 'IDLE',
      projectId: 12,
      failedStaleJobs: 0,
    })
  })

  it('processes the oldest pending job with its persisted speed mode', async () => {
    mocks.failStaleRunningJobs.mockResolvedValue(2)
    mocks.findFirst.mockResolvedValue({
      id: 88,
      projectId: 12,
      payload: { speedMode: 'FAST_ACCEPTANCE' },
    })
    const { runNextPipelineJob } = await import('@/lib/engine/pipeline-worker')

    const result = await runNextPipelineJob({ projectId: 12 })

    expect(mocks.runProductionPipeline).toHaveBeenCalledWith(88, { speedMode: 'FAST_ACCEPTANCE' })
    expect(result).toEqual({
      status: 'processed',
      jobId: 88,
      projectId: 12,
      speedMode: 'FAST_ACCEPTANCE',
      failedStaleJobs: 2,
    })
  })

  it('does not run the pipeline when another worker claims the job first', async () => {
    mocks.findFirst.mockResolvedValue({
      id: 88,
      projectId: 12,
      payload: { speedMode: 'FAST_ACCEPTANCE' },
    })
    mocks.updateMany.mockResolvedValue({ count: 0 })
    const { runNextPipelineJob } = await import('@/lib/engine/pipeline-worker')

    const result = await runNextPipelineJob({ projectId: 12 })

    expect(mocks.runProductionPipeline).not.toHaveBeenCalled()
    expect(result).toMatchObject({
      status: 'IDLE',
      projectId: 12,
      message: '待推进任务已被其他 worker 接管',
    })
  })
})
