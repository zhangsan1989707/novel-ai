import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { designShortEmotion } from '@/lib/short-story/service'
import { handleApiError } from '@/lib/api-response'

const emotionSchema = z.object({
  projectId: z.number().int().positive(),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const parsed = emotionSchema.parse(body)

    const result = await designShortEmotion({
      projectId: parsed.projectId,
    })

    return NextResponse.json({ success: true, data: result })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: error.issues[0].message } },
        { status: 400 }
      )
    }
    return handleApiError(error)
  }
}
