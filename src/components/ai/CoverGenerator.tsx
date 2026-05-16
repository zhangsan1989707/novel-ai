'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import NextImage from 'next/image'
import { Button, Card, CardContent, CardHeader, CardTitle, Badge } from '@/components/ui'
import { ImageIcon, Trash2, Loader2, Palette, Layout, Sparkles, Check, Wand2 } from 'lucide-react'
import { toast } from '@/components/ui/Toast'

interface CoverDesign {
  id: string
  imageUrl: string
  prompt: string
  colorScheme: string[]
  composition: string | null
  elements: string[]
  mood: string | null
  style: string | null
  isApplied: boolean
  createdAt: string
}

interface CoverGeneratorProps {
  projectId: number
}

const genreOptions = [
  { value: '玄幻', label: '玄幻', emoji: '🏔️' },
  { value: '都市', label: '都市', emoji: '🌃' },
  { value: '仙侠', label: '仙侠', emoji: '⚔️' },
  { value: '科幻', label: '科幻', emoji: '🚀' },
  { value: '言情', label: '言情', emoji: '💕' },
  { value: '历史', label: '历史', emoji: '🏯' },
  { value: '悬疑', label: '悬疑', emoji: '🔍' },
]

export function CoverGenerator({ projectId }: CoverGeneratorProps) {
  const [selectedStyle, setSelectedStyle] = useState<string>('')
  const [generating, setGenerating] = useState(false)
  const [coverDesigns, setCoverDesigns] = useState<CoverDesign[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedDesign, setSelectedDesign] = useState<CoverDesign | null>(null)
  const [applyingId, setApplyingId] = useState<string | null>(null)
  const initializedRef = useRef(false)

  const loadCoverDesigns = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/novel/cover/list?projectId=${projectId}`)
      const data = await res.json()
      if (data.success) {
        setCoverDesigns(data.data)
      }
    } catch {
      toast.error('加载封面列表失败')
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    if (!initializedRef.current) {
      initializedRef.current = true
      loadCoverDesigns()
    }
  }, [loadCoverDesigns])

  const handleGenerate = useCallback(async () => {
    setGenerating(true)
    try {
      const res = await fetch('/api/novel/cover/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          style: selectedStyle || undefined,
        }),
      })

      const data = await res.json()
      if (data.success) {
        toast.success('封面生成完成')
        loadCoverDesigns()
        setSelectedDesign(data.data)
      } else {
        toast.error(data.error?.message || '封面生成失败')
      }
    } catch {
      toast.error('封面生成请求失败')
    } finally {
      setGenerating(false)
    }
  }, [projectId, selectedStyle, loadCoverDesigns])

  const handleApply = useCallback(async (designId: string) => {
    setApplyingId(designId)
    try {
      const res = await fetch(`/api/novel/cover/${designId}`, {
        method: 'PATCH',
      })
      const data = await res.json()
      if (data.success) {
        toast.success('封面已应用')
        setCoverDesigns(prev =>
          prev.map(d => ({
            ...d,
            isApplied: d.id === designId,
          }))
        )
      } else {
        toast.error(data.error?.message || '应用封面失败')
      }
    } catch {
      toast.error('应用封面请求失败')
    } finally {
      setApplyingId(null)
    }
  }, [])

  const handleDelete = useCallback(async (designId: string) => {
    try {
      const res = await fetch(`/api/novel/cover/${designId}`, {
        method: 'DELETE',
      })
      const data = await res.json()
      if (data.success) {
        toast.success('已删除')
        setCoverDesigns(prev => prev.filter(d => d.id !== designId))
        if (selectedDesign?.id === designId) {
          setSelectedDesign(null)
        }
      } else {
        toast.error(data.error?.message || '删除失败')
      }
    } catch {
      toast.error('删除请求失败')
    }
  }, [selectedDesign])

  return (
    <div className="space-y-6">
      <div className="space-y-4 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
        <div className="flex items-center gap-2">
          <ImageIcon className="h-4 w-4 text-blue-500" />
          <span className="text-sm font-medium">封面生成</span>
        </div>

        <div className="space-y-2">
          <label className="text-xs text-gray-500">封面风格</label>
          <div className="flex flex-wrap gap-2">
            {genreOptions.map(option => (
              <button
                key={option.value}
                onClick={() => setSelectedStyle(prev => prev === option.value ? '' : option.value)}
                className={`px-3 py-1.5 text-sm rounded-lg border transition-all ${
                  selectedStyle === option.value
                    ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-400'
                    : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:border-gray-400'
                }`}
              >
                {option.emoji} {option.label}
              </button>
            ))}
          </div>
        </div>

        <Button
          variant="primary"
          onClick={handleGenerate}
          disabled={generating}
        >
          {generating ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              生成中...
            </>
          ) : (
            <>
              <Wand2 className="h-4 w-4 mr-2" />
              生成封面
            </>
          )}
        </Button>
      </div>

      {selectedDesign && (
        <Card>
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-sm">封面预览</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-4">
            <div className="flex justify-center">
              <NextImage
                src={selectedDesign.imageUrl}
                alt="封面预览"
                width={240}
                height={320}
                className="max-w-[240px] w-full rounded-lg shadow-md"
                unoptimized
              />
            </div>

            {(selectedDesign.colorScheme.length > 0 || selectedDesign.composition || selectedDesign.elements.length > 0 || selectedDesign.mood) && (
              <div className="space-y-3 pt-2">
                {selectedDesign.colorScheme.length > 0 && (
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-1.5 text-xs font-medium text-gray-500">
                      <Palette className="h-3.5 w-3.5" />
                      配色方案
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {selectedDesign.colorScheme.map((color, i) => (
                        <div key={i} className="flex items-center gap-1.5">
                          <div
                            className="w-5 h-5 rounded border border-gray-200 dark:border-gray-600"
                            style={{ backgroundColor: color.startsWith('#') ? color : undefined }}
                          />
                          <span className="text-xs text-gray-600 dark:text-gray-400">{color}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {selectedDesign.composition && (
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 text-xs font-medium text-gray-500">
                      <Layout className="h-3.5 w-3.5" />
                      构图建议
                    </div>
                    <p className="text-sm text-gray-700 dark:text-gray-300">
                      {selectedDesign.composition}
                    </p>
                  </div>
                )}

                {selectedDesign.elements.length > 0 && (
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-1.5 text-xs font-medium text-gray-500">
                      <Sparkles className="h-3.5 w-3.5" />
                      核心元素
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {selectedDesign.elements.map((el, i) => (
                        <Badge key={i} className="bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300">
                          {el}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {selectedDesign.mood && (
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 text-xs font-medium text-gray-500">
                      <Wand2 className="h-3.5 w-3.5" />
                      整体氛围
                    </div>
                    <p className="text-sm text-gray-700 dark:text-gray-300">
                      {selectedDesign.mood}
                    </p>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ImageIcon className="h-4 w-4 text-gray-500" />
            <span className="text-sm font-medium">历史封面</span>
          </div>
          <span className="text-xs text-gray-500">{coverDesigns.length} 个</span>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
          </div>
        )}

        {!loading && coverDesigns.length === 0 && (
          <div className="text-center py-8 text-sm text-gray-500">
            暂无封面设计，点击上方按钮生成
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {coverDesigns.map(design => (
            <div
              key={design.id}
              className={`relative group rounded-lg overflow-hidden border-2 cursor-pointer transition-all ${
                selectedDesign?.id === design.id
                  ? 'border-blue-500 shadow-md'
                  : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
              }`}
              onClick={() => setSelectedDesign(design)}
            >
              <NextImage
                src={design.imageUrl}
                alt="封面缩略图"
                width={200}
                height={267}
                className="w-full aspect-[3/4] object-cover"
                unoptimized
              />

              {design.isApplied && (
                <div className="absolute top-1.5 left-1.5">
                  <Badge className="bg-green-500 text-white text-xs">
                    <Check className="h-3 w-3 mr-0.5" />
                    已应用
                  </Badge>
                </div>
              )}

              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all flex items-end justify-center opacity-0 group-hover:opacity-100">
                <div className="flex gap-1.5 p-2">
                  {!design.isApplied && (
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={e => {
                        e.stopPropagation()
                        handleApply(design.id)
                      }}
                      disabled={applyingId === design.id}
                    >
                      {applyingId === design.id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Check className="h-3 w-3" />
                      )}
                      应用
                    </Button>
                  )}
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={e => {
                      e.stopPropagation()
                      handleDelete(design.id)
                    }}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
