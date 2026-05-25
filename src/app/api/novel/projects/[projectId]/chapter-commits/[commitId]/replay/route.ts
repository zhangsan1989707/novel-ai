import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { replayChapterCommit } from '@/lib/engine/chapter-commit'
import { reconcileReplayedChapterRuntime } from '@/lib/engine/generation-job'

interface RouteParams {
  params: Promise<{ projectId: string; commitId: string }>
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const { projectId: projectIdStr, commitId } = await params
  const projectId = Number.parseInt(projectIdStr, 10)

  if (Number.isNaN(projectId)) {
    return NextResponse.json(
      { success: false, error: { code: 'INVALID_ID', message: '无效的项目ID' } },
      { status: 400 }
    )
  }

  const commit = await prisma.chapterCommit.findUnique({
    where: { id: commitId },
    select: { id: true, projectId: true },
  })
  if (!commit || commit.projectId !== projectId) {
    return NextResponse.json(
      { success: false, error: { code: 'NOT_FOUND', message: '提交不存在' } },
      { status: 404 }
    )
  }

  const replayed = await replayChapterCommit(commitId)
  if (replayed.chapterNo && commit.projectId) {
    const project = await prisma.novelProject.findUnique({
      where: { id: commit.projectId },
      select: { pipelineJobId: true },
    })
    if (project?.pipelineJobId) {
      await reconcileReplayedChapterRuntime(project.pipelineJobId, replayed.chapterNo)
    }
  }

  return NextResponse.json({
    success: true,
    data: replayed,
  })
}
