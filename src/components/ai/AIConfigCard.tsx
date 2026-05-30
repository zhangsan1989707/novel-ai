'use client'

import { useState } from 'react'
import { Button, Card, CardContent, Badge, toast } from '@/components/ui'
import { Play, Loader2, Check, Edit2, Trash2, Zap, ChevronDown, ChevronUp, CheckCircle, XCircle, Globe, FileText } from 'lucide-react'
import { AIVendor } from '@/types'

interface AIConfig {
  id: number
  name: string
  vendor: AIVendor
  modelId: string
  apiKey: string | null
  apiEndpoint?: string | null
  embeddingVendor?: AIVendor | null
  embeddingApiKey?: string | null
  embeddingApiEndpoint?: string | null
  embeddingModelId?: string | null
  embeddingDimensions?: number | null
  isDefault: boolean
  sortOrder: number
}

const vendorMeta: Record<AIVendor, { label: string; color: string; bg: string; border: string; icon: string }> = {
  [AIVendor.OPENAI]: { label: 'OpenAI', color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200', icon: '🤖' },
  [AIVendor.ANTHROPIC]: { label: 'Anthropic', color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200', icon: '🧠' },
  [AIVendor.ALIBABA]: { label: '阿里云', color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-200', icon: '☁️' },
  [AIVendor.DEEPSEEK]: { label: 'DeepSeek', color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200', icon: '🔍' },
  [AIVendor.MINIMAX]: { label: 'MiniMax', color: 'text-purple-600', bg: 'bg-purple-50', border: 'border-purple-200', icon: '⚡' },
  [AIVendor.MIMO]: { label: '小米 MiMo', color: 'text-rose-600', bg: 'bg-rose-50', border: 'border-rose-200', icon: '📱' },
  [AIVendor.VOLCENGINE]: { label: '火山引擎', color: 'text-cyan-600', bg: 'bg-cyan-50', border: 'border-cyan-200', icon: '🌋' },
  [AIVendor.ZHIPU]: { label: '智谱 AI', color: 'text-indigo-600', bg: 'bg-indigo-50', border: 'border-indigo-200', icon: '💎' },
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
  const hasEmbedding = !!(config.embeddingVendor || config.embeddingApiKey || config.embeddingModelId)
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
    <Card className={`overflow-hidden transition-all duration-200 ${config.isDefault ? `border-2 ${meta.border} shadow-md` : 'hover:shadow-md'}`}>
      {config.isDefault && (
        <div className={`flex items-center gap-1.5 px-4 py-1.5 ${meta.bg} border-b ${meta.border}`}>
          <Zap className="h-3.5 w-3.5" />
          <span className={`text-xs font-medium ${meta.color}`}>默认配置</span>
        </div>
      )}

      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="text-lg">{meta.icon}</span>
              <h3 className="font-semibold text-gray-900 dark:text-white truncate">{config.name}</h3>
              <Badge className={`${meta.bg} ${meta.color} border-0 text-xs`}>
                {meta.label}
              </Badge>
              {config.isDefault && (
                <Badge variant="success" className="text-xs">默认</Badge>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-1.5 text-sm">
              <div className="flex items-center gap-1.5 text-gray-500">
                <FileText className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{config.modelId}</span>
              </div>
              <div className="flex items-center gap-1.5">
                {config.apiKey ? (
                  <>
                    <CheckCircle className="h-3.5 w-3.5 text-green-500 shrink-0" />
                    <span className="text-green-600 text-xs">API Key 已配置</span>
                  </>
                ) : (
                  <>
                    <XCircle className="h-3.5 w-3.5 text-red-400 shrink-0" />
                    <span className="text-red-500 text-xs">API Key 未设置</span>
                  </>
                )}
              </div>
              {config.apiEndpoint && (
                <div className="flex items-center gap-1.5 text-gray-400">
                  <Globe className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate text-xs">{config.apiEndpoint}</span>
                </div>
              )}
            </div>

            {testStatus !== 'idle' && (
              <div className={`flex items-center gap-1.5 text-xs ${testStatus === 'success' ? 'text-green-600' : 'text-red-500'}`}>
                {testStatus === 'success' ? <CheckCircle className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
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
              className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 transition-colors"
            >
              {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              RAG 向量化设置
              {embeddingMeta && (
                <span className={`${embeddingMeta.color}`}>
                  ({embeddingMeta.label})
                </span>
              )}
            </button>
            {expanded && (
              <div className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1 text-xs text-gray-500 pl-5">
                {config.embeddingModelId && <span>模型: {config.embeddingModelId}</span>}
                {config.embeddingDimensions && <span>维度: {config.embeddingDimensions}</span>}
                {config.embeddingApiKey && <span>Key: 已配置</span>}
                {config.embeddingApiEndpoint && <span className="truncate">端点: {config.embeddingApiEndpoint}</span>}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}