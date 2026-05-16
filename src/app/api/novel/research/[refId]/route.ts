import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { tryCatch, error } from '@/lib/api-response'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ refId: string }> }
) {
  return tryCatch(async () => {
    const { refId } = await params

    const ref = await prisma.researchRef.findUnique({
      where: { id: refId },
    })

    if (!ref) {
      return error('NOT_FOUND', '研究资料不存在')
    }

    return ref
  })
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ refId: string }> }
) {
  return tryCatch(async () => {
    const { refId } = await params

    const ref = await prisma.researchRef.findUnique({
      where: { id: refId },
    })

    if (!ref) {
      return error('NOT_FOUND', '研究资料不存在')
    }

    await prisma.researchRef.delete({
      where: { id: refId },
    })

    return { deleted: true, id: refId }
  })
}
