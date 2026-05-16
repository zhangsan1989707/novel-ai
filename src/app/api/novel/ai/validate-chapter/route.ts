import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { validateChapter, validateProject } from '@/lib/engine/validation/validator'
import { prisma } from '@/lib/prisma'
import { logError } from '@/lib/logger'

const vendorEnum = z.enum(['OPENAI', 'ANTHROPIC', 'ALIBABA', 'DEEPSEEK', 'MINIMAX', 'VOLCENGINE'])

const validateChapterSchema = z.object({
  chapterId: z.number().int().positive(),
  vendor: vendorEnum.default('DEEPSEEK'),
})

/**
 * POST /api/novel/ai/validate-chapter
 * 验证单章内容质量
 */
export async function POST(request: NextRequest) {
  let chapterId: number | null = null
  try {
    const body = await request.json()
    const parsed = validateChapterSchema.parse(body)
    chapterId = parsed.chapterId
    const { vendor } = parsed

    // 获取章节信息
    const chapter = await prisma.novelChapter.findUnique({
      where: { id: chapterId },
      include: { project: true },
    })

    if (!chapter) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: '章节不存在' } },
        { status: 404 }
      )
    }

    if (!chapter.content) {
      return NextResponse.json(
        { success: false, error: { code: 'NO_CONTENT', message: '章节内容为空' } },
        { status: 400 }
      )
    }

    // 获取项目所有章节用于交叉验证
    const allChapters = await prisma.novelChapter.findMany({
      where: {
        projectId: chapter.projectId,
        status: { in: ['COMPLETED', 'REVIEWING'] },
      },
      orderBy: { chapterNumber: 'asc' },
    })

    // 执行验证
    const report = await validateChapter(
      chapter.projectId,
      chapter.chapterNumber,
      chapter.content,
      allChapters.map(c => ({ chapterNumber: c.chapterNumber, content: c.content || '', title: c.title }))
    )

    // 更新章节的 validationReport
    await prisma.novelChapter.update({
      where: { id: chapterId },
      data: {
        validationReport: report as unknown as object,
      },
    })

    return NextResponse.json({
      success: true,
      data: report,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: error.issues[0]?.message } },
        { status: 400 }
      )
    }
    logError(error instanceof Error ? error : new Error(String(error)), { type: 'validate_chapter', chapterId })
    return NextResponse.json(
      { success: false, error: { code: 'VALIDATION_ERROR', message: '章节验证失败' } },
      { status: 500 }
    )
  }
}