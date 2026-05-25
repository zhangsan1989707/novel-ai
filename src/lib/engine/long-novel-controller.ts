import { prisma } from '@/lib/prisma'
import { ArcStage, Platform } from '@/types'
import { calculateBatchSize } from './batch-planner'
import { validateOutline } from './outline-validator'
import { shouldExpandWorld, generateExpansionPrompt } from './world-expansion'
import { getVillainPrompt } from './villain-lifecycle'
import { toInternalArcStage, toInternalPlatform } from './production-mapping'

interface BatchContext {
  shouldExpand: boolean
  expansionPrompt: string
  villainPrompt: string
  batchSize: number
  currentArc: ArcStage | null
  progressRatio: number
}

export async function getNextBatchContext(projectId: number): Promise<BatchContext> {
  const project = await prisma.novelProject.findUnique({
    where: { id: projectId },
    include: {
      arcPlans: { orderBy: { arcNumber: 'asc' } },
      villains: true,
      worldState: true,
      chapters: true,
    },
  })

  if (!project) throw new Error(`项目 ${projectId} 不存在`)

  const currentArc = project.arcPlans.find(a => !a.isCompleted)
  const arcStage = toInternalArcStage(currentArc?.stage)

  const totalChapters = project.chapters?.length || 0
  const estimatedTotal = project.targetWordCount
    ? Math.ceil(project.targetWordCount / project.chapterWordCount)
    : 100
  const progressRatio = estimatedTotal > 0 ? totalChapters / estimatedTotal : 0

  const worldState = project.worldState
    ? { ...project.worldState, currentExpansion: project.worldState.currentExpansion ?? undefined }
    : { mapLevel: 1, factionCount: 1, powerLevel: 1, civilizationLevel: 1, regions: [] as string[] }
  const shouldExpand = shouldExpandWorld(arcStage, worldState)
  const expansionPrompt = shouldExpand ? generateExpansionPrompt(arcStage, worldState) : ''

  const platform = toInternalPlatform(project.platform)

  const worldComplexity = worldState.mapLevel / 10
  const plotDensity = 0.5
  const batchSize = calculateBatchSize(platform as Platform, arcStage as ArcStage, worldComplexity, plotDensity)

  const villainPrompt = getVillainPrompt(
    project.villains.map(v => ({
      name: v.name,
      tier: v.tier as 'stage' | 'arc' | 'final',
      isFinalBoss: v.isFinalBoss,
      introducedAt: v.introducedAt || undefined,
      defeatedAt: v.defeatedAt || undefined,
      lifecycle: (v.lifecycle || 'active') as 'active' | 'defeated' | 'escaped' | 'transformed',
    })),
    totalChapters,
    progressRatio
  )

  return {
    shouldExpand,
    expansionPrompt,
    villainPrompt,
    batchSize,
    currentArc: arcStage,
    progressRatio,
  }
}

export async function shouldAdvanceArc(projectId: number): Promise<boolean> {
  const project = await prisma.novelProject.findUnique({
    where: { id: projectId },
    include: {
      arcPlans: { orderBy: { arcNumber: 'asc' } },
      chapters: true,
    },
  })

  if (!project) return false

  const currentArc = project.arcPlans.find(a => !a.isCompleted)
  if (!currentArc) return false

  if (currentArc.endChapter && project.chapters?.length >= currentArc.endChapter) {
    return true
  }

  const arcChapters = project.chapters?.filter(
    c => c.chapterNumber >= currentArc.startChapter
  ) || []

  if (arcChapters.length > 0 && arcChapters.every(c => c.status === 'COMPLETED')) {
    return true
  }

  return false
}

export function validateAndWarn(
  chapters: Array<{ chapterNumber: number; title: string; summary: string }>,
  progressRatio: number
): { passed: boolean; violations: string[]; warnings: string[] } {
  const result = validateOutline(
    chapters.map(c => ({ chapterNumber: c.chapterNumber, title: c.title, summary: c.summary || '' })),
    progressRatio
  )
  return result
}
