import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { AnalysisDimension, AnalysisType } from '@/types'
import { logError } from '@/lib/logger'

// ============================================
// Schema 验证
// ============================================

const contextSchema = z.object({
  mode: z.enum(['ending', 'continue', 'rewrite']),
})

// ============================================
// API Handler
// ============================================

/**
 * GET /api/novel/projects/[projectId]/continuation/context
 * 获取续写所需的上下文数据
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params
    const projectIdNum = parseInt(projectId, 10)

    if (isNaN(projectIdNum)) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_ID', message: '无效的项目ID' } },
        { status: 400 }
      )
    }

    const { searchParams } = new URL(request.url)
    const mode = searchParams.get('mode') || 'ending'

    // 获取项目信息
    const project = await prisma.novelProject.findUnique({
      where: { id: projectIdNum },
      select: {
        id: true,
        title: true,
        genre: true,
        writingStyle: true,
        worldSetting: true,
        powerSystem: true,
        protagonistProfile: true,
        protagonistGoal: true,
        antagonistSetting: true,
        endingPlan: true,
        totalVolumes: true,
      },
    })

    if (!project) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: '项目不存在' } },
        { status: 404 }
      )
    }

    // 获取所有分析结果
    const analyses = await prisma.bookAnalysis.findMany({
      where: {
        projectId: projectIdNum,
        analysisType: AnalysisType.BREAKDOWN,
      },
    })

    // 获取所有章节
    const chapters = await prisma.novelChapter.findMany({
      where: { projectId: projectIdNum },
      orderBy: { chapterNumber: 'desc' },
      select: { id: true, chapterNumber: true, title: true, status: true },
    })

    const completedChapters = chapters.filter(ch => ch.status === 'COMPLETED')
    const lastChapter = chapters[0] // 已按 chapterNumber desc 排序

    // 按模式返回不同数据
    if (mode === 'ending') {
      // 提取未回收伏笔
      const foreshadowingAnalysis = analyses.find(a => a.dimension === AnalysisDimension.FORESHADOWING)
      const plotLineAnalysis = analyses.find(a => a.dimension === AnalysisDimension.PLOT_LINE)
      const characterAnalysis = analyses.find(a => a.dimension === AnalysisDimension.CHARACTER_RELATION)

      const unresolvedForeshadowing: { setup: string; importance: string }[] = []
      const openPlotlines: { title: string; keyEvents: string[] }[] = []
      const characterArcs: { name: string; currentStatus: string; arcDescription?: string }[] = []

      // 解析伏笔数据
      if (foreshadowingAnalysis?.analysisData) {
        const data = foreshadowingAnalysis.analysisData as { items?: { setup: string; payoff?: string; importance: string }[] }
        if (data.items) {
          data.items.forEach(item => {
            if (!item.payoff || item.payoff.trim() === '') {
              unresolvedForeshadowing.push({ setup: item.setup, importance: item.importance })
            }
          })
        }
      }

      // 解析剧情线数据
      if (plotLineAnalysis?.analysisData) {
        const data = plotLineAnalysis.analysisData as { mainPlot?: { title: string; keyEvents: string[] }[]; subPlots?: { title: string; keyEvents: string[] }[] }
        if (data.mainPlot) {
          data.mainPlot.forEach(plot => {
            openPlotlines.push({ title: plot.title, keyEvents: plot.keyEvents || [] })
          })
        }
        if (data.subPlots) {
          data.subPlots.forEach(plot => {
            openPlotlines.push({ title: plot.title, keyEvents: plot.keyEvents || [] })
          })
        }
      }

      // 解析角色数据
      if (characterAnalysis?.analysisData) {
        const data = characterAnalysis.analysisData as { characters?: { name: string; description: string }[] }
        if (data.characters) {
          data.characters.slice(0, 10).forEach(char => {
            characterArcs.push({
              name: char.name,
              currentStatus: char.description.slice(0, 100),
            })
          })
        }
      }

      // 获取全书摘要
      const bookSummary = await prisma.bookSummary.findFirst({
        where: { projectId: projectIdNum },
        orderBy: { createdAt: 'desc' },
      })

      return NextResponse.json({
        success: true,
        data: {
          mode: 'ending',
          unresolvedForeshadowing,
          openPlotlines,
          characterArcs,
          bookSummary: bookSummary?.summary || null,
          totalChapters: chapters.length,
          completedChapters: completedChapters.length,
        },
      })
    }

    if (mode === 'continue') {
      // 继续创作模式 - 返回下一章信息
      const nextChapterNumber = lastChapter ? lastChapter.chapterNumber + 1 : 1

      // 获取最近章节摘要
      const recentChapters = await prisma.chapterSummary.findMany({
        where: { projectId: projectIdNum },
        orderBy: { chapterNo: 'desc' },
        take: 3,
      })
      recentChapters.sort((a, b) => a.chapterNo - b.chapterNo)

      return NextResponse.json({
        success: true,
        data: {
          mode: 'continue',
          lastChapterNumber: lastChapter?.chapterNumber || null,
          lastChapterTitle: lastChapter?.title || null,
          nextChapterNumber,
          recentChapterSummaries: recentChapters.map(s => ({
            chapterNo: s.chapterNo,
            summary: s.summary,
          })),
          totalCompletedChapters: completedChapters.length,
        },
      })
    }

    if (mode === 'rewrite') {
      // 全文重写模式 - 返回全书摘要
      const bookSummary = await prisma.bookSummary.findFirst({
        where: { projectId: projectIdNum },
        orderBy: { createdAt: 'desc' },
      })

      // 获取卷摘要
      const volumeSummaries = await prisma.volumeSummary.findMany({
        where: { projectId: projectIdNum },
        orderBy: { volumeNumber: 'asc' },
      })

      return NextResponse.json({
        success: true,
        data: {
          mode: 'rewrite',
          bookSummary: bookSummary?.summary || null,
          volumeSummaries: volumeSummaries.map(v => ({
            volumeNumber: v.volumeNumber,
            summary: v.summary,
          })),
          totalChapters: chapters.length,
        },
      })
    }

    return NextResponse.json(
      { success: false, error: { code: 'INVALID_MODE', message: '无效的续写模式' } },
      { status: 400 }
    )
  } catch (error) {
    logError(error instanceof Error ? error : new Error(String(error)), { type: $1 })
    return NextResponse.json(
      { success: false, error: { code: 'CONTEXT_ERROR', message: '获取续写上下文失败' } },
      { status: 500 }
    )
  }
}