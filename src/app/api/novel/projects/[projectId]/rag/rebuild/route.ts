import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { rebuildProjectRAGIndex } from '@/lib/engine/rag-vector'

interface RouteParams {
  params: Promise<{ projectId: string }>
}

export async function POST(_request: Request, { params }: RouteParams) {
  try {
    const { projectId } = await params
    const id = Number(projectId)
    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_ID', message: '无效的项目ID' } },
        { status: 400 }
      )
    }

    const project = await prisma.novelProject.findUnique({
      where: { id },
      select: { id: true },
    })
    if (!project) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: '项目不存在' } },
        { status: 404 }
      )
    }

    const result = await rebuildProjectRAGIndex(id)
    return NextResponse.json({
      success: true,
      data: result,
    })
  } catch (error) {
    console.error('重建 RAG 索引失败:', error)
    return NextResponse.json(
      { success: false, error: { code: 'REBUILD_RAG_ERROR', message: '重建 RAG 索引失败' } },
      { status: 500 }
    )
  }
}
