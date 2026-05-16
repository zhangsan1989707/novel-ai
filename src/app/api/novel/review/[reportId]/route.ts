import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { tryCatch, error } from '@/lib/api-response'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ reportId: string }> }
) {
  return tryCatch(async () => {
    const { reportId } = await params

    const report = await prisma.reviewReport.findUnique({
      where: { id: reportId },
    })

    if (!report) {
      return error('NOT_FOUND', '审稿报告不存在')
    }

    return report
  })
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ reportId: string }> }
) {
  return tryCatch(async () => {
    const { reportId } = await params

    const report = await prisma.reviewReport.findUnique({
      where: { id: reportId },
    })

    if (!report) {
      return error('NOT_FOUND', '审稿报告不存在')
    }

    await prisma.reviewReport.delete({
      where: { id: reportId },
    })

    return { deleted: true, id: reportId }
  })
}
