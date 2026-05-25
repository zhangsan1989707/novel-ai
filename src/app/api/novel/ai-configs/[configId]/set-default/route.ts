import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { logError } from '@/lib/logger'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ configId: string }> }
) {
  let id: number | null = null
  try {
    const { configId } = await params
    id = parseInt(configId)

    if (isNaN(id)) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_ID', message: '无效的 ID' } },
        { status: 400 }
      )
    }

    // 先取消其他默认
    await prisma.aIModelConfig.updateMany({
      where: { isDefault: true, id: { not: id } },
      data: { isDefault: false },
    })

    // 设置当前为默认
    const config = await prisma.aIModelConfig.update({
      where: { id },
      data: { isDefault: true },
    })

    return NextResponse.json({ success: true, data: config })
  } catch (error) {
    logError(error instanceof Error ? error : new Error(String(error)), { type: 'set_default_ai_config', configId: id })
    return NextResponse.json(
      { success: false, error: { code: 'SET_DEFAULT_ERROR', message: '设置默认失败' } },
      { status: 500 }
    )
  }
}
