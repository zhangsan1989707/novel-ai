import { NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { tryCatch, error } from '@/lib/api-response'
import { researcherAgent } from '@/lib/agents/researcher'

const researchSchema = z.object({
  projectId: z.number().int().positive(),
  topic: z.string().min(1).max(200),
  context: z.string().max(2000).default(''),
  chapterNo: z.number().int().positive().optional(),
})

export async function POST(request: NextRequest) {
  return tryCatch(async () => {
    const body = await request.json()
    const data = researchSchema.parse(body)

    const project = await prisma.novelProject.findUnique({
      where: { id: data.projectId },
    })

    if (!project) {
      return error('NOT_FOUND', '项目不存在')
    }

    const existingRefs = await prisma.researchRef.findMany({
      where: { projectId: data.projectId },
      select: { topic: true, summary: true },
    })

    const result = await researcherAgent({
      projectId: data.projectId,
      topic: data.topic,
      context: data.context,
      genre: project.genre,
      worldSetting: project.worldSetting,
      chapterNo: data.chapterNo,
      existingResearch: existingRefs.map(r => `${r.topic}: ${r.summary}`),
    })

    const researchRef = await prisma.researchRef.create({
      data: {
        projectId: data.projectId,
        topic: result.topic,
        summary: result.summary,
        keyFacts: result.keyFacts,
        creativeMaterials: result.creativeMaterials,
        confidence: result.confidence,
        usageSuggestions: result.usageSuggestions,
        usedInChapter: data.chapterNo,
      },
    })

    return researchRef
  })
}

export async function GET(request: NextRequest) {
  return tryCatch(async () => {
    const { searchParams } = new URL(request.url)
    const projectId = searchParams.get('projectId')

    if (!projectId) {
      return error('VALIDATION_ERROR', '缺少 projectId 参数')
    }

    const parsedId = parseInt(projectId, 10)
    if (isNaN(parsedId)) {
      return error('VALIDATION_ERROR', 'projectId 格式无效')
    }

    const refs = await prisma.researchRef.findMany({
      where: { projectId: parsedId },
      orderBy: { createdAt: 'desc' },
    })

    return refs
  })
}
