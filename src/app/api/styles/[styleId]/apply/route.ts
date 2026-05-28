import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { logError } from '@/lib/logger'

const applySchema = z.object({
  projectId: z.number().int().positive('无效的项目ID'),
  styleStrength: z.number().min(0).max(1).default(0.5),
  styleSafetyMode: z.enum(['SAFE_ABSTRACT', 'STRICT_PUBLIC_DOMAIN', 'USER_LICENSED']).default('SAFE_ABSTRACT'),
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ styleId: string }> }
) {
  try {
    const { styleId } = await params
    const body = await request.json()
    const parsed = applySchema.parse(body)

    const style = await prisma.styleProfile.findUnique({
      where: { id: styleId },
    })

    if (!style) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: '风格不存在' } },
        { status: 404 }
      )
    }

    const project = await prisma.novelProject.findUnique({
      where: { id: parsed.projectId },
    })

    if (!project) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: '项目不存在' } },
        { status: 404 }
      )
    }

    await prisma.novelProject.update({
      where: { id: parsed.projectId },
      data: {
        styleProfileId: styleId,
        styleStrength: parsed.styleStrength,
        styleSafetyMode: parsed.styleSafetyMode,
      },
    })

    return NextResponse.json({
      success: true,
      data: {
        projectId: parsed.projectId,
        styleProfileId: styleId,
        styleStrength: parsed.styleStrength,
        styleSafetyMode: parsed.styleSafetyMode,
      },
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: error.issues[0]?.message || '验证失败' } },
        { status: 400 }
      )
    }
    logError(error instanceof Error ? error : new Error(String(error)), { type: 'apply_style' })
    return NextResponse.json(
      { success: false, error: { code: 'APPLY_ERROR', message: '应用风格失败' } },
      { status: 500 }
    )
  }
}