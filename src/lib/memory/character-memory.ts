/**
 * 角色档案 Memory 模块
 */
import { prisma } from '@/lib/prisma'
import type { Prisma } from '@prisma/client'
import type { CharacterProfile } from '@/lib/engine/types'

function normalizeJsonObject(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }
  return {}
}

/**
 * 获取项目所有角色档案
 */
export async function getCharacterProfiles(projectId: number): Promise<CharacterProfile[]> {
  const characters = await prisma.character.findMany({
    where: { projectId },
    orderBy: [
      { role: 'asc' },  // PROTAGONIST 排在前面
      { firstChapter: 'asc' },
    ],
  })

  return characters.map(c => ({
    id: c.id,
    name: c.name,
    role: c.role,
    aliases: c.aliases || [],
    appearance: c.appearance,
    personality: c.personality,
    catchphrases: c.catchphrases || [],
    background: c.background,
    relationships: (c.relationships as Record<string, string>) || {},
    currentState: (c.currentState as Record<string, unknown>) || {},
    firstChapter: c.firstChapter,
    lastUpdated: c.lastUpdated,
  }))
}

/**
 * 获取出场角色档案（基于前几章）
 */
export async function getCharacterProfilesForChapter(
  projectId: number,
  chapterNo: number,
  beforeChapter: boolean = true
): Promise<CharacterProfile[]> {
  const whereClause = beforeChapter
    ? { projectId, firstChapter: { lte: chapterNo } }
    : { projectId }

  const characters = await prisma.character.findMany({
    where: whereClause,
    orderBy: [
      { role: 'asc' },
      { firstChapter: 'asc' },
    ],
  })

  return characters.map(c => ({
    id: c.id,
    name: c.name,
    role: c.role,
    aliases: c.aliases || [],
    appearance: c.appearance,
    personality: c.personality,
    catchphrases: c.catchphrases || [],
    background: c.background,
    relationships: (c.relationships as Record<string, string>) || {},
    currentState: (c.currentState as Record<string, unknown>) || {},
    firstChapter: c.firstChapter,
    lastUpdated: c.lastUpdated,
  }))
}

/**
 * 更新角色档案
 */
export async function updateCharacterProfile(
  characterId: string,
  updates: Partial<CharacterProfile>
): Promise<void> {
  await prisma.character.update({
    where: { id: characterId },
    data: {
      name: updates.name,
      role: updates.role,
      aliases: updates.aliases,
      appearance: updates.appearance,
      personality: updates.personality,
      catchphrases: updates.catchphrases,
      background: updates.background,
      relationships: (updates.relationships ?? undefined) as Prisma.InputJsonValue,
      currentState: (updates.currentState ?? undefined) as Prisma.InputJsonValue,
      lastUpdated: updates.lastUpdated,
    },
  })
}

/**
 * 批量更新角色档案（基于校验 Agent 报告）
 */
export async function batchUpdateCharacterProfiles(
  projectId: number,
  updates: Record<string, Record<string, unknown> | string>,
  lastUpdatedChapter?: number
): Promise<void> {
  for (const [characterName, fields] of Object.entries(updates)) {
    const characters = await prisma.character.findMany({
      where: { projectId, name: characterName },
      select: { id: true, currentState: true },
    })

    for (const character of characters) {
      const updateData: Prisma.CharacterUpdateInput = {}

      if (typeof fields === 'string') {
        updateData.currentState = {
          ...normalizeJsonObject(character.currentState),
          aiValidationNote: fields,
          updatedBy: 'VALIDATOR',
        } as Prisma.InputJsonValue
        if (typeof lastUpdatedChapter === 'number') {
          updateData.lastUpdated = lastUpdatedChapter
        }
      } else {
        for (const [key, value] of Object.entries(fields)) {
          if (value === undefined || value === null) continue

          switch (key) {
            case 'appearance':
              updateData.appearance = String(value)
              break
            case 'personality':
              updateData.personality = String(value)
              break
            case 'background':
              updateData.background = String(value)
              break
            case 'aliases':
              if (Array.isArray(value)) {
                updateData.aliases = value.filter((item): item is string => typeof item === 'string')
              }
              break
            case 'catchphrases':
              if (Array.isArray(value)) {
                updateData.catchphrases = value.filter((item): item is string => typeof item === 'string')
              }
              break
            case 'relationships':
              updateData.relationships = value as Prisma.InputJsonValue
              break
            case 'currentState':
              updateData.currentState = {
                ...normalizeJsonObject(character.currentState),
                ...(value as Record<string, unknown>),
              } as Prisma.InputJsonValue
              break
            case 'lastUpdated':
              if (typeof value === 'number' && Number.isFinite(value)) {
                updateData.lastUpdated = value
              }
              break
            default:
              if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
                updateData.currentState = {
                  ...normalizeJsonObject(character.currentState),
                  [key]: value,
                } as Prisma.InputJsonValue
              }
              break
          }
        }

        if (typeof lastUpdatedChapter === 'number' && updateData.lastUpdated === undefined) {
          updateData.lastUpdated = lastUpdatedChapter
        }
      }

      if (Object.keys(updateData).length > 0) {
        await prisma.character.update({
          where: { id: character.id },
          data: updateData,
        })
      }
    }
  }
}

/**
 * 创建新角色档案
 */
export async function createCharacterProfile(
  projectId: number,
  profile: Omit<CharacterProfile, 'id'>
): Promise<string> {
  const character = await prisma.character.create({
    data: {
      projectId,
      name: profile.name,
      role: profile.role,
      aliases: profile.aliases,
      appearance: profile.appearance,
      personality: profile.personality,
      catchphrases: profile.catchphrases,
      background: profile.background,
      relationships: (profile.relationships ?? undefined) as Prisma.InputJsonValue,
      currentState: (profile.currentState ?? undefined) as Prisma.InputJsonValue,
      firstChapter: profile.firstChapter,
      lastUpdated: profile.lastUpdated,
    },
  })
  return character.id
}
