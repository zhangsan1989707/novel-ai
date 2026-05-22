'use client'

import { useRouter } from 'next/navigation'
import { Card, CardContent, Badge, Progress, Button } from '@/components/ui'
import { Pencil, Trash2, BookOpen, Clock, Sparkles } from 'lucide-react'
import { formatDisplayDate } from '@/lib/helpers'
import type { ProjectStatus } from '@/types'

interface ProjectCardProps {
  project: {
    id: number
    title: string
    description?: string | null
    genre?: string | null
    writingStyle?: string | null
    targetWordCount?: number | null
    currentWordCount: number
    status: ProjectStatus
    coverImage?: string | null
    updatedAt: string
    projectMode?: string
    _count?: {
      chapters: number
    }
  }
  onEdit?: (id: number) => void
  onDelete?: (id: number) => void
}

const statusMap: Record<ProjectStatus, { label: string; variant: 'default' | 'primary' | 'secondary' | 'success' | 'warning' | 'danger' }> = {
  DRAFT: { label: '草稿', variant: 'default' },
  WRITING: { label: '写作中', variant: 'primary' },
  COMPLETED: { label: '已完成', variant: 'success' },
  PAUSED: { label: '已暂停', variant: 'warning' },
}

const isAnalyzeMode = (project: ProjectCardProps['project']) => project.projectMode === 'ANALYZE'

export function ProjectCard({ project, onEdit, onDelete }: ProjectCardProps) {
  const router = useRouter()

  const progress = project.targetWordCount
    ? Math.round((project.currentWordCount / project.targetWordCount) * 100)
    : 0

  return (
    <Card hover className="group cursor-pointer overflow-hidden" onClick={() => router.push(`/projects/${project.id}`)}>
      {/* 封面区域 */}
      <div className={`relative h-32 ${isAnalyzeMode(project) ? 'bg-gradient-to-br from-amber-500 to-orange-600' : 'bg-gradient-to-br from-blue-500 to-purple-600'}`}>
        {project.coverImage ? (
          <img src={project.coverImage} alt={project.title} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center">
            <BookOpen className="h-12 w-12 text-white/50" />
          </div>
        )}
        {/* 拆解模式标识 */}
        {isAnalyzeMode(project) && (
          <div className="absolute left-2 top-2 flex items-center gap-1 px-2 py-1 rounded-md bg-amber-400/90 text-amber-900 text-xs font-medium">
            <Sparkles className="h-3 w-3" />
            拆解
          </div>
        )}
        <div className="absolute right-2 top-2 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-all duration-150">
          <Button
            size="sm"
            variant="ghost"
            className="h-8 w-8 p-0 bg-white/90 hover:bg-white dark:bg-gray-800/90 dark:hover:bg-gray-800"
            onClick={(e) => {
              e.stopPropagation()
              onEdit?.(project.id)
            }}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-8 w-8 p-0 bg-white/90 hover:bg-white hover:text-red-500 dark:bg-gray-800/90 dark:hover:bg-gray-800"
            onClick={(e) => {
              e.stopPropagation()
              onDelete?.(project.id)
            }}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <CardContent className="p-4">
        {/* 标题和标签 */}
        <div className="mb-2 flex items-start justify-between gap-2">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100 line-clamp-1">{project.title}</h3>
          <Badge variant={statusMap[project.status].variant}>{statusMap[project.status].label}</Badge>
        </div>

        {/* 类型和风格 */}
        <div className="mb-3 flex gap-2 text-xs text-gray-500">
          {project.genre && <span>{project.genre}</span>}
          {project.genre && project.writingStyle && <span>·</span>}
          {project.writingStyle && <span>{project.writingStyle}</span>}
        </div>

        {/* 进度 */}
        {project.targetWordCount && (
          <div className="mb-3">
            <Progress value={progress} size="sm" />
            <div className="mt-1 flex justify-between text-xs text-gray-500">
              <span>{project.currentWordCount.toLocaleString()} 字</span>
              <span>{project.targetWordCount.toLocaleString()} 字</span>
            </div>
          </div>
        )}

        {/* 统计和时间 */}
        <div className="flex items-center justify-between text-xs text-gray-400">
          <div className="flex items-center gap-3">
            <span>{project._count?.chapters || 0} 章</span>
            <span>{project.currentWordCount.toLocaleString()} 字</span>
          </div>
          <div className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            <span>{formatDisplayDate(project.updatedAt)}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
