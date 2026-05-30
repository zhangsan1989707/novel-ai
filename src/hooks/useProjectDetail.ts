'use client'

import { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { toast } from '@/components/ui'
import type { ProjectBaseInfoFormData } from '@/components/project'
import type { GenerationSpeedMode } from '@/lib/ai/speed-mode'

export interface ProjectChapter {
  id: number
  chapterNumber: number
  title: string
  wordCount: number
  status: 'DRAFT' | 'GENERATING' | 'COMPLETED' | 'REVIEWING'
  sortOrder: number
  summary?: string
  content?: string | null
}

export interface ProjectArcPlan {
  id: string
  arcNumber: number
  name: string
  stage: string
  startChapter: number
  endChapter?: number | null
  goals: string[]
  keyEvents: string[]
  batchSize: number
  isCompleted: boolean
  chapters?: ProjectChapter[]
}

export interface ProjectBlueprint {
  corePitch: string
  worldDirection?: string | null
  mainlineDirection?: string | null
  growthDirection?: string | null
  endingDirection?: string | null
  platformStrategy?: string | null
  genreStrategy?: string | null
  styleStrategy?: string | null
  popularFictionProfile?: Record<string, unknown> | null
  constraints: string[]
}

export interface ProjectStoryRoadmapItem {
  arcId?: string
  arcNumber: number
  title: string
  chapterRange: string
  summary: string
  mainEmotion: string
  stagePayoff: string
  conflictFocus: string
  hookStrategy: string
  highlights: string[]
  forbidden: string[]
}

export interface ProjectMaintenanceSummary {
  bootstrapQueued: boolean
  bootstrapRunning: boolean
  ragQueued: boolean
  ragRunning: boolean
  bootstrapFailed: boolean
  ragFailed: boolean
  bootstrapError?: string | null
  ragError?: string | null
  queuedTaskCount: number
  bootstrapProgress?: {
    phase: string
    message: string
    stepIndex: number
    stepTotal: number
    percent: number
    updatedAt: string
  } | null
  ragProgress?: {
    phase: string
    message: string
    stepIndex: number
    stepTotal: number
    percent: number
    updatedAt: string
  } | null
}

export interface ProjectPreflight {
  ready: boolean
  healthScore: number
  healthLevel: 'critical' | 'warning' | 'healthy'
  primaryAction: string
  recommendations: string[]
  blockers: string[]
  statusHeadline: string
  hasModel: boolean
  hasBlueprint: boolean
  hasArcPlans: boolean
  hasStoryState: boolean
  hasWorldState: boolean
  totalChapters: number
  completedChapters: number
  reviewingChapters: number
  draftChapters: number
  chapterSummaryCount: number
  volumeSummaryCount: number
  bookSummaryCount: number
  characterCount: number
  plotlineCount: number
  openPlotlineCount: number
  resolvedPlotlineCount: number
  researchRefCount: number
  ragDocumentCount: number
  overduePlotlineCount: number
  activeVillainCount: number
  finalBossCount: number
  issues: Array<{
    severity: 'error' | 'warning' | 'info'
    code: string
    message: string
  }>
  nextSteps: Array<{
    title: string
    detail: string
    urgency: 'now' | 'soon' | 'watch'
    blocking: boolean
    relatedIssueCodes: string[]
  }>
  riskHighlights: Array<{
    code: string
    title: string
    detail: string
    severity: 'error' | 'warning' | 'info'
  }>
}

export interface ProjectDetail {
  id: number
  title: string
  description?: string | null
  genre?: string | null
  writingStyle?: string | null
  lengthType?: 'SHORT' | 'MEDIUM' | 'LONG' | 'ULTRA_LONG' | null
  targetWordCount?: number | null
  effectiveTargetWordCount?: number | null
  estimatedTotalChapters?: number
  expectedStageCount?: number
  currentWordCount: number
  chapterWordCount: number
  outline?: string | null
  worldSetting?: string | null
  powerSystem?: string | null
  protagonistProfile?: string | null
  protagonistGoal?: string | null
  antagonistSetting?: string | null
  endingPlan?: string | null
  writingPrompt?: string | null
  status: 'DRAFT' | 'WRITING' | 'COMPLETED' | 'PAUSED'
  totalVolumes: number
  coverImage?: string | null
  aiModelId?: number | null
  aiModelConfig?: { id: number; name: string; vendor: string } | null
  projectMode: 'CREATE' | 'ANALYZE'
  storyType?: string
  pace?: number
  darkness?: number
  humor?: number
  romance?: number
  powerGrowth?: number
  conflictIntensity?: number
  mysteryDensity?: number
  chapters: ProjectChapter[]
  workflowStage?: 'BLUEPRINT_CONFIRM' | 'ARC_PLAN_CONFIRM' | 'GENERATE'
  blueprintConfirmedAt?: string | null
  arcPlanConfirmedAt?: string | null
  bookBlueprint?: ProjectBlueprint | null
  arcPlans?: ProjectArcPlan[]
  storyRoadmap?: ProjectStoryRoadmapItem[]
  preflight?: ProjectPreflight
  maintenanceSummary?: ProjectMaintenanceSummary
  blueprintConsole?: { generatedAt?: string | null } & Record<string, unknown>
  createdAt: string
  updatedAt: string
}

type ModalKey =
  | 'edit'
  | 'delete'
  | 'toolbox'
  | 'chapterPreview'
  | 'research'
  | 'cover'
  | 'plotAnalysis'
  | 'review'
  | 'deslop'
  | 'batchDeslop'
  | 'export'

export function useProjectDetail(initialProject: ProjectDetail | null) {
  const pathname = usePathname()
  const router = useRouter()

  const projectId = useMemo(() => {
    const match = pathname?.match(/\/projects\/(\d+)(?:\/|$)/)
    return match ? Number(match[1]) : NaN
  }, [pathname])

  const [project, setProject] = useState<ProjectDetail | null>(initialProject)
  const [loading, setLoading] = useState(!initialProject)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [selectedSpeedMode, setSelectedSpeedMode] = useState<GenerationSpeedMode>('fast')
  const [selectedChapterNumber, setSelectedChapterNumber] = useState<number | null>(null)
  const [chapterDirectoryTouched, setChapterDirectoryTouched] = useState(false)

  const [modals, setModals] = useState<Record<ModalKey, boolean>>({
    edit: false,
    delete: false,
    toolbox: false,
    chapterPreview: false,
    research: false,
    cover: false,
    plotAnalysis: false,
    review: false,
    deslop: false,
    batchDeslop: false,
    export: false,
  })

  const [previewChapter, setPreviewChapter] = useState<ProjectChapter | null>(null)

  const fetchIdRef = useRef(0)
  const abortControllerRef = useRef<AbortController | null>(null)
  const fetchingRef = useRef(false)

  useEffect(() => {
    fetchingRef.current = false
  }, [projectId])

  const openModal = useCallback((key: ModalKey) => {
    setModals(prev => ({ ...prev, [key]: true }))
  }, [])

  const closeModal = useCallback((key: ModalKey) => {
    setModals(prev => ({ ...prev, [key]: false }))
  }, [])

  const fetchProject = useCallback(async () => {
    if (fetchingRef.current) return
    fetchingRef.current = true
    const fetchId = ++fetchIdRef.current
    abortControllerRef.current?.abort()
    const controller = new AbortController()
    abortControllerRef.current = controller

    try {
      const res = await fetch(`/api/novel/projects/${projectId}`, {
        signal: controller.signal,
      })
      if (fetchId !== fetchIdRef.current) return
      const data = await res.json()
      if (data.success) {
        setProject(data.data)
      } else {
        setError(data.error?.message)
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return
      if (fetchId !== fetchIdRef.current) return
      setError('获取小说详情失败')
    } finally {
      if (fetchId === fetchIdRef.current) {
        setLoading(false)
      }
      fetchingRef.current = false
    }
  }, [projectId])

  useEffect(() => {
    fetchProject()
    return () => {
      abortControllerRef.current?.abort()
    }
  }, [fetchProject])

  const maintenanceActive = Boolean(
    project?.maintenanceSummary?.bootstrapQueued ||
    project?.maintenanceSummary?.bootstrapRunning ||
    project?.maintenanceSummary?.ragQueued ||
    project?.maintenanceSummary?.ragRunning
  )

  const maintenanceFailed = Boolean(
    !maintenanceActive && (
      project?.maintenanceSummary?.bootstrapFailed ||
      project?.maintenanceSummary?.ragFailed
    )
  )

  const projectInitializing = maintenanceActive

  useEffect(() => {
    if (!projectInitializing) return
    const timer = window.setInterval(() => {
      void fetchProject()
    }, 5000)
    return () => window.clearInterval(timer)
  }, [fetchProject, projectInitializing])

  const handleUpdate = async (formData: ProjectBaseInfoFormData) => {
    setSubmitting(true)
    try {
      const body: Record<string, unknown> = { title: formData.title }
      if (formData.description !== undefined) body.description = formData.description
      if (formData.genre !== undefined) body.genre = formData.genre
      if (formData.writingStyle !== undefined) body.writingStyle = formData.writingStyle
      if (formData.targetAudience !== undefined) body.targetAudience = formData.targetAudience

      const res = await fetch(`/api/novel/projects/${projectId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (data.success) {
        setProject(data.data)
        closeModal('edit')
        toast.success('已更新小说信息')
      } else {
        toast.error(data.error?.message || '更新失败')
      }
    } catch {
      toast.error('更新失败，请稍后重试')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async () => {
    setSubmitting(true)
    try {
      const res = await fetch(`/api/novel/projects/${projectId}`, {
        method: 'DELETE',
      })
      const data = await res.json()
      if (data.success) {
        toast.success('已删除小说')
        router.push('/projects')
      } else {
        toast.error(data.error?.message || '删除失败')
      }
    } catch {
      toast.error('删除失败，请稍后重试')
    } finally {
      setSubmitting(false)
    }
  }

  const openChapterPreview = useCallback((chapter: ProjectChapter) => {
    setPreviewChapter(chapter)
    openModal('chapterPreview')
  }, [openModal])

  const openChapterEditor = useCallback((chapterId: number) => {
    router.push(`/projects/${projectId}/chapters/${chapterId}`)
  }, [projectId, router])

  const openChapterGenerate = useCallback((chapterId: number) => {
    router.push(`/projects/${projectId}/chapters/${chapterId}/generate`)
  }, [projectId, router])

  return {
    projectId,
    pathname,
    router,
    project,
    setProject,
    loading,
    error,
    submitting,
    selectedSpeedMode,
    setSelectedSpeedMode,
    selectedChapterNumber,
    setSelectedChapterNumber,
    chapterDirectoryTouched,
    setChapterDirectoryTouched,
    modals,
    openModal,
    closeModal,
    previewChapter,
    setPreviewChapter,
    fetchProject,
    maintenanceActive,
    maintenanceFailed,
    projectInitializing,
    handleUpdate,
    handleDelete,
    openChapterPreview,
    openChapterEditor,
    openChapterGenerate,
  }
}
