import { NextResponse } from 'next/server'
import { getCurrentUserId } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export function projectNotFoundResponse() {
  return NextResponse.json(
    { success: false, error: { code: 'NOT_FOUND', message: '项目不存在' } },
    { status: 404 }
  )
}

export async function requireProjectOwner(projectId: number) {
  let creatorId: number
  try {
    creatorId = await getCurrentUserId()
  } catch {
    return null
  }

  return prisma.novelProject.findFirst({
    where: { id: projectId, creatorId },
    select: { id: true, creatorId: true },
  })
}
