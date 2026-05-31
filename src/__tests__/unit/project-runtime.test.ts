import { describe, expect, it } from 'vitest'
import { buildProjectRuntimeSummary, type RuntimeProjectInput } from '@/lib/engine/project-runtime'

function makeInput(overrides: Partial<RuntimeProjectInput> = {}): RuntimeProjectInput {
  return {
    projectId: 1,
    projectStatus: 'DRAFT',
    hasModel: true,
    hasBlueprint: true,
    blueprintConfirmedAt: '2026-01-01T00:00:00.000Z',
    hasArcPlans: true,
    arcPlanConfirmedAt: '2026-01-01T00:00:00.000Z',
    totalChapters: 10,
    chapters: [],
    ...overrides,
  }
}

describe('buildProjectRuntimeSummary', () => {
  it('blocks start while waiting for blueprint confirmation', () => {
    const summary = buildProjectRuntimeSummary(makeInput({
      hasBlueprint: true,
      blueprintConfirmedAt: null,
    }))

    expect(summary.stage).toBe('BLUEPRINTING')
    expect(summary.stageLabel).toBe('等待确认全书蓝图')
    expect(summary.canStart).toBe(false)
  })

  it('reports writing progress from active chapter word count', () => {
    const summary = buildProjectRuntimeSummary(makeInput({
      chapters: [
        { chapterNumber: 1, status: 'COMPLETED', wordCount: 3000 },
        { chapterNumber: 2, status: 'GENERATING', wordCount: 0 },
      ],
      job: {
        jobId: 7,
        status: 'RUNNING',
        currentStep: 'WRITE',
        currentChapter: 2,
        runtime: {
          currentChapter: {
            chapterNumber: 2,
            status: 'RUNNING',
            currentWordCount: 1500,
            targetWordCount: 3000,
            startedAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:01:00.000Z',
            currentPhase: 'writer',
            phaseTimings: {},
          },
          recentChapters: [],
          lastEventAt: '2026-01-01T00:01:00.000Z',
          streamRevision: 1,
        },
      },
    }))

    expect(summary.stage).toBe('WRITING')
    expect(summary.currentChapterNo).toBe(2)
    expect(summary.overallProgress).toBe(15)
    expect(summary.canPause).toBe(true)
  })

  it('maps repair phase to repairing stage and repair action', () => {
    const summary = buildProjectRuntimeSummary(makeInput({
      chapters: [{ chapterNumber: 1, status: 'GENERATING', wordCount: 1200 }],
      job: {
        jobId: 8,
        status: 'RUNNING',
        currentStep: 'WRITE',
        currentChapter: 1,
        runtime: {
          currentChapter: {
            chapterNumber: 1,
            status: 'RUNNING',
            currentWordCount: 1200,
            targetWordCount: 3000,
            startedAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:01:00.000Z',
            currentPhase: 'repairing',
            phaseTimings: {},
          },
          recentChapters: [],
          streamRevision: 1,
        },
      },
    }))

    expect(summary.stage).toBe('REPAIRING')
    expect(summary.failedChapters).toBe(1)
    expect(summary.canRepair).toBe(true)
  })

  it('treats completed batch as startable when the book still has chapters left', () => {
    const summary = buildProjectRuntimeSummary(makeInput({
      chapters: [
        { chapterNumber: 1, status: 'COMPLETED', wordCount: 3000 },
        { chapterNumber: 2, status: 'COMPLETED', wordCount: 3000 },
      ],
      job: {
        jobId: 9,
        status: 'COMPLETED',
        currentStep: null,
        currentChapter: 2,
      },
    }))

    expect(summary.stage).toBe('COMPLETED')
    expect(summary.stageLabel).toBe('当前批次完成')
    expect(summary.canStart).toBe(true)
    expect(summary.canExport).toBe(true)
  })

  it('does not allow start after full completion', () => {
    const summary = buildProjectRuntimeSummary(makeInput({
      totalChapters: 2,
      chapters: [
        { chapterNumber: 1, status: 'COMPLETED', wordCount: 3000 },
        { chapterNumber: 2, status: 'COMPLETED', wordCount: 3000 },
      ],
    }))

    expect(summary.stage).toBe('COMPLETED')
    expect(summary.overallProgress).toBe(100)
    expect(summary.canStart).toBe(false)
  })
})

