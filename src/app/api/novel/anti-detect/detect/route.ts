import { NextRequest } from 'next/server'
import { tryCatch } from '@/lib/api-response'
import { detectAI } from '@/lib/anti-detect'

export async function POST(request: NextRequest) {
  return tryCatch(async () => {
    const body = await request.json()
    const { content } = body

    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      return { error: '内容不能为空' }
    }

    const result = detectAI(content)

    return {
      score: result.overallScore,
      verdict: result.verdict,
      layers: result.layers,
      details: result.details,
      suggestions: result.suggestions,
    }
  })
}