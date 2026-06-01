import { getMinimumChapterWordCount } from '@/lib/ai/chapter-quality'
import { PlotlineStatus } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getRAGDocumentCount, getRagRuntimeStatus } from './rag-vector'

export type HealthSeverity = 'error' | 'warning' | 'info'
export type HealthLevel = 'critical' | 'warning' | 'healthy'

export interface HealthIssue {
  severity: HealthSeverity
  code: string
  message: string
}

export interface HealthActionItem {
  title: string
  detail: string
  urgency: 'now' | 'soon' | 'watch'
  blocking: boolean
  relatedIssueCodes: string[]
}

export interface HealthRiskItem {
  code: string
  title: string
  detail: string
  severity: HealthSeverity
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
  ragRuntime?: {
    inFlight: boolean
    cooldownRemainingMs: number
    embeddingFallbackActive: boolean
    lastError?: string | null
  }
}

export interface ProjectHealthReport {
  ready: boolean
  healthScore: number
  healthLevel: HealthLevel
  primaryAction: string
  recommendations: string[]
  blockers: string[]
  statusHeadline: string
  nextSteps: HealthActionItem[]
  riskHighlights: HealthRiskItem[]
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
  ragRebuildInFlight: boolean
  ragRebuildCooldownRemainingMs: number
  ragEmbeddingFallbackActive: boolean
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

type HealthSummary = Omit<
  ProjectHealthReport,
  'primaryAction' | 'recommendations' | 'healthScore' | 'healthLevel' | 'ready' | 'issues' | 'blockers' | 'statusHeadline' | 'nextSteps' | 'riskHighlights'
>

function formatSetupGapList(report: Pick<HealthSummary, 'hasBlueprint' | 'hasArcPlans' | 'hasStoryState'>): string {
  const gaps: string[] = []
  if (!report.hasBlueprint) gaps.push('蓝图')
  if (!report.hasArcPlans) gaps.push('阶段规划')
  if (!report.hasStoryState) gaps.push('故事状态')
  return gaps.join('、')
}

function formatCooldownSeconds(milliseconds: number): string {
  const seconds = Math.max(1, Math.ceil(milliseconds / 1000))
  return `${seconds} 秒`
}

function buildStatusHeadline(report: HealthSummary): string {
  if (!report.hasModel) return '现在不能开写：项目还没绑定可用 AI 模型。'
  if (!report.hasBlueprint || !report.hasArcPlans || !report.hasStoryState) {
    const gapList = formatSetupGapList(report)
    return `现在不建议开写：${gapList} 还没准备好。`
  }
  if (report.emptyCompletedChapters > 0) return `现在不建议继续推新章：有 ${report.emptyCompletedChapters} 章已标记完成但未达最低字数。`
  if (report.recentCommitFailures > 0) return `现在不建议继续推新章：最近 ${report.recentCommitFailures} 条章节提交回写失败。`
  if (report.overduePlotlineCount > 0) return `当前可继续写，但有 ${report.overduePlotlineCount} 条伏笔已超期，主线风险正在累积。`
  if (report.ragEmbeddingFallbackActive) return '当前可以继续写，但语义检索处于降级模式，引用和回顾质量会受影响。'
  if (report.ragRebuildInFlight) return '当前可以继续写，但 RAG 索引正在后台重建，检索结果会短时波动。'
  if (report.ragRebuildCooldownRemainingMs > 0 && report.ragDocumentCount === 0) {
    return `当前可以继续写，但 RAG 索引还在冷却，约 ${formatCooldownSeconds(report.ragRebuildCooldownRemainingMs)} 后恢复自动重建。`
  }
  if (report.chapterSummaryCoverage < 80 && report.completedChapters >= 5) return '当前可以继续写，但摘要覆盖不足，后续连贯性会越来越依赖即时上下文。'
  if (report.strandScore < 45) return '当前可以继续写，但追读稳定度偏低，后续章节更容易出现主线松散。'
  return '项目健康正常，可继续推进新章节。'
}

function buildPrimaryAction(report: HealthSummary): string {
  if (!report.hasModel) return '先绑定 AI 模型，否则主生成链路不会放行'
  if (!report.hasBlueprint || !report.hasArcPlans || !report.hasStoryState) {
    const gapList = formatSetupGapList(report)
    return `先补齐${gapList}，再进入正式开写`
  }
  if (report.emptyCompletedChapters > 0) return `先修复 ${report.emptyCompletedChapters} 章低字数完成章，再继续生产`
  if (report.recentCommitFailures > 0) return `先重放 ${report.recentCommitFailures} 条失败章节提交`
  if (report.overduePlotlineCount > 0) return `优先回收 ${report.overduePlotlineCount} 条过期伏笔`
  if (report.ragRebuildInFlight) return '等待 RAG 后台重建完成后再做重度检索依赖操作'
  if (report.chapterSummaryCoverage < 80 && report.completedChapters >= 5) return `补齐章节摘要，当前覆盖率仅 ${report.chapterSummaryCoverage}%`
  if (report.ragDocumentCount === 0 && (report.completedChapters > 0 || report.bookSummaryCount > 0)) {
    return report.ragRebuildCooldownRemainingMs > 0
      ? `等待 RAG 冷却结束（约 ${formatCooldownSeconds(report.ragRebuildCooldownRemainingMs)}）`
      : '触发并等待 RAG 索引重建完成'
  }
  if (report.wordCountComplianceRate < 80 && report.completedChapters > 0) return `提高最低章节字数门槛，当前合规率仅 ${report.wordCountComplianceRate}%`
  if (report.strandScore < 45 && report.hasBlueprint && report.hasArcPlans) return `补强伏笔与摘要链路，当前追读稳定度仅 ${report.strandScore}/100`
  return '继续生产'
}

function buildRecommendations(report: HealthSummary): string[] {
  const recommendations: string[] = []

  if (!report.hasModel) {
    recommendations.push('先绑定 AI 模型；未绑定前，项目页可以看但正式生成链路不应放行')
  }
  if (!report.hasBlueprint || !report.hasArcPlans || !report.hasStoryState) {
    const gapList = formatSetupGapList(report)
    recommendations.push(`先补齐${gapList}；这些基础上下文缺失时，AI 会退化成短上下文拼接，长线稳定性不够`)
  }
  if (report.emptyCompletedChapters > 0) {
    recommendations.push(`修复 ${report.emptyCompletedChapters} 章已完成但字数过低的章节，避免质量门把短章误判为已收敛`)
  }
  if (report.recentCommitFailures > 0) {
    recommendations.push(`重放最近 ${report.recentCommitFailures} 条失败提交，先把故事状态和摘要投影链路修正回来`)
  }
  if (report.overduePlotlineCount > 0) {
    recommendations.push(`回收 ${report.overduePlotlineCount} 条已超时伏笔，避免主线继续发散`)
  }
  if (report.completedChapters >= 5 && report.chapterSummaryCoverage < 80) {
    recommendations.push(`章节摘要覆盖率仅 ${report.chapterSummaryCoverage}% ，建议先补摘要或重跑摘要投影`)
  }
  if (report.wordCountComplianceRate < 80 && report.completedChapters > 0) {
    recommendations.push(`完成章字数合规率仅 ${report.wordCountComplianceRate}% ，建议提高最低字数门槛并回查短章`)
  }
  if (report.strandScore < 45 && report.hasBlueprint && report.hasArcPlans) {
    recommendations.push(`追读稳定度仅 ${report.strandScore}/100，建议补强伏笔、角色状态和故事摘要链路`)
  }
  if (report.ragDocumentCount === 0 && (report.completedChapters > 0 || report.chapterSummaryCount > 0 || report.volumeSummaryCount > 0 || report.bookSummaryCount > 0)) {
    recommendations.push(
      report.ragRebuildCooldownRemainingMs > 0
        ? `RAG 索引为空且仍在冷却，约 ${formatCooldownSeconds(report.ragRebuildCooldownRemainingMs)} 后恢复自动重建`
        : 'RAG 索引为空，建议等待自动重建完成后再依赖语义检索'
    )
  }
  if (report.ragRebuildInFlight) {
    recommendations.push('RAG 索引正在后台重建；这段时间检索结果可能缺章或引用不全')
  }
  if (report.ragEmbeddingFallbackActive) {
    recommendations.push('RAG embedding 当前使用本地回退模式，建议补齐独立 embedding 配置以恢复语义精度')
  }

  if (recommendations.length === 0) {
    recommendations.push('当前健康状态正常，可继续生成')
  }

  return recommendations.slice(0, 5)
}

function buildBlockers(issues: HealthIssue[]): string[] {
  return issues
    .filter(issue => issue.severity === 'error')
    .slice(0, 4)
    .map(issue => issue.message)
}

function buildNextSteps(report: HealthSummary, issues: HealthIssue[]): HealthActionItem[] {
  const steps: HealthActionItem[] = []
  const pushStep = (step: HealthActionItem) => {
    if (steps.some(existing => existing.title === step.title)) return
    steps.push(step)
  }

  if (!report.hasModel) {
    pushStep({
      title: '绑定 AI 模型',
      detail: '先给项目绑定可用模型；没有模型时，正式生成链路不应该继续执行。',
      urgency: 'now',
      blocking: true,
      relatedIssueCodes: ['MODEL_NOT_BOUND'],
    })
  }

  if (!report.hasBlueprint || !report.hasArcPlans || !report.hasStoryState) {
    const gapList = formatSetupGapList(report)
    pushStep({
      title: `补齐${gapList}`,
      detail: '先把创作骨架补齐，再开写正文；否则后续章节会更依赖局部上下文，长线稳定性不足。',
      urgency: 'now',
      blocking: true,
      relatedIssueCodes: ['BLUEPRINT_MISSING', 'ARC_PLAN_MISSING', 'STORY_STATE_MISSING'],
    })
  }

  if (report.emptyCompletedChapters > 0) {
    pushStep({
      title: '修复低字数完成章',
      detail: `回看并修复 ${report.emptyCompletedChapters} 章已标记完成但未达最低字数的章节，再继续推进新章。`,
      urgency: 'now',
      blocking: true,
      relatedIssueCodes: ['EMPTY_COMPLETED_CHAPTERS'],
    })
  }

  if (report.recentCommitFailures > 0) {
    pushStep({
      title: '重放失败提交',
      detail: `先重放最近 ${report.recentCommitFailures} 条失败提交，确保故事状态、摘要和投影链路重新一致。`,
      urgency: 'now',
      blocking: true,
      relatedIssueCodes: ['COMMIT_PROJECTION_FAILURES'],
    })
  }

  if (report.overduePlotlineCount > 0) {
    pushStep({
      title: '回收过期伏笔',
      detail: `优先处理 ${report.overduePlotlineCount} 条超期未回收伏笔，降低主线继续发散的风险。`,
      urgency: 'soon',
      blocking: false,
      relatedIssueCodes: ['OVERDUE_PLOTLINES'],
    })
  }

  if (report.completedChapters >= 5 && report.chapterSummaryCoverage < 80) {
    pushStep({
      title: '补齐章节摘要',
      detail: `当前摘要覆盖率 ${report.chapterSummaryCoverage}% ，建议补摘要或重跑摘要投影，避免长线记忆继续变薄。`,
      urgency: 'soon',
      blocking: false,
      relatedIssueCodes: ['CHAPTER_SUMMARY_COVERAGE_LOW'],
    })
  }

  if (report.ragDocumentCount === 0 && (report.completedChapters > 0 || report.chapterSummaryCount > 0 || report.volumeSummaryCount > 0 || report.bookSummaryCount > 0)) {
    pushStep({
      title: report.ragRebuildCooldownRemainingMs > 0 ? '等待 RAG 冷却结束' : '等待 RAG 重建完成',
      detail: report.ragRebuildCooldownRemainingMs > 0
        ? `当前索引为空且仍在冷却，约 ${formatCooldownSeconds(report.ragRebuildCooldownRemainingMs)} 后会再次自动重建。`
        : '当前索引为空，建议等自动重建完成后再依赖语义检索和引用回顾。',
      urgency: report.ragRebuildCooldownRemainingMs > 0 ? 'watch' : 'soon',
      blocking: false,
      relatedIssueCodes: ['RAG_INDEX_MISSING', 'RAG_REBUILD_COOLDOWN'],
    })
  }

  if (report.ragEmbeddingFallbackActive) {
    pushStep({
      title: '恢复正式 embedding 配置',
      detail: '当前使用本地回退向量，检索质量会下降；补齐独立 embedding 配置后再做强依赖检索的生成。',
      urgency: 'soon',
      blocking: false,
      relatedIssueCodes: ['RAG_EMBEDDING_FALLBACK'],
    })
  }

  if (report.wordCountComplianceRate < 80 && report.completedChapters > 0) {
    pushStep({
      title: '提高章节字数合规率',
      detail: `当前合规率仅 ${report.wordCountComplianceRate}% ，建议上调最低字数门槛并回查短章。`,
      urgency: 'soon',
      blocking: false,
      relatedIssueCodes: ['WORD_COUNT_COMPLIANCE_LOW'],
    })
  }

  if (report.strandScore < 45 && report.hasBlueprint && report.hasArcPlans) {
    pushStep({
      title: '补强追读链路',
      detail: `当前追读稳定度 ${report.strandScore}/100，建议优先补伏笔、角色状态和故事摘要链路。`,
      urgency: 'soon',
      blocking: false,
      relatedIssueCodes: ['STRAND_SCORE_LOW'],
    })
  }

  if (steps.length === 0) {
    pushStep({
      title: '继续生产',
      detail: '当前没有阻塞项，可以直接进入下一章生成或审稿。',
      urgency: 'watch',
      blocking: false,
      relatedIssueCodes: [],
    })
  }

  for (const issue of issues) {
    if (steps.length >= 5) break
    if (steps.some(step => step.relatedIssueCodes.includes(issue.code))) continue
    pushStep({
      title: issue.severity === 'error' ? '先处理阻塞项' : '关注健康提醒',
      detail: issue.message,
      urgency: issue.severity === 'error' ? 'now' : issue.severity === 'warning' ? 'soon' : 'watch',
      blocking: issue.severity === 'error',
      relatedIssueCodes: [issue.code],
    })
  }

  return steps.slice(0, 5)
}

function buildRiskHighlights(report: HealthSummary, issues: HealthIssue[]): HealthRiskItem[] {
  const risks: HealthRiskItem[] = issues
    .filter(issue => issue.severity !== 'info')
    .map(issue => ({
      code: issue.code,
      title:
        issue.code === 'MODEL_NOT_BOUND' ? '生成链路不可用' :
          issue.code === 'EMPTY_COMPLETED_CHAPTERS' ? '质量门失真' :
            issue.code === 'COMMIT_PROJECTION_FAILURES' ? '状态回写断裂' :
              issue.code === 'OVERDUE_PLOTLINES' ? '主线发散风险' :
                issue.code === 'RAG_EMBEDDING_FALLBACK' ? '检索质量下降' :
                  issue.code === 'CHAPTER_SUMMARY_COVERAGE_LOW' ? '长线记忆变薄' :
                    issue.code === 'WORD_COUNT_COMPLIANCE_LOW' ? '章节收敛不足' :
                      issue.code === 'STRAND_SCORE_LOW' ? '追读稳定度偏低' :
                        '项目健康风险',
      detail: issue.message,
      severity: issue.severity,
    }))

  if (risks.length === 0 && report.ragRebuildInFlight) {
    risks.push({
      code: 'RAG_REBUILD_RUNNING',
      title: '检索结果短时波动',
      detail: 'RAG 索引正在后台重建，短时间内引用和召回结果可能不稳定。',
      severity: 'info',
    })
  }

  return risks.slice(0, 4)
}

export function buildProjectHealthReport(input: ProjectHealthInput): ProjectHealthReport {
  const hasModel = Boolean(input.aiModelConfig)
  const hasBlueprint = Boolean(input.bookBlueprint)
  const hasArcPlans = input.arcPlans.length > 0
  const hasStoryState = Boolean(input.storyState)
  const hasWorldState = Boolean(input.worldState)
  const hasFinalBoss = input.villains.some(v => v.isFinalBoss)
  const ragRuntime = input.ragRuntime || {
    inFlight: false,
    cooldownRemainingMs: 0,
    embeddingFallbackActive: false,
    lastError: null,
  }

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
  if (input.ragRuntime?.inFlight) {
    issues.push({ severity: 'info', code: 'RAG_REBUILD_RUNNING', message: 'RAG 索引正在后台重建' })
  } else if (input.ragRuntime?.cooldownRemainingMs && input.ragRuntime.cooldownRemainingMs > 0) {
    issues.push({ severity: 'info', code: 'RAG_REBUILD_COOLDOWN', message: `RAG 索引处于冷却中，约 ${Math.ceil(input.ragRuntime.cooldownRemainingMs / 1000)} 秒后可再次自动重建` })
  }
  if (input.ragRuntime?.embeddingFallbackActive) {
    issues.push({ severity: 'warning', code: 'RAG_EMBEDDING_FALLBACK', message: 'RAG embedding 当前使用本地回退向量，语义质量会下降' })
  }
  if (input.ragRuntime?.lastError) {
    issues.push({ severity: 'warning', code: 'RAG_REBUILD_LAST_ERROR', message: `RAG 最近一次重建失败：${input.ragRuntime.lastError}` })
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
    ragRebuildInFlight: ragRuntime.inFlight,
    ragRebuildCooldownRemainingMs: ragRuntime.cooldownRemainingMs,
    ragEmbeddingFallbackActive: ragRuntime.embeddingFallbackActive,
    chapterSummaryCoverage,
    volumeSummaryCoverage,
    memoryCoverageScore,
    strandScore,
    wordCountComplianceRate,
    overduePlotlineCount,
    activeVillainCount,
    finalBossCount,
  }

  const blockers = buildBlockers(issues)
  const statusHeadline = buildStatusHeadline(summary)
  const primaryAction = buildPrimaryAction(summary)
  const recommendations = buildRecommendations(summary)
  const nextSteps = buildNextSteps(summary, issues)
  const riskHighlights = buildRiskHighlights(summary, issues)

  return {
    ...summary,
    ready,
    healthScore,
    healthLevel,
    blockers,
    statusHeadline,
    primaryAction,
    recommendations,
    nextSteps,
    riskHighlights,
    issues,
  }
}

export async function loadProjectHealthReport(projectId: number): Promise<ProjectHealthReport | null> {
  const project = await prisma.novelProject.findUnique({
    where: { id: projectId },
    include: {
      aiModelConfig: true,
      bookBlueprint: true,
      storyState: {
        select: {
          id: true,
          projectId: true,
          currentChapter: true,
          totalPlanned: true,
          mainConflict: true,
          metadata: true,
        },
      },
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
    ragRuntime: getRagRuntimeStatus(projectId),
  })
}
