import { NextRequest, NextResponse } from 'next/server'
import { logError } from '@/lib/logger'
import { loadProjectForExport } from '@/lib/export/service'
import { projectNotFoundResponse, requireProjectOwner } from '@/lib/server/project-access'

interface RouteParams {
  params: Promise<{ projectId: string }>
}

/**
 * GET /api/novel/projects/{projectId}/export-data
 * 获取项目导出数据（兼容旧接口，已标记为 Deprecated）
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  let projectIdNum: number | null = null
  try {
    const { projectId } = await params
    projectIdNum = parseInt(projectId)

    if (isNaN(projectIdNum)) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_ID', message: '无效的项目ID' } },
        { status: 400 }
      )
    }
    if (!await requireProjectOwner(projectIdNum)) {
      return projectNotFoundResponse()
    }

    const project = await loadProjectForExport(projectIdNum)

    if (!project) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: '项目不存在' } },
        { status: 404 }
      )
    }

    return NextResponse.json(
      {
        success: true,
        data: {
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
        },
      },
      {
        headers: {
          'X-Deprecated-Route': 'true',
          'X-Deprecated-Suggestion': 'POST /api/novel/projects/{projectId}/export { view: "data" }',
        },
      }
    )
  } catch (error) {
    logError(error instanceof Error ? error : new Error(String(error)), { type: 'get_export_data', projectId: projectIdNum })
    return NextResponse.json(
      { success: false, error: { code: 'EXPORT_DATA_ERROR', message: '获取导出数据失败' } },
      { status: 500 }
    )
  }
}
