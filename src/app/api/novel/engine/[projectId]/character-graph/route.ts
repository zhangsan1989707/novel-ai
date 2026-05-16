import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import type { CharacterProfile } from '@/lib/engine/types'
import { logError } from '@/lib/logger'

/**
 * GET /api/novel/engine/[projectId]/character-graph
 * 获取人物关系图数据
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  let projectIdNum: number | null = null
  try {
    const { projectId } = await params
    projectIdNum = parseInt(projectId, 10)

    if (isNaN(projectIdNum)) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: '无效的项目ID' } },
        { status: 400 }
      )
    }

    // 获取所有角色
    const characters = await prisma.character.findMany({
      where: { projectId: projectIdNum },
      orderBy: [{ firstChapter: 'asc' }, { name: 'asc' }],
    })

    // 构建角色节点
    const nodes = characters.map((char, index): {
      id: string
      type: 'character'
      position: { x: number; y: number }
      data: CharacterProfile
    } => {
      // 基于角色类型计算初始位置
      const roleLayers = {
        PROTAGONIST: 0,
        ANTAGONIST: 1,
        SUPPORTING: 2,
        MINOR: 3,
      }
      const layer = roleLayers[char.role as keyof typeof roleLayers] ?? 3
      const horizontalSpacing = 250
      const verticalSpacing = 150

      // 同一层的角色按索引分布
      const sameRoleChars = characters.filter(c => c.role === char.role)
      const sameRoleIndex = sameRoleChars.findIndex(c => c.id === char.id)

      return {
        id: char.id,
        type: 'character',
        position: {
          x: layer * horizontalSpacing + 100,
          y: sameRoleIndex * verticalSpacing + 100,
        },
        data: {
          id: char.id,
          name: char.name,
          role: char.role,
          aliases: char.aliases || [],
          appearance: char.appearance,
          personality: char.personality,
          catchphrases: char.catchphrases || [],
          background: char.background,
          relationships: char.relationships as Record<string, string> || {},
          currentState: char.currentState as Record<string, unknown> || {},
          firstChapter: char.firstChapter,
          lastUpdated: char.lastUpdated,
        },
      }
    })

    // 构建关系边
    const relationships: {
      source: string
      target: string
      type: string
      description: string
      strength: 'strong' | 'medium' | 'weak'
    }[] = []

    characters.forEach(char => {
      const rels = char.relationships as Record<string, string> || {}
      Object.entries(rels).forEach(([targetName, description]) => {
        const targetChar = characters.find(c => c.name === targetName)
        if (targetChar) {
          // 判断关系强度
          let strength: 'strong' | 'medium' | 'weak' = 'medium'
          if (description.includes('至亲') || description.includes('挚友') || description.includes('宿敌')) {
            strength = 'strong'
          } else if (description.includes('陌生') || description.includes('一般')) {
            strength = 'weak'
          }

          // 避免重复添加边（双向关系只添加一次）
          const existingEdge = relationships.find(
            r => (r.source === char.id && r.target === targetChar.id) ||
                 (r.source === targetChar.id && r.target === char.id)
          )
          if (!existingEdge) {
            relationships.push({
              source: char.id,
              target: targetChar.id,
              type: char.role,
              description,
              strength,
            })
          }
        }
      })
    })

    return NextResponse.json({
      success: true,
      data: {
        nodes,
        edges: relationships.map((rel, index) => ({
          id: `edge-${index}`,
          source: rel.source,
          target: rel.target,
          type: 'default',
          label: rel.description,
          data: {
            type: rel.type,
            strength: rel.strength,
          },
        })),
        stats: {
          totalCharacters: characters.length,
          protagonistCount: characters.filter(c => c.role === 'PROTAGONIST').length,
          antagonistCount: characters.filter(c => c.role === 'ANTAGONIST').length,
          supportingCount: characters.filter(c => c.role === 'SUPPORTING').length,
        },
      },
    })
  } catch (error) {
    logError(error instanceof Error ? error : new Error(String(error)), { type: 'get_character_graph', projectId: projectIdNum })
    return NextResponse.json(
      { success: false, error: { code: 'FETCH_ERROR', message: '获取人物关系图失败' } },
      { status: 500 }
    )
  }
}