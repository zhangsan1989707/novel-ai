'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Button, Input, Card, CardContent } from '@/components/ui'
import { WriterCard } from '@/components/writer/WriterCard'
import { WriterForm, type WriterFormData } from '@/components/writer/WriterForm'
import { Plus, Search } from 'lucide-react'
import { TrainingStatus, WriterType } from '@/types'

interface VirtualWriter {
  id: number
  name: string
  description?: string | null
  writerType: string
  trainingStatus: TrainingStatus
  documentCount: number
  totalWordCount: number
  tags?: string | null
  _count?: { documents: number; chapters: number }
}

export default function VirtualWritersPage() {
  const router = useRouter()
  const [writers, setWriters] = useState<VirtualWriter[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [searchQuery, setSearchQuery] = useState('')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editWriter, setEditWriter] = useState<VirtualWriter | null>(null)
  const [deleteWriterId, setDeleteWriterId] = useState<number | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const fetchWriters = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: '12' })
      if (searchQuery) params.set('search', searchQuery)
      const res = await fetch(`/api/novel/virtual-writers?${params}`)
      if (res.ok) {
        const data = await res.json()
        setWriters(data.data || [])
        setTotalPages(data.pagination?.totalPages || 1)
      }
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [page, searchQuery])

  useEffect(() => { fetchWriters() }, [fetchWriters])

  const handleCreate = async (data: WriterFormData) => {
    setSubmitting(true)
    try {
      const res = await fetch('/api/novel/virtual-writers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (res.ok) {
        setShowCreateModal(false)
        fetchWriters()
      }
    } finally {
      setSubmitting(false)
    }
  }

  const handleEdit = async (data: WriterFormData) => {
    if (!editWriter) return
    setSubmitting(true)
    try {
      const res = await fetch(`/api/novel/virtual-writers/${editWriter.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (res.ok) {
        setEditWriter(null)
        fetchWriters()
      }
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteWriterId) return
    await fetch(`/api/novel/virtual-writers/${deleteWriterId}`, { method: 'DELETE' })
    setDeleteWriterId(null)
    fetchWriters()
  }

  const handleTrain = async (id: number) => {
    await fetch(`/api/novel/virtual-writers/${id}/train`, { method: 'POST' })
    fetchWriters()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">虚拟作家</h1>
        <Button onClick={() => setShowCreateModal(true)}>
          <Plus className="h-4 w-4 mr-2" />
          创建作家
        </Button>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="搜索作家..."
            value={searchQuery}
            onChange={e => { setSearchQuery(e.target.value); setPage(1) }}
            className="pl-9"
          />
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">加载中...</div>
      ) : writers.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <p className="text-muted-foreground mb-4">还没有虚拟作家</p>
            <Button onClick={() => setShowCreateModal(true)}>创建第一个作家</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {writers.map(writer => (
            <div key={writer.id} onClick={() => router.push(`/virtual-writers/${writer.id}`)} className="cursor-pointer">
              <WriterCard
                writer={{ ...writer, writerType: writer.writerType as WriterType }}
                onEdit={id => { const w = writers.find(w => w.id === id); if (w) setEditWriter(w) }}
                onDelete={setDeleteWriterId}
                onManageDocuments={id => router.push(`/virtual-writers/${id}`)}
                onTrain={handleTrain}
              />
            </div>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex justify-center gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>上一页</Button>
          <span className="flex items-center px-3 text-sm text-muted-foreground">{page} / {totalPages}</span>
          <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>下一页</Button>
        </div>
      )}

      {/* 创建弹窗 */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-card rounded-xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-semibold mb-4">创建虚拟作家</h2>
            <WriterForm onSubmit={handleCreate} onCancel={() => setShowCreateModal(false)} loading={submitting} />
          </div>
        </div>
      )}

      {/* 编辑弹窗 */}
      {editWriter && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-card rounded-xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-semibold mb-4">编辑虚拟作家</h2>
            <WriterForm
              defaultValues={{ name: editWriter.name, description: editWriter.description || '', writerType: editWriter.writerType as WriterType, isPublic: false, tags: editWriter.tags || '' }}
              onSubmit={handleEdit}
              onCancel={() => setEditWriter(null)}
              loading={submitting}
            />
          </div>
        </div>
      )}

      {/* 删除确认 */}
      {deleteWriterId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-card rounded-xl p-6 w-full max-w-sm">
            <h2 className="text-lg font-semibold mb-2">确认删除</h2>
            <p className="text-sm text-muted-foreground mb-4">删除后不可恢复，确认要删除此虚拟作家吗？</p>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setDeleteWriterId(null)}>取消</Button>
              <Button variant="danger" onClick={handleDelete}>删除</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
