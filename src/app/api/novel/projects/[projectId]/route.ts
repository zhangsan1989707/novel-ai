import { NextRequest, NextResponse } from 'next/server'
import { PlotlineStatus } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { logError } from '@/lib/logger'
import { getRAGDocumentCount, getRagRuntimeStatus } from '@/lib/engine/rag-vector'
import { buildProjectHealthReport } from '@/lib/engine/project-health'
import { buildBlueprintConsoleSnapshot } from '@/lib/engine/blueprint-console'
import { ensureProjectMaintenanceQueued, getProjectMaintenanceSummary } from '@/lib/engine/auto-maintenance'
import { buildStoryRoadmap } from '@/lib/engine/story-roadmap'
import { resolveProjectPlanningTargets } from '@/lib/engine/project-length'
import { readProjectPipelineSnapshot } from '@/lib/engine/project-pipeline-snapshot'
import { normalizeChapterContentForUser } from '@/lib/chapter-content-normalizer'
import { projectNotFoundResponse, requireProjectOwner } from '@/lib/server/project-access'
import { redactAIConfig } from '@/lib/ai/config-redaction'

function buildProjectPreflight(project: {
  aiModelConfig: unknown
  bookBlueprint: unknown
  arcPlans: Array<unknown>
  storyState: unknown
  worldState: unknown
  chapters: Array<{ status: string; wordCount: number; chapterNumber: number }>
  recentCommits: Array<{ projectionStatus: unknown; status: string }>
  plotlines: Array<{ status: string; plantedAt: number; plannedAt: number | null; resolvedAt: number | null }>
  villains: Array<{
    isFinalBoss: boolean
    lifecycle?: string | null
    tier?: string | null
    defeatedAt?: number | null
    introducedAt?: number | null
  }>
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
}) {
  return buildProjectHealthReport(project)
}

const storyStateDetailSelect = {
  id: true,
  projectId: true,
  emotionalArc: true,
  mainConflict: true,
  subConflicts: true,
  currentChapter: true,
  totalPlanned: true,
  metadata: true,
  createdAt: true,
  updatedAt: true,
} as const

// ============================================
// Schema 验证
// ============================================

const updateProjectSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().optional(),
  genre: z.string().optional(),
  writingStyle: z.string().optional(),
  targetAudience: z.enum(['MALE', 'FEMALE']).nullable().optional(),
  targetWordCount: z.number().int().positive().optional(),
  chapterWordCount: z.number().int().positive().optional(),
  outline: z.string().optional(),
  outlineStages: z.object({
    stage1: z.array(z.object({ title: z.string(), summary: z.string() })).optional(),
    stage2: z.array(z.object({ title: z.string(), summary: z.string() })).optional(),
    stage3: z.array(z.object({ title: z.string(), summary: z.string() })).optional(),
    stage4: z.array(z.object({ title: z.string(), summary: z.string() })).optional(),
  }).optional(),
  worldSetting: z.string().optional(),
  powerSystem: z.string().optional(),
  protagonistProfile: z.string().optional(),
  protagonistGoal: z.string().optional(),
  antagonistSetting: z.string().optional(),
  endingPlan: z.string().optional(),
  writingPrompt: z.string().optional(),
  coverImage: z.string().optional(),
  totalVolumes: z.number().int().min(1).max(10).optional(),
  status: z.enum(['DRAFT', 'WRITING', 'COMPLETED', 'PAUSED']).optional(),
  aiModelId: z.number().int().positive().nullable().optional(),
  pace: z.number().min(0).max(1).optional(),
  darkness: z.number().min(0).max(1).optional(),
  humor: z.number().min(0).max(1).optional(),
  romance: z.number().min(0).max(1).optional(),
  powerGrowth: z.number().min(0).max(1).optional(),
  conflictIntensity: z.number().min(0).max(1).optional(),
  mysteryDensity: z.number().min(0).max(1).optional(),
})

// ============================================
// API Handlers
// ============================================

interface RouteParams {
  params: Promise<{ projectId: string }>
}

/**
 * GET /api/novel/projects/{projectId}
 * 获取项目详情
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  let id: number | null = null
  try {
    const { projectId } = await params
    id = parseInt(projectId)

    if (isNaN(id)) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_ID', message: '无效的项目ID' } },
        { status: 400 }
      )
    }

    if (!await requireProjectOwner(id)) {
      return projectNotFoundResponse()
    }

    const project = await prisma.novelProject.findUnique({
      where: { id },
      include: {
        aiModelConfig: true,
        bookBlueprint: true,
        storyState: { select: storyStateDetailSelect },
        worldState: true,
        chapters: {
          orderBy: { chapterNumber: 'asc' },
          select: {
            id: true,
            chapterNumber: true,
            title: true,
            wordCount: true,
            status: true,
            sortOrder: true,
            summary: true,
            content: true,
          },
        },
        plotlines: {
          orderBy: { plantedAt: 'asc' },
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
        arcPlans: {
          orderBy: { arcNumber: 'asc' },
        },
      },
    })

    const recentCommits = await prisma.chapterCommit.findMany({
      where: { projectId: id },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        id: true,
        chapterNo: true,
        source: true,
        status: true,
        projectionStatus: true,
        replayCount: true,
        appliedAt: true,
        createdAt: true,
      },
    })

    const [
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
      prisma.chapterSummary.count({ where: { projectId: id } }),
      prisma.volumeSummary.count({ where: { projectId: id } }),
      prisma.bookSummary.count({ where: { projectId: id } }),
      prisma.character.count({ where: { projectId: id } }),
      prisma.plotline.count({ where: { projectId: id } }),
      prisma.plotline.count({ where: { projectId: id, status: PlotlineStatus.OPEN } }),
      prisma.plotline.count({ where: { projectId: id, status: PlotlineStatus.RESOLVED } }),
      prisma.researchRef.count({ where: { projectId: id } }),
      getRAGDocumentCount(id),
    ])

    if (!project) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: '项目不存在' } },
        { status: 404 }
      )
    }

    // 实时计算当前总字数
    const totalWordCount = project.chapters.reduce((sum, chapter) => {
      return sum + (chapter.wordCount || 0)
    }, 0)
    void ensureProjectMaintenanceQueued(id, {
      hasModel: Boolean(project.aiModelConfig),
      hasBlueprint: Boolean(project.bookBlueprint),
      hasArcPlans: project.arcPlans.length > 0,
      hasStoryState: Boolean(project.storyState),
      hasWorldState: Boolean(project.worldState),
      ragDocumentCount,
      completedChapters: project.chapters.filter(chapter => chapter.status === 'COMPLETED').length,
      chapterSummaryCount,
      volumeSummaryCount,
      bookSummaryCount,
    }).catch(err => {
      logError(err instanceof Error ? err : new Error(String(err)), { type: 'maintenance_queue', projectId: id })
    })

    const maintenanceSummary = await getProjectMaintenanceSummary(id)
    const maintenanceActive = Boolean(
      maintenanceSummary.bootstrapQueued ||
      maintenanceSummary.bootstrapRunning ||
      maintenanceSummary.ragQueued ||
      maintenanceSummary.ragRunning
    )
    const planningTargets = resolveProjectPlanningTargets({
      lengthType: project.lengthType,
      targetWordCount: project.targetWordCount,
      chapterWordCount: project.chapterWordCount,
    })

    const preflight = buildProjectPreflight({
      aiModelConfig: project.aiModelConfig,
      bookBlueprint: project.bookBlueprint,
      storyState: project.storyState,
      arcPlans: project.arcPlans,
      chapters: project.chapters,
      recentCommits,
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
      plotlines: project.plotlines,
      villains: project.villains,
      worldState: project.worldState,
      ragRuntime: getRagRuntimeStatus(id),
      automationState: {
        bootstrapQueued: maintenanceSummary.bootstrapQueued || maintenanceSummary.bootstrapRunning,
        ragQueued: maintenanceSummary.ragQueued || maintenanceSummary.ragRunning,
      },
    })
    const blueprintConsole = await buildBlueprintConsoleSnapshot(id)
    const storyRoadmap = buildStoryRoadmap(
      project.arcPlans.map(plan => ({
        id: plan.id,
        arcNumber: plan.arcNumber,
        name: plan.name,
        stage: plan.stage,
        description: plan.description,
        startChapter: plan.startChapter,
        endChapter: plan.endChapter,
        goals: plan.goals,
        keyEvents: plan.keyEvents,
        popularFictionProfile: (project.bookBlueprint as unknown as { popularFictionProfile?: unknown } | null)?.popularFictionProfile as {
          emotionEngine?: { primaryEmotion?: string; readerPayoff?: string } | null
          conflictEngine?: { conflictTypes?: string[]; hookStrategy?: string } | null
        } | null,
      }))
    )
    const pipelineSnapshot = await readProjectPipelineSnapshot(id, { maintenanceActive })

    // 返回带计算后字数的项目数据
    return NextResponse.json({
      success: true,
      data: {
        ...project,
        aiModelConfig: project.aiModelConfig ? redactAIConfig(project.aiModelConfig) : null,
        chapters: project.chapters.map(chapter => ({
          ...chapter,
          content: normalizeChapterContentForUser(chapter.content),
        })),
        currentWordCount: totalWordCount, // 实时计算替换数据库字段
        effectiveTargetWordCount: planningTargets.effectiveTargetWordCount,
        recentCommits,
        preflight,
        blueprintConsole,
        storyRoadmap,
        estimatedTotalChapters: planningTargets.effectiveTotalChapters,
        expectedStageCount: planningTargets.stageSequence.length,
        maintenanceSummary,
        runtimeSummary: pipelineSnapshot?.runtimeSummary,
      }
    })
  } catch (error) {
    logError(error instanceof Error ? error : new Error(String(error)), { type: 'get_project', projectId: id })
    return NextResponse.json(
      { success: false, error: { code: 'FETCH_ERROR', message: '获取项目详情失败' } },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/novel/projects/{projectId}
 * 更新项目
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  let id: number | null = null
  try {
    const { projectId } = await params
    id = parseInt(projectId)

    if (isNaN(id)) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_ID', message: '无效的项目ID' } },
        { status: 400 }
      )
    }

    if (!await requireProjectOwner(id)) {
      return projectNotFoundResponse()
    }

    const body = await request.json()
    const validatedData = updateProjectSchema.parse(body)

    const project = await prisma.novelProject.update({
      where: { id },
      data: validatedData,
      include: {
        aiModelConfig: true,
      },
    })

    return NextResponse.json({
      success: true,
      data: {
        ...project,
        aiModelConfig: project.aiModelConfig ? redactAIConfig(project.aiModelConfig) : null,
      },
    })
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: error.issues[0]?.message || '验证失败' } },
        { status: 400 }
      )
    }
    logError(error instanceof Error ? error : new Error(String(error)), { type: 'update_project', projectId: id })
    return NextResponse.json(
      { success: false, error: { code: 'UPDATE_ERROR', message: '更新项目失败' } },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/novel/projects/{projectId}
 * 兼容部分前端调用
 */
export async function PATCH(request: NextRequest, context: RouteParams) {
  return PUT(request, context)
}

/**
 * DELETE /api/novel/projects/{projectId}
 * 删除项目
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  let id: number | null = null
  try {
    const { projectId } = await params
    id = parseInt(projectId)

    if (isNaN(id)) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_ID', message: '无效的项目ID' } },
        { status: 400 }
      )
    }

    if (!await requireProjectOwner(id)) {
      return projectNotFoundResponse()
    }

    await prisma.novelProject.delete({
      where: { id },
    })

    return NextResponse.json({ success: true, data: { id } })
  } catch (error) {
    logError(error instanceof Error ? error : new Error(String(error)), { type: 'delete_project', projectId: id })
    return NextResponse.json(
      { success: false, error: { code: 'DELETE_ERROR', message: '删除项目失败' } },
      { status: 500 }
    )
  }
}
