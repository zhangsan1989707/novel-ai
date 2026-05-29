import { NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { tryCatch, error } from '@/lib/api-response'
import { batchChapterDeslopper } from '@/lib/agents/deslopper'

const batchSchema = z.object({
  projectId: z.number().int().positive(),
  chapterIds: z.array(z.number().int().positive()).min(1).max(200),
  strictness: z.enum(['light', 'medium', 'heavy']).default('medium'),
})

export async function POST(request: NextRequest) {
  return tryCatch(async () => {
    const body = await request.json()
    const data = batchSchema.parse(body)

    const project = await prisma.novelProject.findUnique({
      where: { id: data.projectId },
    })

    if (!project) {
      return error('NOT_FOUND', '项目不存在')
    }

    const chapters = await prisma.novelChapter.findMany({
      where: {
        projectId: data.projectId,
        id: { in: data.chapterIds },
      },
      select: {
        id: true,
        chapterNumber: true,
        title: true,
        content: true,
      },
    })

    const validChapters = chapters.filter(c => c.content && c.content.trim().length > 0)

    if (validChapters.length === 0) {
      return error('VALIDATION_ERROR', '所选章节没有可处理的内容')
    }

    const results = await batchChapterDeslopper(
      validChapters.map(c => ({
        chapterId: c.id,
        chapterNumber: c.chapterNumber,
        chapterTitle: c.title,
        content: c.content!,
      })),
      data.projectId,
      {
        genre: project.genre,
        writingStyle: project.writingStyle,
        strictness: data.strictness,
      }
    )

    for (const result of results) {
      if (result.success) {
        await prisma.novelChapter.update({
          where: { id: result.chapterId },
          data: {
            content: result.revisedContent,
            wordCount: result.revisedContent.length,
          },
        })
      }
    }

    const summary = {
      total: results.length,
      success: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      overallImprovement: results
        .filter(r => r.success)
        .reduce((sum, r) => sum + (r.improvement || 0), 0),
      chapters: results.map(r => ({
        chapterId: r.chapterId,
        success: r.success,
        originalScore: r.originalScore,
        revisedScore: r.revisedScore,
        improvement: r.improvement,
        changes: r.changes?.length || 0,
        error: !r.success ? r.error : undefined,
      })),
    }

    return summary
  })
}