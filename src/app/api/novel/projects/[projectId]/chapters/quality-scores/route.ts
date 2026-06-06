import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { logError } from '@/lib/logger'
import { projectNotFoundResponse, requireProjectOwner } from '@/lib/server/project-access'

interface RouteParams {
  params: Promise<{ projectId: string }>
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  let projectIdNum: number | null = null
  try {
    const { projectId } = await params
    projectIdNum = parseInt(projectId)
    if (isNaN(projectIdNum)) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_ID', message: '无效的项目ID' } },
        { status: 400 }
      )
    }

    if (!await requireProjectOwner(projectIdNum)) {
      return projectNotFoundResponse()
    }

    const reports = await prisma.chapterCompletionReport.findMany({
      where: { projectId: projectIdNum },
      orderBy: { chapterNo: 'asc' },
      select: {
        chapterNo: true,
        completionScore: true,
        issues: true,
        actualWordCount: true,
        targetWordCount: true,
        chapterGoalCompleted: true,
        mainConflictProgressed: true,
        mainConflictResolved: true,
        endingHookExists: true,
        abruptTruncationDetected: true,
      },
    })

    return NextResponse.json({
      success: true,
      data: reports.map(r => ({
        chapterNo: r.chapterNo,
        completionScore: r.completionScore,
        issues: r.issues,
        actualWordCount: r.actualWordCount,
        targetWordCount: r.targetWordCount,
        flags: {
          chapterGoalCompleted: r.chapterGoalCompleted,
          mainConflictProgressed: r.mainConflictProgressed,
          mainConflictResolved: r.mainConflictResolved,
          endingHookExists: r.endingHookExists,
          abruptTruncationDetected: r.abruptTruncationDetected,
        },
      })),
    })
  } catch (error) {
    logError(error instanceof Error ? error : new Error(String(error)), {
      type: 'quality_scores',
      projectId: projectIdNum,
    })
    return NextResponse.json(
      { success: false, error: { code: 'FETCH_ERROR', message: '获取质量评分失败' } },
      { status: 500 }
    )
  }
}
