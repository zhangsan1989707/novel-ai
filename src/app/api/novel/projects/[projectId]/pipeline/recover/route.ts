import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { failStaleRunningJobs, prepareJobRecovery } from '@/lib/engine/generation-job'
import { runProductionPipeline } from '@/lib/engine/production-pipeline'
import { replayChapterCommit } from '@/lib/engine/chapter-commit'
import { normalizeGenerationSpeedMode } from '@/lib/ai/speed-mode'

export async function POST(
  request: NextRequest,
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

    const body = await request.json().catch(() => ({}))
    const action = typeof body.action === 'string' ? body.action : 'continue'
    const chapterNumber = typeof body.chapterNumber === 'number' ? body.chapterNumber : undefined

    const project = await prisma.novelProject.findUnique({ where: { id: projectId } })
    const target = action === 'retry_batch'
      ? { mode: 'retry_batch' as const }
      : action === 'retry_chapter' && chapterNumber
        ? { mode: 'retry_chapter' as const, chapterNumber }
        : { mode: 'continue' as const }

    if (action === 'retry_chapter' && chapterNumber) {
      const latestCommit = await prisma.chapterCommit.findFirst({
        where: { projectId, chapterNo: chapterNumber },
        orderBy: { createdAt: 'desc' },
      })
      const projectionStatus = latestCommit?.projectionStatus && typeof latestCommit.projectionStatus === 'object'
        ? latestCommit.projectionStatus as Record<string, unknown>
        : {}
      const summaryStatus = typeof projectionStatus.summary === 'string' ? projectionStatus.summary : ''
      if (latestCommit && summaryStatus.startsWith('failed:')) {
        const replayed = await replayChapterCommit(latestCommit.id)
        return NextResponse.json({
          success: true,
          data: {
            replayedCommitId: replayed.id,
            target: { mode: 'retry_chapter', chapterNumber },
            message: '已重放章节提交，仅补做摘要和投影，不重写正文',
          },
        })
      }
    }

    if (!project?.pipelineJobId) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: '没有可恢复的生成任务' } },
        { status: 404 }
      )
    }

    await failStaleRunningJobs({ projectId })

    const prepared = await prepareJobRecovery(project.pipelineJobId, target)
    if (!prepared) {
      return NextResponse.json(
        { success: false, error: { code: 'RECOVERY_FAILED', message: '当前任务不处于可恢复状态' } },
        { status: 400 }
      )
    }

    const job = await prisma.generationJob.findUnique({
      where: { id: project.pipelineJobId },
      select: { payload: true },
    })
    const payload = job?.payload && typeof job.payload === 'object'
      ? job.payload as Record<string, unknown>
      : {}
    const speedMode = normalizeGenerationSpeedMode(payload.speedMode)
    if (process.env.NOVEL_AI_PIPELINE_INLINE !== 'false') {
      void runProductionPipeline(project.pipelineJobId, { speedMode })
    }

    return NextResponse.json({
      success: true,
      data: {
        jobId: project.pipelineJobId,
        target,
        status: 'pending',
        speedMode,
      },
    })
  } catch (error) {
    console.error('Pipeline recover error:', error)
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: '恢复生成任务失败' } },
      { status: 500 }
    )
  }
}
