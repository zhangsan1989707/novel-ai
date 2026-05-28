import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { logError } from '@/lib/logger'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ styleId: string }> }
) {
  try {
    const { styleId } = await params

    const style = await prisma.styleProfile.findUnique({
      where: { id: styleId },
    })

    if (!style) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: '风格不存在' } },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true, data: style })
  } catch (error) {
    logError(error instanceof Error ? error : new Error(String(error)), { type: 'get_style' })
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: '获取风格失败' } },
      { status: 500 }
    )
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ styleId: string }> }
) {
  try {
    const { styleId } = await params

    const style = await prisma.styleProfile.findUnique({
      where: { id: styleId },
    })

    if (!style) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: '风格不存在' } },
        { status: 404 }
      )
    }

    await prisma.styleProfile.delete({ where: { id: styleId } })

    return NextResponse.json({ success: true, data: { deleted: true } })
  } catch (error) {
    logError(error instanceof Error ? error : new Error(String(error)), { type: 'delete_style' })
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: '删除风格失败' } },
      { status: 500 }
    )
  }
}