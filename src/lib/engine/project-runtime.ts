import type { PipelineRuntimeState } from './pipeline-runtime'

export type ProjectRuntimeStage =
  | 'IDLE'
  | 'BLUEPRINTING'
  | 'PLANNING_ARCS'
  | 'PLANNING_CHAPTERS'
  | 'QUEUING'
  | 'WRITING'
  | 'POLISHING'
  | 'VALIDATING'
  | 'DESLOPPING'
  | 'SUMMARIZING'
  | 'REPAIRING'
  | 'PAUSED'
  | 'FAILED'
  | 'COMPLETED'

export type ChapterRuntimeStatus =
  | 'PLANNED'
  | 'QUEUED'
  | 'WRITING'
  | 'POLISHING'
  | 'VALIDATING'
  | 'REVIEWING'
  | 'COMPLETED'
  | 'FAILED'
  | 'NEEDS_REPAIR'
  | 'SKIPPED'

export interface ProjectRuntimeSummary {
  projectId: number | string
  stage: ProjectRuntimeStage
  stageLabel: string
  overallProgress: number
  currentChapterNo?: number
  totalChapters: number
  completedChapters: number
  failedChapters: number
  queuedChapters: number
  activeJobId?: string
  lastHeartbeatAt?: string
  lastError?: string
  canStart: boolean
  canPause: boolean
  canResume: boolean
  canRepair: boolean
  canExport: boolean
}

export interface RuntimeProjectInput {
  projectId: number | string
  projectStatus?: string | null
  workflowStage?: string | null
  hasModel?: boolean
  hasBlueprint?: boolean
  blueprintConfirmedAt?: string | Date | null
  hasArcPlans?: boolean
  arcPlanConfirmedAt?: string | Date | null
  totalChapters: number
  maintenanceActive?: boolean
  chapters: RuntimeChapterInput[]
  job?: RuntimeJobInput | null
}

export interface RuntimeChapterInput {
  chapterNumber: number
  status: string
  wordCount?: number | null
  content?: string | null
  validationReport?: unknown
  completionReport?: unknown
}

export interface RuntimeJobInput {
  jobId: number | string
  status: string
  currentStep?: string | null
  currentChapter?: number | null
  totalChapters?: number | null
  runtime?: PipelineRuntimeState | null
  error?: string | null
  updatedAt?: string | Date | null
}

const STAGE_LABELS: Record<ProjectRuntimeStage, string> = {
  IDLE: '准备就绪',
  BLUEPRINTING: '准备全书蓝图',
  PLANNING_ARCS: '规划故事路线',
  PLANNING_CHAPTERS: '规划章节目录',
  QUEUING: '生成排队中',
  WRITING: '正文写作中',
  POLISHING: '文风润色中',
  VALIDATING: '质量校验中',
  DESLOPPING: '去 AI 味处理中',
  SUMMARIZING: '摘要与入库中',
  REPAIRING: '章节修复中',
  PAUSED: '已暂停',
  FAILED: '生成异常',
  COMPLETED: '生成完成',
}

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(100, Math.round(value)))
}

function hasValue(value: string | Date | null | undefined): boolean {
  return Boolean(value)
}

function normalizeStep(value?: string | null): string {
  return (value || '').toUpperCase()
}

function normalizePhase(value?: string | null): string {
  return (value || '').toLowerCase()
}

function isActiveJob(job?: RuntimeJobInput | null): boolean {
  return Boolean(job && ['PENDING', 'RUNNING', 'PAUSED'].includes(job.status))
}

function stageFromStep(step?: string | null, runtime?: PipelineRuntimeState | null): ProjectRuntimeStage {
  const currentPhase = normalizePhase(runtime?.currentChapter?.currentPhase || runtime?.lastPhase)
  if (currentPhase) {
    if (currentPhase.includes('repair')) return 'REPAIRING'
    if (currentPhase.includes('deslop')) return 'DESLOPPING'
    if (currentPhase.includes('polish')) return 'POLISHING'
    if (
      currentPhase.includes('valid')
      || currentPhase.includes('review')
      || currentPhase.includes('quality')
      || currentPhase.includes('truncation')
      || currentPhase.includes('word_count')
    ) {
      return 'VALIDATING'
    }
    if (
      currentPhase.includes('summar')
      || currentPhase.includes('db_write')
      || currentPhase.includes('commit')
      || currentPhase.includes('completed')
    ) {
      return 'SUMMARIZING'
    }
    if (currentPhase.includes('writer') || currentPhase.includes('writing')) return 'WRITING'
    if (currentPhase.includes('planner') || currentPhase.includes('planning')) return 'PLANNING_CHAPTERS'
  }

  switch (normalizeStep(step)) {
    case 'BLUEPRINT':
      return 'BLUEPRINTING'
    case 'ARC_PLAN':
      return 'PLANNING_ARCS'
    case 'CHAPTER_LIST':
      return 'PLANNING_CHAPTERS'
    case 'WRITE':
      return 'WRITING'
    case 'POLISH':
      return 'POLISHING'
    case 'VALIDATE':
      return 'VALIDATING'
    case 'DESLOP':
      return 'DESLOPPING'
    case 'SUMMARIZE':
      return 'SUMMARIZING'
    default:
      return 'QUEUING'
  }
}

function stageFromWorkflow(input: RuntimeProjectInput, completedChapters: number): ProjectRuntimeStage {
  if (input.projectStatus === 'PAUSED') return 'PAUSED'
  if (!input.hasBlueprint || !hasValue(input.blueprintConfirmedAt)) return 'BLUEPRINTING'
  if (!input.hasArcPlans || !hasValue(input.arcPlanConfirmedAt)) return 'PLANNING_ARCS'
  if (input.chapters.length === 0) return 'PLANNING_CHAPTERS'
  if (input.totalChapters > 0 && completedChapters >= input.totalChapters) return 'COMPLETED'
  return 'IDLE'
}

function getLastHeartbeat(job?: RuntimeJobInput | null): string | undefined {
  const runtimeHeartbeat = job?.runtime?.lastEventAt
  if (runtimeHeartbeat) return runtimeHeartbeat
  if (job?.updatedAt instanceof Date) return job.updatedAt.toISOString()
  return job?.updatedAt || undefined
}

function mapActiveChapterStatus(runtime?: PipelineRuntimeState | null): ChapterRuntimeStatus {
  const phase = normalizePhase(runtime?.currentChapter?.currentPhase || runtime?.lastPhase)
  if (phase.includes('repair')) return 'NEEDS_REPAIR'
  if (phase.includes('polish')) return 'POLISHING'
  if (phase.includes('valid') || phase.includes('review') || phase.includes('quality')) return 'VALIDATING'
  if (phase.includes('deslop')) return 'VALIDATING'
  if (phase.includes('summar') || phase.includes('commit') || phase.includes('db_write')) return 'VALIDATING'
  return 'WRITING'
}

function buildChapterRuntimeStatuses(input: RuntimeProjectInput): ChapterRuntimeStatus[] {
  const currentChapterNo = input.job?.runtime?.currentChapter?.chapterNumber || input.job?.currentChapter || null
  const recentByChapter = new Map<number, string>()
  for (const chapter of input.job?.runtime?.recentChapters || []) {
    recentByChapter.set(chapter.chapterNumber, chapter.status)
  }

  return input.chapters.map(chapter => {
    const recentStatus = recentByChapter.get(chapter.chapterNumber)
    if (recentStatus === 'FAILED') return 'FAILED'

    if (currentChapterNo === chapter.chapterNumber && input.job?.status === 'RUNNING') {
      const currentRuntimeStatus = input.job.runtime?.currentChapter?.status
      if (currentRuntimeStatus === 'FAILED') return 'FAILED'
      return mapActiveChapterStatus(input.job.runtime)
    }

    if (chapter.status === 'COMPLETED') return 'COMPLETED'
    if (chapter.status === 'REVIEWING') return 'REVIEWING'
    if (chapter.status === 'GENERATING') return input.job ? 'WRITING' : 'FAILED'
    if (
      input.job?.status === 'RUNNING'
      && currentChapterNo
      && chapter.chapterNumber > currentChapterNo
      && chapter.status === 'DRAFT'
    ) {
      return 'QUEUED'
    }
    return 'PLANNED'
  })
}

function calculateProgress(input: RuntimeProjectInput, stage: ProjectRuntimeStage, completedChapters: number): number {
  const total = Math.max(input.totalChapters, 1)
  const current = input.job?.runtime?.currentChapter
  const currentChapterRatio = current
    ? Math.max(0, Math.min(1, current.currentWordCount / Math.max(current.targetWordCount, 1)))
    : 0

  if (completedChapters > 0 || stage === 'WRITING' || stage === 'POLISHING' || stage === 'VALIDATING' || stage === 'DESLOPPING' || stage === 'SUMMARIZING' || stage === 'REPAIRING') {
    return clampPercent(((completedChapters + currentChapterRatio) / total) * 100)
  }

  if (stage === 'COMPLETED') return 100
  if (stage === 'BLUEPRINTING') return input.hasBlueprint ? 12 : 5
  if (stage === 'PLANNING_ARCS') return input.hasArcPlans ? 25 : 18
  if (stage === 'PLANNING_CHAPTERS') return 30
  if (stage === 'QUEUING') return 30
  return 0
}

function buildStageLabel(input: RuntimeProjectInput, stage: ProjectRuntimeStage, completedChapters: number): string {
  if (stage === 'BLUEPRINTING') {
    if (!input.hasBlueprint) return '生成全书蓝图中'
    if (!hasValue(input.blueprintConfirmedAt)) return '等待确认全书蓝图'
  }
  if (stage === 'PLANNING_ARCS') {
    if (!input.hasArcPlans) return '规划故事路线中'
    if (!hasValue(input.arcPlanConfirmedAt)) return '等待确认故事路线'
  }
  if (stage === 'COMPLETED' && input.totalChapters > 0 && completedChapters < input.totalChapters) {
    return '当前批次完成'
  }
  return STAGE_LABELS[stage]
}

export function buildProjectRuntimeSummary(input: RuntimeProjectInput): ProjectRuntimeSummary {
  const completedChapters = input.chapters.filter(chapter => chapter.status === 'COMPLETED').length
  const chapterRuntimeStatuses = buildChapterRuntimeStatuses(input)
  const failedChapters = chapterRuntimeStatuses.filter(status => status === 'FAILED' || status === 'NEEDS_REPAIR').length
  const queuedChapters = chapterRuntimeStatuses.filter(status => status === 'QUEUED').length
  const reviewingChapters = chapterRuntimeStatuses.filter(status => status === 'REVIEWING').length

  let stage: ProjectRuntimeStage
  if (input.maintenanceActive) {
    stage = !input.hasBlueprint || !hasValue(input.blueprintConfirmedAt)
      ? 'BLUEPRINTING'
      : !input.hasArcPlans || !hasValue(input.arcPlanConfirmedAt)
        ? 'PLANNING_ARCS'
        : 'QUEUING'
  } else if (input.job?.status === 'PAUSED') {
    stage = 'PAUSED'
  } else if (input.job?.status === 'FAILED') {
    stage = 'FAILED'
  } else if (input.job?.status === 'COMPLETED') {
    stage = 'COMPLETED'
  } else if (input.job?.status === 'PENDING') {
    stage = stageFromStep(input.job.currentStep, input.job.runtime)
  } else if (input.job?.status === 'RUNNING') {
    stage = stageFromStep(input.job.currentStep, input.job.runtime)
  } else if (chapterRuntimeStatuses.includes('FAILED')) {
    stage = 'FAILED'
  } else {
    stage = stageFromWorkflow(input, completedChapters)
  }

  const allChaptersCompleted = input.totalChapters > 0 && completedChapters >= input.totalChapters
  const runningOrPending = input.job?.status === 'RUNNING' || input.job?.status === 'PENDING'
  const paused = input.job?.status === 'PAUSED'
  const failed = input.job?.status === 'FAILED' || stage === 'FAILED'
  const flowReady = Boolean(input.hasModel && input.hasBlueprint && input.hasArcPlans && input.blueprintConfirmedAt && input.arcPlanConfirmedAt)

  return {
    projectId: input.projectId,
    stage,
    stageLabel: buildStageLabel(input, stage, completedChapters),
    overallProgress: calculateProgress(input, stage, completedChapters),
    currentChapterNo: input.job?.runtime?.currentChapter?.chapterNumber || input.job?.currentChapter || undefined,
    totalChapters: input.totalChapters,
    completedChapters,
    failedChapters,
    queuedChapters,
    activeJobId: isActiveJob(input.job) || failed ? String(input.job?.jobId || '') || undefined : undefined,
    lastHeartbeatAt: getLastHeartbeat(input.job),
    lastError: input.job?.error || undefined,
    canStart: flowReady && !input.maintenanceActive && !runningOrPending && !paused && !allChaptersCompleted,
    canPause: runningOrPending,
    canResume: paused || failed,
    canRepair: failed || failedChapters > 0 || reviewingChapters > 0,
    canExport: completedChapters > 0 && !runningOrPending,
  }
}

