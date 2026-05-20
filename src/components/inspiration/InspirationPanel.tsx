'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Card, CardContent, Badge, Button } from '@/components/ui'
import { Sparkles, RefreshCw, ChevronRight, Flame } from 'lucide-react'
import type { HotInspiration, InspirationCategory } from '@/lib/inspiration/data'

interface InspirationPanelProps {
  onSelect: (inspiration: HotInspiration) => void
  compact?: boolean
  limit?: number
  className?: string
}

const categoryLabels: Record<InspirationCategory, string> = {
  male: '男频',
  female: '女频',
  unisex: '不限',
}

const categoryColors: Record<InspirationCategory, 'primary' | 'secondary' | 'success'> = {
  male: 'primary',
  female: 'secondary',
  unisex: 'success',
}

export function InspirationPanel({ onSelect, compact = false, limit = 6, className = '' }: InspirationPanelProps) {
  const [inspirations, setInspirations] = useState<HotInspiration[]>([])
  const [loading, setLoading] = useState(true)
  const [activeCategory, setActiveCategory] = useState<InspirationCategory | 'all'>('all')
  const randomRef = useRef(false)

  const fetchInspirations = useCallback(async (random: boolean = false) => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (activeCategory !== 'all') {
        params.set('category', activeCategory)
      }
      params.set('limit', String(limit))

      if (random) {
        params.set('random', 'true')
      }

      const res = await fetch(`/api/novel/inspiration?${params}`)
      const data = await res.json()
      if (data.success) {
        setInspirations(data.data)
      }
    } catch (error) {
      console.error('获取创作灵感失败:', error)
    } finally {
      setLoading(false)
    }
  }, [activeCategory, limit])

  useEffect(() => {
    fetchInspirations(randomRef.current)
    randomRef.current = false
  }, [fetchInspirations])

  const handleRefresh = () => {
    randomRef.current = true
    fetchInspirations(true)
  }

  return (
    <div className={`${compact ? 'space-y-3' : 'space-y-4'} ${className}`.trim()}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <Sparkles className={compact ? 'h-4 w-4 text-amber-500' : 'h-5 w-5 text-amber-500'} />
          <h3 className={compact ? 'text-sm font-semibold text-gray-900 dark:text-white' : 'font-medium text-lg'}>基于市场趋势的灵感库</h3>
          {!compact && <span className="text-xs text-gray-500">从最近市场趋势里挑一个开写</span>}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleRefresh}
          disabled={loading}
        >
          <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
          刷新趋势
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setActiveCategory('all')}
          className={`px-3 py-1.5 text-sm rounded-full transition-colors ${
            activeCategory === 'all'
              ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700'
          }`}
        >
          全部
        </button>
        <button
          type="button"
          onClick={() => setActiveCategory('male')}
          className={`px-3 py-1.5 text-sm rounded-full transition-colors ${
            activeCategory === 'male'
              ? 'bg-blue-600 text-white'
              : 'bg-blue-50 text-blue-600 hover:bg-blue-100'
          }`}
        >
          男频
        </button>
        <button
          type="button"
          onClick={() => setActiveCategory('female')}
          className={`px-3 py-1.5 text-sm rounded-full transition-colors ${
            activeCategory === 'female'
              ? 'bg-pink-600 text-white'
              : 'bg-pink-50 text-pink-600 hover:bg-pink-100'
          }`}
        >
          女频
        </button>
        <button
          type="button"
          onClick={() => setActiveCategory('unisex')}
          className={`px-3 py-1.5 text-sm rounded-full transition-colors ${
            activeCategory === 'unisex'
              ? 'bg-green-600 text-white'
              : 'bg-green-50 text-green-600 hover:bg-green-100'
          }`}
        >
          不限
        </button>
      </div>

      {loading ? (
        <div className={compact ? 'grid grid-cols-1 gap-3' : 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'}>
          {[...Array(limit)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-4">
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-2" />
                <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-full mb-4" />
                <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className={compact ? 'grid grid-cols-1 gap-3' : 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'}>
          {inspirations.map((inspiration) => (
            <InspirationCard
              key={inspiration.id}
              inspiration={inspiration}
              onSelect={onSelect}
              compact={compact}
            />
          ))}
        </div>
      )}
    </div>
  )
}

interface InspirationCardProps {
  inspiration: HotInspiration
  onSelect: (inspiration: HotInspiration) => void
  compact?: boolean
}

function InspirationCard({ inspiration, onSelect, compact = false }: InspirationCardProps) {
  const [expanded, setExpanded] = useState(false)

  return (
    <Card hover className="group overflow-hidden">
      <CardContent className={`${compact ? 'p-3' : 'p-4'} flex h-full flex-col`}>
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-2">
            <Badge variant={categoryColors[inspiration.category]} className="text-xs">
              {categoryLabels[inspiration.category]}
            </Badge>
            <div className="flex items-center gap-0.5 text-amber-500">
              <Flame className="h-3.5 w-3.5" />
              <span className="text-xs font-medium">{inspiration.hotScore}</span>
            </div>
          </div>
        </div>

        <h4 className="mb-1 text-sm font-medium transition-colors group-hover:text-blue-600">
          {inspiration.title}
        </h4>

        <p className={compact ? 'mb-2 line-clamp-2 text-xs text-gray-500' : 'text-xs text-gray-500 mb-3 line-clamp-2'}>
          {inspiration.description}
        </p>

        <div className={compact ? 'mb-2 flex flex-wrap gap-1' : 'flex flex-wrap gap-1 mb-3'}>
          {inspiration.coreElements.slice(0, 3).map((element) => (
            <span
              key={element}
              className="px-2 py-0.5 text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded"
            >
              {element}
            </span>
          ))}
        </div>

        {expanded && (
          <div className="mb-3 rounded-lg bg-gray-50 p-3 dark:bg-gray-800/50">
            <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">
              <span className="font-medium">趋势样本：</span>
              {inspiration.exampleWorks.join('、')}
            </p>
            <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">
              <span className="font-medium">目标读者：</span>
              {inspiration.targetAudience}
            </p>
          </div>
        )}

        <div className="mt-auto grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="flex h-8 items-center justify-center rounded-md border border-gray-200 px-2 text-xs text-gray-500 transition-colors hover:border-gray-300 hover:text-gray-700 dark:border-gray-700 dark:text-gray-400 dark:hover:border-gray-600 dark:hover:text-gray-200"
          >
            {expanded ? '收起' : '查看详情'}
          </button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => onSelect(inspiration)}
            className="h-8 w-full justify-center whitespace-nowrap text-xs"
          >
            使用此灵感
            <ChevronRight className="h-3 w-3 ml-1" />
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
