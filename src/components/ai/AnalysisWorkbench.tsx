'use client'

import { useCallback, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui'
import { AnalysisDimension } from '@/types'
import { BookOpen, Sparkles } from 'lucide-react'
import { AnalysisTaskPanel } from './AnalysisTaskPanel'
import { BookAnalysisDashboard } from './BookAnalysisDashboard'
import { BookAnalysisPanel } from './BookAnalysisPanel'

interface AnalysisWorkbenchProps {
  projectId: number
}

interface AnalysisNavigationRequest {
  id: number
  sectionId?: string
  dimension?: AnalysisDimension
  chapterNo?: number
  anchorId?: string
}

export function AnalysisWorkbench({ projectId }: AnalysisWorkbenchProps) {
  const [refreshSeed, setRefreshSeed] = useState(0)
  const [navigationRequest, setNavigationRequest] = useState<AnalysisNavigationRequest | null>(null)

  const scrollToSection = useCallback((sectionId: string) => {
    const el = document.getElementById(sectionId)
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [])

  const handleTaskComplete = useCallback(() => {
    setRefreshSeed(seed => seed + 1)
  }, [])

  const handleNavigateRequest = useCallback((request: Omit<AnalysisNavigationRequest, 'id'>) => {
    if (request.sectionId) {
      scrollToSection(request.sectionId)
    }
    setNavigationRequest({
      id: Date.now(),
      ...request,
    })
  }, [scrollToSection])

  return (
    <div className="space-y-5">
      <Card className="border-amber-200 bg-amber-50/70 dark:border-amber-900/40 dark:bg-amber-950/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4 text-amber-600" />
            拆书自动分析
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-gray-700 dark:text-gray-300">
          <p>系统会自动完成切章、摘要、角色、剧情、伏笔、章节结构、阅读体验和世界观分析。</p>
          <p className="mt-1">这里不提供编辑入口，只展示 AI 识别结果和结构化证据，适合直接阅读和复盘。</p>
        </CardContent>
      </Card>

      <AnalysisTaskPanel projectId={projectId} onTaskComplete={handleTaskComplete} />

      <Card className="overflow-hidden border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <BookOpen className="h-4 w-4 text-blue-600" />
            拆书总览
          </CardTitle>
        </CardHeader>
        <CardContent>
          <BookAnalysisDashboard
            projectId={projectId}
            refreshSeed={refreshSeed}
            onNavigateSection={scrollToSection}
            onNavigateRequest={handleNavigateRequest}
          />
        </CardContent>
      </Card>

      <BookAnalysisPanel
        projectId={projectId}
        refreshSeed={refreshSeed}
        navigationRequest={navigationRequest}
      />
    </div>
  )
}
