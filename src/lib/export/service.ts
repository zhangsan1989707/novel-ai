import { prisma } from '@/lib/prisma'
import type { ExportOptions, ExportResult, ExportedNovel } from './types'
import { logError } from '@/lib/logger'
import { getPlatformConfig, formatChapterTitle, type PlatformKey } from './adapters/index'
import Epub from 'epub-gen'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'

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

export async function exportForPlatform(
  projectId: number,
  platform: PlatformKey,
  options?: { includeMetadata?: boolean }
): Promise<ExportResult> {
  try {
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

    if (!project) return { success: false, fileName: '', error: '项目不存在' }
    if (project.chapters.length === 0) return { success: false, fileName: '', error: '没有可导出的章节' }

    const config = getPlatformConfig(platform)
    const sanitizedTitle = project.title.replace(/[^a-zA-Z0-9一-龥]/g, '_')
    const timestamp = new Date().toISOString().slice(0, 10)

    if (platform === 'epub') {
      const tmpDir = os.tmpdir()
      const tmpId = `epub-${Date.now()}-${projectId}`
      const workDir = path.join(tmpDir, tmpId)
      const tmpFile = path.join(tmpDir, `${tmpId}.epub`)

      fs.mkdirSync(workDir, { recursive: true })

      const epubGenDir = path.resolve(process.cwd(), 'node_modules/epub-gen')

      const epubOptions = {
        title: project.title,
        author: 'AI Novel Generator',
        description: project.description || undefined,
        tempDir: workDir,
        customOpfTemplatePath: path.join(epubGenDir, 'templates/epub3/content.opf.ejs'),
        customNcxTocTemplatePath: path.join(epubGenDir, 'templates/toc.ncx.ejs'),
        customHtmlTocTemplatePath: path.join(epubGenDir, 'templates/epub3/toc.xhtml.ejs'),
        content: project.chapters
          .filter(ch => ch.content && ch.content.trim().length > 0)
          .map(ch => ({
            title: formatChapterTitle(ch.chapterNumber, ch.title, platform),
            data: (ch.content || '')
              .split('\n')
              .filter(line => line.trim())
              .map(line => `<p style="text-indent:2em;margin:0.5em 0;">${line.trim()}</p>`)
              .join('\n'),
          })),
        css: `
          body { font-family: "Noto Serif CJK SC", serif; line-height: 1.8; }
          h2 { text-align: center; margin: 1.5em 0; }
          p { margin: 0.3em 0; }
        `,
        lang: 'zh-CN',
        tocTitle: '目录',
      }

      await new Promise<void>((resolve, reject) => {
        const epub = new Epub(epubOptions, tmpFile)
        epub.promise.then(() => resolve()).catch(reject)
      })

      const epubBuffer = fs.readFileSync(tmpFile)
      const base64Content = epubBuffer.toString('base64')

      try {
        fs.unlinkSync(tmpFile)
      } catch {
        // ignore cleanup errors
      }

      return {
        success: true,
        fileName: `${sanitizedTitle}_${timestamp}.epub`,
        content: base64Content,
        contentType: 'application/epub+zip',
        isBase64: true,
      }
    }

    const lines: string[] = []

    if (options?.includeMetadata !== false) {
      lines.push(project.title)
      lines.push('='.repeat(40))
      if (project.genre) lines.push(`类型：${project.genre}`)
      if (project.description) lines.push(`简介：${project.description}`)
      lines.push('')
      lines.push('')
    }

    for (const chapter of project.chapters) {
      lines.push('')
      const chapterTitle = formatChapterTitle(chapter.chapterNumber, chapter.title, platform)
      lines.push(chapterTitle)
      lines.push('')
      if (chapter.content) {
        lines.push(chapter.content)
      }
      lines.push('')
    }

    const content = lines.join('\n')
    const ext = config.formats[0]
    const fileName = `${sanitizedTitle}_${platform}_${timestamp}.${ext}`

    return {
      success: true,
      fileName,
      content,
      contentType: 'text/plain; charset=utf-8',
    }
  } catch (error) {
    logError(error instanceof Error ? error : new Error(String(error)), { type: 'export_platform', projectId })
    return { success: false, fileName: '', error: error instanceof Error ? error.message : '导出失败' }
  }
}
