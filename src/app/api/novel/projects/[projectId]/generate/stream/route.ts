import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { buildPromptContext, buildNovelGenerationPrompt } from '@/lib/ai'
import { AIService } from '@/lib/ai/service'
import { countChineseWords } from '@/lib/utils'
import { getMinimumChapterWordCount, isChapterWordCountSufficient, buildChapterWordCountWarning } from '@/lib/ai/chapter-quality'
import { logError } from '@/lib/logger'
import { aiGenerationLimiter } from '@/lib/middleware/rate-limit'
import { toProjectDTO, toChapterDTO } from '@/types/dto'
import { recordAndApplyChapterCommit } from '@/lib/engine/chapter-commit'
import { buildChapterMemoryPack } from '@/lib/memory'
import { estimateMaxTokensForTargetWordCount } from '@/lib/ai/speed-mode'
import { projectNotFoundResponse, requireProjectOwner } from '@/lib/server/project-access'

// ============================================
// Schema 验证
// ============================================

const generateSchema = z.object({
  chapterId: z.number().int().positive(),
  useContext: z.boolean().default(true),
  contextChapterCount: z.number().int().min(1).max(10).default(2),
  targetWordCount: z.number().int().positive().default(3000),
  temperature: z.number().min(0).max(2).default(0.7),
  virtualWriterId: z.number().int().positive().optional(),
})

// ============================================
// API Handler
// ============================================

interface RouteParams {
  params: Promise<{ projectId: string }>
}

/**
 * POST /api/novel/projects/{projectId}/generate/stream
 * SSE 流式生成章节内容
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  let projectIdNum: number | null = null
  let chapterId: number | undefined
  try {
    const { projectId } = await params
    projectIdNum = parseInt(projectId)

    if (isNaN(projectIdNum)) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_ID', message: '无效的项目ID' } },
        { status: 400 }
      )
    }

    const projectOwner = await requireProjectOwner(projectIdNum)
    if (!projectOwner) {
      return projectNotFoundResponse()
    }

    const rateLimitResponse = aiGenerationLimiter(request)
    if (rateLimitResponse) {
      return rateLimitResponse
    }

    const body = await request.json()
    const parsedData = generateSchema.parse(body)
    chapterId = parsedData.chapterId
    const {
      useContext,
      contextChapterCount,
      targetWordCount,
      temperature,
      virtualWriterId,
    } = parsedData

    // 获取项目信息
    const rawProject = await prisma.novelProject.findUnique({
      where: { id: projectIdNum },
      include: {
        aiModelConfig: true,
      },
    })

    if (!rawProject) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: '项目不存在' } },
        { status: 404 }
      )
    }

    // 类型转换
    const project = toProjectDTO(rawProject)

    // 获取章节信息
    const rawChapter = await prisma.novelChapter.findUnique({
      where: { id: chapterId },
      include: {
        virtualWriter: true,
      },
    })

    if (!rawChapter || rawChapter.projectId !== projectIdNum) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: '章节不存在' } },
        { status: 404 }
      )
    }

    const chapter = toChapterDTO(rawChapter)

    // 获取前文章节
    const previousChapters = await prisma.novelChapter.findMany({
      where: {
        projectId: projectIdNum,
        id: { not: chapterId },
        status: { in: ['COMPLETED', 'REVIEWING'] },
        content: { not: null },
      },
      orderBy: { chapterNumber: 'asc' },
    })

    // 构建提示词上下文
    const memoryPack = await buildChapterMemoryPack(projectIdNum, chapter.chapterNumber, {
      recentChapterCount: contextChapterCount,
      recentVolumeCount: 2,
      characterLimit: 10,
      plotlineLimit: 10,
      researchLimit: 3,
    })
    const context = await buildPromptContext(
      project,
      chapter,
      previousChapters.map(toChapterDTO),
      {
        useContext,
        contextChapterCount,
        includeStageOutline: true,
        memoryContext: memoryPack.writerContext,
      }
    )

    // 构建完整提示词
    const prompt = buildNovelGenerationPrompt(context, {
      useContext,
      contextChapterCount,
      targetWordCount,
      includeStageOutline: true,
    })

    // 保存生成参数
    const generationParams = {
      useContext,
      contextChapterCount,
      targetWordCount,
      temperature,
      virtualWriterId,
    }

    // 更新章节状态为生成中
    await prisma.novelChapter.update({
      where: { id: chapterId },
      data: {
        status: 'GENERATING',
        generationPrompt: prompt,
        generationParams: generationParams as unknown as object,
        generationCount: { increment: 1 },
        lastGeneratedTime: new Date(),
      },
    })

    // 创建 SSE 流式响应
    const encoder = new TextEncoder()
    let clientClosed = false
    request.signal.addEventListener('abort', () => {
      clientClosed = true
    })

    const stream = new ReadableStream({
      async start(controller) {
        const sendEvent = (event: string, data: Record<string, unknown>) => {
          if (clientClosed) return
          const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
          controller.enqueue(encoder.encode(message))
        }

        try {
          // 发送开始事件
          sendEvent('start', { chapterId, status: 'generating' })

          const provider = await AIService.createProvider({
            projectId: projectIdNum,
            usageType: 'CHAPTER_STREAM',
            speedMode: 'FINAL_POLISH',
            generationRole: 'stream',
          })

          let fullContent = ''
          let wordCount = 0

          // 流式生成
          for await (const token of provider.generateStream(prompt, {
            temperature,
            maxTokens: estimateMaxTokensForTargetWordCount(targetWordCount),
          })) {
            if (clientClosed) {
              break
            }

            fullContent += token

            // 实时计算字数
            wordCount = countChineseWords(fullContent)

            // 发送 token 事件
            sendEvent('token', { content: token })

            // 每累计 50 字发送一次字数更新
            if (wordCount % 50 === 0) {
              sendEvent('wordCount', { count: wordCount })
            }

            // 超过目标 110% 则停止
            if (wordCount >= targetWordCount * 1.1) {
              break
            }
          }

          if (clientClosed) {
            await prisma.novelChapter.update({
              where: { id: chapterId },
              data: { status: 'DRAFT' },
            })
            return
          }

          // 最终字数
          wordCount = countChineseWords(fullContent)
          sendEvent('wordCount', { count: wordCount })

          // 解析标题和内容
          let extractedTitle: string | undefined
          let extractedContent = fullContent
          
          const titleMatch = fullContent.match(/^标题：(.+)$/m)
          const contentMatch = fullContent.match(/^内容：$\s*([\s\S]*)$/m)
          
          if (titleMatch && contentMatch) {
            let aiTitle = titleMatch[1].trim()
            aiTitle = aiTitle.replace(/^第\d+章\s*/, '')
            extractedTitle = aiTitle
            extractedContent = contentMatch[1].trim()
            wordCount = countChineseWords(extractedContent)
          }

          const minimumWordCount = getMinimumChapterWordCount(targetWordCount, chapter.chapterNumber)
          const chapterReady = isChapterWordCountSufficient(wordCount, targetWordCount, chapter.chapterNumber)
          await recordAndApplyChapterCommit(projectIdNum as number, chapterId as number, {
            chapterNo: chapter.chapterNumber,
            chapterTitle: extractedTitle || chapter.title,
            content: extractedContent,
            qualityStatus: chapterReady ? 'completed' : 'reviewing',
            warning: chapterReady ? undefined : buildChapterWordCountWarning(wordCount, targetWordCount, chapter.chapterNumber),
            targetWordCount,
            currentWordCount: wordCount,
            agentType: 'WRITER',
            emittedAt: new Date().toISOString(),
          }, 'generate-stream')

          // 发送完成事件
          sendEvent('done', {
            chapterId,
            content: extractedContent,
            title: extractedTitle || undefined,
            wordCount,
            minimumWordCount,
            qualityStatus: chapterReady ? 'completed' : 'reviewing',
            warning: chapterReady ? undefined : buildChapterWordCountWarning(wordCount, targetWordCount, chapter.chapterNumber),
            status: chapterReady ? 'completed' : 'reviewing',
          })
        } catch (error) {
          logError(error instanceof Error ? error : new Error(String(error)), { type: 'sse_generation', chapterId })

          // 恢复章节状态
          await prisma.novelChapter.update({
            where: { id: chapterId },
            data: { status: 'DRAFT' },
          })

          sendEvent('error', {
            message: error instanceof Error ? error.message : '生成失败',
          })
        } finally {
          try {
            controller.close()
          } catch {}
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
        { success: false, error: { code: 'VALIDATION_ERROR', message: error.issues[0]?.message || '验证失败' } },
        { status: 400 }
      )
    }
    logError(error instanceof Error ? error : new Error(String(error)), { type: 'stream_generate', projectId: projectIdNum, chapterId })
    return NextResponse.json(
      { success: false, error: { code: 'GENERATE_ERROR', message: '生成失败' } },
      { status: 500 }
    )
  }
}
