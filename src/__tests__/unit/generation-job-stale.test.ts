import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  findMany: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    generationJob: {
      findMany: mocks.findMany,
    },
  },
}))

describe('generation job stale reconciliation', () => {
  beforeEach(() => {
    mocks.findMany.mockReset()
    mocks.findMany.mockResolvedValue([])
  })

  it('only reconciles running jobs so queued external-worker jobs can keep waiting', async () => {
    const { failStaleRunningJobs } = await import('@/lib/engine/generation-job')

    await expect(failStaleRunningJobs({ projectId: 42 })).resolves.toBe(0)

    expect(mocks.findMany).toHaveBeenCalledWith({
      where: { status: 'RUNNING', projectId: 42 },
      select: {
        id: true,
        payload: true,
        updatedAt: true,
      },
    })
  })
})
