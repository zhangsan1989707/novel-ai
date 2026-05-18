'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Button, Card, CardContent, Badge } from '@/components/ui'
import { StreamViewer } from '@/components/ai'
import { ArrowLeft, Save } from 'lucide-react'
import { ChapterStatus } from '@/types'

interface Chapter {
  id: number
  projectId: number
  chapterNumber: number
  title: string
  content?: string
  summary?: string
  wordCount: number
  status: ChapterStatus
}

export default function ChapterGeneratePage() {
  const params = useParams()
  const router = useRouter()
  const projectId = parseInt(params.projectId as string)
  const chapterId = parseInt(params.chapterId as string)

  const [chapter, setChapter] = useState<Chapter | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // 获取章节信息
  const fetchChapter = useCallback(async () => {
    try {
      const res = await fetch(`/api/novel/projects/${projectId}/chapters/${chapterId}`)
      const data = await res.json()
      if (data.success) {
        setChapter(data.data)
      }
    } catch (error) {
      console.error('获取章节失败:', error)
    } finally {
      setLoading(false)
    }
  }, [projectId, chapterId])

  useEffect(() => {
    fetchChapter()
  }, [fetchChapter])

  // 保存生成的内容
  const handleSave = async (content: string, wordCount: number) => {
    if (!chapter) return

    setSaving(true)
    try {
      const res = await fetch(`/api/novel/projects/${projectId}/chapters/${chapterId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content,
          wordCount,
          status: 'COMPLETED',
        }),
      })
      const data = await res.json()
      if (data.success) {
        setChapter((prev) => prev ? { ...prev, content, wordCount, status: ChapterStatus.COMPLETED } : null)
        router.push(`/projects/${projectId}/chapters/${chapterId}`)
      }
    } catch (error) {
      console.error('保存失败:', error)
    } finally {
      setSaving(false)
    }
  }

  // 生成完成
  const handleComplete = (content: string, wordCount: number) => {
    handleSave(content, wordCount)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/3" />
          <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded" />
        </div>
      </div>
    )
  }

  if (!chapter) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8">
        <div className="text-center">
          <p className="text-gray-500">章节不存在</p>
          <Button variant="outline" onClick={() => router.push(`/projects/${projectId}`)} className="mt-4">
            返回项目
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-white dark:bg-gray-800 border-b">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" onClick={() => router.push(`/projects/${projectId}/chapters/${chapterId}`)}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                返回
              </Button>
              <div>
                <h1 className="text-xl font-semibold">第{chapter.chapterNumber}章 - AI 生成</h1>
                <p className="text-sm text-gray-500">{chapter.title}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={chapter.status === 'COMPLETED' ? 'success' : 'default'}>
                {chapter.status === 'COMPLETED' ? '已完成' : chapter.status === 'GENERATING' ? '生成中' : '草稿'}
              </Badge>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleSave(chapter.content || '', chapter.wordCount)}
                loading={saving}
              >
                <Save className="h-4 w-4 mr-1.5" />
                保存
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 py-6">
        <Card>
          <CardContent className="p-6">
            <StreamViewer
              projectId={projectId}
              chapterId={chapterId}
              chapterNumber={chapter.chapterNumber}
              chapterTitle={chapter.title}
              initialContent={chapter.content || ''}
              onComplete={handleComplete}
            />
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
