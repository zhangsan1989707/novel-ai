import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { createProviderFromDefaultConfig } from '@/lib/ai'
import { logError } from '@/lib/logger'
import { parseAiJsonObject } from '@/lib/engine/ai-json'
import { createCharacterProfile } from '@/lib/memory/character-memory'
import { CharacterRole } from '@prisma/client'

const extractCharactersSchema = z.object({
  projectId: z.number().int().positive('请选择有效的项目'),
})

export async function POST(request: NextRequest) {
  let projectId: number | null = null
  try {
    const body = await request.json()
    const parsed = extractCharactersSchema.parse(body)
    projectId = parsed.projectId

    const project = await prisma.novelProject.findUnique({
      where: { id: projectId },
      include: {
        sourceNovel: true,
        chapters: {
          orderBy: { chapterNumber: 'asc' },
          take: 20,
        },
      },
    })

    if (!project) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: '项目不存在' } },
        { status: 404 }
      )
    }

    let contentToAnalyze = ''
    if (project.sourceNovel?.originalText) {
      contentToAnalyze = project.sourceNovel.originalText.slice(0, 30000)
    } else if (project.chapters.length > 0) {
      contentToAnalyze = project.chapters
        .map(ch => ch.content || '')
        .join('\n\n')
        .slice(0, 30000)
    }

    if (!contentToAnalyze) {
      return NextResponse.json(
        { success: false, error: { code: 'NO_CONTENT', message: '没有可分析的内容' } },
        { status: 400 }
      )
    }

    const provider = await createProviderFromDefaultConfig()

    const prompt = `你是一位专业的小说角色分析师。请阅读以下小说内容，提取其中的角色信息。

【小说内容】
${contentToAnalyze.slice(0, 8000)}

【任务】
请分析这部小说，识别其中的主要角色，并为每个角色提取以下信息：
1. name - 角色名称
2. role - 角色定位（protagonist=主角, antagonist=反派, supporting=配角, minor=次要角色）
3. appearance - 外貌描写（如果有）
4. personality - 性格特点（如果有）
5. background - 背景故事（如果有）
6. catchphrases - 口头禅（数组，最多3个）
7. aliases - 别名/绰号（数组）
8. relationships - 与其他角色的关系（对象，key为其他角色名，value为关系描述如"师徒"、"恋人"、"敌对"等）
9. currentState - 角色在故事中的当前状态/处境（对象，可以包含 position、goal、status 等字段）

【输出格式】
请严格按照以下 JSON 格式输出：
{
  "characters": [
    {
      "name": "角色名",
      "role": "protagonist|antagonist|supporting|minor",
      "appearance": "外貌描写",
      "personality": "性格特点",
      "background": "背景故事",
      "catchphrases": ["口头禅1"],
      "aliases": ["别名1"],
      "relationships": {"角色名": "师徒"},
      "currentState": {"position": "位置", "goal": "目标"}
    }
  ]
}

注意：
- 最多提取10个最重要的角色
- 确保主角排在最前面
- 如果某个字段没有足够信息，relationships 和 currentState 留空对象 {}
- 不要输出任何额外文字，只输出 JSON`

    const result = await provider.generate(prompt, { temperature: 0.7 })
    
    const extracted = parseAiJsonObject(result.content) as {
      characters?: Array<{
        name: string
        role: string
        appearance?: string
        personality?: string
        background?: string
        catchphrases?: string[]
        aliases?: string[]
        relationships?: Record<string, string>
        currentState?: Record<string, string>
      }>
    } | null

    const roleMap: Record<string, CharacterRole> = {
      protagonist: CharacterRole.PROTAGONIST,
      antagonist: CharacterRole.ANTAGONIST,
      supporting: CharacterRole.SUPPORTING,
      minor: CharacterRole.MINOR,
    }

    let charactersCreated = 0
    if (extracted?.characters && extracted.characters.length > 0) {
      for (const char of extracted.characters.slice(0, 10)) {
        if (!char.name) continue

        const existingCharacter = await prisma.character.findFirst({
          where: { projectId, name: char.name },
        })

        if (existingCharacter) continue

        await createCharacterProfile(projectId, {
          name: char.name,
          role: roleMap[char.role?.toLowerCase()] || CharacterRole.SUPPORTING,
          appearance: char.appearance || null,
          personality: char.personality || null,
          background: char.background || null,
          catchphrases: char.catchphrases?.slice(0, 3) || [],
          aliases: char.aliases || [],
          relationships: char.relationships || {},
          currentState: char.currentState || {},
          firstChapter: 1,
          lastUpdated: 1,
        })
        charactersCreated++
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        charactersCreated,
        characters: extracted?.characters?.slice(0, 10) || [],
      },
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: error.issues[0]?.message || '验证失败' } },
        { status: 400 }
      )
    }
    logError(error instanceof Error ? error : new Error(String(error)), { type: 'extract_characters', projectId })
    return NextResponse.json(
      { success: false, error: { code: 'EXTRACT_ERROR', message: '角色提取失败' } },
      { status: 500 }
    )
  }
}
