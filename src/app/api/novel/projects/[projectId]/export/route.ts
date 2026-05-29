import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { exportNovel, exportForPlatform, loadProjectForExport } from '@/lib/export/service'
import { ExportFormat } from '@/lib/export/types'
import type { PlatformKey } from '@/lib/export/adapters/index'
import AdmZip from 'adm-zip'
import { logError } from '@/lib/logger'

interface RouteParams {
  params: Promise<{ projectId: string }>
}

const exportSchema = z.object({
  format: z.enum(['txt', 'md', 'json', 'epub']).default('txt'),
  includeMetadata: z.boolean().default(true),
  includeChapterTitles: z.boolean().default(true),
  view: z.enum(['file', 'data']).default('file'),
})

function parseProjectId(paramsValue: string) {
  const projectId = parseInt(paramsValue, 10)
  if (Number.isNaN(projectId)) {
    return null
  }

  return projectId
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function buildExportDataResponse(project: NonNullable<Awaited<ReturnType<typeof loadProjectForExport>>>) {
  return {
    id: project.id,
    title: project.title,
    outline: project.outline,
    bookBlueprint: project.bookBlueprint,
    storyState: project.storyState,
    worldState: (project as { worldState?: unknown }).worldState ?? null,
    arcPlans: project.arcPlans,
    chapters: project.chapters.map((chapter) => ({
      chapterNumber: chapter.chapterNumber,
      title: chapter.title,
      content: chapter.content,
    })),
  }
}

async function handleDataView(projectId: number) {
  const project = await loadProjectForExport(projectId)
  if (!project) {
    return NextResponse.json(
      { success: false, error: { code: 'NOT_FOUND', message: '项目不存在' } },
      { status: 404 }
    )
  }

  return NextResponse.json({
    success: true,
    data: buildExportDataResponse(project),
  })
}

/**
 * POST /api/novel/projects/[projectId]/export
 * 导出小说为指定格式
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  let projectIdNum: number | null = null
  try {
    const { projectId } = await params
    projectIdNum = parseProjectId(projectId)

    if (projectIdNum === null) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_ID', message: '无效的项目ID' } },
        { status: 400 }
      )
    }

    const body = await request.json()

    const validPlatforms = ['qidian', 'fanqie', 'feilu', 'jinjiang', 'qimao', 'epub', 'generic'] as const
    const platform = body.platform as string | undefined
    if (platform && !validPlatforms.includes(platform as typeof validPlatforms[number])) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_PLATFORM', message: `不支持的平台: ${platform}` } },
        { status: 400 }
      )
    }

    const parsedView = z.enum(['file', 'data']).default('file').safeParse(body.view)
    const view = parsedView.success ? parsedView.data : 'file'
    if (view === 'data') {
      return handleDataView(projectIdNum)
    }

    if (platform && platform !== 'generic') {
      const result = await exportForPlatform(projectIdNum, platform as PlatformKey, {
        includeMetadata: body.includeMetadata !== false,
      })

      if (!result.success) {
        return NextResponse.json(
          { success: false, error: { code: 'EXPORT_FAILED', message: result.error } },
          { status: 400 }
        )
      }

      if (result.isBase64 && result.content) {
        const binaryData = Buffer.from(result.content, 'base64')
        return new NextResponse(binaryData, {
          headers: {
            'Content-Type': result.contentType || 'application/epub+zip',
            'Content-Disposition': `attachment; filename="${encodeURIComponent(result.fileName)}"`,
          },
        })
      }

      return NextResponse.json({
        success: true,
        data: {
          fileName: result.fileName,
          content: result.content,
          contentType: result.contentType,
        },
      })
    }

    const { format, includeMetadata, includeChapterTitles } = exportSchema.parse(body)

    // 如果是 EPUB，使用原有逻辑
    if (format === 'epub' && projectIdNum !== null) {
      return await exportEpub(projectIdNum)
    }

    // 使用新的导出服务
    const result = await exportNovel(projectIdNum, {
      format: format as ExportFormat,
      includeMetadata,
      includeChapterTitles,
      compress: false,
    })

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: { code: 'EXPORT_FAILED', message: result.error } },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      data: {
        fileName: result.fileName,
        downloadUrl: result.downloadUrl,
      },
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: error.issues[0]?.message } },
        { status: 400 }
      )
    }
    logError(error instanceof Error ? error : new Error(String(error)), { type: 'export_novel', projectId: projectIdNum })
    return NextResponse.json(
      { success: false, error: { code: 'EXPORT_ERROR', message: '导出失败' } },
      { status: 500 }
    )
  }
}

/**
 * 导出为 EPUB 格式
 */
async function exportEpub(projectId: number): Promise<NextResponse> {
  try {
    const project = await prisma.novelProject.findUnique({
      where: { id: projectId },
      include: {
        chapters: {
          orderBy: { chapterNumber: 'asc' },
          select: {
            chapterNumber: true,
            title: true,
            content: true,
          },
        },
      },
    })

    if (!project) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: '项目不存在' } },
        { status: 404 }
      )
    }

    const zip = new AdmZip()

    // 1. mimetype 文件（必须是第一个，不压缩）
    zip.addFile('mimetype', Buffer.from('application/epub+zip', 'utf-8'), '', 0)

    // 2. META-INF/container.xml
    const containerXml = `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`
    zip.addFile('META-INF/container.xml', Buffer.from(containerXml, 'utf-8'))

    // 3. OEBPS/content.opf
    const manifestItems = project.chapters.map((ch, i) =>
      `<item id="chapter${i + 1}" href="chapter${i + 1}.xhtml" media-type="application/xhtml+xml"/>`
    ).join('\n        ')

    const spineItems = project.chapters.map((ch, i) =>
      `<itemref idref="chapter${i + 1}"/>`
    ).join('\n      ')

    const contentOpf = `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="bookid">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:title>${escapeXml(project.title)}</dc:title>
    <dc:language>zh-CN</dc:language>
    <dc:identifier id="bookid">urn:uuid:${projectId}</dc:identifier>
  </metadata>
  <manifest>
    ${manifestItems}
  </manifest>
  <spine>
    ${spineItems}
  </spine>
</package>`
    zip.addFile('OEBPS/content.opf', Buffer.from(contentOpf, 'utf-8'))

    // 4. 生成章节 XHTML 文件
    for (let i = 0; i < project.chapters.length; i++) {
      const ch = project.chapters[i]
      const contentHtml = (ch.content || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\n/g, '<br/>')
      const chapterXhtml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <title>第${ch.chapterNumber}章 ${escapeXml(ch.title)}</title>
</head>
<body>
  <h1>第${ch.chapterNumber}章 ${escapeXml(ch.title)}</h1>
  <p>${contentHtml}</p>
</body>
</html>`
      zip.addFile(`OEBPS/chapter${i + 1}.xhtml`, Buffer.from(chapterXhtml, 'utf-8'))
    }

    // 生成 ZIP 文件
    const epubBuffer = zip.toBuffer()

    const safeFilename = `novel-export-${projectId}.epub`

    return new NextResponse(epubBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/epub+zip',
        'Content-Disposition': `attachment; filename="${safeFilename}"; filename*=UTF-8''${encodeURIComponent(project.title)}.epub`,
      },
    })
  } catch (error) {
    logError(error instanceof Error ? error : new Error(String(error)), { type: 'export_novel', projectId })
    const message = error instanceof Error ? error.message : '未知错误'
    return NextResponse.json(
      { success: false, error: { code: 'EXPORT_ERROR', message: '导出失败: ' + message } },
      { status: 500 }
    )
  }
}
