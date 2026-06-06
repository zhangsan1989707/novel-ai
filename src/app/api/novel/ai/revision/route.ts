import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { getAIProvider, buildPromptContext, buildRevisionPrompt, createProviderFromDefaultConfig } from '@/lib/ai'
import { buildChapterMemoryPack } from '@/lib/memory'
import { countChineseWords } from '@/lib/utils'
import { AIVendor } from '@/types'
import { logError } from '@/lib/logger'
import { toProjectDTO, toChapterDTO } from '@/types/dto'
import { requireProjectOwner, projectNotFoundResponse } from '@/lib/server/project-access'

// ============================================
// Schema 验证
// ============================================

const revisionSchema = z.object({
  projectId: z.number().int().positive(),
  chapterId: z.number().int().positive(),
  revisionType: z.enum(['rewrite', 'continue', 'expand', 'condense', 'polish']),
  currentContent: z.string().min(1),
  suggestion: z.string().optional(),
  useContext: z.boolean().default(true),
  contextChapterCount: z.number().int().min(1).max(10).default(3),
  temperature: z.number().min(0).max(2).default(0.7),
  targetWordCount: z.number().int().positive().default(3000),
  aiModelId: z.number().int().positive().optional(),
})

type RevisionType = 'rewrite' | 'continue' | 'expand' | 'condense' | 'polish'

// ============================================
// API Handler
// ============================================

/**
 * POST /api/novel/ai/revision
 * 改稿功能 - SSE 流式返回
 */
export async function POST(request: NextRequest) {
  let projectId: number | null = null
  let chapterId: number | null = null
  try {
    const body = await request.json()
    const parsed = revisionSchema.parse(body)
    projectId = parsed.projectId
    chapterId = parsed.chapterId
    const {
      revisionType,
      currentContent,
      suggestion,
      useContext,
      contextChapterCount,
      temperature,
      targetWordCount,
      aiModelId,
    } = parsed

    // 项目所有权校验
    const projectAccess = await requireProjectOwner(projectId)
    if (!projectAccess) {
      return projectNotFoundResponse()
    }

    // 获取项目信息
    const rawProject = await prisma.novelProject.findUnique({
      where: { id: projectId },
      include: { aiModelConfig: true },
    })

    if (!rawProject) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: '项目不存在' } },
        { status: 404 }
      )
    }

    const project = toProjectDTO(rawProject)

    // 获取章节信息
    const rawChapter = await prisma.novelChapter.findUnique({
      where: { id: chapterId },
    })

    if (!rawChapter || rawChapter.projectId !== projectId) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: '章节不存在' } },
        { status: 404 }
      )
    }

    const chapter = toChapterDTO(rawChapter)

    // 获取前文章节（用于上下文）
    const previousChapters = useContext
      ? await prisma.novelChapter.findMany({
          where: {
            projectId,
            id: { not: chapterId },
            status: { in: ['COMPLETED', 'REVIEWING'] },
            content: { not: null },
          },
          orderBy: { chapterNumber: 'asc' },
        })
      : []

    const memoryPack = await buildChapterMemoryPack(projectId, chapter.chapterNumber, {
      recentChapterCount: Math.max(3, contextChapterCount),
      recentVolumeCount: 2,
      characterLimit: 10,
      plotlineLimit: 10,
      researchLimit: 3,
    })
    // 构建提示词上下文
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

    // 构建改稿提示词
    const prompt = buildRevisionPrompt(context, currentContent, revisionType, suggestion)

    // 获取 AI Provider
    let provider
    if (aiModelId) {
      const modelConfig = await prisma.aIModelConfig.findUnique({ where: { id: aiModelId } })
      if (modelConfig) {
        provider = getAIProvider(modelConfig.vendor as AIVendor, {
          vendor: modelConfig.vendor as AIVendor,
          modelId: modelConfig.modelId,
          apiKey: modelConfig.apiKey || '',
          apiEndpoint: modelConfig.apiEndpoint || undefined,
        })
      }
    }

    if (!provider) {
      if (rawProject.aiModelConfig) {
        provider = getAIProvider(rawProject.aiModelConfig.vendor as AIVendor, {
          vendor: rawProject.aiModelConfig.vendor as AIVendor,
          modelId: rawProject.aiModelConfig.modelId,
          apiKey: rawProject.aiModelConfig.apiKey || '',
          apiEndpoint: rawProject.aiModelConfig.apiEndpoint || undefined,
        })
      } else {
        provider = await createProviderFromDefaultConfig()
      }
    }

    // 创建 SSE 流式响应
    const encoder = new TextEncoder()

    const stream = new ReadableStream({
      async start(controller) {
        const sendEvent = (event: string, data: Record<string, unknown>) => {
          const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
          controller.enqueue(encoder.encode(message))
        }

        try {
          sendEvent('start', { chapterId, status: 'revision_start' })

          let fullContent = ''
          let wordCount = 0

          // 流式生成
          for await (const token of provider!.generateStream(prompt, { temperature })) {
            fullContent += token
            wordCount = countChineseWords(fullContent)
            sendEvent('token', { content: token })

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

          // 发送完成事件
          sendEvent('done', {
            chapterId,
            content: fullContent,
            wordCount,
            status: 'completed',
          })
        } catch (error) {
          logError(error instanceof Error ? error : new Error(String(error)), { type: 'revision_stream', chapterId })
          sendEvent('error', {
            message: error instanceof Error ? error.message : '改稿失败',
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
    logError(error instanceof Error ? error : new Error(String(error)), { type: 'revision', chapterId })
    return NextResponse.json(
      { success: false, error: { code: 'REVISION_ERROR', message: '改稿失败' } },
      { status: 500 }
    )
  }
}
