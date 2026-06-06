import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getRAGDocumentCount } from '@/lib/engine/rag-vector'
import { queueProjectBootstrap, queueRagRebuild } from '@/lib/engine/auto-maintenance'
import { projectNotFoundResponse, requireProjectOwner } from '@/lib/server/project-access'

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId: projectIdStr } = await params
    const projectId = parseInt(projectIdStr)

    if (isNaN(projectId)) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_ID', message: '无效的项目ID' } },
        { status: 400 }
      )
    }
    if (!await requireProjectOwner(projectId)) {
      return projectNotFoundResponse()
    }

    const project = await prisma.novelProject.findUnique({
      where: { id: projectId },
      include: {
        aiModelConfig: true,
        bookBlueprint: { select: { id: true } },
        arcPlans: { select: { id: true } },
        storyState: { select: { id: true } },
        worldState: { select: { id: true } },
        chapters: {
          select: {
            status: true,
          },
        },
      },
    })

    if (!project) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: '项目不存在' } },
        { status: 404 }
      )
    }

    if (!project.aiModelConfig) {
      return NextResponse.json(
        { success: false, error: { code: 'MODEL_NOT_BOUND', message: '请先绑定可用的 AI 模型后再重试' } },
        { status: 400 }
      )
    }

    const ragDocumentCount = await getRAGDocumentCount(projectId)
    const needsBootstrap =
      !project.bookBlueprint ||
      project.arcPlans.length === 0 ||
      !project.storyState ||
      !project.worldState

    if (needsBootstrap) {
      await queueProjectBootstrap(projectId, { source: 'manual_retry', reason: 'manual_retry_after_failure' })
      return NextResponse.json({
        success: true,
        data: { mode: 'bootstrap', message: '已重新排队创作系统初始化任务' },
      })
    }

    const shouldRebuildRag =
      ragDocumentCount === 0 &&
      project.chapters.some(chapter => chapter.status === 'COMPLETED')

    if (shouldRebuildRag) {
      await queueRagRebuild(projectId, { source: 'manual_retry', reason: 'manual_retry_after_failure' })
      return NextResponse.json({
        success: true,
        data: { mode: 'rag', message: '已重新排队 RAG 重建任务' },
      })
    }

    return NextResponse.json({
      success: true,
      data: { mode: 'noop', message: '当前项目无需重新初始化' },
    })
  } catch (error) {
    console.error('Maintenance retry error:', error)
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: '重试初始化失败' } },
      { status: 500 }
    )
  }
}
