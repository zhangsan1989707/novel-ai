import { prisma } from '@/lib/prisma'
import type {
  ExportOptions,
  ExportResult,
  ExportedArcPlan,
  ExportedBlueprint,
  ExportedNovel,
  ExportedStoryState,
  ExportReusableContext,
} from './types'
import { logError } from '@/lib/logger'
import { getPlatformConfig, formatChapterTitle, type PlatformKey } from './adapters/index'
import Epub from 'epub-gen'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'

type ExportProject = Awaited<ReturnType<typeof loadProjectForExport>>
type ExportChapter = NonNullable<ExportProject>['chapters'][number]
type ExportProjectCore = Pick<
  NonNullable<ExportProject>,
  'title' | 'description' | 'genre' | 'createdAt' | 'updatedAt'
>

async function loadProjectForExport(projectId: number) {
  return prisma.novelProject.findUnique({
    where: { id: projectId },
    include: {
      chapters: {
        where: {
          status: { in: ['COMPLETED', 'REVIEWING'] },
          content: { not: null },
        },
        orderBy: { chapterNumber: 'asc' },
      },
      bookBlueprint: true,
      arcPlans: {
        orderBy: { arcNumber: 'asc' },
      },
      storyState: true,
    },
  })
}

function toRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

function buildReusableContext(project: NonNullable<ExportProject>): ExportReusableContext {
  const blueprint: ExportedBlueprint | undefined = project.bookBlueprint
    ? {
        corePitch: project.bookBlueprint.corePitch,
        worldDirection: project.bookBlueprint.worldDirection,
        mainlineDirection: project.bookBlueprint.mainlineDirection,
        growthDirection: project.bookBlueprint.growthDirection,
        endingDirection: project.bookBlueprint.endingDirection,
        platformStrategy: project.bookBlueprint.platformStrategy,
        genreStrategy: project.bookBlueprint.genreStrategy,
        styleStrategy: project.bookBlueprint.styleStrategy,
        constraints: Array.isArray(project.bookBlueprint.constraints) ? project.bookBlueprint.constraints : [],
        createdAt: project.bookBlueprint.createdAt.toISOString(),
        updatedAt: project.bookBlueprint.updatedAt.toISOString(),
      }
    : undefined

  const arcPlans: ExportedArcPlan[] = project.arcPlans.map((arc) => ({
    arcNumber: arc.arcNumber,
    name: arc.name,
    stage: arc.stage,
    description: arc.description,
    batchSize: arc.batchSize,
    startChapter: arc.startChapter,
    endChapter: arc.endChapter,
    goals: Array.isArray(arc.goals) ? arc.goals : [],
    keyEvents: Array.isArray(arc.keyEvents) ? arc.keyEvents : [],
    isCompleted: arc.isCompleted,
    createdAt: arc.createdAt.toISOString(),
    updatedAt: arc.updatedAt.toISOString(),
  }))

  const storyState: ExportedStoryState | undefined = project.storyState
    ? {
        currentChapter: project.storyState.currentChapter,
        totalPlanned: project.storyState.totalPlanned,
        mainConflict: project.storyState.mainConflict,
        emotionalArc: Array.isArray(project.storyState.emotionalArc) ? project.storyState.emotionalArc : [],
        subConflicts: Array.isArray(project.storyState.subConflicts) ? project.storyState.subConflicts : [],
        metadata: toRecord(project.storyState.metadata),
        createdAt: project.storyState.createdAt.toISOString(),
        updatedAt: project.storyState.updatedAt.toISOString(),
      }
    : undefined

  return {
    exportedAt: new Date().toISOString(),
    blueprint,
    arcPlans,
    storyState,
  }
}

function buildProjectMetadata(project: NonNullable<ExportProject>) {
  return {
    title: project.title,
    genre: project.genre ?? undefined,
    description: project.description ?? undefined,
    wordCount: project.chapters.reduce((sum, ch) => sum + (ch.wordCount || 0), 0),
    chapterCount: project.chapters.length,
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString(),
    reusableContext: buildReusableContext(project),
  }
}

function buildReusableContextText(reusableContext: ExportReusableContext): string[] {
  const lines: string[] = []

  lines.push('创作复用信息')
  lines.push('-'.repeat(40))
  lines.push(`导出时间: ${reusableContext.exportedAt}`)

  if (reusableContext.blueprint) {
    lines.push('')
    lines.push('[Book Blueprint]')
    lines.push(`核心卖点: ${reusableContext.blueprint.corePitch}`)
    if (reusableContext.blueprint.worldDirection) lines.push(`世界方向: ${reusableContext.blueprint.worldDirection}`)
    if (reusableContext.blueprint.mainlineDirection) lines.push(`主线方向: ${reusableContext.blueprint.mainlineDirection}`)
    if (reusableContext.blueprint.growthDirection) lines.push(`成长方向: ${reusableContext.blueprint.growthDirection}`)
    if (reusableContext.blueprint.endingDirection) lines.push(`终局方向: ${reusableContext.blueprint.endingDirection}`)
    if (reusableContext.blueprint.platformStrategy) lines.push(`平台策略: ${reusableContext.blueprint.platformStrategy}`)
    if (reusableContext.blueprint.genreStrategy) lines.push(`题材策略: ${reusableContext.blueprint.genreStrategy}`)
    if (reusableContext.blueprint.styleStrategy) lines.push(`风格策略: ${reusableContext.blueprint.styleStrategy}`)
    if (reusableContext.blueprint.constraints.length > 0) {
      lines.push(`约束: ${reusableContext.blueprint.constraints.join('；')}`)
    }
  }

  if (reusableContext.arcPlans.length > 0) {
    lines.push('')
    lines.push('[Arc Plan]')
    for (const arc of reusableContext.arcPlans) {
      const scope = arc.endChapter ? `${arc.startChapter}-${arc.endChapter}` : `${arc.startChapter}+`
      lines.push(`Arc ${arc.arcNumber} | ${arc.name} | ${arc.stage} | 章节 ${scope} | 批次 ${arc.batchSize}`)
      if (arc.description) lines.push(`  描述: ${arc.description}`)
      if (arc.goals.length > 0) lines.push(`  目标: ${arc.goals.join('；')}`)
      if (arc.keyEvents.length > 0) lines.push(`  关键事件: ${arc.keyEvents.join('；')}`)
    }
  }

  if (reusableContext.storyState) {
    lines.push('')
    lines.push('[StoryState]')
    lines.push(`当前章节: ${reusableContext.storyState.currentChapter}`)
    lines.push(`计划总章: ${reusableContext.storyState.totalPlanned}`)
    if (reusableContext.storyState.mainConflict) lines.push(`当前主冲突: ${reusableContext.storyState.mainConflict}`)
    if (reusableContext.storyState.subConflicts.length > 0) {
      lines.push(`子冲突数: ${reusableContext.storyState.subConflicts.length}`)
    }
    if (reusableContext.storyState.emotionalArc.length > 0) {
      lines.push(`情绪弧点数: ${reusableContext.storyState.emotionalArc.length}`)
    }
  }

  return lines
}

function buildReusableContextHtml(reusableContext: ExportReusableContext): string {
  const lines = buildReusableContextText(reusableContext)
  return lines
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => `<p style="margin:0.4em 0;">${line.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>`)
    .join('\n')
}

/**
 * 导出小说为指定格式
 */
export async function exportNovel(
  projectId: number,
  options: ExportOptions
): Promise<ExportResult> {
  try {
    const project = await loadProjectForExport(projectId)

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
    const metadata = buildProjectMetadata(project)

    // 根据格式生成内容
    switch (options.format) {
      case 'txt':
        content = buildTxtContent(project, chapters, options, metadata.reusableContext)
        fileName = `${sanitizedTitle}_${timestamp}.txt`
        contentType = 'text/plain; charset=utf-8'
        break
      case 'md':
        content = buildMarkdownContent(project, chapters, options, metadata.reusableContext)
        fileName = `${sanitizedTitle}_${timestamp}.md`
        contentType = 'text/markdown; charset=utf-8'
        break
      case 'json':
        content = buildJsonContent(project, chapters, metadata)
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
  project: ExportProjectCore,
  chapters: ExportChapter[],
  options: ExportOptions,
  reusableContext?: ExportReusableContext
): string {
  const lines: string[] = []

  // 元数据
  if (options.includeMetadata) {
    lines.push(project.title)
    lines.push('=' .repeat(40))
    if (project.genre) lines.push(`类型: ${project.genre}`)
    if (project.description) lines.push(`简介: ${project.description}`)
    if (reusableContext) {
      lines.push('')
      lines.push(...buildReusableContextText(reusableContext))
    }
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
  project: ExportProjectCore,
  chapters: ExportChapter[],
  options: ExportOptions,
  reusableContext?: ExportReusableContext
): string {
  const lines: string[] = []

  // 元数据
  if (options.includeMetadata) {
    lines.push(`# ${project.title}`)
    lines.push('')
    if (project.genre) lines.push(`**类型**: ${project.genre}`)
    if (project.description) lines.push(`**简介**: ${project.description}`)
    if (reusableContext) {
      lines.push('')
      lines.push('## 创作复用信息')
      lines.push('')
      for (const line of buildReusableContextText(reusableContext)) {
        lines.push(line)
      }
    }
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
  _project: ExportProjectCore,
  chapters: ExportChapter[],
  metadata: ReturnType<typeof buildProjectMetadata>
): string {
  const exported: ExportedNovel = {
    metadata,
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
        content = buildTxtContent(project!, chapters, options)
        extension = 'txt'
        contentType = 'text/plain; charset=utf-8'
        break
      case 'md':
        content = buildMarkdownContent(project!, chapters, options)
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
    const project = await loadProjectForExport(projectId)

    if (!project) return { success: false, fileName: '', error: '项目不存在' }
    if (project.chapters.length === 0) return { success: false, fileName: '', error: '没有可导出的章节' }

    const config = getPlatformConfig(platform)
    const sanitizedTitle = project.title.replace(/[^a-zA-Z0-9一-龥]/g, '_')
    const timestamp = new Date().toISOString().slice(0, 10)
    const metadata = buildProjectMetadata(project)

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
        content: [
          ...(options?.includeMetadata !== false
            ? [{
                title: '创作复用信息',
                data: buildReusableContextHtml(metadata.reusableContext),
              }]
            : []),
          ...project.chapters
          .filter(ch => ch.content && ch.content.trim().length > 0)
          .map(ch => ({
            title: formatChapterTitle(ch.chapterNumber, ch.title, platform),
            data: (ch.content || '')
              .split('\n')
              .filter(line => line.trim())
              .map(line => `<p style="text-indent:2em;margin:0.5em 0;">${line.trim()}</p>`)
              .join('\n'),
          })),
        ],
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
      lines.push(...buildReusableContextText(metadata.reusableContext))
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
