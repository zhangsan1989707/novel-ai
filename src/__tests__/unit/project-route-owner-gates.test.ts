import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  requireProjectOwner: vi.fn(),
  readProjectPipelineSnapshot: vi.fn(),
  analyzeChapterQuality: vi.fn(),
  aIUsageFindMany: vi.fn(),
  characterFindFirst: vi.fn(),
  characterUpdate: vi.fn(),
  novelChapterFindFirst: vi.fn(),
  novelProjectFindUnique: vi.fn(),
  chapterCompletionReportFindFirst: vi.fn(),
  arcEventLedgerFindMany: vi.fn(),
  cheatAbilityStateFindUnique: vi.fn(),
}))

vi.mock('@/lib/server/project-access', () => ({
  requireProjectOwner: mocks.requireProjectOwner,
  projectNotFoundResponse: () => Response.json(
    { success: false, error: { code: 'NOT_FOUND', message: '项目不存在' } },
    { status: 404 }
  ),
}))

vi.mock('@/lib/engine/project-pipeline-snapshot', () => ({
  readProjectPipelineSnapshot: mocks.readProjectPipelineSnapshot,
}))

vi.mock('@/lib/knowledge/chapter-quality', () => ({
  analyzeChapterQuality: mocks.analyzeChapterQuality,
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    aIUsage: {
      findMany: mocks.aIUsageFindMany,
    },
    character: {
      findFirst: mocks.characterFindFirst,
      update: mocks.characterUpdate,
    },
    novelChapter: {
      findFirst: mocks.novelChapterFindFirst,
    },
    novelProject: {
      findUnique: mocks.novelProjectFindUnique,
    },
    chapterCompletionReport: {
      findFirst: mocks.chapterCompletionReportFindFirst,
    },
    arcEventLedger: {
      findMany: mocks.arcEventLedgerFindMany,
    },
    cheatAbilityState: {
      findUnique: mocks.cheatAbilityStateFindUnique,
    },
  },
}))

describe('project scoped route owner gates', () => {
  beforeEach(() => {
    Object.values(mocks).forEach(mock => mock.mockReset())
    mocks.requireProjectOwner.mockResolvedValue({ id: 42, creatorId: 7 })
    mocks.readProjectPipelineSnapshot.mockResolvedValue({ status: 'IDLE' })
    mocks.aIUsageFindMany.mockResolvedValue([])
    mocks.characterFindFirst.mockResolvedValue({
      id: 'char-1',
      name: '主角',
      speechStyle: '冷静',
      vocabularyLevel: null,
      sentencePattern: null,
      catchphraseStyle: null,
      dialogueExamples: [],
      voiceNotes: null,
    })
    mocks.novelChapterFindFirst.mockResolvedValue({
      id: 9,
      chapterNumber: 3,
      content: '正文',
      validationReport: null,
      completionReport: null,
      wordCount: 1200,
      status: 'COMPLETED',
    })
    mocks.novelProjectFindUnique.mockResolvedValue({ chapterWordCount: 3000 })
    mocks.chapterCompletionReportFindFirst.mockResolvedValue(null)
    mocks.arcEventLedgerFindMany.mockResolvedValue([])
    mocks.cheatAbilityStateFindUnique.mockResolvedValue(null)
  })

  it('blocks pipeline status before reading a snapshot for non-owned projects', async () => {
    mocks.requireProjectOwner.mockResolvedValue(null)
    const { GET } = await import('@/app/api/novel/projects/[projectId]/pipeline/status/route')

    const response = await GET(new NextRequest('http://localhost'), {
      params: Promise.resolve({ projectId: '42' }),
    })

    expect(response.status).toBe(404)
    expect(mocks.readProjectPipelineSnapshot).not.toHaveBeenCalled()
  })

  it('blocks cost aggregation before reading usage records for non-owned projects', async () => {
    mocks.requireProjectOwner.mockResolvedValue(null)
    const { GET } = await import('@/app/api/novel/projects/[projectId]/cost/batch/route')

    const response = await GET(new NextRequest('http://localhost'), {
      params: Promise.resolve({ projectId: '42' }),
    })

    expect(response.status).toBe(404)
    expect(mocks.aIUsageFindMany).not.toHaveBeenCalled()
  })

  it('loads character voice only from the current project', async () => {
    const { GET } = await import('@/app/api/novel/projects/[projectId]/characters/[characterId]/voice/route')

    const response = await GET(new NextRequest('http://localhost'), {
      params: Promise.resolve({ projectId: '42', characterId: 'char-1' }),
    })

    expect(response.status).toBe(200)
    expect(mocks.characterFindFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'char-1', projectId: 42 },
    }))
  })

  it('loads chapter review data only when the chapter belongs to the current project', async () => {
    const { GET } = await import('@/app/api/novel/projects/[projectId]/chapters/[chapterId]/review/route')

    const response = await GET(new NextRequest('http://localhost'), {
      params: Promise.resolve({ projectId: '42', chapterId: '9' }),
    })

    expect(response.status).toBe(200)
    expect(mocks.novelChapterFindFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 9, projectId: 42 },
    }))
  })
})
