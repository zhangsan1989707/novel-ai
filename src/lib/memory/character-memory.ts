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

/**
 * 基于相关性筛选角色（长篇小说优化）
 * 始终保留主角和反派，其余按近期提及频率排序
 */
export function selectRelevantCharacters(
  characters: CharacterProfile[],
  limit: number,
  context: { recentSummaries: string[]; currentChapterNo: number }
): CharacterProfile[] {
  if (characters.length <= limit) return characters

  const summaryText = context.recentSummaries.join('\n')

  const essential = characters.filter(c => c.role === 'PROTAGONIST' || c.role === 'ANTAGONIST')
  const optional = characters.filter(c => c.role !== 'PROTAGONIST' && c.role !== 'ANTAGONIST')

  const scored = optional.map(c => {
    let score = 0
    if (summaryText.includes(c.name)) score += 3
    for (const alias of c.aliases) {
      if (summaryText.includes(alias)) { score += 2; break }
    }
    if (c.lastUpdated && context.currentChapterNo - c.lastUpdated <= 10) score += 2
    if (c.currentState && Object.keys(c.currentState).length > 0) score += 1
    return { character: c, score }
  })

  scored.sort((a, b) => b.score - a.score)

  const remaining = limit - essential.length
  return [...essential, ...scored.slice(0, Math.max(0, remaining)).map(s => s.character)]
}

/**
 * 角色声音指纹接口
 */
export interface CharacterVoice {
  name: string
  speechStyle: string | null
  vocabularyLevel: string | null
  sentencePattern: string | null
  catchphraseStyle: string | null
  dialogueExamples: string[]
  voiceNotes: string | null
}

/**
 * 获取角色声音指纹
 */
export async function getCharacterVoiceFingerprint(
  characterId: string
): Promise<CharacterVoice | null> {
  const character = await prisma.character.findUnique({
    where: { id: characterId },
    select: {
      name: true,
      speechStyle: true,
      vocabularyLevel: true,
      sentencePattern: true,
      catchphraseStyle: true,
      dialogueExamples: true,
      voiceNotes: true,
    },
  })

  if (!character) return null

  // 如果没有任何声音数据，返回 null
  const hasVoiceData = character.speechStyle || character.vocabularyLevel ||
    character.sentencePattern || character.catchphraseStyle ||
    (character.dialogueExamples && character.dialogueExamples.length > 0) ||
    character.voiceNotes

  if (!hasVoiceData) return null

  return {
    name: character.name,
    speechStyle: character.speechStyle,
    vocabularyLevel: character.vocabularyLevel,
    sentencePattern: character.sentencePattern,
    catchphraseStyle: character.catchphraseStyle,
    dialogueExamples: character.dialogueExamples || [],
    voiceNotes: character.voiceNotes,
  }
}

/**
 * 批量获取项目角色声音指纹
 */
export async function getCharacterVoicesForProject(
  projectId: number
): Promise<CharacterVoice[]> {
  const characters = await prisma.character.findMany({
    where: {
      projectId,
      OR: [
        { speechStyle: { not: null } },
        { vocabularyLevel: { not: null } },
        { sentencePattern: { not: null } },
        { catchphraseStyle: { not: null } },
        { voiceNotes: { not: null } },
      ],
    },
    select: {
      name: true,
      speechStyle: true,
      vocabularyLevel: true,
      sentencePattern: true,
      catchphraseStyle: true,
      dialogueExamples: true,
      voiceNotes: true,
    },
  })

  return characters.map(c => ({
    name: c.name,
    speechStyle: c.speechStyle,
    vocabularyLevel: c.vocabularyLevel,
    sentencePattern: c.sentencePattern,
    catchphraseStyle: c.catchphraseStyle,
    dialogueExamples: c.dialogueExamples || [],
    voiceNotes: c.voiceNotes,
  }))
}

/**
 * 格式化角色声音约束为文本（供 Writer prompt 使用）
 */
export function formatCharacterVoiceConstraint(voice: CharacterVoice): string {
  const parts: string[] = []
  parts.push(`【角色声音约束 - ${voice.name}】`)
  if (voice.speechStyle) parts.push(`说话风格：${voice.speechStyle}`)
  if (voice.vocabularyLevel) parts.push(`用词层次：${voice.vocabularyLevel}`)
  if (voice.sentencePattern) parts.push(`句式偏好：${voice.sentencePattern}`)
  if (voice.catchphraseStyle) parts.push(`口头禅规则：${voice.catchphraseStyle}`)
  if (voice.dialogueExamples.length > 0) {
    parts.push('示例对话：')
    voice.dialogueExamples.forEach(ex => parts.push(`  "${ex}"`))
  }
  if (voice.voiceNotes) parts.push(`补充说明：${voice.voiceNotes}`)
  return parts.join('\n')
}
