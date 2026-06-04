'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Button, Badge, Card, CardContent } from '@/components/ui'
import { WriterDocuments } from '@/components/writer/WriterDocuments'
import { StylePreview } from '@/components/writer/StylePreview'
import { ArrowLeft, Sparkles, RefreshCw } from 'lucide-react'
import { TrainingStatus, DocumentStatus, WriterType } from '@/types'

interface VirtualWriterDetail {
  id: number
  name: string
  description?: string | null
  writerType: string
  trainingStatus: TrainingStatus
  trainingProgress: number
  trainedAt?: string | null
  documentCount: number
  totalWordCount: number
  tags?: string | null
  styleFeatures?: string | null
  vocabularyFeatures?: string | null
  sentenceFeatures?: string | null
  rhetoricFeatures?: string | null
  themeFeatures?: string | null
  documents: Array<{
    id: number
    fileName: string
    filePath: string
    fileSize: number
    wordCount: number
    status: string
    errorMessage?: string | null
    createdAt: string
    processedAt?: string | null
  }>
  chapters: Array<{ id: number; chapterNumber: number; title: string; wordCount: number }>
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

export default function VirtualWriterDetailPage() {
  const params = useParams()
  const router = useRouter()
  const writerId = parseInt(params.writerId as string)

  const [writer, setWriter] = useState<VirtualWriterDetail | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchWriter = useCallback(async () => {
    try {
      const res = await fetch(`/api/novel/virtual-writers/${writerId}`)
      if (res.ok) {
        const data = await res.json()
        setWriter(data.data)
      }
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [writerId])

  useEffect(() => { fetchWriter() }, [fetchWriter])

  // 训练状态轮询
  useEffect(() => {
    if (writer?.trainingStatus !== TrainingStatus.TRAINING) return
    const interval = setInterval(fetchWriter, 3000)
    return () => clearInterval(interval)
  }, [writer?.trainingStatus, fetchWriter])

  const handleUpload = async (_writerId: number, file: File) => {
    const formData = new FormData()
    formData.append('file', file)
    const res = await fetch(`/api/novel/virtual-writers/${writerId}/documents`, {
      method: 'POST',
      body: formData,
    })
    if (res.ok) fetchWriter()
  }

  const handleDeleteDocument = async (documentId: number) => {
    // 文档删除暂未实现单独API，刷新列表即可
    console.warn('文档删除未实现:', documentId)
  }

  const handleTrain = async () => {
    await fetch(`/api/novel/virtual-writers/${writerId}/train`, { method: 'POST' })
    fetchWriter()
  }

  if (loading) {
    return <div className="text-center py-12 text-muted-foreground">加载中...</div>
  }

  if (!writer) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground mb-4">作家不存在</p>
        <Button variant="outline" onClick={() => router.push('/virtual-writers')}>返回列表</Button>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* 顶部导航 */}
      <Button variant="ghost" size="sm" onClick={() => router.push('/virtual-writers')}>
        <ArrowLeft className="h-4 w-4 mr-2" />
        返回虚拟作家列表
      </Button>

      {/* 作家信息 */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold">{writer.name}</h1>
              {writer.description && (
                <p className="text-muted-foreground mt-1">{writer.description}</p>
              )}
              <div className="flex items-center gap-2 mt-3">
                <Badge variant={trainingStatusVariants[writer.trainingStatus]}>
                  {trainingStatusLabels[writer.trainingStatus]}
                </Badge>
                {writer.tags?.split(',').map((tag, i) => (
                  <Badge key={i} variant="secondary">{tag.trim()}</Badge>
                ))}
              </div>
            </div>
          </div>

          {/* 训练进度 */}
          {writer.trainingStatus === TrainingStatus.TRAINING && (
            <div className="mt-4 space-y-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <RefreshCw className="h-4 w-4 animate-spin" />
                训练中... {writer.trainingProgress}%
              </div>
              <div className="w-full bg-muted rounded-full h-2">
                <div
                  className="bg-primary h-2 rounded-full transition-all duration-300"
                  style={{ width: `${writer.trainingProgress}%` }}
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 文档管理 */}
      <Card>
        <CardContent className="p-6">
          <h2 className="text-lg font-semibold mb-4">训练文档</h2>
          <WriterDocuments
            writerId={writer.id}
            documents={writer.documents.map(d => ({ ...d, status: d.status as DocumentStatus }))}
            onUpload={handleUpload}
            onDelete={handleDeleteDocument}
          />
          <div className="mt-4 pt-4 border-t flex justify-end">
            <Button
              onClick={handleTrain}
              disabled={writer.trainingStatus === TrainingStatus.TRAINING || writer.documents.length === 0}
            >
              <Sparkles className="h-4 w-4 mr-2" />
              {writer.trainingStatus === TrainingStatus.TRAINING ? '训练中...' : '开始训练'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 风格预览 */}
      <Card>
        <CardContent className="p-6">
          <h2 className="text-lg font-semibold mb-4">风格特征</h2>
          <StylePreview
            styleFeatures={writer.styleFeatures}
            vocabularyFeatures={writer.vocabularyFeatures}
            sentenceFeatures={writer.sentenceFeatures}
            rhetoricFeatures={writer.rhetoricFeatures}
            themeFeatures={writer.themeFeatures}
            trainedAt={writer.trainedAt}
          />
        </CardContent>
      </Card>

      {/* 关联章节 */}
      {writer.chapters.length > 0 && (
        <Card>
          <CardContent className="p-6">
            <h2 className="text-lg font-semibold mb-4">关联章节 ({writer.chapters.length})</h2>
            <div className="space-y-2">
              {writer.chapters.map(ch => (
                <div key={ch.id} className="flex items-center justify-between text-sm p-2 rounded bg-muted/50">
                  <span>第{ch.chapterNumber}章 {ch.title}</span>
                  <span className="text-muted-foreground">{ch.wordCount} 字</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
