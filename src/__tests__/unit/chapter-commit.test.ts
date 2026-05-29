import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  findUnique: vi.fn(),
  findFirst: vi.fn(),
  runChapterProjectionWriters: vi.fn(),
  update: vi.fn(),
  findUniqueOrThrow: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    chapterCommit: {
      create: mocks.create,
      findUnique: mocks.findUnique,
      update: mocks.update,
      findUniqueOrThrow: mocks.findUniqueOrThrow,
    },
    novelChapter: {
      findFirst: mocks.findFirst,
    },
  },
}))

vi.mock('@/lib/engine/chapter-projections', () => ({
  runChapterProjectionWriters: mocks.runChapterProjectionWriters,
}))

describe('recordAndApplyChapterCommit', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    mocks.create.mockResolvedValue({
      id: 'cmp_test_commit',
      projectId: 7,
      chapterId: 11,
      chapterNo: 5,
      source: 'pipeline',
      status: 'accepted',
      payload: { chapterNo: 5, chapterTitle: '第5章', content: '正文' },
      projectionStatus: {
        chapter: 'pending',
        version: 'pending',
        summary: 'pending',
        plotlines: 'pending',
        characters: 'pending',
        story: 'pending',
        project: 'pending',
        audit: 'pending',
      },
      replayCount: 0,
      appliedAt: null,
      createdAt: new Date('2026-05-29T00:00:00.000Z'),
      updatedAt: new Date('2026-05-29T00:00:00.000Z'),
    })
    mocks.findUnique.mockResolvedValue({
      id: 'cmp_test_commit',
      projectId: 7,
      chapterId: 11,
      chapterNo: 5,
      source: 'pipeline',
      status: 'accepted',
      payload: { chapterNo: 5, chapterTitle: '第5章', content: '正文' },
      projectionStatus: {
        chapter: 'pending',
        version: 'pending',
      },
      replayCount: 0,
      appliedAt: null,
      createdAt: new Date('2026-05-29T00:00:00.000Z'),
      updatedAt: new Date('2026-05-29T00:00:00.000Z'),
    })
    mocks.findFirst.mockResolvedValue({
      id: 11,
      generationPrompt: 'prompt',
      summary: 'summary',
    })
    mocks.runChapterProjectionWriters.mockResolvedValue({
      projectionStatus: {
        chapter: 'completed',
        version: 'completed',
      },
    })
    mocks.update.mockResolvedValue(undefined)
    mocks.findUniqueOrThrow.mockResolvedValue({
      id: 'cmp_test_commit',
      projectId: 7,
      chapterId: 11,
      chapterNo: 5,
      source: 'pipeline',
      status: 'accepted',
      payload: { chapterNo: 5, chapterTitle: '第5章', content: '正文' },
      projectionStatus: {
        chapter: 'completed',
        version: 'completed',
      },
      replayCount: 0,
      appliedAt: new Date('2026-05-29T00:00:01.000Z'),
      createdAt: new Date('2026-05-29T00:00:00.000Z'),
      updatedAt: new Date('2026-05-29T00:00:01.000Z'),
    })
  })

  it('persists the commit before loading it for projection replay', async () => {
    const { recordAndApplyChapterCommit } = await import('@/lib/engine/chapter-commit')

    const result = await recordAndApplyChapterCommit(7, 11, {
      chapterNo: 5,
      chapterTitle: '第5章',
      content: '正文',
    })

    expect(mocks.create).toHaveBeenCalledOnce()
    expect(mocks.findUnique).toHaveBeenCalledWith({
      where: { id: 'cmp_test_commit' },
    })
    expect(mocks.findUnique.mock.invocationCallOrder[0]).toBeGreaterThan(
      mocks.create.mock.invocationCallOrder[0]
    )
    expect(result.id).toBe('cmp_test_commit')
    expect(result.projectionStatus.chapter).toBe('completed')
  })
})
