import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sanitizePipelineRuntime } from '@/lib/engine/pipeline-runtime'
import { normalizeGenerationSpeedMode } from '@/lib/ai/speed-mode'

interface RouteParams {
  params: Promise<{ projectId: string }>
}

async function readPipelineSnapshot(projectId: number) {
  const project = await prisma.novelProject.findUnique({
    where: { id: projectId },
    select: { pipelineJobId: true },
  })

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
        totalChapters: 0,
        runtime: sanitizePipelineRuntime(undefined),
        updatedAt: new Date().toISOString(),
      }
    }

    jobId = latestJob.id
    const totalSteps = 8
    const payload = latestJob.payload && typeof latestJob.payload === 'object'
      ? latestJob.payload as Record<string, unknown>
      : {}
    const runtime = sanitizePipelineRuntime(payload.runtime)
    return {
      status: latestJob.status,
      currentStep: latestJob.currentStep || '',
      progress: Math.round((latestJob.stepIndex / totalSteps) * 100),
      currentChapter: latestJob.currentChapter,
      totalChapters: latestJob.totalChapters,
      error: latestJob.errorMessage || undefined,
      pipelineJobId: latestJob.id,
      speedMode: normalizeGenerationSpeedMode(payload.speedMode || runtime.speedMode),
      runtime,
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
      totalChapters: 0,
      runtime: sanitizePipelineRuntime(undefined),
      updatedAt: new Date().toISOString(),
    }
  }

  const totalSteps = 8
  const payload = job.payload && typeof job.payload === 'object'
    ? job.payload as Record<string, unknown>
    : {}
  const runtime = sanitizePipelineRuntime(payload.runtime)
  return {
    status: job.status,
    currentStep: job.currentStep || '',
    progress: Math.round((job.stepIndex / totalSteps) * 100),
    currentChapter: job.currentChapter,
    totalChapters: job.totalChapters,
    error: job.errorMessage || undefined,
    pipelineJobId: job.id,
    speedMode: normalizeGenerationSpeedMode(payload.speedMode || runtime.speedMode),
    runtime,
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
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`))
      }

      let lastFingerprint = ''

      const tick = async () => {
        if (closed) return
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
      }, 1000)

      request.signal.addEventListener('abort', () => {
        closed = true
        clearInterval(timer)
        controller.close()
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
