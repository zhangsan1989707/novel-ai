import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { writeShortSection } from '@/lib/short-story/service'
import { logError } from '@/lib/logger'
import { requireProjectOwner, projectNotFoundResponse } from '@/lib/server/project-access'

const writeSchema = z.object({
  projectId: z.number().int().positive(),
  sectionNumber: z.number().int().positive(),
  stream: z.boolean().default(true),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const parsed = writeSchema.parse(body)
    const { projectId, sectionNumber, stream } = parsed

    const project = await requireProjectOwner(projectId)
    if (!project) {
      return projectNotFoundResponse()
    }

    if (stream) {
      const encoder = new TextEncoder()

      const readable = new ReadableStream({
        async start(controller) {
          const sendEvent = (event: string, data: Record<string, unknown>) => {
            const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
            controller.enqueue(encoder.encode(message))
          }

          try {
            sendEvent('start', { sectionNumber, status: 'writing' })

            const result = await writeShortSection({
              projectId,
              sectionNumber,
              onChunk: (text) => {
                sendEvent('token', { content: text })
              },
            })

            sendEvent('done', {
              sectionNumber,
              wordCount: result.wordCount,
              status: 'completed',
            })
          } catch (error) {
            logError(
              error instanceof Error ? error : new Error(String(error)),
              { type: 'short_story_write', projectId, sectionNumber }
            )
            sendEvent('error', {
              message: error instanceof Error ? error.message : '写作失败',
            })
          } finally {
            controller.close()
          }
        },
      })

      return new Response(readable, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      })
    }

    const result = await writeShortSection({
      projectId,
      sectionNumber,
    })

    return NextResponse.json({
      success: true,
      data: result,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: error.issues[0].message } },
        { status: 400 }
      )
    }
    logError(
      error instanceof Error ? error : new Error(String(error)),
      { type: 'short_story_write' }
    )
    return NextResponse.json(
      { success: false, error: { code: 'WRITE_ERROR', message: '写作失败' } },
      { status: 500 }
    )
  }
}
