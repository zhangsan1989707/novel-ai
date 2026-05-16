'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { Button, Textarea, Card, CardContent, CardHeader, CardTitle, Badge } from '@/components/ui'
import { Search, Trash2, ChevronDown, ChevronUp, Loader2, BookOpen, Lightbulb, Shield, Sparkles } from 'lucide-react'
import { toast } from '@/components/ui/Toast'

interface ResearchRef {
  id: string
  topic: string
  summary: string
  keyFacts: string[]
  creativeMaterials: string[]
  confidence: string
  usageSuggestions: string[]
  usedInChapter: number | null
  createdAt: string
}

interface ResearchPanelProps {
  projectId: number
}

const confidenceConfig: Record<string, { label: string; color: string }> = {
  high: { label: '高', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
  medium: { label: '中', color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' },
  low: { label: '低', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
}

export function ResearchPanel({ projectId }: ResearchPanelProps) {
  const [topic, setTopic] = useState('')
  const [context, setContext] = useState('')
  const [researching, setResearching] = useState(false)
  const [researchRefs, setResearchRefs] = useState<ResearchRef[]>([])
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const initializedRef = useRef(false)

  const loadResearchRefs = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/novel/research?projectId=${projectId}`)
      const data = await res.json()
      if (data.success) {
        setResearchRefs(data.data)
      }
    } catch {
      toast.error('加载研究资料失败')
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    if (!initializedRef.current) {
      initializedRef.current = true
      loadResearchRefs()
    }
  }, [loadResearchRefs])

  const handleResearch = useCallback(async () => {
    if (!topic.trim()) {
      toast.error('请输入研究主题')
      return
    }

    setResearching(true)
    try {
      const res = await fetch('/api/novel/research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          topic: topic.trim(),
          context: context.trim(),
        }),
      })

      const data = await res.json()
      if (data.success) {
        toast.success('研究完成')
        setTopic('')
        setContext('')
        loadResearchRefs()
      } else {
        toast.error(data.error?.message || '研究失败')
      }
    } catch {
      toast.error('研究请求失败')
    } finally {
      setResearching(false)
    }
  }, [projectId, topic, context, loadResearchRefs])

  const handleDelete = useCallback(async (refId: string) => {
    try {
      const res = await fetch(`/api/novel/research/${refId}`, {
        method: 'DELETE',
      })
      const data = await res.json()
      if (data.success) {
        toast.success('已删除')
        setResearchRefs(prev => prev.filter(r => r.id !== refId))
        if (expandedId === refId) {
          setExpandedId(null)
        }
      } else {
        toast.error(data.error?.message || '删除失败')
      }
    } catch {
      toast.error('删除请求失败')
    }
  }, [expandedId])

  const toggleExpand = useCallback((refId: string) => {
    setExpandedId(prev => prev === refId ? null : refId)
  }, [])

  return (
    <div className="space-y-6">
      <div className="space-y-4 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
        <div className="flex items-center gap-2">
          <Search className="h-4 w-4 text-blue-500" />
          <span className="text-sm font-medium">资料研究</span>
        </div>

        <div className="space-y-2">
          <label className="text-xs text-gray-500">研究主题</label>
          <input
            type="text"
            value={topic}
            onChange={e => setTopic(e.target.value)}
            placeholder="例如：宋代科举制度、中世纪骑士文化、太空站生态循环..."
            className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm"
          />
        </div>

        <div className="space-y-2">
          <label className="text-xs text-gray-500">研究背景（可选）</label>
          <Textarea
            value={context}
            onChange={e => setContext(e.target.value)}
            placeholder="描述你需要研究资料的具体场景或问题..."
            rows={3}
            className="text-sm"
          />
        </div>

        <Button
          variant="primary"
          onClick={handleResearch}
          disabled={researching || !topic.trim()}
        >
          {researching ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              研究中...
            </>
          ) : (
            <>
              <Search className="h-4 w-4 mr-2" />
              开始研究
            </>
          )}
        </Button>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-gray-500" />
            <span className="text-sm font-medium">研究资料</span>
          </div>
          <span className="text-xs text-gray-500">{researchRefs.length} 条</span>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
          </div>
        )}

        {!loading && researchRefs.length === 0 && (
          <div className="text-center py-8 text-sm text-gray-500">
            暂无研究资料，输入主题开始研究
          </div>
        )}

        {researchRefs.map(ref => (
          <Card key={ref.id} className="overflow-hidden">
            <CardHeader
              className="cursor-pointer py-3 px-4"
              onClick={() => toggleExpand(ref.id)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <CardTitle className="text-sm truncate">{ref.topic}</CardTitle>
                  <Badge
                    className={
                      confidenceConfig[ref.confidence]?.color ||
                      confidenceConfig.medium.color
                    }
                  >
                    {confidenceConfig[ref.confidence]?.label || '中'}
                  </Badge>
                  {ref.usedInChapter && (
                    <span className="text-xs text-gray-500">
                      第{ref.usedInChapter}章
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={e => {
                      e.stopPropagation()
                      handleDelete(ref.id)
                    }}
                    className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                  {expandedId === ref.id ? (
                    <ChevronUp className="h-4 w-4 text-gray-400" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-gray-400" />
                  )}
                </div>
              </div>
            </CardHeader>

            {expandedId === ref.id && (
              <CardContent className="px-4 pb-4 space-y-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 text-xs font-medium text-gray-500">
                    <BookOpen className="h-3.5 w-3.5" />
                    主题概述
                  </div>
                  <p className="text-sm text-gray-700 dark:text-gray-300">
                    {ref.summary}
                  </p>
                </div>

                {ref.keyFacts.length > 0 && (
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-1.5 text-xs font-medium text-gray-500">
                      <Shield className="h-3.5 w-3.5" />
                      关键事实
                    </div>
                    <ul className="space-y-1">
                      {ref.keyFacts.map((fact, i) => (
                        <li
                          key={i}
                          className="text-sm text-gray-700 dark:text-gray-300 pl-3 border-l-2 border-blue-200 dark:border-blue-800"
                        >
                          {fact}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {ref.creativeMaterials.length > 0 && (
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-1.5 text-xs font-medium text-gray-500">
                      <Sparkles className="h-3.5 w-3.5" />
                      创作素材
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {ref.creativeMaterials.map((mat, i) => (
                        <span
                          key={i}
                          className="text-xs px-2 py-1 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 rounded"
                        >
                          {mat}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {ref.usageSuggestions.length > 0 && (
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-1.5 text-xs font-medium text-gray-500">
                      <Lightbulb className="h-3.5 w-3.5" />
                      引用建议
                    </div>
                    <ul className="space-y-1">
                      {ref.usageSuggestions.map((sug, i) => (
                        <li
                          key={i}
                          className="text-sm text-gray-700 dark:text-gray-300 pl-3 border-l-2 border-amber-200 dark:border-amber-800"
                        >
                          {sug}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </CardContent>
            )}
          </Card>
        ))}
      </div>
    </div>
  )
}
