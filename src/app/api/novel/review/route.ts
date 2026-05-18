import { NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { tryCatch, error } from '@/lib/api-response'
import { reviewerAgent } from '@/lib/agents/reviewer'

const reviewSchema = z.object({
  projectId: z.number().int().positive(),
  content: z.string().min(1),
  chapterNo: z.number().int().positive().optional(),
})

export async function POST(request: NextRequest) {
  return tryCatch(async () => {
    const body = await request.json()
    const data = reviewSchema.parse(body)

    const project = await prisma.novelProject.findUnique({
      where: { id: data.projectId },
    })

    if (!project) {
      return error('NOT_FOUND', '项目不存在')
    }

    const result = await reviewerAgent({
      projectId: data.projectId,
      content: data.content,
      genre: project.genre,
      targetAudience: project.targetAudience,
      chapterNo: data.chapterNo,
      worldSetting: project.worldSetting,
    })

    const report = await prisma.reviewReport.create({
      data: {
        projectId: data.projectId,
        chapterNo: data.chapterNo,
        content: data.content,
        reviews: result.reviews as unknown as object[],
        overallScore: result.overallScore,
        consensus: result.consensus,
        criticalIssues: result.criticalIssues,
        improvementPriority: result.improvementPriority,
      },
    })

    return report
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

    const reports = await prisma.reviewReport.findMany({
      where: { projectId: parsedId },
      orderBy: { createdAt: 'desc' },
    })

    return reports
  })
}
