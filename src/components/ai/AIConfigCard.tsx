'use client'

import { useState } from 'react'
import { Button, Card, CardContent, Badge } from '@/components/ui'
import { Play, Loader2, Check, Edit2, Trash2, Zap, ChevronDown, ChevronUp, CheckCircle, XCircle, Globe, FileText } from 'lucide-react'
import { AIVendor } from '@/types'

interface AIConfig {
  id: number
  name: string
  vendor: AIVendor
  modelId: string
  hasApiKey: boolean
  apiKeyPreview: string | null
  apiEndpoint?: string | null
  embeddingVendor?: AIVendor | null
  hasEmbeddingApiKey: boolean
  embeddingApiKeyPreview: string | null
  embeddingApiEndpoint?: string | null
  embeddingModelId?: string | null
  embeddingDimensions?: number | null
  isDefault: boolean
  sortOrder: number
}

const vendorMeta: Record<AIVendor, {
  label: string
  color: string
  darkColor: string
  bg: string
  darkBg: string
  border: string
  darkBorder: string
  icon: string
  iconBg: string
  darkIconBg: string
}> = {
  [AIVendor.OPENAI]: {
    label: 'OpenAI', icon: '🤖',
    color: 'text-emerald-600', darkColor: 'dark:text-emerald-400',
    bg: 'bg-emerald-50', darkBg: 'dark:bg-emerald-950/40',
    border: 'border-emerald-200', darkBorder: 'dark:border-emerald-800',
    iconBg: 'bg-emerald-100', darkIconBg: 'dark:bg-emerald-900/40',
  },
  [AIVendor.ANTHROPIC]: {
    label: 'Anthropic', icon: '🧠',
    color: 'text-amber-600', darkColor: 'dark:text-amber-400',
    bg: 'bg-amber-50', darkBg: 'dark:bg-amber-950/40',
    border: 'border-amber-200', darkBorder: 'dark:border-amber-800',
    iconBg: 'bg-amber-100', darkIconBg: 'dark:bg-amber-900/40',
  },
  [AIVendor.ALIBABA]: {
    label: '阿里云', icon: '☁️',
    color: 'text-orange-600', darkColor: 'dark:text-orange-400',
    bg: 'bg-orange-50', darkBg: 'dark:bg-orange-950/40',
    border: 'border-orange-200', darkBorder: 'dark:border-orange-800',
    iconBg: 'bg-orange-100', darkIconBg: 'dark:bg-orange-900/40',
  },
  [AIVendor.DEEPSEEK]: {
    label: 'DeepSeek', icon: '🔍',
    color: 'text-blue-600', darkColor: 'dark:text-blue-400',
    bg: 'bg-blue-50', darkBg: 'dark:bg-blue-950/40',
    border: 'border-blue-200', darkBorder: 'dark:border-blue-800',
    iconBg: 'bg-blue-100', darkIconBg: 'dark:bg-blue-900/40',
  },
  [AIVendor.MINIMAX]: {
    label: 'MiniMax', icon: '⚡',
    color: 'text-purple-600', darkColor: 'dark:text-purple-400',
    bg: 'bg-purple-50', darkBg: 'dark:bg-purple-950/40',
    border: 'border-purple-200', darkBorder: 'dark:border-purple-800',
    iconBg: 'bg-purple-100', darkIconBg: 'dark:bg-purple-900/40',
  },
  [AIVendor.MIMO]: {
    label: '小米 MiMo', icon: '📱',
    color: 'text-rose-600', darkColor: 'dark:text-rose-400',
    bg: 'bg-rose-50', darkBg: 'dark:bg-rose-950/40',
    border: 'border-rose-200', darkBorder: 'dark:border-rose-800',
    iconBg: 'bg-rose-100', darkIconBg: 'dark:bg-rose-900/40',
  },
  [AIVendor.VOLCENGINE]: {
    label: '火山引擎', icon: '🌋',
    color: 'text-cyan-600', darkColor: 'dark:text-cyan-400',
    bg: 'bg-cyan-50', darkBg: 'dark:bg-cyan-950/40',
    border: 'border-cyan-200', darkBorder: 'dark:border-cyan-800',
    iconBg: 'bg-cyan-100', darkIconBg: 'dark:bg-cyan-900/40',
  },
  [AIVendor.ZHIPU]: {
    label: '智谱 AI', icon: '💎',
    color: 'text-indigo-600', darkColor: 'dark:text-indigo-400',
    bg: 'bg-indigo-50', darkBg: 'dark:bg-indigo-950/40',
    border: 'border-indigo-200', darkBorder: 'dark:border-indigo-800',
    iconBg: 'bg-indigo-100', darkIconBg: 'dark:bg-indigo-900/40',
  },
}

type TestStatus = 'idle' | 'testing' | 'success' | 'error'

interface AIConfigCardProps {
  config: AIConfig
  onEdit: (config: AIConfig) => void
  onDelete: (configId: number) => void
  onSetDefault: (configId: number) => void
  onTest: (configId: number) => Promise<{ success: boolean; message: string }>
  defaultingId: number | null
}

export function AIConfigCard({ config, onEdit, onDelete, onSetDefault, onTest, defaultingId }: AIConfigCardProps) {
  const [expanded, setExpanded] = useState(false)
  const [testStatus, setTestStatus] = useState<TestStatus>('idle')
  const [testMessage, setTestMessage] = useState('')
  const meta = vendorMeta[config.vendor] || vendorMeta[AIVendor.DEEPSEEK]
  const hasEmbedding = !!(config.embeddingVendor || config.hasEmbeddingApiKey || config.embeddingModelId)
  const embeddingMeta = config.embeddingVendor ? vendorMeta[config.embeddingVendor] : null

  const handleTest = async () => {
    setTestStatus('testing')
    setTestMessage('')
    try {
      const result = await onTest(config.id)
      setTestStatus(result.success ? 'success' : 'error')
      setTestMessage(result.message)
    } catch {
      setTestStatus('error')
      setTestMessage('测试失败')
    }
  }

  return (
    <Card className={`overflow-hidden transition-all duration-200 ${
      config.isDefault
        ? `border-2 ${meta.border} ${meta.darkBorder} shadow-md`
        : 'border-gray-200 dark:border-gray-700 hover:shadow-md'
    }`}>
      {config.isDefault && (
        <div className={`flex items-center gap-1.5 px-4 py-1.5 ${meta.bg} ${meta.darkBg} border-b ${meta.border} ${meta.darkBorder}`}>
          <Zap className={`h-3.5 w-3.5 ${meta.color} ${meta.darkColor}`} />
          <span className={`text-xs font-medium ${meta.color} ${meta.darkColor}`}>默认配置</span>
        </div>
      )}

      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1 space-y-2.5">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className={`inline-flex items-center justify-center w-8 h-8 rounded-lg text-lg ${meta.iconBg} ${meta.darkIconBg}`}>
                {meta.icon}
              </span>
              <h3 className="font-semibold text-gray-900 dark:text-gray-100 truncate">{config.name}</h3>
              <Badge className={`${meta.bg} ${meta.darkBg} ${meta.color} ${meta.darkColor} border-0 text-xs font-medium`}>
                {meta.label}
              </Badge>
              {config.isDefault && (
                <Badge variant="success" className="text-xs">默认</Badge>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-5 gap-y-1.5 text-sm">
              <div className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400">
                <FileText className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{config.modelId}</span>
              </div>
              <div className="flex items-center gap-1.5">
                {config.hasApiKey ? (
                  <>
                    <CheckCircle className="h-3.5 w-3.5 text-emerald-500 dark:text-emerald-400 shrink-0" />
                    <span className="text-emerald-600 dark:text-emerald-400 text-xs">API Key 已配置</span>
                  </>
                ) : (
                  <>
                    <XCircle className="h-3.5 w-3.5 text-red-400 dark:text-red-500 shrink-0" />
                    <span className="text-red-500 dark:text-red-400 text-xs">API Key 未设置</span>
                  </>
                )}
              </div>
              {config.apiEndpoint && (
                <div className="flex items-center gap-1.5 text-gray-400 dark:text-gray-500">
                  <Globe className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate text-xs">{config.apiEndpoint}</span>
                </div>
              )}
            </div>

            {testStatus !== 'idle' && (
              <div className={`flex items-center gap-1.5 text-xs ${
                testStatus === 'success'
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-red-500 dark:text-red-400'
              }`}>
                {testStatus === 'success'
                  ? <CheckCircle className="h-3.5 w-3.5" />
                  : <XCircle className="h-3.5 w-3.5" />
                }
                {testMessage}
              </div>
            )}
          </div>

          <div className="flex flex-col sm:flex-row gap-1.5 shrink-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleTest}
              disabled={testStatus === 'testing'}
            >
              {testStatus === 'testing' ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Play className="h-3.5 w-3.5" />
              )}
              <span className="hidden sm:inline ml-1">测试</span>
            </Button>
            {!config.isDefault && (
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={() => onSetDefault(config.id)}
                loading={defaultingId === config.id}
                disabled={defaultingId !== null}
              >
                <Check className="h-3.5 w-3.5" />
                <span className="hidden sm:inline ml-1">设为默认</span>
              </Button>
            )}
            <Button type="button" variant="ghost" size="sm" onClick={() => onEdit(config)}>
              <Edit2 className="h-3.5 w-3.5" />
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => onDelete(config.id)}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {hasEmbedding && (
          <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
            <button
              type="button"
              onClick={() => setExpanded(!expanded)}
              className="flex items-center gap-1.5 text-xs text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            >
              {expanded
                ? <ChevronUp className="h-3.5 w-3.5" />
                : <ChevronDown className="h-3.5 w-3.5" />
              }
              RAG 向量化设置
              {embeddingMeta && (
                <span className={`${embeddingMeta.color} ${embeddingMeta.darkColor}`}>
                  ({embeddingMeta.label})
                </span>
              )}
            </button>
            {expanded && (
              <div className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1 text-xs text-gray-500 dark:text-gray-400 pl-5">
                {config.embeddingModelId && <span>模型: {config.embeddingModelId}</span>}
                {config.embeddingDimensions && <span>维度: {config.embeddingDimensions}</span>}
                {config.hasEmbeddingApiKey && <span className="text-emerald-600 dark:text-emerald-400">Key: 已配置</span>}
                {config.embeddingApiEndpoint && <span className="truncate">端点: {config.embeddingApiEndpoint}</span>}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
