/**
 * 角色档案 Memory 模块
 */
import { prisma } from '@/lib/prisma'
import type { Prisma } from '@prisma/client'
import type { CharacterProfile } from '@/lib/engine/types'

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
  updates: Record<string, Record<string, unknown>>
): Promise<void> {
  for (const [characterName, fields] of Object.entries(updates)) {
    await prisma.character.updateMany({
      where: { projectId, name: characterName },
      data: fields as Prisma.InputJsonValue,
    })
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
