import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { logError } from '@/lib/logger'
import { getCurrentUserId } from '@/lib/auth'

const createStyleSchema = z.object({
  name: z.string().min(1, '名称不能为空').max(200),
  description: z.string().optional(),
  sourceType: z.enum(['PUBLIC_DOMAIN', 'LICENSED', 'USER_UPLOADED', 'ABSTRACT_TEMPLATE']).default('USER_UPLOADED'),
  riskLevel: z.enum(['LOW', 'MEDIUM', 'HIGH']).default('LOW'),
  authorLabel: z.string().optional(),
  displayLabel: z.string().min(1, '展示标签不能为空'),
  profileJson: z.record(z.string(), z.unknown()),
  promptCard: z.string().optional(),
  sampleStats: z.record(z.string(), z.unknown()).optional(),
  isPublic: z.boolean().default(false),
  tags: z.array(z.string()).default([]),
})

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const creatorId = searchParams.get('creatorId')
    const isPublic = searchParams.get('isPublic')
    const sourceType = searchParams.get('sourceType')

    const where: Record<string, unknown> = {}

    if (creatorId) {
      where.creatorId = parseInt(creatorId, 10)
    }

    if (isPublic === 'true') {
      where.isPublic = true
    } else if (creatorId) {
    } else {
      return NextResponse.json(
        { success: false, error: { code: 'PARAM_ERROR', message: '请提供 creatorId 或 isPublic=true' } },
        { status: 400 }
      )
    }

    if (sourceType) {
      where.sourceType = sourceType
    }

    const styles = await prisma.styleProfile.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        displayLabel: true,
        sourceType: true,
        riskLevel: true,
        tags: true,
        isPublic: true,
        authorLabel: true,
        createdAt: true,
      },
      take: 50,
    })

    return NextResponse.json({ success: true, data: styles })
  } catch (error) {
    logError(error instanceof Error ? error : new Error(String(error)), { type: 'list_styles' })
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: '获取风格列表失败' } },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const parsed = createStyleSchema.parse(body)

    const creatorId = await getCurrentUserId()

    const style = await prisma.styleProfile.create({
      data: {
        name: parsed.name,
        description: parsed.description,
        sourceType: parsed.sourceType,
        riskLevel: parsed.riskLevel,
        authorLabel: parsed.authorLabel,
        displayLabel: parsed.displayLabel,
        profileJson: parsed.profileJson as Prisma.InputJsonValue,
        promptCard: parsed.promptCard || null,
        sampleStats: parsed.sampleStats ? (parsed.sampleStats as Prisma.InputJsonValue) : Prisma.JsonNull,
        creatorId,
        isPublic: parsed.isPublic,
        tags: parsed.tags,
      },
    })

    return NextResponse.json({ success: true, data: style }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: error.issues[0]?.message || '验证失败' } },
        { status: 400 }
      )
    }
    logError(error instanceof Error ? error : new Error(String(error)), { type: 'create_style' })
    return NextResponse.json(
      { success: false, error: { code: 'CREATE_ERROR', message: '创建风格失败' } },
      { status: 500 }
    )
  }
}