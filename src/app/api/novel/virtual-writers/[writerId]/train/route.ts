import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { TrainingStatus } from '@/types'
import { logError } from '@/lib/logger'
import { runVirtualWriterTraining } from '@/lib/virtual-writer/training'

// ============================================
// POST /api/novel/virtual-writers/[writerId]/train
// 触发风格训练
// ============================================

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ writerId: string }> }
) {
  let id: number | null = null
  try {
    const { writerId } = await params
    id = parseInt(writerId)

    if (isNaN(id)) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_ID', message: '无效的 ID' } },
        { status: 400 }
      )
    }

    // 获取作家及其文档
    const writer = await prisma.virtualWriter.findUnique({
      where: { id },
      include: {
        documents: {
          where: { status: 'COMPLETED' },
        },
      },
    })

    if (!writer) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: '作家不存在' } },
        { status: 404 }
      )
    }

    if (writer.documents.length === 0) {
      return NextResponse.json(
        { success: false, error: { code: 'NO_DOCUMENTS', message: '没有已处理的文档可用于训练' } },
        { status: 400 }
      )
    }

    if (writer.trainingStatus === TrainingStatus.TRAINING) {
      return NextResponse.json(
        { success: false, error: { code: 'ALREADY_TRAINING', message: '训练正在进行中' } },
        { status: 409 }
      )
    }

    // 异步执行训练，不阻塞请求
    runVirtualWriterTraining(id).catch(error => {
      logError(error instanceof Error ? error : new Error(String(error)), { type: 'training_background', writerId: id })
    })

    return NextResponse.json({
      success: true,
      data: {
        message: '训练已启动',
        status: TrainingStatus.TRAINING,
      },
    })
  } catch (error) {
    logError(error instanceof Error ? error : new Error(String(error)), { type: 'start_training', writerId: id })
    return NextResponse.json(
      { success: false, error: { code: 'TRAIN_ERROR', message: '启动训练失败' } },
      { status: 500 }
    )
  }
}

// ============================================
// GET /api/novel/virtual-writers/[writerId]/train
// 获取训练状态
// ============================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ writerId: string }> }
) {
  let id: number | null = null
  try {
    const { writerId } = await params
    id = parseInt(writerId)

    if (isNaN(id)) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_ID', message: '无效的 ID' } },
        { status: 400 }
      )
    }

    const writer = await prisma.virtualWriter.findUnique({
      where: { id },
      select: {
        trainingStatus: true,
        trainingProgress: true,
        trainedAt: true,
        styleFeatures: true,
        vocabularyFeatures: true,
        sentenceFeatures: true,
        rhetoricFeatures: true,
        themeFeatures: true,
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
    logError(error instanceof Error ? error : new Error(String(error)), { type: 'get_training_status', writerId: id })
    return NextResponse.json(
      { success: false, error: { code: 'GET_ERROR', message: '获取状态失败' } },
      { status: 500 }
    )
  }
}
