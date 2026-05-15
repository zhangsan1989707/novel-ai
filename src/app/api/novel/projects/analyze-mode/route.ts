import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { ProjectMode } from '@/types'
import { logError } from '@/lib/logger'

// ============================================
// Schema 验证
// ============================================

const analyzeModeSchema = z.object({
  title: z.string().min(1, '标题不能为空').max(200),
  description: z.string().optional(),
  genre: z.string().optional(),
  writingStyle: z.string().optional(),
  targetWordCount: z.coerce.number().int().positive().optional(),
  chapterWordCount: z.coerce.number().int().positive().default(3000),
  totalVolumes: z.coerce.number().int().min(1).max(10).default(4),
  aiModelId: z.coerce.number().int().positive().optional(),
  // 拆解模式特有字段
  sourceName: z.string().optional(),
  originalText: z.string().min(1, '请提供小说文本内容').optional(),
})

// ============================================
// API Handler
// ============================================

/**
 * POST /api/novel/projects/analyze-mode
 * 创建拆解模式项目
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      title,
      description,
      genre,
      writingStyle,
      targetWordCount,
      chapterWordCount,
      totalVolumes,
      aiModelId,
      sourceName,
      originalText,
    } = analyzeModeSchema.parse(body)

    // 确保用户存在
    let creatorId = 1
    const user = await prisma.user.findUnique({ where: { id: creatorId } })
    if (!user) {
      const newUser = await prisma.user.create({
        data: {
          email: 'dev@example.com',
          name: '开发者',
          password: 'hashed_password_placeholder',
        },
      })
      creatorId = newUser.id
    }

    // 字数统计（originalText 可能为空，如果文件已通过 upload API 上传）
    const wordCount = originalText ? originalText.replace(/\s/g, '').length : 0

    // 创建项目（拆解模式）
    const project = await prisma.novelProject.create({
      data: {
        title,
        description: description || `拆解自《${sourceName || '未知来源'}》`,
        genre,
        writingStyle,
        targetWordCount,
        chapterWordCount,
        totalVolumes,
        aiModelId,
        projectMode: ProjectMode.ANALYZE,
        creatorId,
        // 拆解模式不需要大纲
        outline: `【拆解分析】

来源：${sourceName || '未知'}
字数：${wordCount.toLocaleString()} 字

本项目为拆解分析项目，用于分析小说结构，为后续续写做准备。
`,
      },
      include: {
        aiModelConfig: true,
      },
    })

    // 保存原始小说文本（如果提供了文本内容）
    if (originalText) {
      await prisma.sourceNovel.create({
        data: {
          projectId: project.id,
          originalText,
          wordCount,
          sourceName: sourceName || null,
        },
      })
    }

    return NextResponse.json({ success: true, data: project }, { status: 201 })
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: error.issues[0]?.message || '验证失败' } },
        { status: 400 }
      )
    }
    logError(error instanceof Error ? error : new Error(String(error)), { type: $1 })
    return NextResponse.json(
      { success: false, error: { code: 'CREATE_ERROR', message: '创建项目失败' } },
      { status: 500 }
    )
  }
}
