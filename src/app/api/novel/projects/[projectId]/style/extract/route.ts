import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { logError } from '@/lib/logger'
import { extractStyleProfile } from '@/lib/style/style-extractor'

const extractSchema = z.object({
  volumeNumber: z.number().int().min(-1).max(100).default(-1),
  sampleSize: z.number().int().min(1000).max(200000).default(50000),
  styleProfileName: z.string().optional(),
  authorLabel: z.string().optional(),
  displayLabel: z.string().optional(),
  sourceType: z.enum(['PUBLIC_DOMAIN', 'LICENSED', 'USER_UPLOADED', 'ABSTRACT_TEMPLATE']).default('USER_UPLOADED'),
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params
    const projectIdNum = parseInt(projectId, 10)

    if (isNaN(projectIdNum)) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_ID', message: '无效的项目ID' } },
        { status: 400 }
      )
    }

    const body = await request.json()
    const parsed = extractSchema.parse(body)

    const project = await prisma.novelProject.findUnique({
      where: { id: projectIdNum },
    })

    if (!project) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: '项目不存在' } },
        { status: 404 }
      )
    }

    const result = await extractStyleProfile({
      projectId: projectIdNum,
      volumeNumber: parsed.volumeNumber,
      sampleSize: parsed.sampleSize,
      styleProfileName: parsed.styleProfileName,
      authorLabel: parsed.authorLabel,
      displayLabel: parsed.displayLabel,
      sourceType: parsed.sourceType,
    })

    await prisma.bookAnalysis.upsert({
      where: {
        projectId_volumeNumber_analysisType_dimension: {
          projectId: projectIdNum,
          volumeNumber: parsed.volumeNumber,
          analysisType: 'BREAKDOWN',
          dimension: 'STYLE_PROFILE',
        },
      },
      update: {
        analysisData: result.profileData as unknown as Prisma.InputJsonValue,
        rawContent: JSON.stringify(result.profileData, null, 2),
        wordCount: result.sampleStats.totalWords,
      },
      create: {
        projectId: projectIdNum,
        volumeNumber: parsed.volumeNumber,
        analysisType: 'BREAKDOWN',
        dimension: 'STYLE_PROFILE',
        analysisData: result.profileData as unknown as Prisma.InputJsonValue,
        rawContent: JSON.stringify(result.profileData, null, 2),
        wordCount: result.sampleStats.totalWords,
      },
    })

    return NextResponse.json({
      success: true,
      data: {
        styleProfileId: result.styleProfileId,
        profileData: result.profileData,
        sampleStats: result.sampleStats,
      },
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: error.issues[0]?.message || '验证失败' } },
        { status: 400 }
      )
    }
    logError(error instanceof Error ? error : new Error(String(error)), { type: 'extract_style' })
    return NextResponse.json(
      { success: false, error: { code: 'EXTRACT_ERROR', message: error instanceof Error ? error.message : '提取文风失败' } },
      { status: 500 }
    )
  }
}