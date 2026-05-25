import { describe, expect, it } from 'vitest'
import { buildProjectHealthReport } from '@/lib/engine/project-health'

function buildBaseInput() {
  return {
    aiModelConfig: { id: 1 },
    bookBlueprint: { id: 1 },
    arcPlans: [{ id: 1 }],
    storyState: { currentChapter: 12 },
    worldState: { id: 1 },
    chapters: [
      { status: 'COMPLETED', wordCount: 3200, chapterNumber: 1 },
      { status: 'COMPLETED', wordCount: 3300, chapterNumber: 2 },
      { status: 'COMPLETED', wordCount: 3400, chapterNumber: 3 },
      { status: 'COMPLETED', wordCount: 3500, chapterNumber: 4 },
      { status: 'COMPLETED', wordCount: 3600, chapterNumber: 5 },
    ],
    recentCommits: [],
    plotlines: [],
    villains: [{ isFinalBoss: true, lifecycle: 'active' }],
    chapterWordCount: 3000,
    chapterSummaryCount: 5,
    volumeSummaryCount: 1,
    bookSummaryCount: 1,
    characterCount: 3,
    plotlineCount: 2,
    openPlotlineCount: 1,
    resolvedPlotlineCount: 1,
    researchRefCount: 2,
    ragDocumentCount: 10,
    automationState: {
      bootstrapQueued: false,
      ragQueued: false,
    },
    ragRuntime: {
      inFlight: false,
      cooldownRemainingMs: 0,
      embeddingFallbackActive: false,
      lastError: null,
    },
  }
}

describe('buildProjectHealthReport', () => {
  it('returns actionable blockers and next steps when project cannot start writing', () => {
    const report = buildProjectHealthReport({
      ...buildBaseInput(),
      aiModelConfig: null,
      bookBlueprint: null,
      arcPlans: [],
      storyState: null,
    })

    expect(report.ready).toBe(false)
    expect(report.statusHeadline).toContain('现在不能开写')
    expect(report.primaryAction).toContain('绑定 AI 模型')
    expect(report.blockers).toContain('项目未绑定 AI 模型，主生成链路可能无法稳定运行')
    expect(report.nextSteps[0]).toMatchObject({
      title: '绑定 AI 模型',
      urgency: 'now',
      blocking: true,
    })
    expect(report.nextSteps[1]).toMatchObject({
      title: '补齐蓝图、阶段规划、故事状态',
      urgency: 'now',
      blocking: true,
    })
    expect(report.riskHighlights.some(item => item.code === 'MODEL_NOT_BOUND')).toBe(true)
  })

  it('explains degraded but writable state with precise RAG and summary guidance', () => {
    const report = buildProjectHealthReport({
      ...buildBaseInput(),
      chapterSummaryCount: 2,
      ragDocumentCount: 0,
      ragRuntime: {
        inFlight: false,
        cooldownRemainingMs: 24000,
        embeddingFallbackActive: true,
        lastError: null,
      },
    })

    expect(report.ready).toBe(true)
    expect(report.statusHeadline).toContain('当前可以继续写')
    expect(report.primaryAction).toContain('补齐章节摘要')
    expect(report.recommendations.some(item => item.includes('24 秒'))).toBe(true)
    expect(report.nextSteps.some(item => item.title === '等待 RAG 冷却结束')).toBe(true)
    expect(report.nextSteps.some(item => item.title === '补齐章节摘要')).toBe(true)
    expect(report.nextSteps.some(item => item.title === '恢复正式 embedding 配置')).toBe(true)
    expect(report.riskHighlights.some(item => item.code === 'RAG_EMBEDDING_FALLBACK')).toBe(true)
  })
})
