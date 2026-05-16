import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { generateShortOutline } from '@/lib/short-story/service'
import { handleApiError } from '@/lib/api-response'

const outlineSchema = z.object({
  projectId: z.number().int().positive(),
  structure: z.enum(['three_act', 'four_act', 'five_act']).default('three_act'),
  targetWordCount: z.number().int().min(1000).max(50000).default(10000),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const parsed = outlineSchema.parse(body)

    const result = await generateShortOutline({
      projectId: parsed.projectId,
      structure: parsed.structure,
      targetWordCount: parsed.targetWordCount,
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
