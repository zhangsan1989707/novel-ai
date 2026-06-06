import { NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { tryCatch, error } from '@/lib/api-response'
import { deslopperAgent } from '@/lib/agents/deslopper'
import { requireProjectOwner } from '@/lib/server/project-access'

const rewriteSchema = z.object({
  projectId: z.number().int().positive(),
  chapterId: z.number().int().positive().optional(),
  content: z.string().min(1).max(100000),
  strictness: z.enum(['light', 'medium', 'heavy']).default('medium'),
})

export async function POST(request: NextRequest) {
  return tryCatch(async () => {
    const body = await request.json()
    const data = rewriteSchema.parse(body)

    const access = await requireProjectOwner(data.projectId)

    if (!access) {
      return error('NOT_FOUND', '项目不存在')
    }

    const project = await prisma.novelProject.findUnique({
      where: { id: data.projectId },
      select: { genre: true, writingStyle: true },
    })

    if (!project) {
      return error('NOT_FOUND', '项目不存在')
    }

    const chapterId = data.chapterId || 0

    const result = await deslopperAgent({
      projectId: data.projectId,
      chapterId,
      content: data.content,
      genre: project.genre,
      writingStyle: project.writingStyle,
      strictness: data.strictness,
    })

    return {
      ...result,
      content: result.revisedContent,
    }
  })
}
