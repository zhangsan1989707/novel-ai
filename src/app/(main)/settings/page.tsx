'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button, Input, Select, Modal, Badge, Card, CardContent } from '@/components/ui'
import { Plus, Trash2, Edit2, Check, Key, Shield, Play, Loader2, CheckCircle, XCircle } from 'lucide-react'
import { AIVendor } from '@/types'

interface AIConfig {
  id: number
  name: string
  vendor: AIVendor
  modelId: string
  apiKey: string | null
  apiEndpoint?: string | null
  isDefault: boolean
  sortOrder: number
}

type TestStatus = 'idle' | 'testing' | 'success' | 'error'

const vendorOptions = [
  { label: 'DeepSeek', value: AIVendor.DEEPSEEK },
  { label: 'OpenAI', value: AIVendor.OPENAI },
  { label: 'Anthropic (Claude)', value: AIVendor.ANTHROPIC },
  { label: '阿里云 (通义千问)', value: AIVendor.ALIBABA },
  { label: 'MiniMax', value: AIVendor.MINIMAX },
  { label: '火山引擎 (字节)', value: AIVendor.VOLCENGINE },
]

const vendorLabels: Record<AIVendor, string> = {
  [AIVendor.OPENAI]: 'OpenAI',
  [AIVendor.ANTHROPIC]: 'Anthropic',
  [AIVendor.ALIBABA]: '阿里云',
  [AIVendor.DEEPSEEK]: 'DeepSeek',
  [AIVendor.MINIMAX]: 'MiniMax',
  [AIVendor.VOLCENGINE]: '火山引擎',
}

const defaultModelIds: Record<AIVendor, string> = {
  [AIVendor.OPENAI]: 'gpt-4o',
  [AIVendor.ANTHROPIC]: 'claude-3-5-sonnet-20241022',
  [AIVendor.ALIBABA]: 'qwen-max',
  [AIVendor.DEEPSEEK]: 'deepseek-chat',
  [AIVendor.MINIMAX]: 'MiniMax-Text-01',
  [AIVendor.VOLCENGINE]: 'doubao-pro-32k',
}

export default function SettingsPage() {
  const [configs, setConfigs] = useState<AIConfig[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingConfig, setEditingConfig] = useState<AIConfig | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null)

  const [formData, setFormData] = useState({
    name: '',
    vendor: AIVendor.DEEPSEEK,
    modelId: '',
    apiKey: '',
    apiEndpoint: '',
    isDefault: false,
  })

  // 获取配置列表
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

  // 打开新增/编辑弹窗
  const openModal = (config?: AIConfig) => {
    setTestResult(null)
    if (config) {
      setEditingConfig(config)
      setFormData({
        name: config.name,
        vendor: config.vendor,
        modelId: config.modelId,
        apiKey: '', // 不显示现有 API Key
        apiEndpoint: config.apiEndpoint || '',
        isDefault: config.isDefault,
      })
    } else {
      setEditingConfig(null)
      setFormData({
        name: '',
        vendor: AIVendor.DEEPSEEK,
        modelId: defaultModelIds[AIVendor.DEEPSEEK],
        apiKey: '',
        apiEndpoint: '',
        isDefault: false,
      })
    }
    setShowModal(true)
  }

  // 测试配置
  const handleTest = async () => {
    if (!formData.modelId || !formData.apiKey) {
      setTestResult({ success: false, message: '请先填写模型 ID 和 API Key' })
      return
    }

    setTesting(true)
    setTestResult(null)

    try {
      const res = await fetch('/api/novel/ai-configs/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vendor: formData.vendor,
          modelId: formData.modelId,
          apiKey: formData.apiKey,
          apiEndpoint: formData.apiEndpoint || undefined,
        }),
      })

      const data = await res.json()

      if (data.success) {
        setTestResult({ success: true, message: data.data.response || '测试成功！' })
      } else {
        setTestResult({ success: false, message: data.error?.message || '测试失败' })
      }
    } catch (error) {
      setTestResult({ success: false, message: '网络错误，请重试' })
    } finally {
      setTesting(false)
    }
  }

  // 测试已有配置
  const handleTestConfig = async (config: AIConfig) => {
    setTesting(true)
    setTestResult(null)

    try {
      const res = await fetch(`/api/novel/ai-configs/${config.id}/test`, {
        method: 'POST',
      })

      const data = await res.json()

      if (data.success) {
        setTestResult({ success: true, message: data.data.response || '测试成功！' })
      } else {
        setTestResult({ success: false, message: data.error?.message || '测试失败' })
      }
    } catch (error) {
      setTestResult({ success: false, message: '网络错误，请重试' })
    } finally {
      setTesting(false)
    }
  }

  // 提交表单
  const handleSubmit = async () => {
    if (!formData.name || !formData.modelId || !formData.apiKey) {
      alert('请填写完整信息')
      return
    }

    setSubmitting(true)
    try {
      const url = editingConfig
        ? `/api/novel/ai-configs/${editingConfig.id}`
        : '/api/novel/ai-configs'
      const method = editingConfig ? 'PUT' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      const result = await res.json()
      if (result.success) {
        setShowModal(false)
        fetchConfigs()
      } else {
        alert(result.error?.message || '保存失败')
      }
    } catch (error) {
      console.error('保存失败:', error)
      alert('保存失败')
    } finally {
      setSubmitting(false)
    }
  }

  // 删除配置
  const handleDelete = async (id: number) => {
    if (!confirm('确定要删除这个配置吗？')) return

    try {
      const res = await fetch(`/api/novel/ai-configs/${id}`, {
        method: 'DELETE',
      })
      const result = await res.json()
      if (result.success) {
        fetchConfigs()
      }
    } catch (error) {
      console.error('删除失败:', error)
    }
  }

  // 设置默认
  const handleSetDefault = async (id: number) => {
    try {
      const res = await fetch(`/api/novel/ai-configs/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isDefault: true }),
      })
      const result = await res.json()
      if (result.success) {
        fetchConfigs()
      }
    } catch (error) {
      console.error('设置默认失败:', error)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-white dark:bg-gray-800 border-b">
        <div className="px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">设置</h1>
              <p className="text-sm text-gray-500">配置 AI 模型和 API</p>
            </div>
            <Button onClick={() => openModal()}>
              <Plus className="h-4 w-4 mr-2" />
              添加配置
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* 提示信息 */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <Shield className="h-5 w-5 text-blue-500 mt-0.5" />
              <div>
                <h3 className="font-medium text-sm">API Key 安全说明</h3>
                <p className="text-xs text-gray-500 mt-1">
                  您的 API Key 会加密存储，仅用于调用对应 AI 服务商接口。
                  我们不会将您的 API Key 用于任何其他用途。
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 测试结果提示 */}
        {testResult && (
          <Card className={testResult.success ? 'border-green-500' : 'border-red-500'}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                {testResult.success ? (
                  <CheckCircle className="h-5 w-5 text-green-500" />
                ) : (
                  <XCircle className="h-5 w-5 text-red-500" />
                )}
                <span className={testResult.success ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}>
                  {testResult.message}
                </span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* 配置列表 */}
        {loading ? (
          <div className="text-center py-12 text-gray-500">加载中...</div>
        ) : configs.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <Key className="h-12 w-12 mx-auto text-gray-300 mb-4" />
              <h3 className="font-medium mb-2">暂无 AI 配置</h3>
              <p className="text-sm text-gray-500 mb-4">添加您的第一个 AI API 配置</p>
              <Button onClick={() => openModal()}>
                <Plus className="h-4 w-4 mr-2" />
                添加配置
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {configs.map((config) => (
              <Card key={config.id}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium">{config.name}</span>
                        <Badge variant="outline">{vendorLabels[config.vendor]}</Badge>
                        {config.isDefault && (
                          <Badge variant="success">默认</Badge>
                        )}
                      </div>
                      <div className="text-sm text-gray-500 space-y-1">
                        <p>模型: {config.modelId}</p>
                        <p>API Key: {config.apiKey || '未设置'}</p>
                        {config.apiEndpoint && <p>端点: {config.apiEndpoint}</p>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleTestConfig(config)}
                        disabled={testing}
                      >
                        {testing ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Play className="h-4 w-4" />
                        )}
                        测试
                      </Button>
                      {!config.isDefault && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleSetDefault(config.id)}
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openModal(config)}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(config.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>

      {/* 新增/编辑弹窗 */}
      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title={editingConfig ? '编辑配置' : '添加配置'}
      >
        <div className="space-y-4">
          <Input
            label="配置名称"
            placeholder="如：我的 DeepSeek"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          />

          <Select
            label="AI 提供商"
            options={vendorOptions}
            value={formData.vendor}
            onChange={(e) => setFormData({
              ...formData,
              vendor: e.target.value as AIVendor,
              modelId: defaultModelIds[e.target.value as AIVendor] || '',
            })}
          />

          <Input
            label="模型 ID"
            placeholder="如：deepseek-chat"
            value={formData.modelId}
            onChange={(e) => setFormData({ ...formData, modelId: e.target.value })}
          />

          <Input
            label="API Key"
            type="password"
            placeholder={editingConfig ? '不修改请留空' : '请输入 API Key'}
            value={formData.apiKey}
            onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
          />

          <Input
            label="自定义端点（可选）"
            placeholder="如使用代理或特殊端点"
            value={formData.apiEndpoint}
            onChange={(e) => setFormData({ ...formData, apiEndpoint: e.target.value })}
          />

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="isDefault"
              checked={formData.isDefault}
              onChange={(e) => setFormData({ ...formData, isDefault: e.target.checked })}
              className="w-4 h-4 rounded accent-blue-600"
            />
            <label htmlFor="isDefault" className="text-sm cursor-pointer">设为默认配置</label>
          </div>

          {/* 测试结果 */}
          {testResult && (
            <div className={`p-3 rounded-lg ${testResult.success ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400' : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400'}`}>
              <div className="flex items-center gap-2">
                {testResult.success ? (
                  <CheckCircle className="h-4 w-4" />
                ) : (
                  <XCircle className="h-4 w-4" />
                )}
                <span className="text-sm">{testResult.message}</span>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button
              variant="outline"
              onClick={handleTest}
              disabled={testing || !formData.modelId || !formData.apiKey}
            >
              {testing ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Play className="h-4 w-4 mr-2" />
              )}
              测试连接
            </Button>
            <Button variant="outline" onClick={() => setShowModal(false)}>
              取消
            </Button>
            <Button onClick={handleSubmit} loading={submitting}>
              保存
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
