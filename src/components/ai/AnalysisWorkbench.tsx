'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui'
import { BookOpen, Sparkles } from 'lucide-react'
import { AnalysisTaskPanel } from './AnalysisTaskPanel'
import { BookAnalysisDashboard } from './BookAnalysisDashboard'
import { BookAnalysisPanel } from './BookAnalysisPanel'

interface AnalysisWorkbenchProps {
  projectId: number
}

export function AnalysisWorkbench({ projectId }: AnalysisWorkbenchProps) {
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

      <AnalysisTaskPanel projectId={projectId} />

      <Card className="overflow-hidden border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <BookOpen className="h-4 w-4 text-blue-600" />
            拆书总览
          </CardTitle>
        </CardHeader>
        <CardContent>
          <BookAnalysisDashboard projectId={projectId} />
        </CardContent>
      </Card>

      <BookAnalysisPanel projectId={projectId} />
    </div>
  )
}
