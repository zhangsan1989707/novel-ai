'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core'
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Button, Badge, Input, Modal, ChaptersEmptyState, ExpandableList } from '@/components/ui'
import { GripVertical, Plus, Pencil, Trash2, Sparkles, Eye, Clock, Hash, Loader2 } from 'lucide-react'
import { formatLargeNumber } from '@/lib/utils'
import { formatChapterStatus, formatTimeAgo } from '@/lib/format-labels'
import { ChapterDrawer } from './ChapterDrawer'
import type { ChapterStatus } from '@/types'

interface Chapter {
  id: number
  chapterNumber: number
  title: string
  wordCount: number
  status: ChapterStatus
  summary?: string
  sortOrder: number
  updatedAt?: string
}

const INITIAL_VISIBLE_CHAPTERS = 12

interface ChapterListProps {
  projectId: number
  chapters: Chapter[]
  onChaptersChange?: (chapters: Chapter[]) => void
  onOpenGenerator?: () => void
}

interface SortableItemProps {
  id: number
  chapter: Chapter
  onEdit: () => void
  onDelete: () => void
  onGenerate: () => void
  onView: () => void
}

function SortableItem({ id, chapter, onEdit, onDelete, onGenerate, onView }: SortableItemProps) {
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

  const isGenerating = chapter.status === 'GENERATING'
  const summary = chapter.summary || ''
  const truncatedSummary = summary.length > 120 ? summary.slice(0, 120) + '...' : summary

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="group flex items-start gap-3 p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:border-blue-300 dark:hover:border-blue-600 hover:shadow-sm transition-all duration-150 cursor-pointer"
      onClick={onView}
    >
      <button
        className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 mt-1 shrink-0"
        onClick={e => e.stopPropagation()}
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-5 w-5" />
      </button>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-gray-500 text-sm font-medium">第{chapter.chapterNumber}章</span>
          <span className="font-medium truncate">{chapter.title || '无标题'}</span>
          {isGenerating && (
            <Badge variant="primary" className="text-xs gap-1">
              <Loader2 className="h-3 w-3 animate-spin" />
              生成中
            </Badge>
          )}
          {!isGenerating && (
            <Badge variant={chapter.status === 'COMPLETED' ? 'success' : chapter.status === 'REVIEWING' ? 'warning' : 'default'} className="text-xs">
              {formatChapterStatus(chapter.status)}
            </Badge>
          )}
        </div>
        
        <div className="flex items-center gap-4 text-xs text-gray-400 mb-2">
          <span className="flex items-center gap-1">
            <Hash className="h-3 w-3" />
            {formatLargeNumber(chapter.wordCount)}字
          </span>
          {chapter.updatedAt && (
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formatTimeAgo(chapter.updatedAt)}
            </span>
          )}
        </div>

        {truncatedSummary && (
          <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2 leading-relaxed">
            {truncatedSummary}
          </p>
        )}
      </div>

      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        <Button
          size="sm"
          variant="ghost"
          onClick={e => { e.stopPropagation(); onView() }}
          title="查看全文"
        >
          <Eye className="h-4 w-4" />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={e => { e.stopPropagation(); onGenerate() }}
          title="AI生成"
        >
          <Sparkles className="h-4 w-4" />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={e => { e.stopPropagation(); onEdit() }}
          title="编辑"
        >
          <Pencil className="h-4 w-4" />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={e => { e.stopPropagation(); onDelete() }}
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
  const [drawerChapterId, setDrawerChapterId] = useState<number | null>(null)
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
        const newChapter = data.data
        const updatedChapters = [...chapters, newChapter].sort((a, b) => a.chapterNumber - b.chapterNumber)
        setChapters(updatedChapters)
        onChaptersChange?.(updatedChapters)
        setShowNewModal(false)
        setNewChapterTitle('')
        setNewChapterNumber(nextNumber + 1)
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
        const updatedChapters = chapters.filter(c => c.id !== selectedChapter.id)
        setChapters(updatedChapters)
        onChaptersChange?.(updatedChapters)
        setShowDeleteModal(false)
        setSelectedChapter(null)
      }
    } catch (error) {
      console.error('删除章节失败:', error)
    } finally {
      setLoading(false)
    }
  }

  if (chapters.length === 0) {
    return <ChaptersEmptyState onCreate={() => setShowNewModal(true)} onGenerate={() => onOpenGenerator?.()} />
  }

  return (
    <>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={chapters.map(c => c.id)}
          strategy={verticalListSortingStrategy}
        >
          <ExpandableList
            items={chapters} getKey={(chapter) => chapter.id}
            initialVisibleCount={INITIAL_VISIBLE_CHAPTERS}
            renderItem={(chapter) => (
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
                onView={() => setDrawerChapterId(chapter.id)}
              />
            )}
          />
        </SortableContext>
      </DndContext>

      {/* 新建章节弹窗 */}
      <Modal
        open={showNewModal}
        onClose={() => setShowNewModal(false)}
        title="新建章节"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">章节号</label>
            <Input
              type="number"
              value={newChapterNumber}
              onChange={(e) => setNewChapterNumber(Number(e.target.value))}
              min={1}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">章节标题</label>
            <Input
              value={newChapterTitle}
              onChange={(e) => setNewChapterTitle(e.target.value)}
              placeholder="输入章节标题"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowNewModal(false)}>
              取消
            </Button>
            <Button onClick={handleCreate} disabled={!newChapterTitle.trim() || creating}>
              {creating ? '创建中...' : '创建'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* 删除确认弹窗 */}
      <Modal
        open={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title="确认删除"
      >
        <div className="space-y-4">
          <p>确定要删除第{selectedChapter?.chapterNumber}章《{selectedChapter?.title}》吗？此操作不可撤销。</p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowDeleteModal(false)}>
              取消
            </Button>
            <Button variant="danger" onClick={handleDelete} disabled={loading}>
              {loading ? '删除中...' : '删除'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* 章节详情抽屉 */}
      {drawerChapterId && (
        <ChapterDrawer
          projectId={projectId}
          chapterId={drawerChapterId}
          chapters={chapters.map(c => ({ id: c.id, chapterNumber: c.chapterNumber, title: c.title }))}
          onClose={() => setDrawerChapterId(null)}
          onNavigate={(id) => setDrawerChapterId(id)}
          onStatusChange={(chapterId, newStatus) => {
            const updatedChapters = chapters.map(c =>
              c.id === chapterId ? { ...c, status: newStatus as ChapterStatus } : c
            )
            setChapters(updatedChapters)
            onChaptersChange?.(updatedChapters)
          }}
        />
      )}
    </>
  )
}
