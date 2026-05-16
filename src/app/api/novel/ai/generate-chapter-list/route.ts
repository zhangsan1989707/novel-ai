import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createProviderFromDefaultConfig, getAIProvider } from '@/lib/ai'
import { AIVendor } from '@/types'
import { prisma } from '@/lib/prisma'
import { buildChapterListPrompt } from '@/lib/ai/prompts'
import { logError } from '@/lib/logger'

const vendorEnum = z.enum(['OPENAI', 'ANTHROPIC', 'ALIBABA', 'DEEPSEEK', 'MINIMAX', 'VOLCENGINE'])

const generateChapterListSchema = z.object({
  projectTitle: z.string().min(1, '请输入小说标题'),
  projectId: z.number().int().positive().optional(),
  genre: z.string().optional(),
  writingStyle: z.string().optional(),
  worldSetting: z.string().optional(),
  protagonistProfile: z.string().optional(),
  protagonistGoal: z.string().optional(),
  antagonistSetting: z.string().optional(),
  endingPlan: z.string().optional(),
  outline: z.string().optional(),
  outlineStages: z.any().optional(),
  totalChapters: z.number().int().positive().max(500).default(50),
  titleStyle: z.enum(['webnovel', 'traditional', 'poetry']).default('webnovel'),
  aiModelId: z.number().int().positive().optional(),
  vendor: vendorEnum.default('DEEPSEEK'),
  temperature: z.number().min(0).max(2).default(0.7),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      projectTitle,
      projectId,
      genre,
      writingStyle,
      worldSetting,
      protagonistProfile,
      protagonistGoal,
      antagonistSetting,
      endingPlan,
      outline,
      outlineStages,
      totalChapters,
      titleStyle,
      aiModelId,
      vendor,
      temperature,
    } = generateChapterListSchema.parse(body)

    // 如果有项目ID，从数据库获取大纲
    let dbOutline = outline
    let dbOutlineStages = outlineStages
    
    if (projectId) {
      const project = await prisma.novelProject.findUnique({
        where: { id: projectId },
        select: { outline: true, outlineStages: true },
      })
      
      if (project) {
        // 如果传入的没有大纲，使用数据库中的
        if (!dbOutline) dbOutline = project.outline
        if (!dbOutlineStages) dbOutlineStages = project.outlineStages
      }
    }

    const prompt = buildChapterListPrompt({
      projectTitle,
      genre,
      writingStyle,
      worldSetting,
      protagonistProfile,
      protagonistGoal,
      antagonistSetting,
      endingPlan,
      totalChapters,
      titleStyle,
      outline: dbOutline,
      outlineStages: dbOutlineStages,
    })

    let provider
    let configError = ''

    if (aiModelId) {
      const config = await prisma.aIModelConfig.findUnique({
        where: { id: aiModelId },
      })
      if (config && config.apiKey && config.apiKey !== 'your-api-key-placeholder') {
        provider = getAIProvider(config.vendor as AIVendor, {
          vendor: config.vendor as AIVendor,
          modelId: config.modelId,
          apiKey: config.apiKey,
          apiEndpoint: config.apiEndpoint || undefined,
        })
      } else {
        configError = 'AI模型配置无效或未设置API密钥'
        provider = await createProviderFromDefaultConfig()
      }
    } else {
      provider = await createProviderFromDefaultConfig()
    }

    if (configError) {
      return NextResponse.json(
        { success: false, error: { code: 'CONFIG_ERROR', message: configError } },
        { status: 400 }
      )
    }

    const result = await provider.generate(prompt, { temperature })

    let chapterList = null
    let parseError = null
    try {
      const jsonMatch = result.content.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        // 清理 AI 常见的 JSON 格式问题（尾随逗号）
        const cleaned = jsonMatch[0]
          .replace(/,\s*([\]}])/g, '$1')
        chapterList = JSON.parse(cleaned)

        // 验证章节数量是否与请求的一致
        if (chapterList?.chapters && Array.isArray(chapterList.chapters)) {
          const generatedCount = chapterList.chapters.length
          if (generatedCount !== totalChapters) {
            console.warn(
              `[generate-chapter-list] 警告：请求 ${totalChapters} 章，AI 返回 ${generatedCount} 章，将自动截取/补足`
            )
            // 如果 AI 返回的章节数量不对，截取或记录
            if (generatedCount > totalChapters) {
              // 截取多余的章节
              chapterList.chapters = chapterList.chapters.slice(0, totalChapters)
            }
            // 如果少于要求，标记为解析问题
            if (generatedCount < totalChapters) {
              parseError = `AI 只生成了 ${generatedCount} 章，少于要求的 ${totalChapters} 章`
            }
          }
        }
      }
    } catch (e) {
      parseError = `JSON 解析失败: ${e instanceof Error ? e.message : String(e)}`
      chapterList = null
    }

    return NextResponse.json({
      success: true,
      data: {
        content: result.content,
        chapterList,
        usage: result.usage,
      },
      warning: parseError || undefined,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: error.issues[0]?.message || '验证失败' } },
        { status: 400 }
      )
    }
    logError(error instanceof Error ? error : new Error(String(error)), { type: 'generate_chapter_list' })
    return NextResponse.json(
      { success: false, error: { code: 'GENERATE_ERROR', message: '生成章节列表失败' } },
      { status: 500 }
    )
  }
}
