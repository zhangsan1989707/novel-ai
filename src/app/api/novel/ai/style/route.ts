import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { success, handleApiError } from '@/lib/api-response'
import { AppError, ErrorCodes } from '@/lib/errors'
import {
  getStylePresets,
  matchStylePreset,
  extractStyleVector,
  blendStyleVectors,
  buildStyleModulationPrompt,
  DEFAULT_STYLE_VECTOR,
} from '@/lib/engine/style-engine'
import { requireProjectOwner, projectNotFoundResponse } from '@/lib/server/project-access'

/**
 * GET /api/novel/ai/style
 * 获取风格预设列表
 */
export async function GET() {
  try {
    const presets = getStylePresets()
    return NextResponse.json(success({ presets, defaultVector: DEFAULT_STYLE_VECTOR }))
  } catch (err) {
    return handleApiError(err)
  }
}

/**
 * POST /api/novel/ai/style
 * 分析项目风格 / 匹配预设 / 混合风格
 * body: { action: 'analyze' | 'match' | 'blend', projectId, overrides?, weight? }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { action, projectId, overrides, weight } = body

    if (action === 'analyze') {
      if (!projectId) throw new AppError(ErrorCodes.VALIDATION_ERROR, '缺少 projectId', 400)

      // 项目所有权校验
      const projectAccess = await requireProjectOwner(projectId)
      if (!projectAccess) {
        return projectNotFoundResponse()
      }

      const chapters = await prisma.novelChapter.findMany({
        where: { projectId, status: 'COMPLETED', content: { not: null } },
        select: { content: true },
        orderBy: { chapterNumber: 'desc' },
        take: 3,
      })

      if (chapters.length === 0) {
        return NextResponse.json(success({ vector: DEFAULT_STYLE_VECTOR, source: 'default' }))
      }

      const sample = chapters.map(c => c.content).join('\n\n')
      const vector = await extractStyleVector(projectId, sample)
      return NextResponse.json(success({ vector, source: 'analyzed' }))
    }

    if (action === 'match') {
      if (projectId) {
        const projectAccess = await requireProjectOwner(projectId)
        if (!projectAccess) {
          return projectNotFoundResponse()
        }
      }

      const project = projectId
        ? await prisma.novelProject.findUnique({
            where: { id: projectId },
            select: { platform: true, genre: true },
          })
        : null

      const preset = matchStylePreset(
        project?.platform?.toLowerCase() || undefined,
        project?.genre || undefined
      )

      return NextResponse.json(success({ preset }))
    }

    if (action === 'blend') {
      if (!overrides) throw new AppError(ErrorCodes.VALIDATION_ERROR, '缺少 overrides', 400)

      if (projectId) {
        const projectAccess = await requireProjectOwner(projectId)
        if (!projectAccess) {
          return projectNotFoundResponse()
        }
      }

      const project = projectId
        ? await prisma.novelProject.findUnique({
            where: { id: projectId },
            select: { platform: true, genre: true },
          })
        : null

      const preset = matchStylePreset(
        project?.platform?.toLowerCase() || undefined,
        project?.genre || undefined
      )

      const base = preset?.vector || DEFAULT_STYLE_VECTOR
      const blended = blendStyleVectors(base, overrides, weight ?? 0.5)
      const promptFragment = buildStyleModulationPrompt(blended, preset?.name)

      return NextResponse.json(success({ vector: blended, promptFragment, presetName: preset?.name }))
    }

    throw new AppError(ErrorCodes.VALIDATION_ERROR, '无效的 action，支持 analyze/match/blend', 400)
  } catch (err) {
    return handleApiError(err)
  }
}
