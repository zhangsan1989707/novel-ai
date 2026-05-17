import { prisma } from '@/lib/prisma'
import type { ExportOptions, ExportResult, ExportedNovel } from './types'
import { logError } from '@/lib/logger'

/**
 * 导出小说为指定格式
 */
export async function exportNovel(
  projectId: number,
  options: ExportOptions
): Promise<ExportResult> {
  try {
    // 获取项目信息
    const project = await prisma.novelProject.findUnique({
      where: { id: projectId },
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
      return { success: false, fileName: '', error: '项目不存在' }
    }

    const chapters = project.chapters
    if (chapters.length === 0) {
      return { success: false, fileName: '', error: '没有可导出的章节' }
    }

    // 构建文件名
    const sanitizedTitle = project.title.replace(/[^a-zA-Z0-9一-龥]/g, '_')
    const timestamp = new Date().toISOString().slice(0, 10)
    let fileName = ''
    let content = ''
    let contentType = 'text/plain; charset=utf-8'

    // 根据格式生成内容
    switch (options.format) {
      case 'txt':
        content = buildTxtContent({
          ...project,
          description: project.description ?? undefined,
          genre: project.genre ?? undefined
        }, chapters, options)
        fileName = `${sanitizedTitle}_${timestamp}.txt`
        contentType = 'text/plain; charset=utf-8'
        break
      case 'md':
        content = buildMarkdownContent({
          ...project,
          description: project.description ?? undefined,
          genre: project.genre ?? undefined
        }, chapters, options)
        fileName = `${sanitizedTitle}_${timestamp}.md`
        contentType = 'text/markdown; charset=utf-8'
        break
      case 'json':
        content = buildJsonContent({
          ...project,
          description: project.description ?? undefined,
          genre: project.genre ?? undefined
        }, chapters, options)
        fileName = `${sanitizedTitle}_${timestamp}.json`
        contentType = 'application/json; charset=utf-8'
        break
      default:
        return { success: false, fileName: '', error: `不支持的格式: ${options.format}` }
    }

    // 如果需要压缩，创建 zip
    if (options.compress) {
      // TODO: 实现 zip 压缩功能
      // 可以使用 archiver 或 jszip 库
      return {
        success: true,
        fileName: fileName.replace(/\.[^.]+$/, '.zip'),
        error: '压缩功能待实现',
      }
    }

    return {
      success: true,
      fileName,
      filePath: `/exports/${fileName}`,
      downloadUrl: `/api/novel/projects/${projectId}/export/download?format=${options.format}&includeMetadata=${options.includeMetadata}&includeChapterTitles=${options.includeChapterTitles}`,
      content,
      contentType,
    }
  } catch (error) {
    logError(error instanceof Error ? error : new Error(String(error)), { type: 'export_novel', projectId })
    return {
      success: false,
      fileName: '',
      error: error instanceof Error ? error.message : '导出失败',
    }
  }
}

/**
 * 构建 TXT 格式内容
 */
function buildTxtContent(
  project: { title: string; author?: string; description?: string; genre?: string },
  chapters: { chapterNumber: number; title: string; content: string | null; wordCount: number }[],
  options: ExportOptions
): string {
  const lines: string[] = []

  // 元数据
  if (options.includeMetadata) {
    lines.push(project.title)
    lines.push('=' .repeat(40))
    if (project.author) lines.push(`作者: ${project.author}`)
    if (project.genre) lines.push(`类型: ${project.genre}`)
    if (project.description) lines.push(`简介: ${project.description}`)
    lines.push('')
    lines.push('')
  }

  // 章节
  for (const chapter of chapters) {
    if (options.includeChapterTitles) {
      lines.push('')
      lines.push(`第${chapter.chapterNumber}章 ${chapter.title}`)
      lines.push('-'.repeat(40))
    }
    if (chapter.content) {
      lines.push(chapter.content)
    }
    lines.push('')
  }

  return lines.join('\n')
}

/**
 * 构建 Markdown 格式内容
 */
function buildMarkdownContent(
  project: { title: string; author?: string; description?: string; genre?: string },
  chapters: { chapterNumber: number; title: string; content: string | null; wordCount: number }[],
  options: ExportOptions
): string {
  const lines: string[] = []

  // 元数据
  if (options.includeMetadata) {
    lines.push(`# ${project.title}`)
    lines.push('')
    if (project.author) lines.push(`**作者**: ${project.author}`)
    if (project.genre) lines.push(`**类型**: ${project.genre}`)
    if (project.description) lines.push(`**简介**: ${project.description}`)
    lines.push('')
    lines.push('---')
    lines.push('')
  }

  // 章节
  for (const chapter of chapters) {
    if (options.includeChapterTitles) {
      lines.push(`## 第${chapter.chapterNumber}章 ${chapter.title}`)
      lines.push('')
    }
    if (chapter.content) {
      lines.push(chapter.content)
    }
    lines.push('')
    lines.push('---')
    lines.push('')
  }

  return lines.join('\n')
}

/**
 * 构建 JSON 格式内容
 */
function buildJsonContent(
  project: { title: string; author?: string; description?: string; genre?: string; createdAt: Date; updatedAt: Date },
  chapters: { chapterNumber: number; title: string; content: string | null; wordCount: number }[],
  _options: ExportOptions
): string {
  const exported: ExportedNovel = {
    metadata: {
      title: project.title,
      author: project.author,
      genre: project.genre,
      description: project.description,
      wordCount: chapters.reduce((sum, ch) => sum + (ch.wordCount || 0), 0),
      chapterCount: chapters.length,
      createdAt: project.createdAt.toISOString(),
      updatedAt: project.updatedAt.toISOString(),
    },
    chapters: chapters.map(ch => ({
      number: ch.chapterNumber,
      title: ch.title,
      content: ch.content || '',
      wordCount: ch.wordCount || 0,
    })),
  }

  return JSON.stringify(exported, null, 2)
}

/**
 * 导出章节列表（批量）
 */
export async function exportChapters(
  projectId: number,
  chapterIds: number[],
  options: ExportOptions
): Promise<ExportResult> {
  try {
    const chapters = await prisma.novelChapter.findMany({
      where: {
        id: { in: chapterIds },
        content: { not: null },
      },
      orderBy: { chapterNumber: 'asc' },
    })

    if (chapters.length === 0) {
      return { success: false, fileName: '', error: '没有可导出的章节' }
    }

    const project = await prisma.novelProject.findUnique({ where: { id: projectId } })
    const sanitizedTitle = (project?.title || 'novel').replace(/[^a-zA-Z0-9一-龥]/g, '_')

    let extension = ''
    let content = ''
    let contentType = 'text/plain; charset=utf-8'

    switch (options.format) {
      case 'txt':
        content = buildTxtContent({
          ...project!,
          description: project?.description ?? undefined,
          genre: project?.genre ?? undefined
        }, chapters, options)
        extension = 'txt'
        contentType = 'text/plain; charset=utf-8'
        break
      case 'md':
        content = buildMarkdownContent({
          ...project!,
          description: project?.description ?? undefined,
          genre: project?.genre ?? undefined
        }, chapters, options)
        extension = 'md'
        contentType = 'text/markdown; charset=utf-8'
        break
      default:
        return { success: false, fileName: '', error: `不支持的格式: ${options.format}` }
    }

    const fileName = `${sanitizedTitle}_chapters_${Date.now()}.${extension}`

    return {
      success: true,
      fileName,
      filePath: `/exports/${fileName}`,
      content,
      contentType,
    }
  } catch (error) {
    return {
      success: false,
      fileName: '',
      error: error instanceof Error ? error.message : '导出失败',
    }
  }
}
