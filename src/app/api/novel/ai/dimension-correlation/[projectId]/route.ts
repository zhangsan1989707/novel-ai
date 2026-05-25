import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { logError } from '@/lib/logger'
import { buildChapterMemoryPack, buildMemorySnapshotPack } from '@/lib/memory'

/**
 * GET /api/novel/ai/dimension-correlation/[projectId]
 * 获取多维度关联数据（人物 ←→ 剧情 ←→ 伏笔 ←→ 章节）
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

    // 并行获取所有数据
    const [characters, plotlines, chapterSummaries, chapters] = await Promise.all([
      prisma.character.findMany({
        where: { projectId: projectIdNum },
        select: { id: true, name: true, role: true, relationships: true },
      }),
      prisma.plotline.findMany({
        where: { projectId: projectIdNum },
        orderBy: { plantedAt: 'asc' },
      }),
      prisma.chapterSummary.findMany({
        where: { projectId: projectIdNum },
        orderBy: { chapterNo: 'asc' },
      }),
      prisma.novelChapter.findMany({
        where: { projectId: projectIdNum },
        select: { chapterNumber: true, title: true },
      }),
    ])
    const memoryPack = await buildChapterMemoryPack(projectIdNum, Math.max(...chapters.map(ch => ch.chapterNumber), 1), {
      recentChapterCount: 5,
      recentVolumeCount: 2,
      characterLimit: 10,
      plotlineLimit: 10,
      researchLimit: 3,
    })

    // 构建关联图
    // 1. 人物 <-> 伏笔: 通过伏笔描述中提到的人物
    const characterPlotlineMap: Record<string, string[]> = {}
    const plotlineCharacterMap: Record<string, string[]> = {}

    plotlines.forEach(plotline => {
      characters.forEach(char => {
        // 检查伏笔描述中是否提到该角色
        if (plotline.description.includes(char.name)) {
          if (!characterPlotlineMap[char.name]) {
            characterPlotlineMap[char.name] = []
          }
          characterPlotlineMap[char.name].push(plotline.id)

          if (!plotlineCharacterMap[plotline.id]) {
            plotlineCharacterMap[plotline.id] = []
          }
          plotlineCharacterMap[plotline.id].push(char.name)
        }
      })
    })

    // 2. 伏笔 <-> 章节
    const plotlineChapterMap: Record<string, number[]> = {}
    plotlines.forEach(p => {
      plotlineChapterMap[p.id] = [p.plantedAt]
      if (p.resolvedAt) {
        plotlineChapterMap[p.id].push(p.resolvedAt)
      }
    })

    // 3. 章节 <-> 情绪
    const chapterEmotionMap: Record<number, string> = {}
    chapterSummaries.forEach(s => {
      chapterEmotionMap[s.chapterNo] = s.emotionalTone || '平稳'
    })

    // 4. 跨维度洞察
    const crossDimensionInsights: {
      type: 'character_plotline' | 'plotline_chapter' | 'emotion_trend'
      description: string
      data: unknown
    }[] = []

    // 洞察1: 活跃角色与伏笔关联
    const activeCharactersWithPlotlines = Object.entries(characterPlotlineMap)
      .filter(([, plotlineIds]) => plotlineIds.length >= 2)
      .map(([charName, plotlineIds]) => ({
        character: charName,
        plotlineCount: plotlineIds.length,
        plotlines: plotlineIds.slice(0, 5),
      }))
    if (activeCharactersWithPlotlines.length > 0) {
      crossDimensionInsights.push({
        type: 'character_plotline',
        description: `角色"${activeCharactersWithPlotlines[0].character}"关联了${activeCharactersWithPlotlines[0].plotlineCount}个伏笔`,
        data: activeCharactersWithPlotlines,
      })
    }

    // 洞察2: 伏笔分布
    const unresolvedCount = plotlines.filter(p => p.status === 'OPEN').length
    const resolvedCount = plotlines.filter(p => p.status === 'RESOLVED').length
    if (unresolvedCount > resolvedCount) {
      crossDimensionInsights.push({
        type: 'plotline_chapter',
        description: `当前有${unresolvedCount}个伏笔未回收，建议在后续章节中安排回收`,
        data: { unresolved: unresolvedCount, resolved: resolvedCount },
      })
    }

    // 洞察3: 情绪趋势
    const emotionCounts: Record<string, number> = {}
    Object.values(chapterEmotionMap).forEach(emotion => {
      emotionCounts[emotion] = (emotionCounts[emotion] || 0) + 1
    })
    if (Object.keys(emotionCounts).length > 0) {
      const dominantEmotion = Object.entries(emotionCounts)
        .sort(([, a], [, b]) => b - a)[0]?.[0] || '平稳'
      crossDimensionInsights.push({
        type: 'emotion_trend',
        description: `全书情绪基调以"${dominantEmotion}"为主`,
        data: emotionCounts,
      })
    }

    return NextResponse.json({
      success: true,
      data: {
        characterPlotlineMap,
        plotlineChapterMap,
        chapterEmotionMap,
        crossDimensionInsights,
        stats: {
          totalCharacters: characters.length,
          totalPlotlines: plotlines.length,
          totalChapters: chapters.length,
          openPlotlines: unresolvedCount,
          resolvedPlotlines: resolvedCount,
        },
        memoryPack: buildMemorySnapshotPack(memoryPack),
        contexts: {
          planner: memoryPack.plannerContext,
          writer: memoryPack.writerContext,
          validator: memoryPack.validatorContext,
          summarizer: memoryPack.summarizerContext,
        },
      },
    })
  } catch (error) {
    logError(error instanceof Error ? error : new Error(String(error)), { type: 'get_dimension_correlation', projectId: projectIdNum })
    return NextResponse.json(
      { success: false, error: { code: 'FETCH_ERROR', message: '获取多维度关联失败' } },
      { status: 500 }
    )
  }
}
