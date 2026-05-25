import { NextRequest } from 'next/server'
import { z } from 'zod'
import { tryCatch, error } from '@/lib/api-response'
import { analyzeChapterQuality } from '@/lib/knowledge/chapter-quality'

const analyzeSchema = z.object({
  projectId: z.number().int().positive().optional(),
  content: z.string().min(1).max(200000),
})

/**
 * POST /api/novel/ai/chapter-quality/analyze
 * 分析章节AI质量
 */
export async function POST(request: NextRequest) {
  return tryCatch(async () => {
    const body = await request.json()
    const data = analyzeSchema.parse(body)

    if (!data.content.trim()) {
      return error('VALIDATION_ERROR', '内容不能为空')
    }

    const report = analyzeChapterQuality(data.content)

    return {
      success: true,
      data: report,
    }
  })
}
