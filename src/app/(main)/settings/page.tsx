'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { Button, Input, Select, Modal, Badge, Card, CardContent, toast } from '@/components/ui'
import { Plus, Key, Search, Zap, AlertTriangle, Filter, X } from 'lucide-react'
import { AIVendor } from '@/types'
import { AIConfigCard } from '@/components/ai/AIConfigCard'
import {
  AIConfigForm,
  vendorMeta,
  vendorOptions,
  defaultModelIds,
  defaultApiEndpoints,
  defaultEmbeddingModelIds,
  defaultEmbeddingApiEndpoints,
  defaultEmbeddingDimensions,
} from '@/components/ai/AIConfigForm'

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

interface AIConfigFormData {
  name: string
  vendor: AIVendor
  modelId: string
  apiKey: string
  apiEndpoint: string
  embeddingVendor: AIVendor | null | undefined
  embeddingApiKey: string
  embeddingApiEndpoint: string
  embeddingModelId: string
  embeddingDimensions: string
  isDefault: boolean
}

type VendorFilter = AIVendor | 'ALL'

const vendorFilterOptions = [
  { label: '全部厂商', value: 'ALL' },
  ...vendorOptions.map(v => ({ label: v.label, value: v.value })),
]

export default function SettingsPage() {
  const [configs, setConfigs] = useState<AIConfig[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingConfig, setEditingConfig] = useState<AIConfig | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [testing, setTesting] = useState(false)
  const [defaultingConfigId, setDefaultingConfigId] = useState<number | null>(null)
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [vendorFilter, setVendorFilter] = useState<VendorFilter>('ALL')
  const [showApiKey, setShowApiKey] = useState(false)

  const [formData, setFormData] = useState<AIConfigFormData>({
    name: '',
    vendor: AIVendor.DEEPSEEK,
    modelId: defaultModelIds[AIVendor.DEEPSEEK],
    apiKey: '',
    apiEndpoint: defaultApiEndpoints[AIVendor.DEEPSEEK] || '',
    embeddingVendor: AIVendor.OPENAI,
    embeddingApiKey: '',
    embeddingApiEndpoint: defaultEmbeddingApiEndpoints[AIVendor.OPENAI] || '',
    embeddingModelId: defaultEmbeddingModelIds[AIVendor.DEEPSEEK] || '',
    embeddingDimensions: String(defaultEmbeddingDimensions),
    isDefault: false,
  })

  const fetchConfigs = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/novel/ai-configs')
      const data = await res.json()
      if (data.success) {
        setConfigs(data.data)
      }
    } catch (error) {
      console.error('获取配置失败:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchConfigs()
  }, [fetchConfigs])

  const defaultConfig = useMemo(() => configs.find(c => c.isDefault), [configs])

  const filteredConfigs = useMemo(() => {
    return configs.filter(config => {
      const matchSearch = !searchQuery ||
        config.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        config.modelId.toLowerCase().includes(searchQuery.toLowerCase())
      const matchVendor = vendorFilter === 'ALL' || config.vendor === vendorFilter
      return matchSearch && matchVendor
    })
  }, [configs, searchQuery, vendorFilter])

  const openModal = (config?: AIConfig) => {
    setTestResult(null)
    setShowApiKey(false)
    if (config) {
      setEditingConfig(config)
      setFormData({
        name: config.name,
        vendor: config.vendor,
        modelId: config.modelId,
        apiKey: '',
        apiEndpoint: config.apiEndpoint || '',
        embeddingVendor: config.embeddingVendor,
        embeddingApiKey: '',
        embeddingApiEndpoint: config.embeddingApiEndpoint || '',
        embeddingModelId: config.embeddingModelId || '',
        embeddingDimensions: String(config.embeddingDimensions || defaultEmbeddingDimensions),
        isDefault: config.isDefault,
      })
    } else {
      setEditingConfig(null)
      setFormData({
        name: '',
        vendor: AIVendor.DEEPSEEK,
        modelId: defaultModelIds[AIVendor.DEEPSEEK],
        apiKey: '',
        apiEndpoint: defaultApiEndpoints[AIVendor.DEEPSEEK] || '',
        embeddingVendor: AIVendor.OPENAI,
        embeddingApiKey: '',
        embeddingApiEndpoint: defaultEmbeddingApiEndpoints[AIVendor.OPENAI] || '',
        embeddingModelId: defaultEmbeddingModelIds[AIVendor.DEEPSEEK] || '',
        embeddingDimensions: String(defaultEmbeddingDimensions),
        isDefault: false,
      })
    }
    setShowModal(true)
  }

  const handleTest = async () => {
    if (!formData.modelId) {
      setTestResult({ success: false, message: '请先填写模型 ID' })
      return
    }
    if (!editingConfig && !formData.apiKey) {
      setTestResult({ success: false, message: '请填写 API Key' })
      return
    }

    setTesting(true)
    setTestResult(null)

    try {
      const url = editingConfig
        ? `/api/novel/ai-configs/${editingConfig.id}/test`
        : '/api/novel/ai-configs/test'
      const body = editingConfig
        ? undefined
        : JSON.stringify({
            vendor: formData.vendor,
            modelId: formData.modelId,
            apiKey: formData.apiKey,
            apiEndpoint: formData.apiEndpoint || undefined,
          })

      const res = await fetch(url, {
        method: 'POST',
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body,
      })

      const data = await res.json()
      if (data.success) {
        setTestResult({ success: true, message: data.data.response || '测试成功！连接正常。' })
      } else {
        setTestResult({ success: false, message: data.error?.message || '测试失败' })
      }
    } catch {
      setTestResult({ success: false, message: '网络错误，请重试' })
    } finally {
      setTesting(false)
    }
  }

  const handleSubmit = async () => {
    if (!formData.name || !formData.modelId) {
      setTestResult({ success: false, message: '请填写必填字段' })
      return
    }
    if (!editingConfig && !formData.apiKey) {
      setTestResult({ success: false, message: '请填写 API Key' })
      return
    }

    setSubmitting(true)
    setTestResult(null)

    try {
      const method = editingConfig ? 'PUT' : 'POST'
      const url = editingConfig
        ? `/api/novel/ai-configs/${editingConfig.id}`
        : '/api/novel/ai-configs'
      const body = editingConfig
        ? {
            ...formData,
            id: editingConfig.id,
            apiKey: formData.apiKey.trim() || undefined,
            embeddingApiKey: formData.embeddingApiKey.trim() || undefined,
            embeddingVendor: formData.embeddingVendor || undefined,
            embeddingApiEndpoint: formData.embeddingApiEndpoint.trim() || undefined,
            embeddingModelId: formData.embeddingModelId.trim() || undefined,
            embeddingDimensions: formData.embeddingDimensions.trim()
              ? Number(formData.embeddingDimensions)
              : undefined,
          }
        : {
            ...formData,
            apiKey: formData.apiKey.trim(),
            embeddingApiKey: formData.embeddingApiKey.trim(),
            embeddingVendor: formData.embeddingVendor,
            embeddingApiEndpoint: formData.embeddingApiEndpoint.trim() || undefined,
            embeddingModelId: formData.embeddingModelId.trim() || undefined,
            embeddingDimensions: formData.embeddingDimensions.trim()
              ? Number(formData.embeddingDimensions)
              : undefined,
          }

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      const data = await res.json()
      if (data.success) {
        setShowModal(false)
        fetchConfigs()
        toast.success(editingConfig ? '配置已更新' : '配置已添加')
      } else {
        setTestResult({ success: false, message: data.error?.message || '保存失败' })
      }
    } catch {
      setTestResult({ success: false, message: '网络错误，请重试' })
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (configId: number) => {
    if (!confirm('确定要删除这个配置吗？')) return

    try {
      const res = await fetch(`/api/novel/ai-configs/${configId}`, {
        method: 'DELETE',
      })
      const data = await res.json()
      if (data.success) {
        fetchConfigs()
        toast.success('配置已删除')
      } else {
        toast.error(data.error?.message || '删除失败')
      }
    } catch {
      toast.error('删除失败')
    }
  }

  const handleSetDefault = async (configId: number) => {
    setDefaultingConfigId(configId)
    try {
      const res = await fetch(`/api/novel/ai-configs/${configId}/set-default`, {
        method: 'POST',
      })
      const result = await res.json()
      if (result.success) {
        fetchConfigs()
        toast.success('默认配置已更新')
      } else {
        toast.error(result.error?.message || '设置默认失败')
      }
    } catch {
      toast.error('设置默认失败')
    } finally {
      setDefaultingConfigId(null)
    }
  }

  const handleTestConfig = async (configId: number): Promise<{ success: boolean; message: string }> => {
    try {
      const res = await fetch(`/api/novel/ai-configs/${configId}/test`, {
        method: 'POST',
      })
      const data = await res.json()
      if (data.success) {
        return { success: true, message: data.data.response || '测试成功！' }
      }
      return { success: false, message: data.error?.message || '测试失败' }
    } catch {
      return { success: false, message: '网络错误' }
    }
  }

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">系统设置</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">管理 AI 配置</p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto space-y-6">
        {!loading && (
          <Card className={defaultConfig ? 'border-blue-200 bg-blue-50/50' : 'border-amber-200 bg-amber-50/50'}>
            <CardContent className="p-4">
              {defaultConfig ? (
                <div className="flex items-center gap-3">
                  <span className="text-xl">{vendorMeta[defaultConfig.vendor]?.icon || '🤖'}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-blue-700">
                      当前默认配置：
                      <span className="font-bold">{defaultConfig.name}</span>
                      <Badge variant="outline" className="ml-2 text-xs">
                        {vendorMeta[defaultConfig.vendor]?.label || defaultConfig.vendor}
                      </Badge>
                    </p>
                    <p className="text-xs text-blue-500 mt-0.5">
                      模型 {defaultConfig.modelId}，所有 AI 功能将默认使用此配置
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-amber-700">未设置默认配置</p>
                    <p className="text-xs text-amber-500 mt-0.5">
                      系统将使用环境变量中的 AI 配置作为备选。建议点击「设为默认」指定一个配置。
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {!loading && configs.length > 0 && (
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="搜索配置名称或模型..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-8 h-10 rounded-lg border border-gray-300 text-sm bg-white dark:bg-gray-800 dark:border-gray-600 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <Select
              options={vendorFilterOptions}
              value={vendorFilter}
              onChange={(e) => setVendorFilter(e.target.value as VendorFilter)}
              className="w-full sm:w-44"
            />
            <Button type="button" onClick={() => openModal()} className="shrink-0">
              <Plus className="h-4 w-4 mr-1.5" />
              添加配置
            </Button>
          </div>
        )}

        {loading ? (
          <div className="text-center py-12 text-gray-500">加载中...</div>
        ) : filteredConfigs.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              {configs.length === 0 ? (
                <>
                  <Key className="h-12 w-12 mx-auto text-gray-300 mb-4" />
                  <h3 className="font-medium mb-2">暂无 AI 配置</h3>
                  <p className="text-sm text-gray-500 mb-4">添加您的第一个 AI API 配置</p>
                  <Button type="button" onClick={() => openModal()}>
                    <Plus className="h-4 w-4 mr-2" />
                    添加配置
                  </Button>
                </>
              ) : (
                <>
                  <Search className="h-12 w-12 mx-auto text-gray-300 mb-4" />
                  <h3 className="font-medium mb-2">没有匹配的配置</h3>
                  <p className="text-sm text-gray-500">尝试调整搜索条件或清除筛选</p>
                </>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {filteredConfigs.map((config) => (
              <AIConfigCard
                key={config.id}
                config={config}
                onEdit={openModal}
                onDelete={handleDelete}
                onSetDefault={handleSetDefault}
                onTest={handleTestConfig}
                defaultingId={defaultingConfigId}
              />
            ))}
          </div>
        )}
      </div>

      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title={
          <div className="flex items-center gap-2">
            <span>{vendorMeta[formData.vendor]?.icon || '🤖'}</span>
            <span>{editingConfig ? '编辑配置' : '添加配置'}</span>
          </div>
        }
      >
        <AIConfigForm
          formData={formData}
          onChange={setFormData}
          editing={!!editingConfig}
          onTest={handleTest}
          onSubmit={handleSubmit}
          onCancel={() => setShowModal(false)}
          submitting={submitting}
          testing={testing}
          testResult={testResult}
        />
      </Modal>
    </>
  )
}