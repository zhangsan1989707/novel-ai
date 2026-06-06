/**
 * GET/PUT /api/novel/engine/[projectId]/characters/[characterId]
 * 获取/更新单个角色档案
 */
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { updateCharacterProfile } from '@/lib/memory/character-memory'
import { logError } from '@/lib/logger'
import { requireProjectOwner, projectNotFoundResponse } from '@/lib/server/project-access'

interface RouteParams {
  params: Promise<{ projectId: string; characterId: string }>
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  let projectId: string | null = null
  let characterId: string | null = null
  try {
    const { projectId: paramProjectId, characterId: paramCharacterId } = await params
    projectId = paramProjectId
    characterId = paramCharacterId
    const projectIdNum = parseInt(paramProjectId)

    if (isNaN(projectIdNum)) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_ID', message: '无效的项目ID' } },
        { status: 400 }
      )
    }

    const project = await requireProjectOwner(projectIdNum)
    if (!project) {
      return projectNotFoundResponse()
    }

    const character = await prisma.character.findUnique({
      where: { id: paramCharacterId },
    })

    if (!character || character.projectId !== projectIdNum) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: '角色不存在' } },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: character,
    })
  } catch (error) {
    logError(error instanceof Error ? error : new Error(String(error)), { type: 'get_character', characterId, projectId })
    return NextResponse.json(
      { success: false, error: { code: 'CHARACTER_ERROR', message: '获取角色失败' } },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  let characterId: string | null = null
  try {
    const { projectId: paramProjectId, characterId: paramCharacterId } = await params
    characterId = paramCharacterId
    const projectIdNum = parseInt(paramProjectId)

    if (isNaN(projectIdNum)) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_ID', message: '无效的项目ID' } },
        { status: 400 }
      )
    }

    const project = await requireProjectOwner(projectIdNum)
    if (!project) {
      return projectNotFoundResponse()
    }

    const body = await request.json()

    // 验证角色归属
    const existing = await prisma.character.findUnique({
      where: { id: paramCharacterId },
    })

    if (!existing || existing.projectId !== projectIdNum) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: '角色不存在' } },
        { status: 404 }
      )
    }

    // 更新角色档案
    await updateCharacterProfile(paramCharacterId, {
      name: body.name,
      role: body.role,
      aliases: body.aliases,
      appearance: body.appearance,
      personality: body.personality,
      catchphrases: body.catchphrases,
      background: body.background,
      relationships: body.relationships,
      currentState: body.currentState,
    })

    return NextResponse.json({
      success: true,
      data: { id: paramCharacterId },
    })
  } catch (error) {
    logError(error instanceof Error ? error : new Error(String(error)), { type: 'update_character', characterId })
    return NextResponse.json(
      { success: false, error: { code: 'CHARACTER_ERROR', message: '更新角色失败' } },
      { status: 500 }
    )
  }
}
