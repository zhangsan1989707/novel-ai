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
})

// ============================================
// API Handler
// ============================================

interface RouteParams {
  params: Promise<{ projectId: string }>
}

/**
 * POST /api/novel/projects/{projectId}/generate
 * 非流式生成章节内容
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

    // 更新章节状态
    await prisma.novelChapter.update({
      where: { id: chapterId },
      data: {
        status: 'GENERATING',
        generationPrompt: prompt,
        generationCount: { increment: 1 },
        lastGeneratedTime: new Date(),
      },
    })

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

    // 非流式生成
    const result = await provider.generate(prompt, { temperature })
    const wordCount = countChineseWords(result.content)

    // 保存生成内容
    const oldWordCount = chapter.content?.length || 0
    const wordCountDiff = wordCount - oldWordCount

    await prisma.novelChapter.update({
      where: { id: chapterId },
      data: {
        content: result.content,
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

    return NextResponse.json({
      success: true,
      data: {
        chapterId,
        content: result.content,
        wordCount,
        usage: result.usage,
      },
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: error.issues[0]?.message || '验证失败' } },
        { status: 400 }
      )
    }
    console.error('生成失败:', error)
    return NextResponse.json(
      { success: false, error: { code: 'GENERATE_ERROR', message: '生成失败' } },
      { status: 500 }
    )
  }
}
