/**
 * GET/PUT /api/novel/engine/[projectId]/characters/[characterId]
 * 获取/更新单个角色档案
 */
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { updateCharacterProfile } from '@/lib/memory/character-memory'
import { logError } from '@/lib/logger'

interface RouteParams {
  params: Promise<{ projectId: string; characterId: string }>
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { projectId, characterId } = await params
    const projectIdNum = parseInt(projectId)

    if (isNaN(projectIdNum)) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_ID', message: '无效的项目ID' } },
        { status: 400 }
      )
    }

    const character = await prisma.character.findUnique({
      where: { id: characterId },
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
    logError(error instanceof Error ? error : new Error(String(error)), { type: $1 })
    return NextResponse.json(
      { success: false, error: { code: 'CHARACTER_ERROR', message: '获取角色失败' } },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { projectId, characterId } = await params
    const projectIdNum = parseInt(projectId)

    if (isNaN(projectIdNum)) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_ID', message: '无效的项目ID' } },
        { status: 400 }
      )
    }

    const body = await request.json()

    // 验证角色归属
    const existing = await prisma.character.findUnique({
      where: { id: characterId },
    })

    if (!existing || existing.projectId !== projectIdNum) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: '角色不存在' } },
        { status: 404 }
      )
    }

    // 更新角色档案
    await updateCharacterProfile(characterId, {
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
      data: { id: characterId },
    })
  } catch (error) {
    logError(error instanceof Error ? error : new Error(String(error)), { type: 'update_character', characterId })
    return NextResponse.json(
      { success: false, error: { code: 'CHARACTER_ERROR', message: '更新角色失败' } },
      { status: 500 }
    )
  }
}
