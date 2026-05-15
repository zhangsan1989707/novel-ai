import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { WriterType } from '@/types'

// ============================================
// Schema 验证
// ============================================

const updateVirtualWriterSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  description: z.string().optional(),
  writerType: z.nativeEnum(WriterType).optional(),
  styleFeatures: z.string().optional(),
  vocabularyFeatures: z.string().optional(),
  sentenceFeatures: z.string().optional(),
  rhetoricFeatures: z.string().optional(),
  themeFeatures: z.string().optional(),
  isPublic: z.boolean().optional(),
  tags: z.string().optional(),
})

// ============================================
// GET /api/novel/virtual-writers/[writerId]
// 获取单个虚拟作家详情
// ============================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ writerId: string }> }
) {
  try {
    const { writerId } = await params
    const id = parseInt(writerId)

    if (isNaN(id)) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_ID', message: '无效的 ID' } },
        { status: 400 }
      )
    }

    const writer = await prisma.virtualWriter.findUnique({
      where: { id },
      include: {
        documents: {
          orderBy: { createdAt: 'desc' },
        },
        chapters: {
          select: {
            id: true,
            chapterNumber: true,
            title: true,
            wordCount: true,
          },
          orderBy: { chapterNumber: 'asc' },
        },
      },
    })

    if (!writer) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: '作家不存在' } },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: writer,
    })
  } catch (error) {
    logError(error instanceof Error ? error : new Error(String(error)), { type: 'get_virtual_writer', writerId: id })
    return NextResponse.json(
      { success: false, error: { code: 'GET_ERROR', message: '获取失败' } },
      { status: 500 }
    )
  }
}

// ============================================
// PUT /api/novel/virtual-writers/[writerId]
// 更新虚拟作家
// ============================================

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ writerId: string }> }
) {
  try {
    const { writerId } = await params
    const id = parseInt(writerId)

    if (isNaN(id)) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_ID', message: '无效的 ID' } },
        { status: 400 }
      )
    }

    const body = await request.json()
    const data = updateVirtualWriterSchema.parse(body)

    const writer = await prisma.virtualWriter.update({
      where: { id },
      data,
    })

    return NextResponse.json({
      success: true,
      data: writer,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: error.issues[0]?.message || '验证失败' } },
        { status: 400 }
      )
    }
    logError(error instanceof Error ? error : new Error(String(error)), { type: 'update_virtual_writer', writerId: id })
    return NextResponse.json(
      { success: false, error: { code: 'UPDATE_ERROR', message: '更新失败' } },
      { status: 500 }
    )
  }
}

// ============================================
// DELETE /api/novel/virtual-writers/[writerId]
// 删除虚拟作家
// ============================================

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ writerId: string }> }
) {
  try {
    const { writerId } = await params
    const id = parseInt(writerId)

    if (isNaN(id)) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_ID', message: '无效的 ID' } },
        { status: 400 }
      )
    }

    await prisma.virtualWriter.delete({
      where: { id },
    })

    return NextResponse.json({
      success: true,
      data: null,
    })
  } catch (error) {
    logError(error instanceof Error ? error : new Error(String(error)), { type: $1 })
    return NextResponse.json(
      { success: false, error: { code: 'DELETE_ERROR', message: '删除失败' } },
      { status: 500 }
    )
  }
}
