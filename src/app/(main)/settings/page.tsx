'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Button, Input, Select, Modal, Badge, Card, CardContent, Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui'
import { AgentManager, WorkflowHooksPanel } from '@/components/ai'
import { Plus, Trash2, Edit2, Check, Key, Shield, Play, Loader2, CheckCircle, XCircle, Bot, Workflow, Eye, EyeOff } from 'lucide-react'
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
  { label: '智谱 AI (GLM)', value: AIVendor.ZHIPU },
]

const vendorLabels: Record<AIVendor, string> = {
  [AIVendor.OPENAI]: 'OpenAI',
  [AIVendor.ANTHROPIC]: 'Anthropic',
  [AIVendor.ALIBABA]: '阿里云',
  [AIVendor.DEEPSEEK]: 'DeepSeek',
  [AIVendor.MINIMAX]: 'MiniMax',
  [AIVendor.VOLCENGINE]: '火山引擎',
  [AIVendor.ZHIPU]: '智谱 AI',
}

const defaultModelIds: Record<AIVendor, string> = {
  [AIVendor.OPENAI]: 'gpt-4o',
  [AIVendor.ANTHROPIC]: 'claude-3-5-sonnet-20241022',
  [AIVendor.ALIBABA]: 'qwen-max',
  [AIVendor.DEEPSEEK]: 'deepseek-v4-flash',
  [AIVendor.MINIMAX]: 'MiniMax-Text-01',
  [AIVendor.VOLCENGINE]: 'ark-code-latest',
  [AIVendor.ZHIPU]: 'GLM-4.5-Air',
}

const defaultApiEndpoints: Partial<Record<AIVendor, string>> = {
  [AIVendor.VOLCENGINE]: 'https://ark.cn-beijing.volces.com/api/coding/v3',
  [AIVendor.ZHIPU]: 'https://open.bigmodel.cn/api/paas/v4',
}

export default function SettingsPage() {
  const router = useRouter()
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
  const [showApiKey, setShowApiKey] = useState(false)

  const [activeTab, setActiveTab] = useState<'ai-configs' | 'agents' | 'hooks'>('ai-configs')
  const [loadedTabs, setLoadedTabs] = useState<Set<string>>(new Set(['ai-configs']))

  const handleTabChange = (tab: string) => {
    setActiveTab(tab as typeof activeTab)
    setLoadedTabs(prev => new Set([...prev, tab]))
  }

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
        isDefault: false,
      })
    }
    setShowModal(true)
  }

  const handleTest = async () => {
    if (!formData.modelId || (!formData.apiKey && !editingConfig)) {
      setTestResult({ success: false, message: '请先填写模型 ID 和 API Key' })
      return
    }

    // 如果是编辑模式且没有输入新的API Key，我们需要获取完整的API Key来测试
    let apiKeyToUse = formData.apiKey
    if (editingConfig && !formData.apiKey) {
      // 这里我们需要一个API来获取完整的API Key用于测试
      // 但是考虑到安全性，我们暂时使用后端的 test/{id} 接口
      // 不过这需要修改逻辑，先跳过这里，我们稍后调整
      setTestResult({ success: false, message: '编辑时测试功能暂时不可用，请重新输入 API Key' })
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
            apiKey: formData.apiKey.trim() || undefined 
          }
        : formData

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      const data = await res.json()
      if (data.success) {
        setShowModal(false)
        fetchConfigs()
      } else {
        setTestResult({ success: false, message: data.error?.message || '保存失败' })
      }
    } catch (error) {
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
      }
    } catch (error) {
      console.error('删除失败:', error)
    }
  }

  const handleSetDefault = async (configId: number) => {
    try {
      const res = await fetch(`/api/novel/ai-configs/${configId}/set-default`, {
        method: 'POST',
      })
      const result = await res.json()
      if (result.success) {
        fetchConfigs()
      }
    } catch (error) {
      console.error('设置默认失败:', error)
    }
  }

  const handleTestConfig = async (config: AIConfig) => {
    setTesting(true)
    try {
      const res = await fetch(`/api/novel/ai-configs/${config.id}/test`, {
        method: 'POST',
      })
      const data = await res.json()
      if (data.success) {
        alert('测试成功！')
      } else {
        alert('测试失败: ' + (data.error?.message || '未知错误'))
      }
    } catch (error) {
      alert('网络错误，请重试')
    } finally {
      setTesting(false)
    }
  }

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">系统设置</h1>
          <p className="text-sm text-gray-500">管理 AI 配置、Agent 和工作流</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList>
          <TabsTrigger value="ai-configs">
            <Key className="h-4 w-4 mr-2" />
            AI 配置
          </TabsTrigger>
          <TabsTrigger value="agents">
            <Bot className="h-4 w-4 mr-2" />
            Agent 管理
          </TabsTrigger>
          <TabsTrigger value="hooks">
            <Workflow className="h-4 w-4 mr-2" />
            工作流 Hooks
          </TabsTrigger>
        </TabsList>

        <TabsContent value="ai-configs">
          <div className="max-w-4xl mx-auto space-y-6">
            <Card>
              <CardContent className="p-4">
                <div className="space-y-2">
                  <h3 className="font-medium text-sm text-gray-900 dark:text-white">绑定 AI 模型的最短路径</h3>
                  <ol className="list-decimal space-y-1 pl-5 text-xs text-gray-600 dark:text-gray-400">
                    <li>点击“添加配置”。</li>
                    <li>选择供应商，填模型 ID 和 API Key。</li>
                    <li>保存后点左侧的“默认”按钮，或回到项目页在“编辑项目”里选中它。</li>
                  </ol>
                </div>
              </CardContent>
            </Card>
            <div className="flex justify-end">
              <Button onClick={() => openModal()}>
                <Plus className="h-4 w-4 mr-2" />
                添加配置
              </Button>
            </div>
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

            {testResult && (
              <Card className={testResult.success ? 'border-green-200' : 'border-red-200'}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2">
                    {testResult.success ? (
                      <CheckCircle className="h-5 w-5 text-green-500" />
                    ) : (
                      <XCircle className="h-5 w-5 text-red-500" />
                    )}
                    <span className={testResult.success ? 'text-green-700' : 'text-red-700'}>
                      {testResult.message}
                    </span>
                  </div>
                </CardContent>
              </Card>
            )}

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
                            <p>API Key: {config.apiKey ? '已配置' : '未设置'}</p>
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
          </div>
        </TabsContent>

        <TabsContent value="agents">
          <div className="max-w-4xl mx-auto">
            <Card>
              <CardContent className="p-6">
                {loadedTabs.has('agents') ? (
                  <AgentManager />
                ) : (
                  <div className="text-center py-12 text-gray-500">
                    <Loader2 className="h-8 w-8 mx-auto mb-4 animate-spin" />
                    加载中...
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="hooks">
          <div className="max-w-4xl mx-auto">
            <Card>
              <CardContent className="p-6">
                {loadedTabs.has('hooks') ? (
                  <WorkflowHooksPanel />
                ) : (
                  <div className="text-center py-12 text-gray-500">
                    <Loader2 className="h-8 w-8 mx-auto mb-4 animate-spin" />
                    加载中...
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

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
              modelId: defaultModelIds[e.target.value as AIVendor],
              apiEndpoint: defaultApiEndpoints[e.target.value as AIVendor] || '',
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
            type={showApiKey ? "text" : "password"}
            placeholder={editingConfig ? "留空则保持不变，或输入新的 API Key" : "请输入您的 API Key"}
            value={formData.apiKey}
            onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
            rightAction={
              <button
                type="button"
                onClick={() => setShowApiKey(!showApiKey)}
                className="text-gray-500 hover:text-gray-700 focus:outline-none"
              >
                {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            }
          />

          <Input
            label="API 端点 (可选)"
            placeholder="如：https://ark.cn-beijing.volces.com/api/coding/v3"
            value={formData.apiEndpoint}
            onChange={(e) => setFormData({ ...formData, apiEndpoint: e.target.value })}
          />

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="isDefault"
              checked={formData.isDefault}
              onChange={(e) => setFormData({ ...formData, isDefault: e.target.checked })}
            />
            <label htmlFor="isDefault" className="text-sm text-gray-600">
              设为默认配置
            </label>
          </div>

          {testResult && (
            <div className={`p-3 rounded ${testResult.success ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
              {testResult.message}
            </div>
          )}

          <div className="flex gap-3 justify-end">
            <Button variant="outline" onClick={handleTest} disabled={testing || submitting}>
              {testing ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Play className="h-4 w-4 mr-2" />
              )}
              测试连接
            </Button>
            <Button variant="primary" onClick={handleSubmit} disabled={submitting || testing}>
              {submitting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : null}
              保存
            </Button>
          </div>
        </div>
      </Modal>
    </>
  )
}
