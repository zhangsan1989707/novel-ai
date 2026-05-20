import { NextRequest, NextResponse } from 'next/server'
import { PlotlineStatus } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { logError } from '@/lib/logger'

type PreflightIssueSeverity = 'error' | 'warning' | 'info'

interface PreflightIssue {
  severity: PreflightIssueSeverity
  code: string
  message: string
}

function buildProjectPreflight(project: {
  aiModelConfig: unknown
  bookBlueprint: unknown
  arcPlans: Array<unknown>
  chapters: Array<{ status: string; wordCount: number; chapterNumber: number }>
  recentCommits: Array<{ projectionStatus: unknown; status: string }>
  chapterWordCount: number
  chapterSummaryCount: number
  volumeSummaryCount: number
  bookSummaryCount: number
  characterCount: number
  plotlineCount: number
  openPlotlineCount: number
  resolvedPlotlineCount: number
  researchRefCount: number
}) {
  const issues: PreflightIssue[] = []
  const hasModel = Boolean(project.aiModelConfig)
  const hasBlueprint = Boolean(project.bookBlueprint)
  const hasArcPlans = project.arcPlans.length > 0
  const completedChapters = project.chapters.filter(chapter => chapter.status === 'COMPLETED')
  const reviewingChapters = project.chapters.filter(chapter => chapter.status === 'REVIEWING')
  const draftChapters = project.chapters.filter(chapter => chapter.status === 'DRAFT')
  const emptyCompletedChapters = completedChapters.filter(
    chapter => chapter.wordCount <= 0 || chapter.wordCount < Math.max(200, Math.floor(project.chapterWordCount * 0.3))
  )

  const recentCommitFailures = project.recentCommits.filter(commit => {
    if (commit.status !== 'accepted' && commit.status !== 'replayed') {
      return true
    }

    const projectionStatus = commit.projectionStatus as Record<string, unknown> | null | undefined
    return Boolean(
      projectionStatus &&
        Object.values(projectionStatus).some(value => typeof value === 'string' && value.startsWith('failed:'))
    )
  })

  const totalChapterCount = Math.max(1, completedChapters.length)
  const chapterSummaryCoverage = Math.min(100, Math.round((project.chapterSummaryCount / totalChapterCount) * 100))
  const volumeSummaryCoverage = Math.min(100, Math.round((project.volumeSummaryCount / Math.max(1, project.arcPlans.length || 1)) * 100))
  const memoryCoverageScore = Math.min(100, Math.round(
    (chapterSummaryCoverage * 0.4) +
    (volumeSummaryCoverage * 0.15) +
    (project.bookSummaryCount > 0 ? 15 : 0) +
    (project.characterCount > 0 ? 10 : 0) +
    (project.plotlineCount > 0 ? 10 : 0) +
    (project.researchRefCount > 0 ? 10 : 0)
  ))
  const strandScore = Math.min(100, Math.round(
    (hasBlueprint ? 20 : 0) +
    (hasArcPlans ? 20 : 0) +
    (project.chapterSummaryCount > 0 ? 20 : 0) +
    (project.bookSummaryCount > 0 ? 10 : 0) +
    (project.characterCount > 0 ? 10 : 0) +
    (project.plotlineCount > 0 ? 10 : 0) +
    (project.openPlotlineCount > 0 ? 5 : 0) +
    (project.researchRefCount > 0 ? 5 : 0)
  ))

  if (!hasModel) {
    issues.push({
      severity: 'error',
      code: 'MODEL_NOT_BOUND',
      message: '项目未绑定 AI 模型，主生成链路可能无法稳定运行',
    })
  }

  if (!hasBlueprint) {
    issues.push({
      severity: 'warning',
      code: 'BLUEPRINT_MISSING',
      message: '尚未生成书籍蓝图，提交/重放只能依赖已有章节状态',
    })
  }

  if (!hasArcPlans) {
    issues.push({
      severity: 'warning',
      code: 'ARC_PLAN_MISSING',
      message: '尚未生成阶段规划，长篇续写会更依赖局部上下文',
    })
  }

  if (draftChapters.length > 0) {
    issues.push({
      severity: 'info',
      code: 'DRAFT_CHAPTERS_EXIST',
      message: `还有 ${draftChapters.length} 章未写作`,
    })
  }

  if (reviewingChapters.length > 0) {
    issues.push({
      severity: 'warning',
      code: 'REVIEWING_CHAPTERS_EXIST',
      message: `还有 ${reviewingChapters.length} 章待审稿`,
    })
  }

  if (emptyCompletedChapters.length > 0) {
    issues.push({
      severity: 'error',
      code: 'EMPTY_COMPLETED_CHAPTERS',
      message: `有 ${emptyCompletedChapters.length} 章已完成但字数过低，需要回看写作链路`,
    })
  }

  if (recentCommitFailures.length > 0) {
    issues.push({
      severity: 'error',
      code: 'COMMIT_PROJECTION_FAILURES',
      message: `最近 ${recentCommitFailures.length} 条章节提交存在回写失败`,
    })
  }

  if (completedChapters.length >= 5 && chapterSummaryCoverage < 80) {
    issues.push({
      severity: 'warning',
      code: 'CHAPTER_SUMMARY_COVERAGE_LOW',
      message: `章节摘要覆盖率仅 ${chapterSummaryCoverage}%`,
    })
  }

  if (strandScore < 45 && hasBlueprint && hasArcPlans) {
    issues.push({
      severity: 'warning',
      code: 'STRAND_SCORE_LOW',
      message: `追读稳定度偏低（${strandScore}/100），建议补强伏笔与摘要链路`,
    })
  }

  return {
    ready: hasModel && hasBlueprint && hasArcPlans && emptyCompletedChapters.length === 0 && recentCommitFailures.length === 0,
    hasModel,
    hasBlueprint,
    hasArcPlans,
    totalChapters: project.chapters.length,
    completedChapters: completedChapters.length,
    reviewingChapters: reviewingChapters.length,
    draftChapters: draftChapters.length,
    emptyCompletedChapters: emptyCompletedChapters.length,
    recentCommitFailures: recentCommitFailures.length,
    chapterSummaryCount: project.chapterSummaryCount,
    volumeSummaryCount: project.volumeSummaryCount,
    bookSummaryCount: project.bookSummaryCount,
    characterCount: project.characterCount,
    plotlineCount: project.plotlineCount,
    openPlotlineCount: project.openPlotlineCount,
    resolvedPlotlineCount: project.resolvedPlotlineCount,
    researchRefCount: project.researchRefCount,
    chapterSummaryCoverage,
    volumeSummaryCoverage,
    memoryCoverageScore,
    strandScore,
    issues,
  }
}

// ============================================
// Schema 验证
// ============================================

const updateProjectSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().optional(),
  genre: z.string().optional(),
  writingStyle: z.string().optional(),
  targetWordCount: z.number().int().positive().optional(),
  currentWordCount: z.number().int().min(0).optional(),
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

    const project = await prisma.novelProject.findUnique({
      where: { id },
      include: {
        aiModelConfig: true,
        bookBlueprint: true,
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
    ] = await Promise.all([
      prisma.chapterSummary.count({ where: { projectId: id } }),
      prisma.volumeSummary.count({ where: { projectId: id } }),
      prisma.bookSummary.count({ where: { projectId: id } }),
      prisma.character.count({ where: { projectId: id } }),
      prisma.plotline.count({ where: { projectId: id } }),
      prisma.plotline.count({ where: { projectId: id, status: PlotlineStatus.OPEN } }),
      prisma.plotline.count({ where: { projectId: id, status: PlotlineStatus.RESOLVED } }),
      prisma.researchRef.count({ where: { projectId: id } }),
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
    const preflight = buildProjectPreflight({
      aiModelConfig: project.aiModelConfig,
      bookBlueprint: project.bookBlueprint,
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
    })

    // 返回带计算后字数的项目数据
    return NextResponse.json({
      success: true,
      data: {
        ...project,
        currentWordCount: totalWordCount, // 实时计算替换数据库字段
        recentCommits,
        preflight,
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

    const body = await request.json()
    const validatedData = updateProjectSchema.parse(body)

    const project = await prisma.novelProject.update({
      where: { id },
      data: validatedData,
      include: {
        aiModelConfig: true,
      },
    })

    return NextResponse.json({ success: true, data: project })
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
