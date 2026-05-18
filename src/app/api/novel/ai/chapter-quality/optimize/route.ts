import { NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { tryCatch, error } from '@/lib/api-response'
import { chapterDeslopper } from '@/lib/agents/deslopper'
import { analyzeChapterQuality } from '@/lib/knowledge/chapter-quality'

const optimizeSchema = z.object({
  projectId: z.number().int().positive(),
  chapterId: z.number().int().positive(),
  strictness: z.enum(['light', 'medium', 'heavy']).default('medium'),
  autoSave: z.boolean().default(false),
})

/**
 * POST /api/novel/ai/chapter-quality/optimize
 * 对章节进行去AI味优化
 */
export async function POST(request: NextRequest) {
  return tryCatch(async () => {
    const body = await request.json()
    const data = optimizeSchema.parse(body)

    // 获取章节信息
    const chapter = await prisma.novelChapter.findUnique({
      where: { id: data.chapterId },
      include: { project: true },
    })

    if (!chapter) {
      return error('NOT_FOUND', '章节不存在')
    }

    if (chapter.projectId !== data.projectId) {
      return error('FORBIDDEN', '章节不属于该项目')
    }

    if (!chapter.content) {
      return error('VALIDATION_ERROR', '章节内容为空')
    }

    // 执行去AI味处理
    const result = await chapterDeslopper({
      projectId: data.projectId,
      chapterId: data.chapterId,
      content: chapter.content,
      chapterNumber: chapter.chapterNumber,
      chapterTitle: chapter.title,
      genre: chapter.project.genre,
      writingStyle: chapter.project.writingStyle,
      strictness: data.strictness,
    })

    // 如果设置了自动保存，则更新章节
    if (data.autoSave && result.revisedContent !== chapter.content) {
      const wordCount = result.revisedContent.replace(/\s/g, '').length
      await prisma.novelChapter.update({
        where: { id: data.chapterId },
        data: {
          content: result.revisedContent,
          wordCount,
        },
      })
      result.autoApplied = true
    }

    // 生成质量报告
    const qualityReport = analyzeChapterQuality(result.revisedContent)

    return {
      success: true,
      data: {
        chapterId: data.chapterId,
        originalContent: result.originalContent,
        revisedContent: result.revisedContent,
        changes: result.changes,
        originalScore: result.originalScore,
        revisedScore: result.revisedScore,
        improvement: result.improvement,
        qualityReport,
        autoApplied: result.autoApplied,
        tokens: result.tokens,
        duration: result.duration,
      },
    }
  })
}
