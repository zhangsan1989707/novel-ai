import { prisma } from '@/lib/prisma'
import { normalizeGenerationSpeedMode, type GenerationSpeedMode } from '@/lib/ai/speed-mode'
import { sanitizePipelineRuntime, type PipelineRuntimeState } from './pipeline-runtime'
import { failStaleRunningJobs } from './generation-job'
import { resolveProjectPlanningTargets } from './project-length'
import { buildProjectRuntimeSummary, type ProjectRuntimeSummary } from './project-runtime'

export interface ProjectPipelineSnapshot {
  status: 'IDLE' | string
  currentStep: string
  progress: number
  currentChapter: number
  totalChapters: number
  completedChapters: number
  failedChapters: number
  queuedChapters: number
  actualChapterCount: number
  nextChapterNumber: number
  currentChapterProgress: number
  error?: string
  pipelineJobId?: number
  speedMode?: GenerationSpeedMode
  runtime: PipelineRuntimeState
  lastHeartbeatAt: string | null
  updatedAt: string
  runtimeSummary: ProjectRuntimeSummary
}

export async function readProjectPipelineSnapshot(
  projectId: number,
  options: {
    reconcileStale?: boolean
    maintenanceActive?: boolean
  } = {}
): Promise<ProjectPipelineSnapshot | null> {
  if (options.reconcileStale) {
    await failStaleRunningJobs({ projectId })
  }

  const project = await prisma.novelProject.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      status: true,
      aiModelId: true,
      workflowStage: true,
      blueprintConfirmedAt: true,
      arcPlanConfirmedAt: true,
      totalVolumes: true,
      lengthType: true,
      targetWordCount: true,
      chapterWordCount: true,
      pipelineJobId: true,
      bookBlueprint: { select: { id: true } },
      arcPlans: { select: { id: true } },
    },
  })

  if (!project) return null

  const chapters = await prisma.novelChapter.findMany({
    where: { projectId },
    select: {
      chapterNumber: true,
      status: true,
      wordCount: true,
      content: true,
      validationReport: true,
      completionReport: true,
    },
    orderBy: { chapterNumber: 'asc' },
  })

  const planningTargets = resolveProjectPlanningTargets({
    lengthType: project.lengthType,
    targetWordCount: project.targetWordCount,
    chapterWordCount: project.chapterWordCount,
  })
  const totalChapters = planningTargets.effectiveTotalChapters || project.totalVolumes * 25 || 300
  const completedChapterCount = chapters.filter(chapter => chapter.status === 'COMPLETED').length
  const firstIncomplete = chapters.find(chapter => chapter.status !== 'COMPLETED')
  const nextChapterNumber = firstIncomplete
    ? firstIncomplete.chapterNumber
    : (completedChapterCount > 0 ? completedChapterCount + 1 : 1)

  let jobId = project.pipelineJobId
  if (!jobId) {
    const latestJob = await prisma.generationJob.findFirst({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    })
    jobId = latestJob?.id || null
  }

  const job = jobId
    ? await prisma.generationJob.findUnique({
        where: { id: jobId },
        select: {
          id: true,
          status: true,
          currentStep: true,
          totalChapters: true,
          currentChapter: true,
          errorMessage: true,
          payload: true,
          updatedAt: true,
        },
      })
    : null

  const payload = job?.payload && typeof job.payload === 'object'
    ? job.payload as Record<string, unknown>
    : {}
  const runtime = sanitizePipelineRuntime(payload.runtime)
  const currentChapterProgress = runtime.currentChapter
    ? Math.round((runtime.currentChapter.currentWordCount / Math.max(runtime.currentChapter.targetWordCount, 1)) * 100)
    : 0

  const runtimeSummary = buildProjectRuntimeSummary({
    projectId,
    projectStatus: project.status,
    workflowStage: project.workflowStage,
    hasModel: Boolean(project.aiModelId),
    hasBlueprint: Boolean(project.bookBlueprint),
    blueprintConfirmedAt: project.blueprintConfirmedAt,
    hasArcPlans: project.arcPlans.length > 0,
    arcPlanConfirmedAt: project.arcPlanConfirmedAt,
    totalChapters,
    maintenanceActive: options.maintenanceActive,
    chapters,
    job: job
      ? {
          jobId: job.id,
          status: job.status,
          currentStep: job.currentStep,
          currentChapter: job.currentChapter,
          totalChapters: job.totalChapters,
          runtime,
          error: job.errorMessage,
          updatedAt: job.updatedAt,
        }
      : null,
  })

  return {
    status: job?.status || 'IDLE',
    currentStep: job?.currentStep || '',
    progress: runtimeSummary.overallProgress,
    currentChapter: job?.currentChapter || 0,
    totalChapters,
    completedChapters: completedChapterCount,
    failedChapters: runtimeSummary.failedChapters,
    queuedChapters: runtimeSummary.queuedChapters,
    actualChapterCount: chapters.length,
    nextChapterNumber,
    currentChapterProgress,
    error: job?.errorMessage || undefined,
    pipelineJobId: job?.id,
    speedMode: normalizeGenerationSpeedMode(payload.speedMode || runtime.speedMode),
    runtime,
    lastHeartbeatAt: runtimeSummary.lastHeartbeatAt || null,
    updatedAt: job?.updatedAt.toISOString() || new Date().toISOString(),
    runtimeSummary,
  }
}
