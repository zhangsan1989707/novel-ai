import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { createProviderFromDefaultConfig } from '@/lib/ai'
import { logError } from '@/lib/logger'
import { parseAiJsonObject } from '@/lib/engine/ai-json'

const extractMetadataSchema = z.object({
  projectId: z.number().int().positive('请选择有效的项目'),
})

export async function POST(request: NextRequest) {
  let projectId: number | null = null
  try {
    const body = await request.json()
    const parsed = extractMetadataSchema.parse(body)
    projectId = parsed.projectId

    const project = await prisma.novelProject.findUnique({
      where: { id: projectId },
      include: {
        sourceNovel: true,
        chapters: {
          orderBy: { chapterNumber: 'asc' },
          take: 10,
        },
      },
    })

    if (!project) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: '项目不存在' } },
        { status: 404 }
      )
    }

    let contentToAnalyze = ''
    if (project.sourceNovel?.originalText) {
      contentToAnalyze = project.sourceNovel.originalText.slice(0, 20000)
    } else if (project.chapters.length > 0) {
      contentToAnalyze = project.chapters
        .map(ch => ch.content || '')
        .join('\n\n')
        .slice(0, 20000)
    }

    if (!contentToAnalyze) {
      return NextResponse.json(
        { success: false, error: { code: 'NO_CONTENT', message: '没有可分析的内容' } },
        { status: 400 }
      )
    }

    const provider = await createProviderFromDefaultConfig()

    const prompt = `你是一位专业的小说分析师。请阅读以下小说内容，提取其关键元数据。

【小说内容摘要】
${contentToAnalyze.slice(0, 5000)}

【任务】
请分析这部小说，提取以下信息：
1. 小说标题 - 从内容中推断最合适的标题
2. 小说类型 - 例如：玄幻、都市、仙侠、科幻、历史等
3. 写作风格 - 例如：轻松幽默、热血激昂、细腻唯美、黑暗现实等
4. 原著名称 - 如果是同人/改编作品
5. 预估总字数
6. 预估章节数

【输出格式】
请严格按照以下 JSON 格式输出：
{
  "title": "小说标题",
  "genre": "小说类型",
  "writingStyle": "写作风格",
  "sourceName": "原著名称（如无可留空）",
  "estimatedWordCount": 预估总字数（数字）,
  "estimatedChapterCount": 预估章节数（数字）
}

注意：
- 所有字段都是字符串类型，除了 estimatedWordCount 和 estimatedChapterCount 是数字
- 如果无法确定某个字段，使用合理的推测
- 不要输出任何额外文字，只输出 JSON`

    const result = await provider.generate(prompt, { temperature: 0.7 })
    
    const extracted = parseAiJsonObject(result.content) as {
      title?: string
      genre?: string
      writingStyle?: string
      sourceName?: string
      estimatedWordCount?: number
      estimatedChapterCount?: number
    } | null

    if (!extracted) {
      return NextResponse.json({
        success: true,
        data: {
          title: project.title,
          genre: project.genre,
          writingStyle: project.writingStyle,
          sourceName: project.sourceNovel?.sourceName,
          wordCount: project.sourceNovel?.wordCount,
          chapterCount: project.chapters.length,
        },
      })
    }

    const updates: Record<string, unknown> = {}
    if (extracted.title && extracted.title !== project.title) {
      updates.title = extracted.title
    }
    if (extracted.genre) {
      updates.genre = extracted.genre
    }
    if (extracted.writingStyle) {
      updates.writingStyle = extracted.writingStyle
    }

    if (Object.keys(updates).length > 0) {
      await prisma.novelProject.update({
        where: { id: projectId },
        data: updates,
      })
    }

    return NextResponse.json({
      success: true,
      data: {
        title: extracted.title || project.title,
        genre: extracted.genre || project.genre,
        writingStyle: extracted.writingStyle || project.writingStyle,
        sourceName: extracted.sourceName || project.sourceNovel?.sourceName,
        wordCount: extracted.estimatedWordCount || project.sourceNovel?.wordCount,
        chapterCount: extracted.estimatedChapterCount || project.chapters.length,
      },
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: error.issues[0]?.message || '验证失败' } },
        { status: 400 }
      )
    }
    logError(error instanceof Error ? error : new Error(String(error)), { type: 'extract_metadata', projectId })
    return NextResponse.json(
      { success: false, error: { code: 'EXTRACT_ERROR', message: '元数据提取失败' } },
      { status: 500 }
    )
  }
}
