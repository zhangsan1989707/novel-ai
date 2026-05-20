import { getMinimumChapterWordCount } from '@/lib/ai/chapter-quality'
import { PlotlineStatus } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getRAGDocumentCount } from './rag-vector'

export type HealthSeverity = 'error' | 'warning' | 'info'
export type HealthLevel = 'critical' | 'warning' | 'healthy'

export interface HealthIssue {
  severity: HealthSeverity
  code: string
  message: string
}

export interface ProjectHealthInput {
  aiModelConfig: unknown
  bookBlueprint: unknown
  arcPlans: Array<unknown>
  storyState: unknown
  chapters: Array<{ status: string; wordCount: number; chapterNumber: number }>
  recentCommits: Array<{ projectionStatus: unknown; status: string }>
  plotlines: Array<{
    status: string
    plantedAt: number
    plannedAt: number | null
    resolvedAt: number | null
  }>
  villains: Array<{
    isFinalBoss: boolean
    lifecycle?: string | null
    tier?: string | null
    defeatedAt?: number | null
    introducedAt?: number | null
  }>
  worldState: unknown
  chapterWordCount: number
  chapterSummaryCount: number
  volumeSummaryCount: number
  bookSummaryCount: number
  characterCount: number
  plotlineCount: number
  openPlotlineCount: number
  resolvedPlotlineCount: number
  researchRefCount: number
  ragDocumentCount: number
  automationState?: {
    bootstrapQueued?: boolean
    ragQueued?: boolean
  }
}

export interface ProjectHealthReport {
  ready: boolean
  healthScore: number
  healthLevel: HealthLevel
  primaryAction: string
  recommendations: string[]
  hasModel: boolean
  hasBlueprint: boolean
  hasArcPlans: boolean
  hasStoryState: boolean
  hasWorldState: boolean
  hasFinalBoss: boolean
  totalChapters: number
  completedChapters: number
  reviewingChapters: number
  draftChapters: number
  emptyCompletedChapters: number
  recentCommitFailures: number
  chapterSummaryCount: number
  volumeSummaryCount: number
  bookSummaryCount: number
  characterCount: number
  plotlineCount: number
  openPlotlineCount: number
  resolvedPlotlineCount: number
  researchRefCount: number
  ragDocumentCount: number
  chapterSummaryCoverage: number
  volumeSummaryCoverage: number
  memoryCoverageScore: number
  strandScore: number
  wordCountComplianceRate: number
  overduePlotlineCount: number
  activeVillainCount: number
  finalBossCount: number
  issues: HealthIssue[]
}

function getHealthLevel(score: number, hasCriticalIssue: boolean): HealthLevel {
  if (hasCriticalIssue || score < 50) return 'critical'
  if (score < 75) return 'warning'
  return 'healthy'
}

function normalizeScore(score: number): number {
  if (Number.isNaN(score)) return 0
  return Math.max(0, Math.min(100, Math.round(score)))
}

type HealthSummary = Omit<ProjectHealthReport, 'primaryAction' | 'recommendations' | 'healthScore' | 'healthLevel' | 'ready' | 'issues'>

function buildPrimaryAction(report: HealthSummary): string {
  if (!report.hasModel) return '先绑定 AI 模型'
  if (!report.hasBlueprint || !report.hasArcPlans || !report.hasStoryState) return '系统正在自动初始化'
  if (report.emptyCompletedChapters > 0) return '回看短章并重算投影'
  if (report.recentCommitFailures > 0) return '重放失败的章节提交'
  if (report.overduePlotlineCount > 0) return '回收过期伏笔'
  if (report.chapterSummaryCoverage < 80 && report.completedChapters >= 5) return '补齐章节摘要'
  if (report.ragDocumentCount === 0 && (report.completedChapters > 0 || report.bookSummaryCount > 0)) return '系统正在自动重建 RAG 索引'
  if (report.wordCountComplianceRate < 80 && report.completedChapters > 0) return '提高章节字数门槛'
  if (report.strandScore < 45 && report.hasBlueprint && report.hasArcPlans) return '补强伏笔与摘要链路'
  return '继续生产'
}

function buildRecommendations(report: HealthSummary): string[] {
  const recommendations: string[] = []

  if (!report.hasModel) {
    recommendations.push('先绑定 AI 模型，否则主生成链路无法稳定运行')
  }
  if (!report.hasBlueprint || !report.hasArcPlans || !report.hasStoryState) {
    recommendations.push('系统正在自动初始化创作系统，补齐蓝图、阶段规划和故事状态')
  }
  if (report.emptyCompletedChapters > 0) {
    recommendations.push('修复已完成但字数过低的章节，避免质量门失真')
  }
  if (report.recentCommitFailures > 0) {
    recommendations.push('重放失败的章节提交，保持回写链路一致')
  }
  if (report.overduePlotlineCount > 0) {
    recommendations.push('回收已超时的伏笔，避免主线发散')
  }
  if (report.completedChapters >= 5 && report.chapterSummaryCoverage < 80) {
    recommendations.push('章节摘要覆盖不足，建议补摘要或重跑摘要投影')
  }
  if (report.wordCountComplianceRate < 80 && report.completedChapters > 0) {
    recommendations.push('完成章字数合规率偏低，建议提高最低字数门槛')
  }
  if (report.strandScore < 45 && report.hasBlueprint && report.hasArcPlans) {
    recommendations.push('追读稳定度偏低，建议补强伏笔、角色状态和故事摘要')
  }
  if (report.ragDocumentCount === 0 && (report.completedChapters > 0 || report.chapterSummaryCount > 0 || report.volumeSummaryCount > 0 || report.bookSummaryCount > 0)) {
    recommendations.push('RAG 索引正在自动重建，完成后会恢复语义检索')
  }

  if (recommendations.length === 0) {
    recommendations.push('当前健康状态正常，可继续生产')
  }

  return recommendations.slice(0, 5)
}

export function buildProjectHealthReport(input: ProjectHealthInput): ProjectHealthReport {
  const hasModel = Boolean(input.aiModelConfig)
  const hasBlueprint = Boolean(input.bookBlueprint)
  const hasArcPlans = input.arcPlans.length > 0
  const hasStoryState = Boolean(input.storyState)
  const hasWorldState = Boolean(input.worldState)
  const hasFinalBoss = input.villains.some(v => v.isFinalBoss)

  const completedChapters = input.chapters.filter(chapter => chapter.status === 'COMPLETED')
  const reviewingChapters = input.chapters.filter(chapter => chapter.status === 'REVIEWING')
  const draftChapters = input.chapters.filter(chapter => chapter.status === 'DRAFT')

  const emptyCompletedChapters = completedChapters.filter(
    chapter => chapter.wordCount <= 0 || chapter.wordCount < getMinimumChapterWordCount(input.chapterWordCount, chapter.chapterNumber)
  )

  const recentCommitFailures = input.recentCommits.filter(commit => {
    if (commit.status !== 'accepted' && commit.status !== 'replayed') {
      return true
    }

    const projectionStatus = commit.projectionStatus as Record<string, unknown> | null | undefined
    return Boolean(
      projectionStatus &&
        Object.values(projectionStatus).some(value => typeof value === 'string' && value.startsWith('failed:'))
    )
  })

  const currentChapter = Math.max(
    0,
    ...(input.chapters.length > 0 ? input.chapters.map(chapter => chapter.chapterNumber) : [0]),
    ...(hasStoryState && typeof (input.storyState as { currentChapter?: unknown })?.currentChapter === 'number'
      ? [Number((input.storyState as { currentChapter?: number }).currentChapter || 0)]
      : [0])
  )

  const overduePlotlineCount = input.plotlines.filter(plotline => {
    if (plotline.status !== 'OPEN') return false
    if (plotline.resolvedAt) return false
    const overdueByPlannedAt = typeof plotline.plannedAt === 'number' && plotline.plannedAt > 0 && currentChapter > plotline.plannedAt + 2
    const overdueByAge = currentChapter > 0 && currentChapter - plotline.plantedAt > 30
    return overdueByPlannedAt || overdueByAge
  }).length

  const totalChapterCount = Math.max(1, completedChapters.length)
  const chapterSummaryCoverage = Math.min(100, Math.round((input.chapterSummaryCount / totalChapterCount) * 100))
  const volumeSummaryCoverage = Math.min(100, Math.round((input.volumeSummaryCount / Math.max(1, input.arcPlans.length || 1)) * 100))
  const memoryCoverageScore = Math.min(100, Math.round(
    (chapterSummaryCoverage * 0.35) +
    (volumeSummaryCoverage * 0.12) +
    (input.bookSummaryCount > 0 ? 15 : 0) +
    (input.characterCount > 0 ? 10 : 0) +
    (input.plotlineCount > 0 ? 10 : 0) +
    (input.researchRefCount > 0 ? 8 : 0) +
    (hasWorldState ? 5 : 0) +
    (hasFinalBoss ? 5 : 0)
  ))
  const strandScore = Math.min(100, Math.round(
    (hasBlueprint ? 18 : 0) +
    (hasArcPlans ? 18 : 0) +
    (hasStoryState ? 12 : 0) +
    (input.chapterSummaryCount > 0 ? 15 : 0) +
    (input.bookSummaryCount > 0 ? 10 : 0) +
    (input.characterCount > 0 ? 8 : 0) +
    (input.plotlineCount > 0 ? 8 : 0) +
    (overduePlotlineCount === 0 ? 6 : 0) +
    (hasWorldState ? 5 : 0)
  ))

  const compliantCompletedChapters = completedChapters.filter(chapter => {
    const minimum = getMinimumChapterWordCount(input.chapterWordCount, chapter.chapterNumber)
    return chapter.wordCount >= minimum
  }).length
  const wordCountComplianceRate = completedChapters.length > 0
    ? Math.min(100, Math.round((compliantCompletedChapters / completedChapters.length) * 100))
    : 100

  const activeVillainCount = input.villains.filter(v => (v.lifecycle || 'active') !== 'defeated').length
  const finalBossCount = input.villains.filter(v => v.isFinalBoss).length
  const plotlineHealthPenalty = Math.min(30, overduePlotlineCount * 8)
  const commitPenalty = Math.min(30, recentCommitFailures.length * 12)
  const shortChapterPenalty = Math.min(30, emptyCompletedChapters.length * 10)

  const baseScore = (
    (hasModel ? 14 : 0) +
    (hasBlueprint ? 10 : 0) +
    (hasArcPlans ? 10 : 0) +
    (hasStoryState ? 8 : 0) +
    (hasWorldState ? 5 : 0) +
    (input.ragDocumentCount > 0 ? 8 : 0) +
    (chapterSummaryCoverage * 0.14) +
    (volumeSummaryCoverage * 0.06) +
    (memoryCoverageScore * 0.12) +
    (strandScore * 0.12) +
    (wordCountComplianceRate * 0.1) +
    (finalBossCount > 0 ? 4 : 0) +
    (activeVillainCount > 0 ? 4 : 0)
  )

  const healthScore = normalizeScore(baseScore - plotlineHealthPenalty - commitPenalty - shortChapterPenalty)

  const issues: HealthIssue[] = []
  if (!hasModel) {
    issues.push({ severity: 'error', code: 'MODEL_NOT_BOUND', message: '项目未绑定 AI 模型，主生成链路可能无法稳定运行' })
  }
  if (!hasBlueprint) {
    issues.push({ severity: input.automationState?.bootstrapQueued ? 'info' : 'warning', code: 'BLUEPRINT_MISSING', message: input.automationState?.bootstrapQueued ? '书籍蓝图正在自动生成' : '尚未生成书籍蓝图，创作方向还没有锁定' })
  }
  if (!hasArcPlans) {
    issues.push({ severity: input.automationState?.bootstrapQueued ? 'info' : 'warning', code: 'ARC_PLAN_MISSING', message: input.automationState?.bootstrapQueued ? '阶段规划正在自动生成' : '尚未生成阶段规划，长篇结构会更依赖局部上下文' })
  }
  if (!hasStoryState) {
    issues.push({ severity: input.automationState?.bootstrapQueued ? 'info' : 'warning', code: 'STORY_STATE_MISSING', message: input.automationState?.bootstrapQueued ? '故事状态正在自动初始化' : '尚未初始化故事状态，情绪曲线与主线冲突不会稳定回写' })
  }
  if (!hasWorldState) {
    issues.push({ severity: input.automationState?.bootstrapQueued ? 'info' : 'info', code: 'WORLD_STATE_MISSING', message: input.automationState?.bootstrapQueued ? '世界状态正在自动初始化' : '尚未初始化世界状态，世界扩张会更依赖导演提示' })
  }
  if (draftChapters.length > 0) {
    issues.push({ severity: 'info', code: 'DRAFT_CHAPTERS_EXIST', message: `还有 ${draftChapters.length} 章未写作` })
  }
  if (reviewingChapters.length > 0) {
    issues.push({ severity: 'warning', code: 'REVIEWING_CHAPTERS_EXIST', message: `还有 ${reviewingChapters.length} 章待审稿` })
  }
  if (emptyCompletedChapters.length > 0) {
    issues.push({ severity: 'error', code: 'EMPTY_COMPLETED_CHAPTERS', message: `有 ${emptyCompletedChapters.length} 章已完成但字数过低` })
  }
  if (recentCommitFailures.length > 0) {
    issues.push({ severity: 'error', code: 'COMMIT_PROJECTION_FAILURES', message: `最近 ${recentCommitFailures.length} 条章节提交存在回写失败` })
  }
  if (overduePlotlineCount > 0) {
    issues.push({ severity: 'warning', code: 'OVERDUE_PLOTLINES', message: `有 ${overduePlotlineCount} 条伏笔已超期未回收` })
  }
  if (input.ragDocumentCount === 0 && (completedChapters.length > 0 || input.chapterSummaryCount > 0 || input.volumeSummaryCount > 0 || input.bookSummaryCount > 0)) {
    issues.push({ severity: input.automationState?.ragQueued ? 'info' : 'warning', code: 'RAG_INDEX_MISSING', message: input.automationState?.ragQueued ? 'RAG 索引正在自动重建' : 'RAG 索引尚未建立或为空，语义检索会先触发重建' })
  }
  if (completedChapters.length >= 5 && chapterSummaryCoverage < 80) {
    issues.push({ severity: 'warning', code: 'CHAPTER_SUMMARY_COVERAGE_LOW', message: `章节摘要覆盖率仅 ${chapterSummaryCoverage}%` })
  }
  if (wordCountComplianceRate < 80 && completedChapters.length > 0) {
    issues.push({ severity: 'warning', code: 'WORD_COUNT_COMPLIANCE_LOW', message: `完成章字数合规率仅 ${wordCountComplianceRate}%` })
  }
  if (strandScore < 45 && hasBlueprint && hasArcPlans) {
    issues.push({ severity: 'warning', code: 'STRAND_SCORE_LOW', message: `追读稳定度偏低（${strandScore}/100）` })
  }

  const ready = hasModel && hasBlueprint && hasArcPlans && hasStoryState && emptyCompletedChapters.length === 0 && recentCommitFailures.length === 0
  const hasCriticalIssue = issues.some(issue => issue.severity === 'error')
  const healthLevel = getHealthLevel(healthScore, hasCriticalIssue)

  const summary = {
    ready,
    hasModel,
    hasBlueprint,
    hasArcPlans,
    hasStoryState,
    hasWorldState,
    hasFinalBoss,
    totalChapters: input.chapters.length,
    completedChapters: completedChapters.length,
    reviewingChapters: reviewingChapters.length,
    draftChapters: draftChapters.length,
    emptyCompletedChapters: emptyCompletedChapters.length,
    recentCommitFailures: recentCommitFailures.length,
    chapterSummaryCount: input.chapterSummaryCount,
    volumeSummaryCount: input.volumeSummaryCount,
    bookSummaryCount: input.bookSummaryCount,
    characterCount: input.characterCount,
    plotlineCount: input.plotlineCount,
    openPlotlineCount: input.openPlotlineCount,
    resolvedPlotlineCount: input.resolvedPlotlineCount,
    researchRefCount: input.researchRefCount,
    ragDocumentCount: input.ragDocumentCount,
    chapterSummaryCoverage,
    volumeSummaryCoverage,
    memoryCoverageScore,
    strandScore,
    wordCountComplianceRate,
    overduePlotlineCount,
    activeVillainCount,
    finalBossCount,
  }

  const primaryAction = buildPrimaryAction(summary)
  const recommendations = buildRecommendations(summary)

  return {
    ...summary,
    healthScore,
    healthLevel,
    primaryAction,
    recommendations,
    issues,
  }
}

export async function loadProjectHealthReport(projectId: number): Promise<ProjectHealthReport | null> {
  const project = await prisma.novelProject.findUnique({
    where: { id: projectId },
    include: {
      aiModelConfig: true,
      bookBlueprint: true,
      storyState: true,
      worldState: true,
      chapters: {
        select: {
          status: true,
          wordCount: true,
          chapterNumber: true,
        },
      },
      plotlines: {
        select: {
          status: true,
          plantedAt: true,
          plannedAt: true,
          resolvedAt: true,
        },
      },
      villains: {
        select: {
          isFinalBoss: true,
          lifecycle: true,
          tier: true,
          defeatedAt: true,
          introducedAt: true,
        },
      },
      arcPlans: true,
    },
  })

  if (!project) {
    return null
  }

  const [
    recentCommits,
    chapterSummaryCount,
    volumeSummaryCount,
    bookSummaryCount,
    characterCount,
    plotlineCount,
    openPlotlineCount,
    resolvedPlotlineCount,
    researchRefCount,
    ragDocumentCount,
  ] = await Promise.all([
    prisma.chapterCommit.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        status: true,
        projectionStatus: true,
      },
    }),
    prisma.chapterSummary.count({ where: { projectId } }),
    prisma.volumeSummary.count({ where: { projectId } }),
    prisma.bookSummary.count({ where: { projectId } }),
    prisma.character.count({ where: { projectId } }),
    prisma.plotline.count({ where: { projectId } }),
    prisma.plotline.count({ where: { projectId, status: PlotlineStatus.OPEN } }),
    prisma.plotline.count({ where: { projectId, status: PlotlineStatus.RESOLVED } }),
    prisma.researchRef.count({ where: { projectId } }),
    getRAGDocumentCount(projectId),
  ])

  return buildProjectHealthReport({
    aiModelConfig: project.aiModelConfig,
    bookBlueprint: project.bookBlueprint,
    arcPlans: project.arcPlans,
    storyState: project.storyState,
    worldState: project.worldState,
    chapters: project.chapters,
    recentCommits,
    plotlines: project.plotlines,
    villains: project.villains,
    chapterWordCount: project.chapterWordCount,
    chapterSummaryCount,
    volumeSummaryCount,
    bookSummaryCount,
    characterCount,
    plotlineCount,
    openPlotlineCount,
    resolvedPlotlineCount,
    researchRefCount,
    ragDocumentCount,
  })
}
