'use client'

import { Button, Badge, Card, CardContent } from '@/components/ui'
import { WriterType, TrainingStatus } from '@/types'
import { Edit2, Trash2, FileText, Sparkles, Upload } from 'lucide-react'

interface VirtualWriter {
  id: number
  name: string
  description?: string | null
  writerType: WriterType
  styleFeatures?: string | null
  trainingStatus: TrainingStatus
  documentCount: number
  totalWordCount: number
  tags?: string | null
  _count?: {
    documents: number
    chapters: number
  }
}

interface WriterCardProps {
  writer: VirtualWriter
  onEdit: (id: number) => void
  onDelete: (id: number) => void
  onManageDocuments: (id: number) => void
  onTrain: (id: number) => void
}

const trainingStatusLabels: Record<TrainingStatus, string> = {
  UNTRAINED: '未训练',
  TRAINING: '训练中',
  TRAINED: '已训练',
  FAILED: '训练失败',
}

const trainingStatusVariants: Record<TrainingStatus, 'default' | 'warning' | 'success' | 'danger'> = {
  UNTRAINED: 'default',
  TRAINING: 'warning',
  TRAINED: 'success',
  FAILED: 'danger',
}

const writerTypeLabels: Record<WriterType, string> = {
  REAL_AUTHOR: '真实作家',
  CUSTOM: '自定义作家',
}

export function WriterCard({
  writer,
  onEdit,
  onDelete,
  onManageDocuments,
  onTrain,
}: WriterCardProps) {
  const documentCount = writer._count?.documents ?? writer.documentCount
  const chapterCount = writer._count?.chapters ?? 0

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-semibold truncate">{writer.name}</h3>
              <Badge variant="outline">
                {writerTypeLabels[writer.writerType]}
              </Badge>
            </div>
            {writer.description && (
              <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2">
                {writer.description}
              </p>
            )}
          </div>
        </div>

        {/* 标签 */}
        {writer.tags && (
          <div className="flex flex-wrap gap-1 mb-3">
            {writer.tags.split(',').map((tag, i) => (
              <Badge key={i} variant="secondary">
                {tag.trim()}
              </Badge>
            ))}
          </div>
        )}

        {/* 统计信息 */}
        <div className="grid grid-cols-3 gap-2 mb-3 text-sm">
          <div className="text-center p-2 bg-gray-50 dark:bg-gray-800 rounded">
            <div className="font-medium">{documentCount}</div>
            <div className="text-xs text-gray-500">文档</div>
          </div>
          <div className="text-center p-2 bg-gray-50 dark:bg-gray-800 rounded">
            <div className="font-medium">{chapterCount}</div>
            <div className="text-xs text-gray-500">章节</div>
          </div>
          <div className="text-center p-2 bg-gray-50 dark:bg-gray-800 rounded">
            <div className="font-medium">{writer.totalWordCount.toLocaleString()}</div>
            <div className="text-xs text-gray-500">字数</div>
          </div>
        </div>

        {/* 训练状态 */}
        <div className="mb-3">
          <Badge variant={trainingStatusVariants[writer.trainingStatus]}>
            {trainingStatusLabels[writer.trainingStatus]}
          </Badge>
        </div>

        {/* 操作按钮 */}
        <div className="flex justify-between pt-3 border-t">
          <div className="flex gap-1">
            <Button variant="ghost" size="sm" onClick={() => onManageDocuments(writer.id)}>
              <FileText className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onTrain(writer.id)}
              disabled={writer.trainingStatus === TrainingStatus.TRAINING}
            >
              <Sparkles className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex gap-1">
            <Button variant="ghost" size="sm" onClick={() => onEdit(writer.id)}>
              <Edit2 className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => onDelete(writer.id)}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
