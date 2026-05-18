import { NextRequest } from 'next/server'
import { z } from 'zod'
import { tryCatch, error } from '@/lib/api-response'
import { quickScore } from '@/lib/agents/deslopper'
import { scanForbiddenWords, scanForbiddenPatterns } from '@/lib/knowledge/anti-ai'

const detectSchema = z.object({
  content: z.string().min(1).max(100000),
})

export async function POST(request: NextRequest) {
  return tryCatch(async () => {
    const body = await request.json()
    const data = detectSchema.parse(body)

    if (!data.content.trim()) {
      return error('VALIDATION_ERROR', '内容不能为空')
    }

    const score = quickScore(data.content)
    const forbiddenWordResults = scanForbiddenWords(data.content)
    const forbiddenPatternResults = scanForbiddenPatterns(data.content)

    return {
      score,
      forbiddenWords: forbiddenWordResults.map(r => ({
        word: r.word.word,
        level: r.word.level,
        count: r.count,
        replacement: r.word.replacement,
      })),
      forbiddenPatterns: forbiddenPatternResults.map(r => ({
        pattern: r.pattern.pattern,
        description: r.pattern.description,
        level: r.pattern.level,
        matches: r.matches,
      })),
    }
  })
}
