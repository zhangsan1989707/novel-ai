import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { logError } from '@/lib/logger'
import { AnalysisDimension } from '@/types'
import { buildFallbackAnalysisData, isRefusalContent } from '@/lib/analysis/book-analysis-fallback'
import { projectNotFoundResponse, requireProjectOwner } from '@/lib/server/project-access'

// ============================================
// Schema 验证
// ============================================

const getAnalysisSchema = z.object({
  volumeNumber: z.string().optional().transform(v => v ? parseInt(v, 10) : undefined),
  dimension: z.union([z.nativeEnum(AnalysisDimension), z.literal('all')]).optional().transform(v => v || 'all'),
})

// ============================================
// API Handler
// ============================================

/**
 * GET /api/novel/projects/[projectId]/book-analysis
 * 获取项目的拆书分析结果
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  let projectIdNum: number | null = null
  try {
    const { projectId } = await params
    projectIdNum = parseInt(projectId, 10)

    if (isNaN(projectIdNum)) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_ID', message: '无效的项目ID' } },
        { status: 400 }
      )
    }

    if (!await requireProjectOwner(projectIdNum)) {
      return projectNotFoundResponse()
    }

    const { searchParams } = new URL(request.url)
    const query = getAnalysisSchema.parse({
      volumeNumber: searchParams.get('volumeNumber') ?? undefined,
      dimension: searchParams.get('dimension') ?? undefined,
    })

    // 构建查询条件
    const where: Record<string, unknown> = {
      projectId: projectIdNum,
    }

    if (query.volumeNumber != null) {
      where.volumeNumber = query.volumeNumber
    }

    if (query.dimension && query.dimension !== 'all') {
      where.dimension = query.dimension
    }

    const project = await prisma.novelProject.findUnique({
      where: { id: projectIdNum },
      select: {
        title: true,
        genre: true,
        outline: true,
        outlineStages: true,
        worldSetting: true,
        powerSystem: true,
        protagonistProfile: true,
        protagonistGoal: true,
        antagonistSetting: true,
        endingPlan: true,
        writingPrompt: true,
        chapters: {
          select: {
            chapterNumber: true,
            title: true,
            summary: true,
          },
          orderBy: { chapterNumber: 'asc' },
        },
      },
    })

    // 查询分析结果
    const analyses = await prisma.bookAnalysis.findMany({
      where,
      orderBy: [
        { volumeNumber: 'asc' },
        { dimension: 'asc' },
        { createdAt: 'desc' },
      ],
    })

    const normalizedAnalyses = project
      ? analyses.map((analysis) => {
          const rawData = (analysis.analysisData as Record<string, unknown> | null) || {}
          const needsFallback = Object.keys(rawData).length === 0 || isRefusalContent(analysis.rawContent)
          return needsFallback
            ? {
                ...analysis,
                analysisData: buildFallbackAnalysisData(project, analysis.dimension as AnalysisDimension),
              }
            : analysis
        })
      : analyses

    return NextResponse.json({
      success: true,
      data: normalizedAnalyses,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: error.issues[0]?.message || '验证失败' } },
        { status: 400 }
      )
    }
    logError(error instanceof Error ? error : new Error(String(error)), { type: 'get_book_analysis', projectId: projectIdNum })
    return NextResponse.json(
      { success: false, error: { code: 'FETCH_ERROR', message: '获取分析结果失败' } },
      { status: 500 }
    )
  }
}
