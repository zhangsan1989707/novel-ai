import { NextRequest, NextResponse } from 'next/server'
import { runNextPipelineJob } from '@/lib/engine/pipeline-worker'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function readAuthorized(request: NextRequest): boolean {
  const expected = process.env.NOVEL_AI_PIPELINE_WORKER_SECRET
  if (!expected) return true

  const authorization = request.headers.get('authorization') || ''
  const bearer = authorization.startsWith('Bearer ') ? authorization.slice('Bearer '.length) : ''
  const headerSecret = request.headers.get('x-pipeline-worker-secret') || ''
  return bearer === expected || headerSecret === expected
}

function readProjectId(request: NextRequest): number | undefined {
  const raw = request.nextUrl.searchParams.get('projectId')
  if (!raw) return undefined
  const projectId = Number.parseInt(raw, 10)
  return Number.isNaN(projectId) ? undefined : projectId
}

async function handleRunNext(request: NextRequest) {
  try {
    if (!readAuthorized(request)) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: '无权推进生成任务' } },
        { status: 401 }
      )
    }

    const result = await runNextPipelineJob({ projectId: readProjectId(request) })
    return NextResponse.json({ success: true, data: result })
  } catch (error) {
    console.error('Pipeline worker run-next error:', error)
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: '推进 AI 生成失败' } },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  return handleRunNext(request)
}

export async function POST(request: NextRequest) {
  return handleRunNext(request)
}
