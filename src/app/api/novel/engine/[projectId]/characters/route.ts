/**
 * GET /api/novel/engine/[projectId]/characters
 * 获取项目所有角色
 */
import { NextRequest, NextResponse } from 'next/server'
import { getCharacterProfiles } from '@/lib/memory/character-memory'
import { logError } from '@/lib/logger'

interface RouteParams {
  params: Promise<{ projectId: string }>
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { projectId } = await params
    const projectIdNum = parseInt(projectId)

    if (isNaN(projectIdNum)) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_ID', message: '无效的项目ID' } },
        { status: 400 }
      )
    }

    const characters = await getCharacterProfiles(projectIdNum)

    return NextResponse.json({
      success: true,
      data: characters,
    })
  } catch (error) {
    logError(error instanceof Error ? error : new Error(String(error)), { type: 'get_characters', projectId: projectIdNum })
    return NextResponse.json(
      { success: false, error: { code: 'CHARACTERS_ERROR', message: '获取角色列表失败' } },
      { status: 500 }
    )
  }
}
