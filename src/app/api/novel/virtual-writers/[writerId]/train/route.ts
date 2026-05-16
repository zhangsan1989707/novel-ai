import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { TrainingStatus } from '@/types'
import { logError } from '@/lib/logger'

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

    // 更新训练状态为进行中
    await prisma.virtualWriter.update({
      where: { id },
      data: {
        trainingStatus: TrainingStatus.TRAINING,
        trainingProgress: 0,
      },
    })

    // TODO: 实际异步执行训练任务
    // 这里简化处理，直接更新为已训练状态
    // 真实场景应该使用任务队列（如 Bull, RQ）异步处理
    setTimeout(async () => {
      try {
        await prisma.virtualWriter.update({
          where: { id: id as number },
          data: {
            trainingStatus: TrainingStatus.TRAINED,
            trainingProgress: 100,
            trainedAt: new Date(),
            // 模拟提取的风格特征
            styleFeatures: writer.styleFeatures || '该作家风格独特，语言流畅...',
            vocabularyFeatures: writer.vocabularyFeatures || '词汇丰富，善用修辞...',
            sentenceFeatures: writer.sentenceFeatures || '句式多变，长短结合...',
            rhetoricFeatures: writer.rhetoricFeatures || '善用比喻、排比等修辞手法...',
            themeFeatures: writer.themeFeatures || '主题深刻，关注人性...',
          },
        })
      } catch (err) {
        logError(err instanceof Error ? err : new Error(String(err)), { type: 'training_update', writerId: id })
        await prisma.virtualWriter.update({
          where: { id: id as number },
          data: {
            trainingStatus: TrainingStatus.FAILED,
          },
        })
      }
    }, 100)

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
