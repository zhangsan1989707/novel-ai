import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { success, handleApiError } from '@/lib/api-response'
import { AppError, ErrorCodes } from '@/lib/errors'
import { validateCausalConsistency, buildCausalGraph } from '@/lib/engine/causal-graph'
import { requireProjectOwner, projectNotFoundResponse } from '@/lib/server/project-access'

/**
 * POST /api/novel/ai/causal-validate
 * 校验新章节的因果一致性
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { projectId, chapterNo } = body

    if (!projectId || !chapterNo) {
      throw new AppError(ErrorCodes.VALIDATION_ERROR, '缺少 projectId 或 chapterNo', 400)
    }

    // 项目所有权校验
    const projectAccess = await requireProjectOwner(projectId)
    if (!projectAccess) {
      return projectNotFoundResponse()
    }

    const chapter = await prisma.novelChapter.findUnique({
      where: {
        projectId_chapterNumber: { projectId, chapterNumber: chapterNo },
      },
      select: { summary: true },
    })

    if (!chapter?.summary) {
      throw new AppError(ErrorCodes.NOT_FOUND, '章节不存在或摘要为空', 404)
    }

    const report = await validateCausalConsistency(projectId, chapterNo, chapter.summary)

    return NextResponse.json(success(report))
  } catch (err) {
    return handleApiError(err)
  }
}

/**
 * GET /api/novel/ai/causal-validate?projectId=xxx
 * 获取项目的因果图
 */
export async function GET(req: NextRequest) {
  try {
    const projectId = Number(req.nextUrl.searchParams.get('projectId'))

    if (!projectId) {
      throw new AppError(ErrorCodes.VALIDATION_ERROR, '缺少 projectId', 400)
    }

    // 项目所有权校验
    const projectAccess = await requireProjectOwner(projectId)
    if (!projectAccess) {
      return projectNotFoundResponse()
    }

    const graph = await buildCausalGraph(projectId)

    return NextResponse.json(success(graph))
  } catch (err) {
    return handleApiError(err)
  }
}
