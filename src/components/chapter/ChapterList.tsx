'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core'
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Button, Badge, Input, Modal, ChaptersEmptyState } from '@/components/ui'
import { GripVertical, Plus, Pencil, Trash2, Sparkles } from 'lucide-react'
import type { ChapterStatus } from '@/types'

interface Chapter {
  id: number
  chapterNumber: number
  title: string
  wordCount: number
  status: ChapterStatus
  summary?: string
  sortOrder: number
}

interface ChapterListProps {
  projectId: number
  chapters: Chapter[]
  onChaptersChange?: (chapters: Chapter[]) => void
  onOpenGenerator?: () => void
}

const statusMap: Record<ChapterStatus, { label: string; variant: 'default' | 'primary' | 'secondary' | 'success' | 'warning' | 'danger' }> = {
  DRAFT: { label: '草稿', variant: 'default' },
  GENERATING: { label: '生成中', variant: 'primary' },
  COMPLETED: { label: '已完成', variant: 'success' },
  REVIEWING: { label: '审核中', variant: 'warning' },
}

interface SortableItemProps {
  id: number
  chapter: Chapter
  onEdit: () => void
  onDelete: () => void
  onGenerate: () => void
}

function SortableItem({ id, chapter, onEdit, onDelete, onGenerate }: SortableItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:border-gray-300 dark:hover:border-gray-600 hover:shadow-sm transition-all duration-150"
    >
      <button
        className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-5 w-5" />
      </button>

      <div className="flex-1 min-w-0 cursor-pointer" onClick={onEdit}>
        <div className="flex items-center gap-2">
          <span className="text-gray-500 text-sm">第{chapter.chapterNumber}章</span>
          <span className="font-medium truncate">{chapter.title || '无标题'}</span>
        </div>
        <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
          <span>{chapter.wordCount.toLocaleString()} 字</span>
          <Badge variant={statusMap[chapter.status].variant} className="text-xs">
            {statusMap[chapter.status].label}
          </Badge>
        </div>
      </div>

      <div className="flex items-center gap-1">
        <Button
          size="sm"
          variant="ghost"
          onClick={onGenerate}
          title="AI生成"
        >
          <Sparkles className="h-4 w-4" />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={onEdit}
          title="编辑"
        >
          <Pencil className="h-4 w-4" />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={onDelete}
          className="hover:text-red-500"
          title="删除"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}

export function ChapterList({ projectId, chapters: initialChapters, onChaptersChange, onOpenGenerator }: ChapterListProps) {
  const router = useRouter()
  const [chapters, setChapters] = useState(initialChapters)
  const [showNewModal, setShowNewModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [selectedChapter, setSelectedChapter] = useState<Chapter | null>(null)
  const [newChapterTitle, setNewChapterTitle] = useState('')
  const [newChapterNumber, setNewChapterNumber] = useState(1)
  const [nextNumber, setNextNumber] = useState(1)
  const [loading, setLoading] = useState(false)
  const [creating, setCreating] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  useEffect(() => {
    setChapters(initialChapters)
  }, [initialChapters])

  // 获取下一个可用章节号
  useEffect(() => {
    const fetchNextNumber = async () => {
      try {
        const res = await fetch(`/api/novel/projects/${projectId}/chapters/next-number`)
        const data = await res.json()
        if (data.success) {
          setNextNumber(data.data.nextNumber)
          setNewChapterNumber(data.data.nextNumber)
        }
      } catch (error) {
        console.error('获取章节号失败:', error)
      }
    }
    fetchNextNumber()
  }, [projectId])

  // 拖拽结束
  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event

    if (over && active.id !== over.id) {
      const oldIndex = chapters.findIndex((c) => c.id === active.id)
      const newIndex = chapters.findIndex((c) => c.id === over.id)

      const newChapters = arrayMove(chapters, oldIndex, newIndex)
      setChapters(newChapters)
      onChaptersChange?.(newChapters)

      // 保存排序
      try {
        await fetch(`/api/novel/projects/${projectId}/chapters/reorder`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chapterIds: newChapters.map((c) => c.id),
          }),
        })
      } catch (error) {
        console.error('保存排序失败:', error)
      }
    }
  }

  // 创建章节
  const handleCreate = async () => {
    if (!newChapterTitle.trim()) return

    setCreating(true)
    try {
      const res = await fetch(`/api/novel/projects/${projectId}/chapters`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newChapterTitle,
          chapterNumber: newChapterNumber,
        }),
      })
      const data = await res.json()
      if (data.success) {
        setShowNewModal(false)
        setNewChapterTitle('')
        router.push(`/projects/${projectId}/chapters/${data.data.id}`)
      }
    } catch (error) {
      console.error('创建章节失败:', error)
    } finally {
      setCreating(false)
    }
  }

  // 删除章节
  const handleDelete = async () => {
    if (!selectedChapter) return

    setLoading(true)
    try {
      const res = await fetch(`/api/novel/projects/${projectId}/chapters/${selectedChapter.id}`, {
        method: 'DELETE',
      })
      const data = await res.json()
      if (data.success) {
        setChapters(chapters.filter((c) => c.id !== selectedChapter.id))
        onChaptersChange?.(chapters.filter((c) => c.id !== selectedChapter.id))
        setShowDeleteModal(false)
        setSelectedChapter(null)
      }
    } catch (error) {
      console.error('删除章节失败:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-medium">章节列表</h3>
        <Button size="sm" onClick={() => setShowNewModal(true)}>
          <Plus className="h-4 w-4 mr-2" />
          新建章节
        </Button>
      </div>

      {chapters.length === 0 ? (
        <ChaptersEmptyState
          onCreate={() => setShowNewModal(true)}
          onGenerate={onOpenGenerator || (() => {})}
        />
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={chapters.map((c) => c.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-2">
              {chapters.map((chapter) => (
                <SortableItem
                  key={chapter.id}
                  id={chapter.id}
                  chapter={chapter}
                  onEdit={() => router.push(`/projects/${projectId}/chapters/${chapter.id}`)}
                  onDelete={() => {
                    setSelectedChapter(chapter)
                    setShowDeleteModal(true)
                  }}
                  onGenerate={() => router.push(`/projects/${projectId}/chapters/${chapter.id}/generate`)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {/* 新建章节 Modal */}
      <Modal
        open={showNewModal}
        onClose={() => setShowNewModal(false)}
        title="新建章节"
      >
        <div className="space-y-4">
          <Input
            label="章节编号"
            type="number"
            value={newChapterNumber}
            onChange={(e) => setNewChapterNumber(parseInt(e.target.value) || 1)}
            min={1}
          />
          <Input
            label="章节标题"
            placeholder="请输入章节标题"
            value={newChapterTitle}
            onChange={(e) => setNewChapterTitle(e.target.value)}
          />
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setShowNewModal(false)}>
              取消
            </Button>
            <Button onClick={handleCreate} loading={creating}>
              创建
            </Button>
          </div>
        </div>
      </Modal>

      {/* 删除确认 Modal */}
      <Modal
        open={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title="删除章节"
        description={`确定要删除"${selectedChapter?.title}"吗？此操作不可撤销。`}
      >
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={() => setShowDeleteModal(false)}>
            取消
          </Button>
          <Button variant="danger" onClick={handleDelete} loading={loading}>
            删除
          </Button>
        </div>
      </Modal>
    </div>
  )
}
