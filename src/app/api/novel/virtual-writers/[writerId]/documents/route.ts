import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { DocumentStatus } from '@/types'
import { logError } from '@/lib/logger'
import { processWriterDocument } from '@/lib/virtual-writer/document-processor'

// ============================================
// GET /api/novel/virtual-writers/[writerId]/documents
// 获取作家的文档列表
// ============================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ writerId: string }> }
) {
  let writerIdNum: number | null = null
  try {
    const { writerId } = await params
    writerIdNum = parseInt(writerId)

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
  let writerIdNum: number | null = null
  try {
    const { writerId } = await params
    writerIdNum = parseInt(writerId)

    if (isNaN(writerIdNum)) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_ID', message: '无效的 ID' } },
        { status: 400 }
      )
    }

    const contentType = request.headers.get('content-type') || ''

    let fileName: string
    let filePath: string
    let fileSize: number

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData()
      const file = formData.get('file') as File | null
      if (!file) {
        return NextResponse.json(
          { success: false, error: { code: 'VALIDATION_ERROR', message: '缺少文件' } },
          { status: 400 }
        )
      }

      const { mkdir, writeFile } = await import('fs/promises')
      const { join } = await import('path')
      const uploadDir = join(process.cwd(), 'uploads', 'writer-docs')
      await mkdir(uploadDir, { recursive: true })

      const safeName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._一-龥-]/g, '_')}`
      filePath = join(uploadDir, safeName)
      fileName = file.name
      fileSize = file.size
      await writeFile(filePath, Buffer.from(await file.arrayBuffer()))
    } else {
      const body = await request.json()
      fileName = body.fileName
      filePath = body.filePath
      fileSize = body.fileSize
      if (!fileName || !filePath || !fileSize) {
        return NextResponse.json(
          { success: false, error: { code: 'VALIDATION_ERROR', message: '缺少必要参数' } },
          { status: 400 }
        )
      }
    }

    // 创建文档记录
    const document = await prisma.writerDocument.create({
      data: {
        virtualWriterId: writerIdNum,
        fileName,
        filePath,
        fileSize,
        wordCount: 0,
        status: DocumentStatus.PROCESSING,
      },
    })

    // 处理文档：读取文件内容，计算字数
    try {
      const { text, wordCount } = await processWriterDocument(filePath, fileName)

      await prisma.writerDocument.update({
        where: { id: document.id },
        data: {
          status: DocumentStatus.COMPLETED,
          wordCount,
          processedAt: new Date(),
        },
      })

      await prisma.virtualWriter.update({
        where: { id: writerIdNum },
        data: {
          documentCount: { increment: 1 },
          totalWordCount: { increment: wordCount },
        },
      })

      return NextResponse.json({
        success: true,
        data: { ...document, status: DocumentStatus.COMPLETED, wordCount, processedAt: new Date() },
      })
    } catch (processError) {
      const errorMessage = processError instanceof Error ? processError.message : '文档处理失败'

      await prisma.writerDocument.update({
        where: { id: document.id },
        data: {
          status: DocumentStatus.FAILED,
          errorMessage,
        },
      })

      return NextResponse.json(
        { success: false, error: { code: 'PROCESS_ERROR', message: errorMessage } },
        { status: 400 }
      )
    }
  } catch (error) {
    logError(error instanceof Error ? error : new Error(String(error)), { type: 'upload_document', writerId: writerIdNum })
    return NextResponse.json(
      { success: false, error: { code: 'UPLOAD_ERROR', message: '上传失败' } },
      { status: 500 }
    )
  }
}
