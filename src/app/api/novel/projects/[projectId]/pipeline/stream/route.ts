import { NextRequest, NextResponse } from 'next/server'
import { readProjectPipelineSnapshot } from '@/lib/engine/project-pipeline-snapshot'
import { projectNotFoundResponse, requireProjectOwner } from '@/lib/server/project-access'

interface RouteParams {
  params: Promise<{ projectId: string }>
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { projectId: projectIdStr } = await params
  const projectId = Number.parseInt(projectIdStr, 10)

  if (Number.isNaN(projectId)) {
    return NextResponse.json(
      { success: false, error: { code: 'INVALID_ID', message: '无效的项目ID' } },
      { status: 400 }
    )
  }

  if (!await requireProjectOwner(projectId)) {
    return projectNotFoundResponse()
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
        let snapshot = null
        if (!staleChecked) {
          staleChecked = true
          snapshot = await readProjectPipelineSnapshot(projectId, { reconcileStale: true }).catch(() => null)
        }
        snapshot = snapshot || await readProjectPipelineSnapshot(projectId)
        if (!snapshot) {
          send('error', { message: '项目不存在' })
          return
        }
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
