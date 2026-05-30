import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sanitizePipelineRuntime } from '@/lib/engine/pipeline-runtime'
import { normalizeGenerationSpeedMode } from '@/lib/ai/speed-mode'
import { failStaleRunningJobs } from '@/lib/engine/generation-job'

interface RouteParams {
  params: Promise<{ projectId: string }>
}

async function readPipelineSnapshot(projectId: number) {
  const project = await prisma.novelProject.findUnique({
    where: { id: projectId },
    select: { pipelineJobId: true, totalVolumes: true },
  })

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

  // 从项目获取目标章节数
  const totalChapters = (project?.totalVolumes || 12) * 25 || 300

  let jobId = project?.pipelineJobId || null
  if (!jobId) {
    const latestJob = await prisma.generationJob.findFirst({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        status: true,
        currentStep: true,
        stepIndex: true,
        totalChapters: true,
        currentChapter: true,
        errorMessage: true,
        payload: true,
        updatedAt: true,
      },
    })

    if (!latestJob) {
      return {
        status: 'IDLE',
        currentStep: '',
        progress: 0,
        currentChapter: 0,
        totalChapters,
        completedChapters: completedChapterCount,
        actualChapterCount,
        nextChapterNumber,
        runtime: sanitizePipelineRuntime(undefined),
        updatedAt: new Date().toISOString(),
      }
    }

    jobId = latestJob.id
    const payload = latestJob.payload && typeof latestJob.payload === 'object'
      ? latestJob.payload as Record<string, unknown>
      : {}
    const runtime = sanitizePipelineRuntime(payload.runtime)
    
    return {
      status: latestJob.status,
      currentStep: latestJob.currentStep || '',
      progress: totalChapters > 0 ? Math.round((completedChapterCount / totalChapters) * 100) : 0,
      currentChapter: latestJob.currentChapter,
      totalChapters,
      completedChapters: completedChapterCount,
      actualChapterCount,
      nextChapterNumber,
      error: latestJob.errorMessage || undefined,
      pipelineJobId: latestJob.id,
      speedMode: normalizeGenerationSpeedMode(payload.speedMode || runtime.speedMode),
      runtime,
      lastHeartbeatAt: runtime.lastEventAt || null,
      updatedAt: latestJob.updatedAt.toISOString(),
    }
  }

  const job = await prisma.generationJob.findUnique({
    where: { id: jobId },
    select: {
      id: true,
      status: true,
      currentStep: true,
      stepIndex: true,
      totalChapters: true,
      currentChapter: true,
      errorMessage: true,
      payload: true,
      updatedAt: true,
    },
  })

  if (!job) {
    return {
      status: 'IDLE',
      currentStep: '',
      progress: 0,
      currentChapter: 0,
      totalChapters,
      completedChapters: completedChapterCount,
      actualChapterCount,
      nextChapterNumber,
      runtime: sanitizePipelineRuntime(undefined),
      updatedAt: new Date().toISOString(),
    }
  }

  const payload = job.payload && typeof job.payload === 'object'
    ? job.payload as Record<string, unknown>
    : {}
  const runtime = sanitizePipelineRuntime(payload.runtime)
  
  return {
    status: job.status,
    currentStep: job.currentStep || '',
    progress: totalChapters > 0 ? Math.round((completedChapterCount / totalChapters) * 100) : 0,
    currentChapter: job.currentChapter,
    totalChapters,
    completedChapters: completedChapterCount,
    actualChapterCount,
    nextChapterNumber,
    error: job.errorMessage || undefined,
    pipelineJobId: job.id,
    speedMode: normalizeGenerationSpeedMode(payload.speedMode || runtime.speedMode),
    runtime,
    lastHeartbeatAt: runtime.lastEventAt || null,
    updatedAt: job.updatedAt.toISOString(),
  }
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { projectId: projectIdStr } = await params
  const projectId = Number.parseInt(projectIdStr, 10)

  if (Number.isNaN(projectId)) {
    return new Response('invalid project id', { status: 400 })
  }

  const encoder = new TextEncoder()
  let closed = false

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, payload: unknown) => {
        if (closed) return
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`))
        } catch {
          closed = true
        }
      }

      let lastFingerprint = ''
      let staleChecked = false

      const tick = async () => {
        if (closed) return
        if (!staleChecked) {
          staleChecked = true
          await failStaleRunningJobs({ projectId }).catch(() => {})
        }
        const snapshot = await readPipelineSnapshot(projectId)
        const fingerprint = JSON.stringify(snapshot)
        if (fingerprint !== lastFingerprint) {
          lastFingerprint = fingerprint
          send('pipeline', snapshot)
        } else {
          send('heartbeat', { at: new Date().toISOString() })
        }
      }

      await tick()
      const timer = setInterval(() => {
        void tick()
      }, 3000)

      request.signal.addEventListener('abort', () => {
        closed = true
        clearInterval(timer)
        try { controller.close() } catch {}
      })
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  })
}
