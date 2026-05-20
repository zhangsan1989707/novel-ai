import { NextRequest } from 'next/server'
import { tryCatch } from '@/lib/api-response'
import { rewriteText, detectAI } from '@/lib/anti-detect'

export async function POST(request: NextRequest) {
  return tryCatch(async () => {
    const body = await request.json()
    const { content, intensity = 'medium' } = body

    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      return { error: '内容不能为空' }
    }

    if (!['light', 'medium', 'heavy'].includes(intensity)) {
      return { error: 'intensity 必须是 light, medium 或 heavy' }
    }

    const beforeResult = detectAI(content)

    const rewriteResult = rewriteText(content, { intensity })

    const afterResult = detectAI(rewriteResult.text)

    return {
      originalText: content,
      rewrittenText: rewriteResult.text,
      strategies: rewriteResult.appliedStrategies,
      changes: rewriteResult.changes.slice(0, 20),
      scores: {
        before: beforeResult.overallScore,
        after: afterResult.overallScore,
        reduced: beforeResult.overallScore - afterResult.overallScore,
      },
      verdicts: {
        before: beforeResult.verdict,
        after: afterResult.verdict,
      },
    }
  })
}