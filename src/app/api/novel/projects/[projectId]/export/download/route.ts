import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { exportNovel } from '@/lib/export/service'
import { ExportFormat } from '@/lib/export/types'
import { logError } from '@/lib/logger'
import { projectNotFoundResponse, requireProjectOwner } from '@/lib/server/project-access'

interface RouteParams {
  params: Promise<{ projectId: string }>
}

const downloadSchema = z.object({
  format: z.enum(['txt', 'md', 'json', 'docx']).default('txt'),
  includeMetadata: z.enum(['true', 'false']).default('true').transform(value => value === 'true'),
  includeChapterTitles: z.enum(['true', 'false']).default('true').transform(value => value === 'true'),
})

export async function GET(request: NextRequest, { params }: RouteParams) {
  let projectIdNum: number | null = null

  try {
    const { projectId } = await params
    projectIdNum = parseInt(projectId, 10)

    if (Number.isNaN(projectIdNum)) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_ID', message: '无效的项目ID' } },
        { status: 400 }
      )
    }
    if (!await requireProjectOwner(projectIdNum)) {
      return projectNotFoundResponse()
    }

    const { searchParams } = new URL(request.url)
    const query = downloadSchema.parse({
      format: searchParams.get('format') || undefined,
      includeMetadata: searchParams.get('includeMetadata') || undefined,
      includeChapterTitles: searchParams.get('includeChapterTitles') || undefined,
    })

    const result = await exportNovel(projectIdNum, {
      format: query.format as ExportFormat,
      includeMetadata: query.includeMetadata,
      includeChapterTitles: query.includeChapterTitles,
      compress: false,
    })

    if (!result.success || !result.content) {
      return NextResponse.json(
        { success: false, error: { code: 'EXPORT_FAILED', message: result.error || '导出失败' } },
        { status: 400 }
      )
    }

    if (result.isBase64 && result.content) {
      const binaryData = Buffer.from(result.content, 'base64')
      return new NextResponse(binaryData, {
        status: 200,
        headers: {
          'Content-Type': result.contentType || 'application/octet-stream',
          'Content-Disposition': `attachment; filename="${encodeURIComponent(result.fileName)}"`,
          'Cache-Control': 'no-store',
        },
      })
    }

    return new NextResponse(result.content, {
      status: 200,
      headers: {
        'Content-Type': result.contentType || 'text/plain; charset=utf-8',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(result.fileName)}"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: err.issues[0]?.message || '参数错误' } },
        { status: 400 }
      )
    }

    logError(err instanceof Error ? err : new Error(String(err)), {
      type: 'export_download',
      projectId: projectIdNum,
    })

    return NextResponse.json(
      { success: false, error: { code: 'EXPORT_DOWNLOAD_ERROR', message: '下载导出文件失败' } },
      { status: 500 }
    )
  }
}
