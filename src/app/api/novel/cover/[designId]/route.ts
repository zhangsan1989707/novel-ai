import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { tryCatch, error } from '@/lib/api-response'

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

    await prisma.coverDesign.updateMany({
      where: { projectId: design.projectId, isApplied: true },
      data: { isApplied: false },
    })

    const updated = await prisma.coverDesign.update({
      where: { id: designId },
      data: { isApplied: true },
    })

    await prisma.novelProject.update({
      where: { id: design.projectId },
      data: { coverImage: design.imageUrl },
    })

    return updated
  })
}
