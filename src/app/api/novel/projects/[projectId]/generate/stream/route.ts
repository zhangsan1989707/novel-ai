import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { getAIProvider, buildPromptContext, buildNovelGenerationPrompt, createProviderFromDefaultConfig } from '@/lib/ai'
import { countChineseWords } from '@/lib/utils'
import { AIVendor } from '@/types'

// ============================================
// Schema 验证
// ============================================

const generateSchema = z.object({
  chapterId: z.number().int().positive(),
  useContext: z.boolean().default(true),
  contextChapterCount: z.number().int().min(1).max(10).default(3),
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
  const { projectId } = await params
  const projectIdNum = parseInt(projectId)

  if (isNaN(projectIdNum)) {
    return NextResponse.json(
      { success: false, error: { code: 'INVALID_ID', message: '无效的项目ID' } },
      { status: 400 }
    )
  }

  try {
    const body = await request.json()
    const {
      chapterId,
      useContext,
      contextChapterCount,
      targetWordCount,
      temperature,
      virtualWriterId,
    } = generateSchema.parse(body)

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

    // 类型转换：处理 null vs undefined，并使用类型断言
    const project = {
      ...rawProject,
      description: rawProject.description || undefined,
      genre: rawProject.genre || undefined,
      writingStyle: rawProject.writingStyle || undefined,
      outline: rawProject.outline || undefined,
      worldSetting: rawProject.worldSetting || undefined,
      powerSystem: rawProject.powerSystem || undefined,
      protagonistProfile: rawProject.protagonistProfile || undefined,
      protagonistGoal: rawProject.protagonistGoal || undefined,
      antagonistSetting: rawProject.antagonistSetting || undefined,
      endingPlan: rawProject.endingPlan || undefined,
      writingPrompt: rawProject.writingPrompt || undefined,
      coverImage: rawProject.coverImage || undefined,
      targetWordCount: rawProject.targetWordCount ?? undefined,
      outlineStages: rawProject.outlineStages ?? undefined,
    } as unknown as Parameters<typeof buildPromptContext>[0]

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

    const chapter = {
      ...rawChapter,
      summary: rawChapter.summary || undefined,
      content: rawChapter.content || undefined,
      generationPrompt: rawChapter.generationPrompt || undefined,
    } as unknown as Parameters<typeof buildPromptContext>[1]

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
    const context = await buildPromptContext(
      project,
      chapter,
      previousChapters as unknown as Parameters<typeof buildPromptContext>[2],
      {
        useContext,
        contextChapterCount,
        includeStageOutline: true,
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

    const stream = new ReadableStream({
      async start(controller) {
        const sendEvent = (event: string, data: Record<string, unknown>) => {
          const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
          controller.enqueue(encoder.encode(message))
        }

        try {
          // 发送开始事件
          sendEvent('start', { chapterId, status: 'generating' })

          // 获取 AI Provider
          let provider
          if (project.aiModelConfig) {
            provider = getAIProvider(project.aiModelConfig.vendor as AIVendor, {
              vendor: project.aiModelConfig.vendor as AIVendor,
              modelId: project.aiModelConfig.modelId,
              apiKey: project.aiModelConfig.apiKey || '',
              apiEndpoint: project.aiModelConfig.apiEndpoint || undefined,
            })
          } else {
            // 使用默认配置（从数据库）
            provider = await createProviderFromDefaultConfig()
          }

          let fullContent = ''
          let wordCount = 0

          // 流式生成
          for await (const token of provider.generateStream(prompt, { temperature })) {
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

          // 最终字数
          wordCount = countChineseWords(fullContent)
          sendEvent('wordCount', { count: wordCount })

          // 保存生成内容
          const oldWordCount = chapter.content?.length || 0
          const wordCountDiff = wordCount - oldWordCount

          await prisma.novelChapter.update({
            where: { id: chapterId },
            data: {
              content: fullContent,
              wordCount,
              status: 'COMPLETED',
            },
          })

          // 更新项目总字数
          if (wordCountDiff !== 0) {
            await prisma.novelProject.update({
              where: { id: projectIdNum },
              data: {
                currentWordCount: { increment: wordCountDiff },
              },
            })
          }

          // 发送完成事件
          sendEvent('done', {
            chapterId,
            wordCount,
            status: 'completed',
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
        { success: false, error: { code: 'VALIDATION_ERROR', message: error.issues[0]?.message || '验证失败' } },
        { status: 400 }
      )
    }
    logError(error instanceof Error ? error : new Error(String(error)), { type: $1 })
    return NextResponse.json(
      { success: false, error: { code: 'GENERATE_ERROR', message: '生成失败' } },
      { status: 500 }
    )
  }
}
