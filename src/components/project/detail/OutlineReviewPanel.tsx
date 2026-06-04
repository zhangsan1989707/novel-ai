'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button, Card, CardContent, Input } from '@/components/ui'
import { CheckCircle, Edit3, Save } from 'lucide-react'

interface ChapterOutline {
  id: number
  chapterNumber: number
  title: string
  summary: string | null
  chapterOutline: Record<string, unknown> | null
}

interface OutlineReviewPanelProps {
  projectId: number
  onConfirmed: () => void
}

export function OutlineReviewPanel({ projectId, onConfirmed }: OutlineReviewPanelProps) {
  const [outlines, setOutlines] = useState<ChapterOutline[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Record<number, { title: string; summary: string }>>({})
  const [saving, setSaving] = useState(false)

  const fetchOutlines = useCallback(async () => {
    try {
      const res = await fetch(`/api/novel/projects/${projectId}/chapters/outline`)
      if (res.ok) {
        const data = await res.json()
        setOutlines(data.data || [])
      }
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => { fetchOutlines() }, [fetchOutlines])

  const startEdit = (ch: ChapterOutline) => {
    setEditing(prev => ({
      ...prev,
      [ch.chapterNumber]: { title: ch.title, summary: ch.summary || '' },
    }))
  }

  const updateEdit = (chapterNumber: number, field: 'title' | 'summary', value: string) => {
    setEditing(prev => ({
      ...prev,
      [chapterNumber]: { ...prev[chapterNumber], [field]: value },
    }))
  }

  const handleConfirm = async () => {
    setSaving(true)
    try {
      // 保存编辑
      const editedOutlines = Object.entries(editing).map(([chNum, data]) => ({
        chapterNumber: parseInt(chNum),
        title: data.title,
        summary: data.summary,
      }))

      if (editedOutlines.length > 0) {
        await fetch(`/api/novel/projects/${projectId}/chapters/outline`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ outlines: editedOutlines }),
        })
      }

      // 确认大纲
      const res = await fetch(`/api/novel/projects/${projectId}/outline/confirm`, { method: 'POST' })
      if (res.ok) {
        onConfirmed()
      }
    } catch {
      // ignore
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="text-center py-8 text-muted-foreground">加载中...</div>
  }

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-semibold">审核章节目录</h2>
            <p className="text-sm text-muted-foreground mt-1">
              共 {outlines.length} 章 · 编辑标题和摘要后确认开始生成
            </p>
          </div>
          <Button onClick={handleConfirm} disabled={saving}>
            <CheckCircle className="h-4 w-4 mr-2" />
            {saving ? '确认中...' : '确认大纲并开始生成'}
          </Button>
        </div>

        <div className="space-y-3 max-h-[60vh] overflow-y-auto">
          {outlines.map(ch => {
            const isEditing = editing[ch.chapterNumber] !== undefined
            const editData = editing[ch.chapterNumber]

            return (
              <div key={ch.id} className="border rounded-lg p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded">
                        #{ch.chapterNumber}
                      </span>
                      {isEditing ? (
                        <Input
                          value={editData.title}
                          onChange={e => updateEdit(ch.chapterNumber, 'title', e.target.value)}
                          className="h-7 text-sm"
                        />
                      ) : (
                        <span className="font-medium">{ch.title}</span>
                      )}
                    </div>
                    {isEditing ? (
                      <textarea
                        value={editData.summary}
                        onChange={e => updateEdit(ch.chapterNumber, 'summary', e.target.value)}
                        className="w-full mt-2 text-sm border rounded p-2 bg-background resize-none"
                        rows={3}
                      />
                    ) : (
                      <p className="text-sm text-muted-foreground mt-1">{ch.summary || '无摘要'}</p>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => isEditing ? setEditing(prev => { const next = { ...prev }; delete next[ch.chapterNumber]; return next }) : startEdit(ch)}
                  >
                    {isEditing ? <Save className="h-4 w-4" /> : <Edit3 className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
