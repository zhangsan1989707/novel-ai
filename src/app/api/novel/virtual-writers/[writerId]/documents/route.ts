import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { DocumentStatus } from '@/types'

// ============================================
// GET /api/novel/virtual-writers/[writerId]/documents
// 获取作家的文档列表
// ============================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ writerId: string }> }
) {
  try {
    const { writerId } = await params
    const writerIdNum = parseInt(writerId)

    if (isNaN(writerIdNum)) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_ID', message: '无效的 ID' } },
        { status: 400 }
      )
    }

    const documents = await prisma.writerDocument.findMany({
      where: { virtualWriterId: writerIdNum },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({
      success: true,
      data: documents,
    })
  } catch (error) {
    logError(error instanceof Error ? error : new Error(String(error)), { type: 'get_documents', writerId: writerIdNum })
    return NextResponse.json(
      { success: false, error: { code: 'GET_ERROR', message: '获取列表失败' } },
      { status: 500 }
    )
  }
}

// ============================================
// POST /api/novel/virtual-writers/[writerId]/documents
// 上传文档
// ============================================

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ writerId: string }> }
) {
  try {
    const { writerId } = await params
    const writerIdNum = parseInt(writerId)

    if (isNaN(writerIdNum)) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_ID', message: '无效的 ID' } },
        { status: 400 }
      )
    }

    const body = await request.json()
    const { fileName, filePath, fileSize, wordCount } = body

    if (!fileName || !filePath || !fileSize) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: '缺少必要参数' } },
        { status: 400 }
      )
    }

    // 创建文档记录
    const document = await prisma.writerDocument.create({
      data: {
        virtualWriterId: writerIdNum,
        fileName,
        filePath,
        fileSize,
        wordCount: wordCount || 0,
        status: DocumentStatus.PENDING,
      },
    })

    // 更新作家的文档数量和总字数
    await prisma.virtualWriter.update({
      where: { id: writerIdNum },
      data: {
        documentCount: { increment: 1 },
        totalWordCount: { increment: wordCount || 0 },
      },
    })

    return NextResponse.json({
      success: true,
      data: document,
    })
  } catch (error) {
    logError(error instanceof Error ? error : new Error(String(error)), { type: $1 })
    return NextResponse.json(
      { success: false, error: { code: 'UPLOAD_ERROR', message: '上传失败' } },
      { status: 500 }
    )
  }
}
