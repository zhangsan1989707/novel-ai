import { NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { tryCatch, error } from '@/lib/api-response'
import { generateCover } from '@/lib/cover/service'

const generateSchema = z.object({
  projectId: z.number().int().positive(),
  style: z.string().optional(),
})

export async function POST(request: NextRequest) {
  return tryCatch(async () => {
    const body = await request.json()
    const data = generateSchema.parse(body)

    const project = await prisma.novelProject.findUnique({
      where: { id: data.projectId },
    })

    if (!project) {
      return error('NOT_FOUND', '项目不存在')
    }

    const result = await generateCover({
      projectId: data.projectId,
      title: project.title,
      genre: project.genre || '玄幻',
      synopsis: project.description || undefined,
      targetAudience: project.targetAudience || undefined,
      style: data.style,
    })

    const coverDesign = await prisma.coverDesign.create({
      data: {
        projectId: data.projectId,
        imageUrl: result.imageUrl,
        prompt: result.prompt,
        colorScheme: result.analysis.colorScheme,
        composition: result.analysis.composition,
        elements: result.analysis.elements,
        mood: result.analysis.mood,
        style: data.style,
      },
    })

    return coverDesign
  })
}
