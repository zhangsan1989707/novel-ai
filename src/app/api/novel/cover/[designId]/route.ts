import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { tryCatch, error } from '@/lib/api-response'
import { requireProjectOwner, projectNotFoundResponse } from '@/lib/server/project-access'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ designId: string }> }
) {
  return tryCatch(async () => {
    const { designId } = await params

    const design = await prisma.coverDesign.findUnique({
      where: { id: designId },
    })

    if (!design) {
      return error('NOT_FOUND', '封面设计不存在')
    }

    const project = await requireProjectOwner(design.projectId)
    if (!project) {
      return projectNotFoundResponse()
    }

    return design
  })
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ designId: string }> }
) {
  return tryCatch(async () => {
    const { designId } = await params

    const design = await prisma.coverDesign.findUnique({
      where: { id: designId },
    })

    if (!design) {
      return error('NOT_FOUND', '封面设计不存在')
    }

    const project = await requireProjectOwner(design.projectId)
    if (!project) {
      return projectNotFoundResponse()
    }

    await prisma.coverDesign.delete({
      where: { id: designId },
    })

    return { deleted: true, id: designId }
  })
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ designId: string }> }
) {
  return tryCatch(async () => {
    const { designId } = await params

    const design = await prisma.coverDesign.findUnique({
      where: { id: designId },
    })

    if (!design) {
      return error('NOT_FOUND', '封面设计不存在')
    }

    const project = await requireProjectOwner(design.projectId)
    if (!project) {
      return projectNotFoundResponse()
    }

    const updated = await prisma.$transaction(async (tx) => {
      await tx.coverDesign.updateMany({
        where: { projectId: design.projectId, isApplied: true },
        data: { isApplied: false },
      })

      const result = await tx.coverDesign.update({
        where: { id: designId },
        data: { isApplied: true },
      })

      await tx.novelProject.update({
        where: { id: design.projectId },
        data: { coverImage: design.imageUrl },
      })

      return result
    })

    return updated
  })
}
