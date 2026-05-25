import { cn } from '@/lib/utils'
import { Button } from './Button'
import { Sparkles, BookOpen, FileText, Zap, Plus, Wand2 } from 'lucide-react'

interface ProjectStats {
  projectCount: number
  totalWordCount: number
  aiCallCount: number
}

interface ProjectsEmptyStateProps {
  onCreate: () => void
  onAnalyze?: () => void
  stats?: ProjectStats
  className?: string
}

function formatNumber(num: number): string {
  if (num >= 10000) {
    return (num / 10000).toFixed(1) + 'w'
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'k'
  }
  return num.toString()
}

export function ProjectsEmptyState({
  onCreate,
  onAnalyze,
  stats,
  className
}: ProjectsEmptyStateProps) {
  const projectCount = stats?.projectCount ?? 0
  const totalWordCount = stats?.totalWordCount ?? 0
  const aiCallCount = stats?.aiCallCount ?? 0

  return (
    <div className={cn('space-y-6', className)}>
      {/* 数据统计卡 */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4 text-center border border-gray-100 dark:border-gray-700/50">
          <div className="flex items-center justify-center gap-1.5 text-lg font-semibold text-gray-900 dark:text-white">
            <BookOpen className="h-4 w-4 text-blue-500" />
            {projectCount}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">小说总数</div>
        </div>
        <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4 text-center border border-gray-100 dark:border-gray-700/50">
          <div className="flex items-center justify-center gap-1.5 text-lg font-semibold text-gray-900 dark:text-white">
            <FileText className="h-4 w-4 text-green-500" />
            {formatNumber(totalWordCount)}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">累计字数</div>
        </div>
        <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4 text-center border border-gray-100 dark:border-gray-700/50">
          <div className="flex items-center justify-center gap-1.5 text-lg font-semibold text-gray-900 dark:text-white">
            <Zap className="h-4 w-4 text-amber-500" />
            {formatNumber(aiCallCount)}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">AI 调用次数</div>
        </div>
      </div>

      {/* 空态内容 */}
      <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-8 text-center border border-dashed border-gray-200 dark:border-gray-700">
        <div className="w-14 h-14 bg-blue-100 dark:bg-blue-900/30 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <Sparkles className="h-7 w-7 text-blue-600 dark:text-blue-400" />
        </div>
        <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-2">
          开始你的第一部小说
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
          用 AI 辅助创作，支持大纲规划、章节生成与拆解分析
        </p>
        <div className="flex items-center justify-center gap-3 flex-wrap">
          <Button onClick={onCreate} className="gap-1.5">
            <Plus className="h-4 w-4" />
            新建小说
          </Button>
          {onAnalyze && (
            <Button variant="outline" onClick={onAnalyze} className="gap-1.5">
              <Wand2 className="h-4 w-4" />
              拆解小说
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
