import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  writerAgent: vi.fn(),
  polisherAgent: vi.fn(),
  reviewerAgent: vi.fn(),
  summarizerAgent: vi.fn(),
  validatorAgent: vi.fn(),
  chapterDeslopper: vi.fn(),
  plannerAgent: vi.fn(),
  recordAndApplyChapterCommit: vi.fn(),
  prisma: {
    novelProject: { findUnique: vi.fn() },
    novelChapter: { count: vi.fn(), findUnique: vi.fn(), upsert: vi.fn(), update: vi.fn() },
    chapterCompletionReport: { upsert: vi.fn() },
  },
}))

vi.mock('@/lib/prisma', () => ({ prisma: mocks.prisma }))
vi.mock('@/lib/ai/service', () => ({
  AIService: { createProvider: vi.fn(async () => ({ generate: vi.fn(), generateStream: vi.fn() })) },
}))
vi.mock('@/lib/agents/planner', () => ({ plannerAgent: mocks.plannerAgent }))
vi.mock('@/lib/agents/writer', () => ({ writerAgent: mocks.writerAgent }))
vi.mock('@/lib/agents/polisher', () => ({ polisherAgent: mocks.polisherAgent }))
vi.mock('@/lib/agents/reviewer', () => ({ reviewerAgent: mocks.reviewerAgent }))
vi.mock('@/lib/agents/summarizer', () => ({ summarizerAgent: mocks.summarizerAgent }))
vi.mock('@/lib/agents/validator', () => ({ validatorAgent: mocks.validatorAgent }))
vi.mock('@/lib/agents/deslopper', () => ({ chapterDeslopper: mocks.chapterDeslopper }))
vi.mock('@/lib/engine/chapter-commit', () => ({ recordAndApplyChapterCommit: mocks.recordAndApplyChapterCommit }))
vi.mock('@/lib/memory', () => ({ buildChapterMemoryPack: vi.fn(async () => mockMemoryPack) }))
vi.mock('@/lib/engine/story-state', () => ({
  getStoryState: vi.fn(async () => ({ currentChapter: 1, totalPlanned: 100, mainConflict: '主线', subConflicts: [], emotionalArc: [] })),
  initStoryState: vi.fn(),
  recordStoryEvent: vi.fn(),
  updateChapterProgress: vi.fn(),
}))
vi.mock('@/lib/hooks/registry', () => ({ hookRegistry: { execute: vi.fn(async () => []) } }))
vi.mock('@/lib/agents/narrative-director', () => ({ directChapter: vi.fn(async () => null) }))
vi.mock('@/lib/engine/cheat-ability-state', () => ({
  getCheatAbilityState: vi.fn(async () => null),
  appendCheatUsage: vi.fn(),
  buildCheatAbilityPromptContext: vi.fn(() => ''),
}))
vi.mock('@/lib/engine/arc-event-ledger', () => ({
  getPendingOrStartedArcEvents: vi.fn(async () => []),
  buildArcEventPromptContext: vi.fn(() => ''),
  advanceArcEvent: vi.fn(),
}))
vi.mock('@/lib/engine/long-novel-integration', () => ({
  getWorldState: vi.fn(async () => null),
  getVillains: vi.fn(async () => []),
  getWorldExpansionContext: vi.fn(() => ''),
  getVillainContext: vi.fn(() => ''),
}))
vi.mock('@/lib/engine/world-state-updater', () => ({ updateWorldStateAfterChapter: vi.fn(async () => undefined) }))
vi.mock('@/lib/memory/character-memory', () => ({ getCharacterVoicesForProject: vi.fn(async () => []) }))
vi.mock('@/lib/engine/quality-gate', () => ({ runQualityGate: vi.fn(() => ({ canSave: true, errors: [] })) }))
vi.mock('@/lib/engine/content-validator', () => ({
  validateChapterContent: vi.fn(() => ({ passed: true, shouldReroll: false, warnings: [], violations: [] })),
}))
vi.mock('@/lib/engine/rule-fantasy-validator', () => ({ runRuleFantasyValidator: vi.fn(() => ({ passed: true, findings: [] })) }))
vi.mock('@/lib/engine/chapter-completion', () => ({
  buildChapterCompletionReport: vi.fn(() => ({
    completionScore: 100,
    issues: [],
    actualWordCount: 1000,
    targetWordCount: 1000,
    chapterGoalCompleted: true,
    mainConflictProgressed: true,
    mainConflictResolved: false,
    endingHookExists: true,
    abruptTruncationDetected: false,
  })),
}))

const mockMemoryPack = {
  plannerContext: 'planner context',
  writerContext: 'writer context',
  validatorContext: 'validator context',
  summarizerContext: 'summarizer context',
  characterProfiles: [],
  openPlotlines: [],
  researchRefs: [],
  recentChapterSummaries: [],
  storyState: { currentChapter: 1, totalPlanned: 100, mainConflict: '主线', subConflicts: [], emotionalArc: [] },
}

const project = {
  id: 1,
  title: '偷偷喜欢你',
  genre: '言情',
  writingStyle: '轻松甜宠',
  worldSetting: null,
  powerSystem: null,
  protagonistProfile: null,
  antagonistSetting: null,
  targetAudience: null,
  chapterWordCount: 1000,
  totalVolumes: 4,
  styleStrength: 0.5,
  styleSafetyMode: 'SAFE_ABSTRACT',
  bookBlueprint: null,
  styleProfile: null,
  aiModelConfig: null,
}

describe('FINAL_POLISH reviewer phase', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.prisma.novelProject.findUnique.mockResolvedValue(project)
    mocks.prisma.novelChapter.count.mockResolvedValue(0)
    mocks.prisma.novelChapter.findUnique.mockResolvedValue(null)
    mocks.prisma.novelChapter.upsert.mockResolvedValue({ id: 11, title: '第1章', chapterNumber: 1 })
    mocks.prisma.novelChapter.update.mockResolvedValue({})
    mocks.prisma.chapterCompletionReport.upsert.mockResolvedValue({})
    mocks.recordAndApplyChapterCommit.mockResolvedValue({})

    mocks.plannerAgent.mockResolvedValue({
      outline: {
        chapterTitle: '匿名论坛热帖',
        chapterGoal: '处理日记曝光后的第一波冲击',
        mainConflict: '女主面对校园舆论',
        keyScenes: [{ scene: '论坛曝光', characters: ['林知意'], emotion: '紧张' }],
        ending: '男主留下意味不明的回应',
        foreshadows: [],
        resolvedPlotlines: [],
      },
    })
    mocks.writerAgent.mockImplementation(async (_input, onChunk) => {
      onChunk?.('# 第1章\n\n原始草稿，人物仍是林知意和江以珩。')
      return { content: '# 第1章\n\n原始草稿，人物仍是林知意和江以珩。' }
    })
    mocks.polisherAgent.mockImplementation(async (_input, onChunk) => {
      onChunk?.('# 第1章\n\n润色稿，人物仍是林知意和江以珩。')
      return { content: '# 第1章\n\n润色稿，人物仍是林知意和江以珩。' }
    })
    mocks.reviewerAgent.mockResolvedValue({
      reviews: [],
      overallScore: 90,
      consensus: '可读',
      criticalIssues: [],
      improvementPriority: [],
    })
    mocks.summarizerAgent.mockResolvedValue({
      summary: '日记曝光，女主面对舆论。',
      keyEvents: [],
      characterUpdates: {},
      newPlotlines: [],
      resolvedPlotlines: [],
      emotionalTone: '紧张',
    })
    mocks.validatorAgent.mockResolvedValue({
      result: 'pass',
      score: 90,
      issues: [],
      characterUpdates: {},
      newPlotlines: [],
      resolvedPlotlines: [],
      qualityMetrics: { logicScore: 90, characterScore: 90, emotionScore: 90, styleScore: 90 },
    })
    mocks.chapterDeslopper.mockResolvedValue({
      revisedContent: '# 第1章\n\n润色稿，人物仍是林知意和江以珩。',
      changes: [],
    })
  })

  it('does not freely rewrite the polished chapter after review', async () => {
    const { runChapterGenerationPipeline } = await import('@/lib/engine/orchestrator')

    const result = await runChapterGenerationPipeline(1, 1, vi.fn(), { speedMode: 'FINAL_POLISH' })

    expect(result.success).toBe(true)
    expect(mocks.reviewerAgent).toHaveBeenCalledOnce()
    expect(mocks.writerAgent).toHaveBeenCalledOnce()
    expect(result.content).toContain('润色稿')
    expect(result.content).not.toContain('原始草稿')
  })
})
