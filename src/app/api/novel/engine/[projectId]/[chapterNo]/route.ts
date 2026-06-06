/**
 * GET /api/novel/engine/[projectId]/[chapterNo]/stream
 * SSE 流式获取章节生成进度
 */
import { NextRequest, NextResponse } from 'next/server'
import { runChapterGenerationPipeline } from '@/lib/engine/orchestrator'
import { requireProjectOwner, projectNotFoundResponse } from '@/lib/server/project-access'

interface RouteParams {
  params: Promise<{ projectId: string; chapterNo: string }>
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { projectId, chapterNo } = await params
  const projectIdNum = parseInt(projectId)
  const chapterNoNum = parseInt(chapterNo)

  if (isNaN(projectIdNum) || isNaN(chapterNoNum)) {
    return NextResponse.json(
      { success: false, error: { code: 'INVALID_PARAMS', message: '参数错误' } },
      { status: 400 }
    )
  }

  const project = await requireProjectOwner(projectIdNum)
  if (!project) {
    return projectNotFoundResponse()
  }

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      const emit = (event: { type: string; data: Record<string, unknown> }) => {
        const message = `event: ${event.type}\ndata: ${JSON.stringify(event.data)}\n\n`
        controller.enqueue(encoder.encode(message))
      }

      try {
        await runChapterGenerationPipeline(projectIdNum, chapterNoNum, emit)
      } catch (error) {
        emit({ type: 'error', data: {
          message: error instanceof Error ? error.message : '生成失败',
        } })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}
