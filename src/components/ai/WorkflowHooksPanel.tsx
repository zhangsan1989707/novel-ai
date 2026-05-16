'use client'

import { useState, useEffect, useCallback } from 'react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { toast } from '@/components/ui/Toast'
import {
  Zap,
  Play,
  ToggleLeft,
  ToggleRight,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'

interface WorkflowHook {
  id: string
  name: string
  trigger: HookTrigger
  description: string
  enabled: boolean
  priority: number
}

type HookTrigger =
  | 'project_create'
  | 'chapter_generate_start'
  | 'chapter_generate_end'
  | 'chapter_save'
  | 'story_gap_detect'
  | 'pre_context_compress'
  | 'post_context_compress'
  | 'pre_commit'

interface HookExecutionRecord {
  hookId: string
  hookName: string
  trigger: HookTrigger
  action: 'continue' | 'warn' | 'block'
  message?: string
  data?: Record<string, unknown>
  executedAt: string
}

interface TriggerResult {
  hookId: string
  trigger: HookTrigger
  results: Array<{
    action: 'continue' | 'warn' | 'block'
    message?: string
    data?: Record<string, unknown>
  }>
}

const triggerLabels: Record<HookTrigger, string> = {
  project_create: '项目创建',
  chapter_generate_start: '章节生成开始',
  chapter_generate_end: '章节生成结束',
  chapter_save: '章节保存',
  story_gap_detect: '故事缺口检测',
  pre_context_compress: '上下文压缩前',
  post_context_compress: '上下文压缩后',
  pre_commit: '提交前验证',
}

const actionConfig = {
  continue: {
    label: '通过',
    icon: CheckCircle,
    color: 'text-green-500',
    badge: 'success' as const,
  },
  warn: {
    label: '警告',
    icon: AlertTriangle,
    color: 'text-yellow-500',
    badge: 'warning' as const,
  },
  block: {
    label: '阻断',
    icon: XCircle,
    color: 'text-red-500',
    badge: 'danger' as const,
  },
}

interface WorkflowHooksPanelProps {
  className?: string
}

export function WorkflowHooksPanel({ className }: WorkflowHooksPanelProps) {
  const [hooks, setHooks] = useState<WorkflowHook[]>([])
  const [history, setHistory] = useState<HookExecutionRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedHook, setExpandedHook] = useState<string | null>(null)
  const [triggeringHookId, setTriggeringHookId] = useState<string | null>(null)
  const [triggerResults, setTriggerResults] = useState<TriggerResult | null>(null)
  const [showHistory, setShowHistory] = useState(false)

  const fetchHooks = useCallback(async () => {
    try {
      const res = await fetch('/api/hooks')
      const data = await res.json()
      if (data.success) {
        setHooks(data.data.hooks)
        setHistory(data.data.history)
      }
    } catch (error) {
      console.error('获取 Hooks 数据失败:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const res = await fetch('/api/hooks')
        const data = await res.json()
        if (!cancelled && data.success) {
          setHooks(data.data.hooks)
          setHistory(data.data.history)
        }
      } catch (error) {
        console.error('获取 Hooks 数据失败:', error)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  const handleToggle = async (hookId: string, enabled: boolean) => {
    try {
      const res = await fetch(`/api/hooks/${hookId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !enabled }),
      })
      const data = await res.json()
      if (data.success) {
        setHooks(prev =>
          prev.map(h => (h.id === hookId ? { ...h, enabled: !enabled } : h))
        )
        toast.success(enabled ? 'Hook 已禁用' : 'Hook 已启用')
      }
    } catch {
      toast.error('操作失败')
    }
  }

  const handleTrigger = async (hookId: string) => {
    setTriggeringHookId(hookId)
    setTriggerResults(null)
    try {
      const res = await fetch(`/api/hooks/${hookId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ context: {} }),
      })
      const data = await res.json()
      if (data.success) {
        setTriggerResults(data.data)
        toast.success('Hook 触发成功')
        fetchHooks()
      } else {
        toast.error(data.error?.message || '触发失败')
      }
    } catch {
      toast.error('触发失败')
    } finally {
      setTriggeringHookId(null)
    }
  }

  if (loading) {
    return (
      <div className={cn('flex items-center justify-center p-8', className)}>
        <div className="text-muted-foreground">加载中...</div>
      </div>
    )
  }

  const enabledCount = hooks.filter(h => h.enabled).length
  const recentHistory = history.slice(-10).reverse()

  return (
    <div className={cn('space-y-6', className)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-purple-500" />
            <h3 className="text-lg font-semibold">工作流 Hooks</h3>
          </div>
          <Badge variant="primary">
            {enabledCount}/{hooks.length} 已启用
          </Badge>
        </div>
        <Button size="sm" variant="outline" onClick={() => fetchHooks()}>
          刷新
        </Button>
      </div>

      <div className="space-y-3">
        {hooks.map(hook => {
          const isExpanded = expandedHook === hook.id
          const isTriggering = triggeringHookId === hook.id

          return (
            <div
              key={hook.id}
              className={cn(
                'rounded-lg border transition-colors',
                hook.enabled
                  ? 'border-purple-200 dark:border-purple-800 bg-white dark:bg-gray-900'
                  : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 opacity-60'
              )}
            >
              <div
                className="flex items-center gap-3 p-4 cursor-pointer"
                onClick={() => setExpandedHook(isExpanded ? null : hook.id)}
              >
                <button
                  onClick={e => {
                    e.stopPropagation()
                    handleToggle(hook.id, hook.enabled)
                  }}
                  className="flex-shrink-0"
                >
                  {hook.enabled ? (
                    <ToggleRight className="h-6 w-6 text-purple-500" />
                  ) : (
                    <ToggleLeft className="h-6 w-6 text-gray-400" />
                  )}
                </button>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{hook.name}</span>
                    <Badge variant="outline" className="text-xs">
                      {triggerLabels[hook.trigger]}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">
                    {hook.description}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={!hook.enabled || isTriggering}
                    onClick={e => {
                      e.stopPropagation()
                      handleTrigger(hook.id)
                    }}
                  >
                    <Play className={cn('h-3.5 w-3.5', isTriggering && 'animate-spin')} />
                  </Button>
                  {isExpanded ? (
                    <ChevronUp className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
              </div>

              {isExpanded && (
                <div className="px-4 pb-4 pt-0 border-t border-gray-100 dark:border-gray-800">
                  <div className="mt-3 space-y-2 text-sm">
                    <div className="flex items-center gap-4 text-muted-foreground">
                      <span>ID: {hook.id}</span>
                      <span>优先级: {hook.priority}</span>
                      <span>触发器: {hook.trigger}</span>
                    </div>

                    {triggerResults && triggerResults.hookId === hook.id && (
                      <div className="mt-3 space-y-2">
                        <div className="font-medium text-xs text-muted-foreground uppercase tracking-wider">
                          触发结果
                        </div>
                        {triggerResults.results.map((result, idx) => {
                          const config = actionConfig[result.action]
                          const Icon = config.icon
                          return (
                            <div
                              key={idx}
                              className={cn(
                                'flex items-start gap-2 p-2 rounded-md',
                                result.action === 'continue' && 'bg-green-50 dark:bg-green-900/10',
                                result.action === 'warn' && 'bg-yellow-50 dark:bg-yellow-900/10',
                                result.action === 'block' && 'bg-red-50 dark:bg-red-900/10'
                              )}
                            >
                              <Icon className={cn('h-4 w-4 mt-0.5 flex-shrink-0', config.color)} />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <Badge variant={config.badge} className="text-xs">
                                    {config.label}
                                  </Badge>
                                </div>
                                {result.message && (
                                  <p className="text-xs mt-1 text-foreground">{result.message}</p>
                                )}
                                {result.data && (
                                  <pre className="text-xs mt-1 text-muted-foreground overflow-x-auto">
                                    {JSON.stringify(result.data, null, 2)}
                                  </pre>
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div className="border-t pt-4">
        <button
          className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          onClick={() => setShowHistory(!showHistory)}
        >
          <Clock className="h-4 w-4" />
          执行历史
          {showHistory ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
        </button>

        {showHistory && (
          <div className="mt-3 space-y-2">
            {recentHistory.length === 0 ? (
              <div className="text-sm text-muted-foreground text-center py-4">
                暂无执行记录
              </div>
            ) : (
              recentHistory.map((record, idx) => {
                const config = actionConfig[record.action]
                const Icon = config.icon
                return (
                  <div
                    key={idx}
                    className="flex items-start gap-3 p-2 rounded-md bg-gray-50 dark:bg-gray-800/50"
                  >
                    <Icon className={cn('h-4 w-4 mt-0.5 flex-shrink-0', config.color)} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{record.hookName}</span>
                        <Badge variant={config.badge} className="text-xs">
                          {config.label}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {triggerLabels[record.trigger]}
                        </Badge>
                      </div>
                      {record.message && (
                        <p className="text-xs text-muted-foreground mt-0.5">{record.message}</p>
                      )}
                      <span className="text-xs text-muted-foreground">
                        {new Date(record.executedAt).toLocaleString('zh-CN')}
                      </span>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        )}
      </div>
    </div>
  )
}
