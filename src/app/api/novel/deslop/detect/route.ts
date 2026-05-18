import { NextRequest } from 'next/server'
import { z } from 'zod'
import { tryCatch, error } from '@/lib/api-response'
import { quickScore } from '@/lib/agents/deslopper'

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

    return { score }
  })
}
