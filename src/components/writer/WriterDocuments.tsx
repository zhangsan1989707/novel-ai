'use client'

import { useState, useCallback } from 'react'
import { Button, Badge, Progress } from '@/components/ui'
import { Upload, FileText, Trash2, RefreshCw, CheckCircle, XCircle, Clock } from 'lucide-react'
import { DocumentStatus } from '@/types'
import { formatDisplayDate } from '@/lib/helpers'

interface WriterDocument {
  id: number
  fileName: string
  filePath: string
  fileSize: number
  wordCount: number
  status: DocumentStatus
  errorMessage?: string | null
  createdAt: string
  processedAt?: string | null
}

interface WriterDocumentsProps {
  writerId: number
  documents: WriterDocument[]
  onUpload: (writerId: number, file: File) => Promise<void>
  onDelete: (documentId: number) => Promise<void>
}

const statusConfig: Record<DocumentStatus, { label: string; icon: typeof Clock; variant: 'default' | 'warning' | 'success' | 'danger' }> = {
  PENDING: { label: '等待中', icon: Clock, variant: 'default' },
  PROCESSING: { label: '处理中', icon: RefreshCw, variant: 'warning' },
  COMPLETED: { label: '已完成', icon: CheckCircle, variant: 'success' },
  FAILED: { label: '失败', icon: XCircle, variant: 'danger' },
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function WriterDocuments({ writerId, documents, onUpload, onDelete }: WriterDocumentsProps) {
  const [uploading, setUploading] = useState(false)
  const [deletingId, setDeletingId] = useState<number | null>(null)

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    try {
      await onUpload(writerId, file)
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }, [writerId, onUpload])

  const handleDelete = useCallback(async (docId: number) => {
    setDeletingId(docId)
    try {
      await onDelete(docId)
    } finally {
      setDeletingId(null)
    }
  }, [onDelete])

  return (
    <div className="space-y-4">
      {/* 上传区域 */}
      <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-6 text-center hover:border-gray-400 dark:hover:border-gray-500 transition-colors">
        <input
          type="file"
          id={`upload-${writerId}`}
          className="hidden"
          accept=".txt,.md,.doc,.docx"
          onChange={handleFileChange}
          disabled={uploading}
        />
        <label htmlFor={`upload-${writerId}`} className="cursor-pointer">
          <Upload className="h-8 w-8 mx-auto mb-2 text-gray-400" />
          <div className="text-sm text-gray-500">
            {uploading ? '上传中...' : '点击上传文档'}
          </div>
          <div className="text-xs text-gray-400 mt-1">
            支持 .txt, .md, .doc, .docx 格式
          </div>
        </label>
      </div>

      {/* 文档列表 */}
      {documents.length > 0 ? (
        <div className="space-y-2">
          {documents.map((doc) => {
            const config = statusConfig[doc.status]
            const Icon = config.icon

            return (
              <div
                key={doc.id}
                className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <FileText className="h-5 w-5 text-gray-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium truncate">{doc.fileName}</span>
                      <Badge variant={config.variant}>
                        <Icon className="h-3 w-3 mr-1" />
                        {config.label}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-gray-500 mt-1">
                      <span>{formatFileSize(doc.fileSize)}</span>
                      <span>{doc.wordCount.toLocaleString()} 字</span>
                      {doc.processedAt && (
                        <span>处理于 {formatDisplayDate(doc.processedAt)}</span>
                      )}
                    </div>
                    {doc.errorMessage && (
                      <div className="text-xs text-red-500 mt-1">{doc.errorMessage}</div>
                    )}
                  </div>
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDelete(doc.id)}
                  disabled={deletingId === doc.id}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="text-center py-8 text-gray-500">
          暂无文档，上传文档后可开始训练
        </div>
      )}

      {/* 训练进度 */}
      {documents.some(d => d.status === 'PROCESSING') && (
        <div className="space-y-1">
          <div className="text-sm text-gray-500">处理中...</div>
          <Progress value={50} size="sm" />
        </div>
      )}
    </div>
  )
}
