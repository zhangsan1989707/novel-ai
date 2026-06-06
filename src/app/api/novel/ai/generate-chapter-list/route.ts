import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createProviderFromEnv, createProviderFromConfigId, createProviderFromDefaultConfig } from '@/lib/ai'
import { AIVendor } from '@/types'
import { prisma } from '@/lib/prisma'
import { buildChapterListPrompt, buildSummaryCompletionPrompt } from '@/lib/ai/prompts'
import { logError } from '@/lib/logger'
import { requireProjectOwner, projectNotFoundResponse } from '@/lib/server/project-access'

const vendorEnum = z.enum(['OPENAI', 'ANTHROPIC', 'ALIBABA', 'DEEPSEEK', 'MINIMAX', 'VOLCENGINE', 'ZHIPU'])

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
  existingChapters: z.array(z.object({
    chapterNumber: z.number().int().positive(),
    title: z.string(),
    summary: z.string(),
  })).optional(),
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
      vendor: requestedVendor,
      temperature,
    } = generateChapterListSchema.parse(body)

    // 如果有项目ID，校验所有权
    if (projectId) {
      const projectAccess = await requireProjectOwner(projectId)
      if (!projectAccess) {
        return projectNotFoundResponse()
      }
    }

    // 如果有项目ID，从数据库获取大纲（尝试获取，但失败了也不中断）
    let dbOutline = outline
    let dbOutlineStages = outlineStages

    if (projectId) {
      try {
        const project = await prisma.novelProject.findUnique({
          where: { id: projectId },
          select: { outline: true, outlineStages: true },
        })
        
        if (project) {
          if (!dbOutline) dbOutline = project.outline ?? undefined
          if (!dbOutlineStages) dbOutlineStages = project.outlineStages ?? undefined
        }
      } catch {
        // 数据库操作失败，继续使用传入的参数
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
      existingChapters: body.existingChapters,
    })

    let provider
    if (aiModelId) {
      const configProvider = await createProviderFromConfigId(aiModelId)
      if (configProvider) {
        provider = configProvider
      } else if (requestedVendor) {
        provider = createProviderFromEnv(requestedVendor as AIVendor)
      } else {
        provider = await createProviderFromDefaultConfig()
      }
    } else if (requestedVendor) {
      provider = createProviderFromEnv(requestedVendor as AIVendor)
    } else {
      provider = await createProviderFromDefaultConfig()
    }

    const estimatedTokens = Math.min(totalChapters * 300 + 1000, 65536)
    const result = await provider.generate(prompt, { temperature, maxTokens: estimatedTokens, timeoutMs: 120000 })

    let chapterList = null
    let parseError = null
    try {
      const jsonMatch = result.content.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const cleaned = jsonMatch[0]
          .replace(/,\s*([\]}])/g, '$1')
        chapterList = JSON.parse(cleaned)

        if (chapterList?.chapters && Array.isArray(chapterList.chapters)) {
          const generatedCount = chapterList.chapters.length
          const existingCount = body.existingChapters?.length || 0
          const expectedCount = existingCount > 0 ? totalChapters - existingCount : totalChapters
          if (generatedCount !== expectedCount) {
            console.warn(
              `[generate-chapter-list] 警告：期望 ${expectedCount} 章，AI 返回 ${generatedCount} 章，将自动截取/补足`
            )
            if (generatedCount > expectedCount) {
              chapterList.chapters = chapterList.chapters.slice(0, expectedCount)
            }
            if (generatedCount < expectedCount) {
              parseError = `AI 只生成了 ${generatedCount} 章，少于要求的 ${expectedCount} 章`
            }
          }

          let missingSummaryCount = 0
          for (let i = 0; i < chapterList.chapters.length; i++) {
            const ch = chapterList.chapters[i]
            if (!ch.summary || typeof ch.summary !== 'string' || ch.summary.trim() === '') {
              missingSummaryCount++
            }
          }

          if (missingSummaryCount > 0) {
            const summaryPrompt = buildSummaryCompletionPrompt(chapterList.chapters, projectTitle, genre)
            try {
              const summaryResult = await provider.generate(summaryPrompt, { temperature: 0.5 })
              const summaryMatch = summaryResult.content.match(/\{[\s\S]*\}/)
              if (summaryMatch) {
                const cleaned = summaryMatch[0].replace(/,\s*([\]}])/g, '$1')
                const summaryData = JSON.parse(cleaned)
                if (summaryData.summaries && Array.isArray(summaryData.summaries)) {
                  const chapterMap = new Map<number, number>()
                  for (let i = 0; i < chapterList.chapters.length; i++) {
                    chapterMap.set(chapterList.chapters[i].chapterNumber, i)
                  }
                  for (const item of summaryData.summaries) {
                    const chNum = item.chapterNumber || item.index + 1
                    const idx = chapterMap.get(chNum)
                    if (idx !== undefined && item.summary && typeof item.summary === 'string' && item.summary.trim()) {
                      chapterList.chapters[idx].summary = item.summary
                    }
                  }
                  missingSummaryCount = 0
                  for (const ch of chapterList.chapters) {
                    if (!ch.summary || ch.summary.trim() === '') missingSummaryCount++
                  }
                }
              }
            } catch (e) {
              console.warn('[generate-chapter-list] Summary completion failed:', e)
            }

            if (missingSummaryCount > 0) {
              for (let i = 0; i < chapterList.chapters.length; i++) {
                const ch = chapterList.chapters[i]
                if (!ch.summary || !ch.summary.trim()) {
                  ch.summary = ch.title || `第${ch.chapterNumber}章`
                }
              }
              const summaryWarning = `有 ${missingSummaryCount} 个章节AI未生成概要，已用标题作为占位`
              parseError = parseError ? `${parseError}；${summaryWarning}` : summaryWarning
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
