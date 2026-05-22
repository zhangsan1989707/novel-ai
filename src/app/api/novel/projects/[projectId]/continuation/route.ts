import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { createProviderFromDefaultConfig } from '@/lib/ai'
import { buildNovelGenerationPrompt, buildEndingPrompt, buildRevisionPrompt } from '@/lib/ai/prompts'
import { buildPromptContext } from '@/lib/ai/context-manager'
import { buildChapterMemoryPack } from '@/lib/memory'
import { getMinimumChapterWordCount, isChapterWordCountSufficient } from '@/lib/ai/chapter-quality'
import { logError } from '@/lib/logger'
import { toProjectDTO, toChapterDTO } from '@/types/dto'
import { countChapterWords, syncProjectChapterWordCount } from '@/lib/novel/chapter-word-count'

// ============================================
// Schema 验证
// ============================================

const continuationSchema = z.object({
  mode: z.enum(['ending', 'continue', 'rewrite']),
  // ending 模式
  targetChapterCount: z.number().int().positive().optional().default(1),
  endingDirection: z.enum(['happy', 'tragic', 'open']).optional(),
  // continue 模式
  baseChapterId: z.number().int().positive().optional(),
  // rewrite 模式
  userInput: z.string().optional(),
  // 通用参数
  useContext: z.boolean().default(true),
  contextChapterCount: z.number().int().min(1).max(10).default(2),
  targetWordCount: z.number().int().positive().default(3000),
  temperature: z.number().min(0).max(2).default(0.7),
})

// ============================================
// API Handler
// ============================================

/**
 * POST /api/novel/projects/[projectId]/continuation
 * 续写生成接口 (SSE 流式)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  let projectIdNum: number | null = null
  try {
    const { projectId } = await params
    projectIdNum = parseInt(projectId, 10)

    if (isNaN(projectIdNum)) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_ID', message: '无效的项目ID' } },
        { status: 400 }
      )
    }

    const body = await request.json()
    const {
      mode,
      targetChapterCount,
      endingDirection,
      userInput,
      useContext,
      contextChapterCount,
      targetWordCount,
      temperature,
    } = continuationSchema.parse(body)

    // 获取项目信息
    const rawProject = await prisma.novelProject.findUnique({
      where: { id: projectIdNum },
    })

    if (!rawProject) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: '项目不存在' } },
        { status: 404 }
      )
    }

    // 类型转换
    const project = toProjectDTO(rawProject)

    // 获取所有章节
    const chapters = await prisma.novelChapter.findMany({
      where: { projectId: projectIdNum },
      orderBy: { chapterNumber: 'asc' },
    })

    // 获取分析结果
    const analyses = await prisma.bookAnalysis.findMany({
      where: { projectId: projectIdNum },
    })

    // 创建 AI Provider
    const provider = await createProviderFromDefaultConfig()

    // 根据模式构建提示词
    let prompt = ''
    let chapterTitle = ''
    let chapterNumber = 1

    if (mode === 'ending') {
      // 续写结局模式
      // 提取未回收伏笔和开放剧情线
      const foreshadowingAnalysis = analyses.find(a => a.dimension === 'FORESHADOWING')
      const plotLineAnalysis = analyses.find(a => a.dimension === 'PLOT_LINE')
      const characterAnalysis = analyses.find(a => a.dimension === 'CHARACTER_RELATION')

      const unresolvedForeshadowing: { setup: string; importance: string }[] = []
      const openPlotlines: { title: string; keyEvents: string[] }[] = []
      const characterArcs: { name: string; currentStatus: string; arcDescription?: string }[] = []

      if (foreshadowingAnalysis?.analysisData) {
        const data = foreshadowingAnalysis.analysisData as { items?: { setup: string; payoff?: string; importance: string }[] }
        if (data.items) {
          data.items.forEach(item => {
            if (!item.payoff || item.payoff.trim() === '') {
              unresolvedForeshadowing.push({ setup: item.setup, importance: item.importance })
            }
          })
        }
      }

      if (plotLineAnalysis?.analysisData) {
        const data = plotLineAnalysis.analysisData as { mainPlot?: { title: string; keyEvents: string[] }[]; subPlots?: { title: string; keyEvents: string[] }[] }
        if (data.mainPlot) {
          data.mainPlot.forEach(plot => {
            openPlotlines.push({ title: plot.title, keyEvents: plot.keyEvents || [] })
          })
        }
        if (data.subPlots) {
          data.subPlots.forEach(plot => {
            openPlotlines.push({ title: plot.title, keyEvents: plot.keyEvents || [] })
          })
        }
      }

      if (characterAnalysis?.analysisData) {
        const data = characterAnalysis.analysisData as { characters?: { name: string; description: string }[] }
        if (data.characters) {
          data.characters.slice(0, 10).forEach(char => {
            characterArcs.push({
              name: char.name,
              currentStatus: char.description.slice(0, 100),
            })
          })
        }
      }

      // 获取最后一章
      const lastChapter = chapters[chapters.length - 1]
      chapterNumber = lastChapter ? lastChapter.chapterNumber + 1 : 1
      chapterTitle = `结局章`

      // 构建上下文
      const currentChapter = lastChapter
        ? toChapterDTO({ ...lastChapter, chapterNumber, title: chapterTitle })
        : toChapterDTO({ id: 0, projectId: projectIdNum, chapterNumber, title: chapterTitle, content: '', wordCount: 0, status: 'DRAFT' as const, sortOrder: chapterNumber, summary: null, generationPrompt: null, generationParams: null, generationCount: 0, lastGeneratedTime: null, chapterOutline: null, validationReport: null, retryCount: 0, lastAgentType: null, virtualWriterId: null, createdAt: new Date(), updatedAt: new Date(), virtualWriter: null })

      const memoryPack = await buildChapterMemoryPack(projectIdNum, chapterNumber, {
        recentChapterCount: 5,
        recentVolumeCount: 2,
        characterLimit: 8,
        plotlineLimit: 8,
        researchLimit: 3,
      })
      const context = await buildPromptContext(
        project,
        currentChapter,
        [],
        {
          useContext: false,
          contextChapterCount: 3,
          includeStageOutline: false,
          memoryContext: memoryPack.writerContext,
        }
      )

      // 构建结局提示词
      prompt = buildEndingPrompt({
        context,
        options: {
          unresolvedForeshadowing,
          openPlotlines,
          characterArcs,
          endingDirection: endingDirection as 'happy' | 'tragic' | 'open' | undefined,
          targetChapterCount,
        }
      })
    } else if (mode === 'continue') {
      // 继续创作模式
      const lastChapter = chapters[chapters.length - 1]
      chapterNumber = lastChapter ? lastChapter.chapterNumber + 1 : 1
      chapterTitle = `第${chapterNumber}章`

      // 获取前几章作为上下文
      const contextChapters = lastChapter
        ? chapters.slice(-contextChapterCount).map(toChapterDTO)
        : []

      const currentChapterForContinue = lastChapter
        ? toChapterDTO({ ...lastChapter, chapterNumber, title: chapterTitle })
        : toChapterDTO({ id: 0, projectId: projectIdNum, chapterNumber, title: chapterTitle, content: '', wordCount: 0, status: 'DRAFT' as const, sortOrder: chapterNumber, summary: null, generationPrompt: null, generationParams: null, generationCount: 0, lastGeneratedTime: null, chapterOutline: null, validationReport: null, retryCount: 0, lastAgentType: null, virtualWriterId: null, createdAt: new Date(), updatedAt: new Date(), virtualWriter: null })

      const memoryPack = await buildChapterMemoryPack(projectIdNum, chapterNumber, {
        recentChapterCount: Math.max(3, contextChapterCount),
        recentVolumeCount: 2,
        characterLimit: 10,
        plotlineLimit: 10,
        researchLimit: 3,
      })
      const context = await buildPromptContext(
        project,
        currentChapterForContinue,
        contextChapters,
        {
          useContext,
          contextChapterCount,
          includeStageOutline: true,
          memoryContext: memoryPack.writerContext,
        }
      )

      prompt = buildNovelGenerationPrompt(context, {
        useContext,
        contextChapterCount,
        targetWordCount,
        includeStageOutline: true,
      })
    } else {
      // rewrite 模式 - 全文重写
      const lastChapter = chapters[chapters.length - 1]
      chapterNumber = lastChapter ? lastChapter.chapterNumber + 1 : 1
      chapterTitle = `重写版第${chapterNumber}章`

      // 获取全书摘要
      // 构建上下文
      const rewriteContextChapters = chapters.slice(-contextChapterCount).map(toChapterDTO)

      const currentChapterForRewrite = lastChapter
        ? toChapterDTO({ ...lastChapter, chapterNumber, title: chapterTitle })
        : toChapterDTO({ id: 0, projectId: projectIdNum, chapterNumber, title: chapterTitle, content: '', wordCount: 0, status: 'DRAFT' as const, sortOrder: chapterNumber, summary: null, generationPrompt: null, generationParams: null, generationCount: 0, lastGeneratedTime: null, chapterOutline: null, validationReport: null, retryCount: 0, lastAgentType: null, virtualWriterId: null, createdAt: new Date(), updatedAt: new Date(), virtualWriter: null })

      const memoryPack = await buildChapterMemoryPack(projectIdNum, chapterNumber, {
        recentChapterCount: Math.max(3, contextChapterCount),
        recentVolumeCount: 2,
        characterLimit: 10,
        plotlineLimit: 10,
        researchLimit: 3,
      })
      const context = await buildPromptContext(
        project,
        currentChapterForRewrite,
        rewriteContextChapters,
        {
          useContext: false,
          contextChapterCount: 3,
          includeStageOutline: false,
          memoryContext: memoryPack.writerContext,
        }
      )

      // 使用 revision continue 类型
      const fullContent = lastChapter?.content || ''
      prompt = buildRevisionPrompt(context, fullContent, 'continue', userInput)
    }

    // 创建章节记录
    const newChapter = await prisma.novelChapter.create({
      data: {
        projectId: projectIdNum,
        chapterNumber,
        title: chapterTitle,
        status: 'GENERATING',
        sortOrder: chapterNumber,
      },
    })

    // 设置 SSE 响应头
    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      async start(controller) {
        const sendEvent = (event: string, data: Record<string, unknown>) => {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`))
        }

        try {
          // 发送开始事件
          sendEvent('start', { chapterId: newChapter.id, chapterNumber, mode })

          // 流式生成
          let fullContent = ''
          for await (const token of provider.generateStream(prompt, { temperature })) {
            fullContent += token
            sendEvent('token', { content: token })
          }

          // 解析标题和内容
          let extractedTitle = chapterTitle
          let extractedContent = fullContent
          
          const titleMatch = fullContent.match(/^标题：(.+)$/m)
          const contentMatch = fullContent.match(/^内容：$\s*([\s\S]*)$/m)
          
          if (titleMatch && contentMatch) {
            let aiTitle = titleMatch[1].trim()
            aiTitle = aiTitle.replace(/^第\d+章\s*/, '')
            extractedTitle = aiTitle || chapterTitle
            extractedContent = contentMatch[1].trim()
          }

          const wordCount = countChapterWords(extractedContent)
          const chapterReady = isChapterWordCountSufficient(wordCount, targetWordCount, chapterNumber)

          // 更新章节内容
          await prisma.novelChapter.update({
            where: { id: newChapter.id },
            data: {
              title: extractedTitle,
              content: extractedContent,
              wordCount,
              status: chapterReady ? 'COMPLETED' : 'REVIEWING',
            },
          })

          await syncProjectChapterWordCount(prisma, projectIdNum as number)

          // 发送完成事件
          sendEvent('done', {
            chapterId: newChapter.id,
            chapterNumber,
            wordCount,
            minimumWordCount: getMinimumChapterWordCount(targetWordCount, chapterNumber),
            qualityStatus: chapterReady ? 'completed' : 'reviewing',
          })
        } catch (error) {
          // 标记章节为失败
          await prisma.novelChapter.update({
            where: { id: newChapter.id },
            data: { status: 'DRAFT' },
          }).catch(() => {})

          sendEvent('error', {
            message: error instanceof Error ? error.message : '生成失败',
          })
        } finally {
          controller.close()
        }
      },
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: error.issues[0]?.message } },
        { status: 400 }
      )
    }
    logError(error instanceof Error ? error : new Error(String(error)), { type: 'generate_continuation', projectId: projectIdNum })
    return NextResponse.json(
      { success: false, error: { code: 'GENERATION_ERROR', message: '续写生成失败' } },
      { status: 500 }
    )
  }
}
