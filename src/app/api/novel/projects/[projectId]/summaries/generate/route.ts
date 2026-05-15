import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createProviderFromDefaultConfig } from '@/lib/ai'
import { saveChapterSummary } from '@/lib/memory/chapter-summary'
import type { ChapterSummaryData } from '@/lib/engine/types'

const BATCH_SIZE = 5 // 每批处理章节数

interface RouteParams {
  params: Promise<{ projectId: string }>
}

/**
 * POST /api/novel/projects/[projectId]/summaries/generate
 * 预生成所有章节摘要（后台异步任务）
 * 返回 SSE 流式进度
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const { projectId } = await params
  const projectIdNum = parseInt(projectId, 10)

  if (isNaN(projectIdNum)) {
    return NextResponse.json(
      { success: false, error: { code: 'INVALID_ID', message: '无效的项目ID' } },
      { status: 400 }
    )
  }

  // 获取项目信息
  const project = await prisma.novelProject.findUnique({
    where: { id: projectIdNum },
    include: {
      chapters: {
        where: {
          status: { in: ['COMPLETED', 'REVIEWING'] },
          content: { not: null },
        },
        orderBy: { chapterNumber: 'asc' },
      },
    },
  })

  if (!project) {
    return NextResponse.json(
      { success: false, error: { code: 'NOT_FOUND', message: '项目不存在' } },
      { status: 404 }
    )
  }

  const chapters = project.chapters
  if (chapters.length === 0) {
    return NextResponse.json(
      { success: false, error: { code: 'NO_CHAPTERS', message: '没有可生成摘要的章节' } },
      { status: 400 }
    )
  }

  // 获取已存在的摘要
  const existingSummaries = await prisma.chapterSummary.findMany({
    where: { projectId: projectIdNum },
    select: { chapterNo: true },
  })
  const existingChapterNos = new Set(existingSummaries.map(s => s.chapterNo))

  // 过滤出需要生成摘要的章节
  const chaptersNeedingSummary = chapters.filter(
    ch => !existingChapterNos.has(ch.chapterNumber)
  )

  if (chaptersNeedingSummary.length === 0) {
    return NextResponse.json({
      success: true,
      message: '所有章节摘要已存在',
      data: {
        total: chapters.length,
        completed: chapters.length,
        remaining: 0,
      },
    })
  }

  // 创建 SSE 流式响应
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      const sendEvent = (event: string, data: Record<string, unknown>) => {
        const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
        controller.enqueue(encoder.encode(message))
      }

      const total = chaptersNeedingSummary.length
      let completed = 0
      let failed = 0

      sendEvent('start', {
          total,
          completed,
          failed,
          message: `开始生成 ${total} 章摘要...`,
        })

        // 获取 AI Provider
        const provider = await createProviderFromDefaultConfig()

        // 分批处理
        for (let i = 0; i < chaptersNeedingSummary.length; i += BATCH_SIZE) {
          const batch = chaptersNeedingSummary.slice(i, i + BATCH_SIZE)
          const batchNum = Math.floor(i / BATCH_SIZE) + 1
          const totalBatches = Math.ceil(total / BATCH_SIZE)

          sendEvent('batch_start', {
            batchNum,
            totalBatches,
            chapters: batch.map(ch => ({ no: ch.chapterNumber, title: ch.title })),
          })

          // 为每章生成摘要
          for (const chapter of batch) {
            try {
              const summaryData = await generateChapterSummary(
                chapter.chapterNumber,
                chapter.title,
                chapter.content || '',
                provider
              )

              // 持久化到数据库
              await saveChapterSummary(projectIdNum, chapter.chapterNumber, summaryData)

              completed++
              sendEvent('chapter_complete', {
                chapterNo: chapter.chapterNumber,
                summary: summaryData.summary.slice(0, 50) + '...',
              })
            } catch (error) {
              failed++
              console.error(`章节 ${chapter.chapterNumber} 摘要生成失败:`, error)
              sendEvent('chapter_error', {
                chapterNo: chapter.chapterNumber,
                error: error instanceof Error ? error.message : '生成失败',
              })
            }
          }

          // 发送批次进度
          sendEvent('batch_complete', {
            batchNum,
            completed,
            total,
            failed,
          })
        }

        // 完成
        sendEvent('done', {
          total,
          completed,
          failed,
          message: failed > 0
            ? `摘要生成完成：成功 ${completed} 章，失败 ${failed} 章`
            : `摘要生成完成：${completed} 章全部成功`,
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
}

/**
 * 生成单章摘要
 */
async function generateChapterSummary(
  chapterNo: number,
  title: string,
  content: string,
  provider: Awaited<ReturnType<typeof createProviderFromDefaultConfig>>
): Promise<ChapterSummaryData> {
  // 截取前 3000 字进行分析
  const truncatedContent = content.slice(0, 3000)
  const truncatedNote = content.length > 3000 ? '\n[内容已截断，只分析前3000字]' : ''

  const prompt = `你是一个专业的小说分析师。请对以下章节进行精准分析，严格按 JSON 格式返回。

章节标题：第${chapterNo}章 "${title}"
章节内容：
${truncatedContent}${truncatedNote}

请返回如下 JSON 结构：
{
  "summary": "本章核心内容摘要，不超过200字",
  "keyEvents": ["关键事件1", "关键事件2", "关键事件3"],
  "emotionalTone": "本章的情感基调，如：紧张、温馨、搞笑等",
  "plantedPlotlines": ["本章埋下的伏笔（如有）"],
  "resolvedPlotlines": ["本章回收的伏笔（如有）"]
}

只返回 JSON，不要输出任何其他内容。`

  const result = await provider.generate(prompt, { temperature: 0.3 })

  // 解析 JSON
  let data: Partial<ChapterSummaryData> = {}
  try {
    const jsonMatch = result.content.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      data = JSON.parse(jsonMatch[0])
    }
  } catch {
    // 解析失败，使用默认结构
  }

  return {
    summary: data.summary || '摘要生成失败',
    keyEvents: data.keyEvents || [],
    emotionalTone: data.emotionalTone || null,
    plantedPlotlines: data.plantedPlotlines || [],
    resolvedPlotlines: data.resolvedPlotlines || [],
  }
}

/**
 * GET /api/novel/projects/[projectId]/summaries/generate
 * 获取摘要生成进度
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const { projectId } = await params
  const projectIdNum = parseInt(projectId, 10)

  if (isNaN(projectIdNum)) {
    return NextResponse.json(
      { success: false, error: { code: 'INVALID_ID', message: '无效的项目ID' } },
      { status: 400 }
    )
  }

  // 获取项目章节总数
  const totalChapters = await prisma.novelChapter.count({
    where: {
      projectId: projectIdNum,
      status: { in: ['COMPLETED', 'REVIEWING'] },
      content: { not: null },
    },
  })

  // 获取已生成的摘要数量
  const summarizedCount = await prisma.chapterSummary.count({
    where: { projectId: projectIdNum },
  })

  return NextResponse.json({
    success: true,
    data: {
      total: totalChapters,
      completed: summarizedCount,
      remaining: Math.max(0, totalChapters - summarizedCount),
      progress: totalChapters > 0 ? Math.round((summarizedCount / totalChapters) * 100) : 0,
    },
  })
}
