'use client'

import { useCallback, useState } from 'react'
import { Badge, Card, CardContent, CardHeader, CardTitle } from '@/components/ui'
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
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-sm font-medium text-amber-700 dark:text-amber-300">拆书模式</div>
              <CardTitle className="mt-1 flex items-center gap-2 text-base">
                <Sparkles className="h-4 w-4 text-amber-600" />
                AI 拆书结果
              </CardTitle>
            </div>
            <Badge variant="secondary">只读工作台</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-gray-700 dark:text-gray-300">
          <p>系统会自动完成章节切分、摘要、角色、剧情、伏笔、章节结构、阅读体验和世界观分析。这里仅用于查看 AI 拆书结果，不提供编辑入口。</p>
          <div className="flex flex-wrap gap-2">
            {['故事总览', '人物关系', '角色成长', '剧情线', '伏笔悬念', '章节结构', '阅读体验', '世界观设定'].map(label => (
              <Badge key={label} variant="outline" className="bg-white/80 dark:bg-gray-900/60">
                {label}
              </Badge>
            ))}
          </div>
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
