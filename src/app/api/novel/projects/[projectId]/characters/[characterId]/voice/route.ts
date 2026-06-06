import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { success, handleApiError } from '@/lib/api-response'
import { projectNotFoundResponse, requireProjectOwner } from '@/lib/server/project-access'

/**
 * GET /api/novel/projects/:projectId/characters/:characterId/voice
 * 获取角色声音指纹
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ projectId: string; characterId: string }> }
) {
  try {
    const { projectId: projectIdStr, characterId } = await params
    const projectId = parseInt(projectIdStr, 10)

    if (isNaN(projectId)) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_ID', message: '无效的项目ID' } },
        { status: 400 }
      )
    }

    if (!await requireProjectOwner(projectId)) {
      return projectNotFoundResponse()
    }

    const character = await prisma.character.findFirst({
      where: { id: characterId, projectId },
      select: {
        id: true,
        name: true,
        speechStyle: true,
        vocabularyLevel: true,
        sentencePattern: true,
        catchphraseStyle: true,
        dialogueExamples: true,
        voiceNotes: true,
      },
    })

    if (!character) {
      return NextResponse.json(success(null, '角色不存在'))
    }

    return NextResponse.json(success({
      id: character.id,
      name: character.name,
      speechStyle: character.speechStyle,
      vocabularyLevel: character.vocabularyLevel,
      sentencePattern: character.sentencePattern,
      catchphraseStyle: character.catchphraseStyle,
      dialogueExamples: character.dialogueExamples || [],
      voiceNotes: character.voiceNotes,
    }))
  } catch (err) {
    return handleApiError(err)
  }
}

/**
 * PUT /api/novel/projects/:projectId/characters/:characterId/voice
 * 更新角色声音指纹
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string; characterId: string }> }
) {
  try {
    const { projectId: projectIdStr, characterId } = await params
    const projectId = parseInt(projectIdStr, 10)
    const body = await req.json()

    if (isNaN(projectId)) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_ID', message: '无效的项目ID' } },
        { status: 400 }
      )
    }

    if (!await requireProjectOwner(projectId)) {
      return projectNotFoundResponse()
    }

    const { speechStyle, vocabularyLevel, sentencePattern, catchphraseStyle, dialogueExamples, voiceNotes } = body

    const existingCharacter = await prisma.character.findFirst({
      where: { id: characterId, projectId },
      select: { id: true },
    })

    if (!existingCharacter) {
      return NextResponse.json(success(null, '角色不存在'))
    }

    const character = await prisma.character.update({
      where: { id: characterId },
      data: {
        speechStyle: speechStyle ?? undefined,
        vocabularyLevel: vocabularyLevel ?? undefined,
        sentencePattern: sentencePattern ?? undefined,
        catchphraseStyle: catchphraseStyle ?? undefined,
        dialogueExamples: dialogueExamples ?? undefined,
        voiceNotes: voiceNotes ?? undefined,
      },
      select: {
        id: true,
        name: true,
        speechStyle: true,
        vocabularyLevel: true,
        sentencePattern: true,
        catchphraseStyle: true,
        dialogueExamples: true,
        voiceNotes: true,
      },
    })

    return NextResponse.json(success(character, '声音指纹已更新'))
  } catch (err) {
    return handleApiError(err)
  }
}
