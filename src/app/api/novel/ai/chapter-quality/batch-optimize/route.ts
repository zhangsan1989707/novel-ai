import { NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { tryCatch, error } from '@/lib/api-response'
import { batchChapterDeslopper } from '@/lib/agents/deslopper'

const batchOptimizeSchema = z.object({
  projectId: z.number().int().positive(),
  chapterIds: z.array(z.number().int().positive()).min(1).max(20),
  strictness: z.enum(['light', 'medium', 'heavy']).default('medium'),
  autoSave: z.boolean().default(true),
})

/**
 * POST /api/novel/ai/chapter-quality/batch-optimize
 * 批量优化多个章节的去AI味
 */
export async function POST(request: NextRequest) {
  return tryCatch(async () => {
    const body = await request.json()
    const data = batchOptimizeSchema.parse(body)

    // 获取章节列表
    const chapters = await prisma.novelChapter.findMany({
      where: {
        id: { in: data.chapterIds },
        projectId: data.projectId,
      },
      select: {
        id: true,
        chapterNumber: true,
        title: true,
        content: true,
      },
    })

    if (chapters.length === 0) {
      return error('NOT_FOUND', '没有找到可优化的章节')
    }

    // 过滤掉没有内容的章节
    const validChapters = chapters.filter(ch => ch.content)
    if (validChapters.length === 0) {
      return error('VALIDATION_ERROR', '所有章节内容都为空')
    }

    // 执行批量处理
    const results = await batchChapterDeslopper(
      validChapters.map(ch => ({
        chapterId: ch.id,
        chapterNumber: ch.chapterNumber,
        chapterTitle: ch.title,
        content: ch.content!,
      })),
      data.projectId,
      {
        strictness: data.strictness,
      }
    )

    // 如果设置自动保存，更新章节内容
    if (data.autoSave) {
      const updatedChapters: number[] = []
      for (const result of results) {
        if (result.success && result.revisedContent !== result.originalContent) {
          await prisma.novelChapter.update({
            where: { id: result.chapterId },
            data: {
              content: result.revisedContent,
              wordCount: result.revisedContent.replace(/\s/g, '').length,
            },
          })
          updatedChapters.push(result.chapterId)
        }
      }
      results.forEach(r => {
        if (updatedChapters.includes(r.chapterId)) {
          r.autoApplied = true
        }
      })
    }

    // 统计结果
    const successCount = results.filter(r => r.success).length
    const failedCount = results.filter(r => !r.success).length
    const totalImprovement = results.reduce((sum, r) => sum + (r.success ? r.improvement : 0), 0)
    const avgImprovement = successCount > 0 ? Math.round(totalImprovement / successCount) : 0

    return {
      success: true,
      data: {
        total: validChapters.length,
        success: successCount,
        failed: failedCount,
        totalImprovement,
        avgImprovement,
        results,
      },
    }
  })
}
