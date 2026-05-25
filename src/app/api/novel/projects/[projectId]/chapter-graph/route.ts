import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { logError } from '@/lib/logger'
import { AnalysisDimension, AnalysisType } from '@/types'
import { buildChapterGraph } from '@/lib/analysis/chapter-graph'

/**
 * GET /api/novel/projects/[projectId]/chapter-graph
 * 获取拆书章节图谱
 */
export async function GET(
  _request: NextRequest,
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

    const [analyses, chapters, snapshot] = await Promise.all([
      prisma.bookAnalysis.findMany({
        where: {
          projectId: projectIdNum,
          analysisType: AnalysisType.BREAKDOWN,
          volumeNumber: -1,
        },
        orderBy: { dimension: 'asc' },
      }),
      prisma.novelChapter.findMany({
        where: { projectId: projectIdNum },
        select: { chapterNumber: true, title: true, summary: true, updatedAt: true },
        orderBy: { chapterNumber: 'asc' },
      }),
      prisma.chapterGraphSnapshot.findUnique({
        where: { projectId: projectIdNum },
      }),
    ])

    const analysisMap = new Map<AnalysisDimension, Record<string, unknown>>()
    analyses.forEach(item => {
      analysisMap.set(item.dimension as AnalysisDimension, item.analysisData as Record<string, unknown>)
    })

    const storyOverview = analysisMap.get(AnalysisDimension.STORY_OVERVIEW) || {}
    const chapterStructure = analysisMap.get(AnalysisDimension.CHAPTER_STRUCTURE) || {}
    const plotLine = analysisMap.get(AnalysisDimension.PLOT_LINE) || {}
    const foreshadowing = analysisMap.get(AnalysisDimension.FORESHADOWING) || {}
    const readingExperience = analysisMap.get(AnalysisDimension.READING_EXPERIENCE) || {}
    const worldSetting = analysisMap.get(AnalysisDimension.WORLD_SETTING) || {}

    const latestAnalysisUpdatedAt = analyses.reduce<Date | null>((latest, item) => {
      if (!latest || item.updatedAt > latest) return item.updatedAt
      return latest
    }, null)
    const latestChapterUpdatedAt = chapters.reduce<Date | null>((latest, item) => {
      if (!latest || item.updatedAt > latest) return item.updatedAt
      return latest
    }, null)
    const sourceUpdatedAt = [latestAnalysisUpdatedAt, latestChapterUpdatedAt]
      .filter((value): value is Date => Boolean(value))
      .reduce<Date | null>((latest, value) => {
        if (!latest || value > latest) return value
        return latest
      }, null)

    if (snapshot && sourceUpdatedAt && snapshot.sourceUpdatedAt && snapshot.sourceUpdatedAt >= sourceUpdatedAt) {
      return NextResponse.json({
        success: true,
        data: {
          graph: snapshot.graph,
          chapterCount: chapters.length,
          sourceCount: analyses.length,
          chapters: chapters.map(ch => ({
            chapterNo: ch.chapterNumber,
            title: ch.title,
            summary: ch.summary || '',
          })),
          cached: true,
          sourceUpdatedAt: snapshot.sourceUpdatedAt,
          generatedAt: snapshot.generatedAt,
        },
      })
    }

    const graph = buildChapterGraph({
      storyOverview,
      chapterStructure,
      plotLine,
      foreshadowing,
      readingExperience: readingExperience as {
        scores?: Record<string, number>
        readingFeel?: {
          hookSummary?: string
          wowPointSummary?: string
          fatigueSummary?: string
          chapterEndingSummary?: string
        }
        highlightChapters?: Array<{ chapter?: number; reason?: string }>
        fatigueChapters?: Array<{ chapterRange?: string; reason?: string }>
        readerTakeaway?: string
      },
      worldSetting,
    })

    await prisma.chapterGraphSnapshot.upsert({
      where: { projectId: projectIdNum },
      create: {
        projectId: projectIdNum,
        graph: graph as unknown as Prisma.InputJsonValue,
        sourceUpdatedAt,
      },
      update: {
        graph: graph as unknown as Prisma.InputJsonValue,
        sourceUpdatedAt,
        generatedAt: new Date(),
      },
    })

    return NextResponse.json({
      success: true,
      data: {
        graph,
        chapterCount: chapters.length,
        sourceCount: analyses.length,
        chapters: chapters.map(ch => ({
          chapterNo: ch.chapterNumber,
          title: ch.title,
          summary: ch.summary || '',
        })),
        cached: false,
        sourceUpdatedAt,
      },
    })
  } catch (error) {
    logError(error instanceof Error ? error : new Error(String(error)), { type: 'get_chapter_graph', projectId: projectIdNum })
    return NextResponse.json(
      { success: false, error: { code: 'FETCH_ERROR', message: '获取章节图谱失败' } },
      { status: 500 }
    )
  }
}
