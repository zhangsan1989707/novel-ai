import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createProviderFromConfigId, createProviderFromDefaultConfig } from '@/lib/ai/factory'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string; chapterId: string }> }
) {
  try {
    const { chapterNumber, title, currentSummary } = await request.json()
    const { projectId: projectIdStr, chapterId: chapterIdStr } = await params
    const projectId = parseInt(projectIdStr)
    const chapterId = parseInt(chapterIdStr)

    const project = await prisma.novelProject.findUnique({
      where: { id: projectId },
      include: { aiModelConfig: true },
    })

    if (!project) {
      return NextResponse.json(
        { success: false, error: { code: 'PROJECT_NOT_FOUND', message: '项目不存在' } },
        { status: 404 }
      )
    }

    const provider = project.aiModelId
      ? await createProviderFromConfigId(project.aiModelId)
      : await createProviderFromDefaultConfig()

    if (!provider) {
      return NextResponse.json(
        { success: false, error: { code: 'AI_CONFIG_ERROR', message: '无法获取AI配置' } },
        { status: 500 }
      )
    }

    const prompt = `
请根据以下信息为小说章节生成或优化概要：

章节信息：
- 章节序号：第${chapterNumber}章
- 章节标题：${title || '暂无标题'}

已有概要（如果有）：
${currentSummary || '暂无'}

要求：
1. 概要应简洁明了，突出本章核心情节
2. 保持50-100字左右
3. 如果已有概要，进行优化提升，保持原有核心信息
4. 只返回概要内容，不要额外说明
    `.trim()

    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const token of provider.generateStream(prompt, { temperature: 0.7 })) {
            controller.enqueue(new TextEncoder().encode(token))
          }
          controller.close()
        } catch (error) {
          controller.error(error)
        }
      },
    })

    return new NextResponse(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Transfer-Encoding': 'chunked',
      },
    })
  } catch (error) {
    console.error('Enhance summary error:', error)
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'AI增强失败' } },
      { status: 500 }
    )
  }
}