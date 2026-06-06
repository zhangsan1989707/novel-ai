import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const snapshot = {
  status: 'PAUSED',
  currentStep: 'chapter',
  progress: 37,
  currentChapter: 12,
  totalChapters: 80,
  completedChapters: 11,
  actualChapterCount: 12,
  nextChapterNumber: 12,
  pipelineJobId: 99,
  speedMode: 'FAST_ACCEPTANCE',
  runtimeSummary: { label: 'paused' },
}

const mocks = vi.hoisted(() => ({
  requireProjectOwner: vi.fn(),
  findUnique: vi.fn(),
  count: vi.fn(),
  findFirst: vi.fn(),
  update: vi.fn(),
  createJob: vi.fn(),
  failStaleRunningJobs: vi.fn(),
  resumeJob: vi.fn(),
  updateJobStep: vi.fn(),
  runProductionPipeline: vi.fn(),
  getProjectMaintenanceSummary: vi.fn(),
  readProjectPipelineSnapshot: vi.fn(),
}))

vi.mock('@/lib/server/project-access', () => ({
  requireProjectOwner: mocks.requireProjectOwner,
  projectNotFoundResponse: () => Response.json(
    { success: false, error: { code: 'NOT_FOUND', message: '项目不存在' } },
    { status: 404 }
  ),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    novelProject: {
      findUnique: mocks.findUnique,
      update: mocks.update,
    },
    novelChapter: {
      count: mocks.count,
    },
    generationJob: {
      findFirst: mocks.findFirst,
    },
  },
}))

vi.mock('@/lib/engine/generation-job', () => ({
  createJob: mocks.createJob,
  failStaleRunningJobs: mocks.failStaleRunningJobs,
  resumeJob: mocks.resumeJob,
  updateJobStep: mocks.updateJobStep,
}))

vi.mock('@/lib/engine/production-pipeline', () => ({
  runProductionPipeline: mocks.runProductionPipeline,
}))

vi.mock('@/lib/engine/auto-maintenance', () => ({
  getProjectMaintenanceSummary: mocks.getProjectMaintenanceSummary,
}))

vi.mock('@/lib/engine/project-pipeline-snapshot', () => ({
  readProjectPipelineSnapshot: mocks.readProjectPipelineSnapshot,
}))

describe('pipeline start route snapshot semantics', () => {
  beforeEach(() => {
    Object.values(mocks).forEach(mock => mock.mockReset())
    mocks.requireProjectOwner.mockResolvedValue({ id: 42, creatorId: 7 })
    mocks.findUnique.mockResolvedValue({
      id: 42,
      workflowStage: 'GENERATE',
      blueprintConfirmedAt: new Date('2026-06-06T00:00:00.000Z'),
      arcPlanConfirmedAt: new Date('2026-06-06T00:00:00.000Z'),
      outlineConfirmedAt: null,
      bookBlueprint: { id: 1 },
      arcPlans: [{ id: 1 }],
      storyState: { id: 1 },
      worldState: { id: 1 },
    })
    mocks.count.mockResolvedValue(0)
    mocks.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 99, status: 'PAUSED', payload: { speedMode: 'FAST_ACCEPTANCE' } })
    mocks.getProjectMaintenanceSummary.mockResolvedValue({})
    mocks.runProductionPipeline.mockResolvedValue(undefined)
    mocks.readProjectPipelineSnapshot.mockResolvedValue(snapshot)
  })

  it('returns the post-start snapshot instead of stale optimistic fields', async () => {
    const { POST } = await import('@/app/api/novel/projects/[projectId]/pipeline/start/route')

    const response = await POST(new NextRequest('http://localhost/api/novel/projects/42/pipeline/start', {
      method: 'POST',
      body: JSON.stringify({ speedMode: 'FAST_ACCEPTANCE' }),
    }), {
      params: Promise.resolve({ projectId: '42' }),
    })
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(mocks.resumeJob).toHaveBeenCalledWith(99)
    expect(body.data).toMatchObject({
      jobId: 99,
      projectId: 42,
      status: 'PAUSED',
      speedMode: 'FAST_ACCEPTANCE',
      snapshot,
      totalChapters: 80,
      runtimeSummary: { label: 'paused' },
    })
  })
})
