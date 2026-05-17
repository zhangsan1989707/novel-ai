import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { getAIProvider, buildPromptContext, buildNovelGenerationPrompt, createProviderFromDefaultConfig } from '@/lib/ai'
import { countChineseWords } from '@/lib/utils'
import { AIVendor, ChapterStatus } from '@/types'
import { logError } from '@/lib/logger'
import { toProjectDTO, toChapterDTO } from '@/types/dto'

// ============================================
// Schema 验证
// ============================================

const batchGenerateSchema = z.object({
  chapterIds: z.array(z.number().int().positive()).optional(), // 空表示全部待生成章节
  useContext: z.boolean().default(true),
  contextChapterCount: z.number().int().min(1).max(10).default(3),
  targetWordCount: z.number().int().positive().default(3000),
  temperature: z.number().min(0).max(2).default(0.7),
})

// ============================================
// API Handler
// ============================================

interface RouteParams {
  params: Promise<{ projectId: string }>
}

/**
 * POST /api/novel/projects/{projectId}/generate/batch
 * SSE 批量流式生成章节内容
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
      chapterIds,
      useContext,
      contextChapterCount,
      targetWordCount,
      temperature,
    } = batchGenerateSchema.parse(body)

    // 获取项目信息
    const rawProject = await prisma.novelProject.findUnique({
      where: { id: projectIdNum },
      include: {
        aiModelConfig: true,
        chapters: {
          where: chapterIds ? { id: { in: chapterIds } } : undefined,
          orderBy: { chapterNumber: 'asc' },
        },
      },
    })

    if (!rawProject) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: '项目不存在' } },
        { status: 404 }
      )
    }

    // 确定要生成的章节列表
    let chaptersToGenerate = rawProject.chapters

    // 如果没有指定章节，获取所有待生成章节
    if (!chapterIds || chapterIds.length === 0) {
      chaptersToGenerate = await prisma.novelChapter.findMany({
        where: {
          projectId: projectIdNum,
          status: { not: 'GENERATING' }, // 排除正在生成的
          OR: [
            { content: null },
            { wordCount: 0 },
          ],
        },
        orderBy: { chapterNumber: 'asc' },
      })
    }

    if (chaptersToGenerate.length === 0) {
      return NextResponse.json(
        { success: false, error: { code: 'NO_CHAPTERS', message: '没有待生成的章节' } },
        { status: 400 }
      )
    }

    // 类型转换
    const project = toProjectDTO(rawProject)

    // 创建 SSE 流式响应
    const encoder = new TextEncoder()

    const stream = new ReadableStream({
      async start(controller) {
        const sendEvent = (event: string, data: Record<string, unknown>) => {
          const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
          controller.enqueue(encoder.encode(message))
        }

        const writeAgentLog = async (
          chapterNo: number,
          status: 'START' | 'DONE' | 'FAILED',
          data?: {
            inputPrompt?: string
            outputContent?: string
            errorMessage?: string
            tokenCount?: number
            durationMs?: number
          }
        ) => {
          try {
            await prisma.agentLog.create({
              data: {
                projectId: projectIdNum,
                chapterNo,
                agentType: 'WRITER',
                status,
                inputPrompt: data?.inputPrompt,
                outputContent: data?.outputContent,
                errorMessage: data?.errorMessage,
                tokenCount: data?.tokenCount,
                durationMs: data?.durationMs,
              },
            })
          } catch (agentLogError) {
            console.warn('[batch-generate] Failed to write agent log:', agentLogError)
          }
        }

        let successCount = 0
        let failCount = 0

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

        // 发送开始事件
        sendEvent('start', {
          totalChapters: chaptersToGenerate.length,
          firstChapterId: chaptersToGenerate[0].id,
        })
        await writeAgentLog(0, 'START', {
          outputContent: `批量生成开始，共 ${chaptersToGenerate.length} 章`,
        })

        // 按顺序处理每个章节
        for (let i = 0; i < chaptersToGenerate.length; i++) {
          const chapter = chaptersToGenerate[i]
          const chapterStartTime = Date.now()

          // 发送章节开始事件
          sendEvent('chapter_start', {
            chapterId: chapter.id,
            chapterNumber: chapter.chapterNumber,
            title: chapter.title,
            index: i,
            total: chaptersToGenerate.length,
          })

          // 更新章节状态为生成中
          await prisma.novelChapter.update({
            where: { id: chapter.id },
            data: {
              status: ChapterStatus.GENERATING,
              lastGeneratedTime: new Date(),
            },
          })

          try {
            // 获取前文章节（用于上下文）
            const previousChapters = await prisma.novelChapter.findMany({
              where: {
                projectId: projectIdNum,
                id: { not: chapter.id },
                chapterNumber: { lt: chapter.chapterNumber },
                status: { in: ['COMPLETED', 'REVIEWING'] },
                content: { not: null },
              },
              orderBy: { chapterNumber: 'asc' },
              take: contextChapterCount,
            })

            // 构建提示词上下文
            const chapterData = toChapterDTO(chapter)

            const context = await buildPromptContext(
              project,
              chapterData,
              previousChapters.map(toChapterDTO),
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

            // 保存生成提示词
            await prisma.novelChapter.update({
              where: { id: chapter.id },
              data: { generationPrompt: prompt },
            })
            await writeAgentLog(chapter.chapterNumber, 'START', {
              inputPrompt: prompt,
            })

            let fullContent = ''
            let wordCount = 0

            // 流式生成
            for await (const token of provider.generateStream(prompt, { temperature })) {
              fullContent += token
              wordCount = countChineseWords(fullContent)

              // 发送 token 事件
              sendEvent('token', {
                content: token,
                chapterId: chapter.id,
              })

              // 每累计 50 字发送一次字数更新
              if (wordCount % 50 === 0) {
                sendEvent('wordCount', {
                  count: wordCount,
                  chapterId: chapter.id,
                })
              }

              // 超过目标 110% 则停止
              if (wordCount >= targetWordCount * 1.1) {
                break
              }
            }

            // 最终字数
            wordCount = countChineseWords(fullContent)

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

            // 保存生成内容
            const oldWordCount = chapter.content?.length || 0
            const wordCountDiff = wordCount - oldWordCount

            const updateData: Record<string, unknown> = {
              content: extractedContent,
              wordCount,
              status: ChapterStatus.COMPLETED,
              generationCount: { increment: 1 },
            }
            if (extractedTitle) {
              updateData.title = extractedTitle
            }

            await prisma.novelChapter.update({
              where: { id: chapter.id },
              data: updateData,
            })
            await writeAgentLog(chapter.chapterNumber, 'DONE', {
              inputPrompt: prompt,
              outputContent: extractedContent.slice(0, 10000),
              tokenCount: wordCount,
              durationMs: Date.now() - chapterStartTime,
            })

            // 更新项目总字数
            if (wordCountDiff !== 0) {
              await prisma.novelProject.update({
                where: { id: projectIdNum },
                data: {
                  currentWordCount: { increment: wordCountDiff },
                  status: 'WRITING',
                },
              })
            }

            // 发送章节完成事件
            sendEvent('chapter_done', {
              chapterId: chapter.id,
              wordCount,
              index: i,
              total: chaptersToGenerate.length,
            })

            successCount++
          } catch (error) {
            logError(error instanceof Error ? error : new Error(String(error)), { type: 'generate_chapter', chapterId: chapter.id, projectId: projectIdNum })

            // 恢复章节状态为 DRAFT
            await prisma.novelChapter.update({
              where: { id: chapter.id },
              data: {
                status: ChapterStatus.DRAFT,
                generationCount: { increment: 1 },
              },
            })
            await writeAgentLog(chapter.chapterNumber, 'FAILED', {
              errorMessage: error instanceof Error ? error.message : '生成失败',
              durationMs: Date.now() - chapterStartTime,
            })

            // 发送章节错误事件
            sendEvent('chapter_error', {
              chapterId: chapter.id,
              error: error instanceof Error ? error.message : '生成失败',
              index: i,
              total: chaptersToGenerate.length,
            })

            failCount++

            // 自动跳过，继续下一章
            continue
          }
        }

        // 发送全部完成事件
        sendEvent('done', {
          successCount,
          failCount,
          total: chaptersToGenerate.length,
        })
        await writeAgentLog(0, failCount > 0 ? 'FAILED' : 'DONE', {
          outputContent: `批量生成完成：成功 ${successCount} 章，失败 ${failCount} 章`,
        })

        controller.close()
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
    logError(error instanceof Error ? error : new Error(String(error)), { type: 'batch_generate' })
    return NextResponse.json(
      { success: false, error: { code: 'BATCH_GENERATE_ERROR', message: '批量生成失败' } },
      { status: 500 }
    )
  }
}
