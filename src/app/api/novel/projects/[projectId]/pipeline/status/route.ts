import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sanitizePipelineRuntime } from '@/lib/engine/pipeline-runtime'
import { normalizeGenerationSpeedMode } from '@/lib/ai/speed-mode'
import { failStaleRunningJobs } from '@/lib/engine/generation-job'

export async function GET(
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

    const project = await prisma.novelProject.findUnique({ where: { id: projectId } })
    if (!project) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: '项目不存在' } },
        { status: 404 }
      )
    }

    await failStaleRunningJobs({ projectId })

    const chapters = await prisma.novelChapter.findMany({
      where: { projectId },
      select: { chapterNumber: true, status: true },
      orderBy: { chapterNumber: 'asc' },
    })
    const actualChapterCount = chapters.length
    const completedChapterCount = chapters.filter(c => c.status === 'COMPLETED').length
    const firstIncomplete = chapters.find(c => c.status !== 'COMPLETED')
    const nextChapterNumber = firstIncomplete
      ? firstIncomplete.chapterNumber
      : (completedChapterCount > 0 ? completedChapterCount + 1 : 1)

    // 从项目获取目标章节数，而不是从 chapters 表
    const totalChapters = project.totalVolumes * 25 || 300

    let jobId = project.pipelineJobId
    if (!jobId) {
      const latestJob = await prisma.generationJob.findFirst({
        where: { projectId },
        orderBy: { createdAt: 'desc' },
      })
      jobId = latestJob?.id || null
    }

    if (!jobId) {
      return NextResponse.json({
        success: true,
        data: {
          status: 'IDLE',
          currentStep: '',
          progress: 0,
          currentChapter: 0,
          totalChapters,
          completedChapters: completedChapterCount,
          actualChapterCount,
          nextChapterNumber,
          runtime: sanitizePipelineRuntime(undefined),
        },
      })
    }

    const job = await prisma.generationJob.findUnique({
      where: { id: jobId },
    })

    if (!job) {
      return NextResponse.json({
        success: true,
        data: {
          status: 'IDLE',
          currentStep: '',
          progress: 0,
          currentChapter: 0,
          totalChapters,
          completedChapters: completedChapterCount,
          actualChapterCount,
          nextChapterNumber,
          runtime: sanitizePipelineRuntime(undefined),
        },
      })
    }

    // 计算真实进度：已完成章节数 / 总章节数
    const chapterProgress = totalChapters > 0 ? Math.round((completedChapterCount / totalChapters) * 100) : 0
    const payload = job.payload && typeof job.payload === 'object'
      ? job.payload as Record<string, unknown>
      : {}
    const runtime = sanitizePipelineRuntime(payload.runtime)

    // 如果任务正在运行，使用运行时的当前章节进度作为额外信息
    const currentChapterProgress = runtime.currentChapter ? 
      Math.round((runtime.currentChapter.currentWordCount / runtime.currentChapter.targetWordCount) * 100) : 0

    return NextResponse.json({
      success: true,
      data: {
        status: job.status,
        currentStep: job.currentStep || '',
        progress: chapterProgress, // 使用章节完成进度，而不是步骤进度
        currentChapter: job.currentChapter,
        totalChapters,
        completedChapters: completedChapterCount,
        actualChapterCount,
        nextChapterNumber,
        currentChapterProgress, // 当前章节的字数进度
        error: job.errorMessage || undefined,
        pipelineJobId: job.id,
        speedMode: normalizeGenerationSpeedMode(payload.speedMode || runtime.speedMode),
        runtime,
        lastHeartbeatAt: runtime.lastEventAt || null,
        updatedAt: job.updatedAt.toISOString(),
      },
    })
  } catch (error) {
    console.error('Pipeline status error:', error)
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: '查询生成状态失败' } },
      { status: 500 }
    )
  }
}
