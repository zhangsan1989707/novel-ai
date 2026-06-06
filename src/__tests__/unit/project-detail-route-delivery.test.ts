import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const project = {
  id: 42,
  title: '测试小说',
  aiModelId: null,
  aiModelConfig: null,
  bookBlueprint: null,
  storyState: null,
  worldState: null,
  chapters: [],
  plotlines: [],
  villains: [],
  arcPlans: [],
  chapterWordCount: 3000,
  lengthType: 'MEDIUM',
  targetWordCount: 300000,
  totalVolumes: 4,
}

const mocks = vi.hoisted(() => ({
  requireProjectOwner: vi.fn(),
  novelProjectFindUnique: vi.fn(),
  novelProjectUpdate: vi.fn(),
  findMany: vi.fn(),
  count: vi.fn(),
  getRAGDocumentCount: vi.fn(),
  getRagRuntimeStatus: vi.fn(),
  buildProjectHealthReport: vi.fn(),
  buildBlueprintConsoleSnapshot: vi.fn(),
  ensureProjectMaintenanceQueued: vi.fn(),
  getProjectMaintenanceSummary: vi.fn(),
  buildStoryRoadmap: vi.fn(),
  resolveProjectPlanningTargets: vi.fn(),
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
      findUnique: mocks.novelProjectFindUnique,
      update: mocks.novelProjectUpdate,
      delete: vi.fn(),
    },
    chapterCommit: { findMany: mocks.findMany },
    chapterSummary: { count: mocks.count },
    volumeSummary: { count: mocks.count },
    bookSummary: { count: mocks.count },
    character: { count: mocks.count },
    plotline: { count: mocks.count },
    researchRef: { count: mocks.count },
  },
}))

vi.mock('@/lib/engine/rag-vector', () => ({
  getRAGDocumentCount: mocks.getRAGDocumentCount,
  getRagRuntimeStatus: mocks.getRagRuntimeStatus,
}))

vi.mock('@/lib/engine/project-health', () => ({
  buildProjectHealthReport: mocks.buildProjectHealthReport,
}))

vi.mock('@/lib/engine/blueprint-console', () => ({
  buildBlueprintConsoleSnapshot: mocks.buildBlueprintConsoleSnapshot,
}))

vi.mock('@/lib/engine/auto-maintenance', () => ({
  ensureProjectMaintenanceQueued: mocks.ensureProjectMaintenanceQueued,
  getProjectMaintenanceSummary: mocks.getProjectMaintenanceSummary,
}))

vi.mock('@/lib/engine/story-roadmap', () => ({
  buildStoryRoadmap: mocks.buildStoryRoadmap,
}))

vi.mock('@/lib/engine/project-length', () => ({
  resolveProjectPlanningTargets: mocks.resolveProjectPlanningTargets,
}))

vi.mock('@/lib/engine/project-pipeline-snapshot', () => ({
  readProjectPipelineSnapshot: mocks.readProjectPipelineSnapshot,
}))

describe('project detail route delivery semantics', () => {
  beforeEach(() => {
    Object.values(mocks).forEach(mock => mock.mockReset())
    mocks.requireProjectOwner.mockResolvedValue({ id: 42, creatorId: 7 })
    mocks.novelProjectFindUnique.mockResolvedValue(project)
    mocks.novelProjectUpdate.mockResolvedValue({ ...project, targetAudience: 'FEMALE' })
    mocks.findMany.mockResolvedValue([])
    mocks.count.mockResolvedValue(0)
    mocks.getRAGDocumentCount.mockResolvedValue(0)
    mocks.getRagRuntimeStatus.mockReturnValue({ inFlight: false, cooldownRemainingMs: 0, embeddingFallbackActive: false })
    mocks.buildProjectHealthReport.mockReturnValue({ hasModel: false })
    mocks.buildBlueprintConsoleSnapshot.mockResolvedValue(null)
    mocks.ensureProjectMaintenanceQueued.mockResolvedValue(undefined)
    mocks.getProjectMaintenanceSummary.mockResolvedValue({})
    mocks.buildStoryRoadmap.mockReturnValue([])
    mocks.resolveProjectPlanningTargets.mockReturnValue({
      effectiveTargetWordCount: 300000,
      effectiveTotalChapters: 100,
      stageSequence: [],
    })
    mocks.readProjectPipelineSnapshot.mockResolvedValue({ runtimeSummary: null })
  })

  it('does not bind a default AI config while reading project details', async () => {
    const { GET } = await import('@/app/api/novel/projects/[projectId]/route')

    const response = await GET(new NextRequest('http://localhost/api/novel/projects/42'), {
      params: Promise.resolve({ projectId: '42' }),
    })

    expect(response.status).toBe(200)
    expect(mocks.novelProjectUpdate).not.toHaveBeenCalled()
  })

  it('persists targetAudience from the edit form payload', async () => {
    const { PATCH } = await import('@/app/api/novel/projects/[projectId]/route')

    const response = await PATCH(new NextRequest('http://localhost/api/novel/projects/42', {
      method: 'PATCH',
      body: JSON.stringify({ title: '测试小说', targetAudience: 'FEMALE' }),
    }), {
      params: Promise.resolve({ projectId: '42' }),
    })

    expect(response.status).toBe(200)
    expect(mocks.novelProjectUpdate).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 42 },
      data: expect.objectContaining({ targetAudience: 'FEMALE' }),
    }))
  })
})
