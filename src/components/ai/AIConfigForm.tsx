'use client'

import { useState } from 'react'
import { Button, Input, Select } from '@/components/ui'
import { Play, Loader2, Eye, EyeOff, ChevronDown, ChevronUp, Settings2, Shield, CheckCircle2 } from 'lucide-react'
import { AIVendor } from '@/types'

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

interface AIConfigFormProps {
  formData: AIConfigFormData
  onChange: (data: AIConfigFormData) => void
  editing: boolean
  onTest: () => Promise<void>
  onSubmit: () => Promise<void>
  onCancel: () => void
  submitting: boolean
  testing: boolean
  testResult: { success: boolean; message: string } | null
}

const vendorMeta: Record<AIVendor, { label: string; icon: string; desc: string; needsEndpoint: boolean }> = {
  [AIVendor.OPENAI]: { label: 'OpenAI', icon: '🤖', desc: 'GPT-4o / o1 系列', needsEndpoint: false },
  [AIVendor.ANTHROPIC]: { label: 'Anthropic', icon: '🧠', desc: 'Claude Sonnet / Opus', needsEndpoint: false },
  [AIVendor.ALIBABA]: { label: '阿里云', icon: '☁️', desc: '通义千问 Qwen 系列', needsEndpoint: false },
  [AIVendor.DEEPSEEK]: { label: 'DeepSeek', icon: '🔍', desc: 'DeepSeek V4 / R1', needsEndpoint: false },
  [AIVendor.MINIMAX]: { label: 'MiniMax', icon: '⚡', desc: 'MiniMax-Text-01', needsEndpoint: false },
  [AIVendor.MIMO]: { label: '小米 MiMo', icon: '📱', desc: 'MiMo 系列模型', needsEndpoint: true },
  [AIVendor.VOLCENGINE]: { label: '火山引擎', icon: '🌋', desc: '豆包 / Ark 系列', needsEndpoint: true },
  [AIVendor.ZHIPU]: { label: '智谱 AI', icon: '💎', desc: 'GLM-4 系列', needsEndpoint: true },
}

const vendorOptions = Object.entries(vendorMeta).map(([value, meta]) => ({
  label: `${meta.icon} ${meta.label}`,
  value: value as AIVendor,
}))

const modelPresets: Record<AIVendor, string[]> = {
  [AIVendor.OPENAI]: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'o3-mini', 'o1'],
  [AIVendor.ANTHROPIC]: ['claude-sonnet-4-20250514', 'claude-3-5-sonnet-20241022', 'claude-3-opus-20240229', 'claude-3-5-haiku-20241022'],
  [AIVendor.ALIBABA]: ['qwen-max', 'qwen-plus', 'qwen-turbo', 'qwen3-max'],
  [AIVendor.DEEPSEEK]: ['deepseek-v4-flash', 'deepseek-chat', 'deepseek-reasoner'],
  [AIVendor.MINIMAX]: ['MiniMax-Text-01', 'abab6.5s-chat'],
  [AIVendor.MIMO]: ['mimo-v2.5', 'mimo-v2'],
  [AIVendor.VOLCENGINE]: ['ark-code-latest', 'doubao-pro-32k', 'deepseek-r1-2501'],
  [AIVendor.ZHIPU]: ['GLM-4.5-Air', 'glm-4-0520', 'glm-4-plus', 'glm-4-flash'],
}

const defaultModelIds: Record<AIVendor, string> = {
  [AIVendor.OPENAI]: 'gpt-4o',
  [AIVendor.ANTHROPIC]: 'claude-3-5-sonnet-20241022',
  [AIVendor.ALIBABA]: 'qwen-max',
  [AIVendor.DEEPSEEK]: 'deepseek-v4-flash',
  [AIVendor.MINIMAX]: 'MiniMax-Text-01',
  [AIVendor.MIMO]: 'mimo-v2.5',
  [AIVendor.VOLCENGINE]: 'ark-code-latest',
  [AIVendor.ZHIPU]: 'GLM-4.5-Air',
}

const defaultApiEndpoints: Partial<Record<AIVendor, string>> = {
  [AIVendor.MIMO]: 'https://token-plan-cn.xiaomimimo.com/v1',
  [AIVendor.VOLCENGINE]: 'https://ark.cn-beijing.volces.com/api/coding/v3',
  [AIVendor.ZHIPU]: 'https://open.bigmodel.cn/api/paas/v4',
}

const defaultEmbeddingModelIds: Partial<Record<AIVendor, string>> = {
  [AIVendor.OPENAI]: 'text-embedding-3-small',
}

const defaultEmbeddingApiEndpoints: Partial<Record<AIVendor, string>> = {
  [AIVendor.MIMO]: 'https://token-plan-cn.xiaomimimo.com/v1',
  [AIVendor.VOLCENGINE]: 'https://ark.cn-beijing.volces.com/api/coding/v3',
  [AIVendor.ZHIPU]: 'https://open.bigmodel.cn/api/paas/v4',
}

const defaultEmbeddingDimensions = 256

export function AIConfigForm({
  formData,
  onChange,
  editing,
  onTest,
  onSubmit,
  onCancel,
  submitting,
  testing,
  testResult,
}: AIConfigFormProps) {
  const [showApiKey, setShowApiKey] = useState(false)
  const [showEmbedding, setShowEmbedding] = useState(!!formData.embeddingVendor)
  const currentVendor = formData.vendor
  const needsEndpoint = vendorMeta[currentVendor]?.needsEndpoint ?? false

  const update = (partial: Partial<AIConfigFormData>) => {
    onChange({ ...formData, ...partial })
  }

  const handleVendorChange = (vendor: AIVendor) => {
    update({
      vendor,
      modelId: defaultModelIds[vendor],
      apiEndpoint: defaultApiEndpoints[vendor] || '',
    })
  }

  const presets = modelPresets[currentVendor] || []

  return (
    <div className="space-y-0">
      <SectionHeader icon={<Settings2 className="h-4 w-4" />} title="基础设置" />

      <div className="space-y-4 px-0.5">
        <Input
          label="配置名称"
          placeholder="如：我的 DeepSeek"
          value={formData.name}
          onChange={(e) => update({ name: e.target.value })}
        />

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            AI 提供商
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {(Object.entries(vendorMeta) as [AIVendor, typeof vendorMeta[AIVendor]][]).map(([vendor, meta]) => (
              <button
                key={vendor}
                type="button"
                onClick={() => handleVendorChange(vendor)}
                className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all duration-200 ${
                  currentVendor === vendor
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/40 dark:border-blue-400 shadow-sm'
                    : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/50 hover:border-gray-300 dark:hover:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800'
                }`}
              >
                <span className="text-xl">{meta.icon}</span>
                <span className={`text-xs font-medium ${
                  currentVendor === vendor
                    ? 'text-blue-700 dark:text-blue-300'
                    : 'text-gray-700 dark:text-gray-300'
                }`}>
                  {meta.label}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            模型 ID
          </label>
          {presets.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-2.5">
              {presets.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => update({ modelId: preset })}
                  className={`px-3 py-1.5 text-xs rounded-lg border transition-all duration-200 ${
                    formData.modelId === preset
                      ? 'border-blue-400 bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:border-blue-500 dark:text-blue-300 shadow-sm'
                      : 'border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-600 hover:text-gray-700 dark:hover:text-gray-300 bg-white dark:bg-gray-800/50'
                  }`}
                >
                  {preset}
                </button>
              ))}
            </div>
          )}
          <Input
            placeholder="输入模型 ID 或点击上方预设"
            value={formData.modelId}
            onChange={(e) => update({ modelId: e.target.value })}
          />
        </div>

        <Input
          label="API Key"
          type={showApiKey ? 'text' : 'password'}
          placeholder={editing ? '留空则保持不变，或输入新的 API Key' : '请输入您的 API Key'}
          value={formData.apiKey}
          onChange={(e) => update({ apiKey: e.target.value })}
          rightAction={
            <button
              type="button"
              onClick={() => setShowApiKey(!showApiKey)}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            >
              {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          }
        />

        {needsEndpoint && (
          <Input
            label="API 端点"
            placeholder="如：https://ark.cn-beijing.volces.com/api/coding/v3"
            value={formData.apiEndpoint}
            onChange={(e) => update({ apiEndpoint: e.target.value })}
          />
        )}
      </div>

      <div className="my-5">
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/20">
          <input
            type="checkbox"
            id="isDefault"
            checked={formData.isDefault}
            onChange={(e) => update({ isDefault: e.target.checked })}
            className="h-4 w-4 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500 dark:bg-gray-800"
          />
          <label htmlFor="isDefault" className="flex items-center gap-1.5 text-sm text-blue-700 dark:text-blue-300 cursor-pointer">
            <CheckCircle2 className="h-4 w-4" />
            设为默认配置
          </label>
        </div>
      </div>

      <SectionHeader
        icon={<Shield className="h-4 w-4" />}
        title="RAG 向量化"
        subtitle="可选 · 章节检索与记忆召回"
        collapsible
        expanded={showEmbedding}
        onToggle={() => setShowEmbedding(!showEmbedding)}
      />

      {showEmbedding && (
        <div className="space-y-4 px-0.5 pb-2">
          <Select
            label="Embedding 提供商"
            options={vendorOptions}
            value={formData.embeddingVendor || AIVendor.OPENAI}
            onChange={(e) => {
              const embeddingVendor = e.target.value as AIVendor
              update({
                embeddingVendor,
                embeddingApiEndpoint: formData.embeddingApiEndpoint || defaultEmbeddingApiEndpoints[embeddingVendor] || '',
                embeddingModelId: formData.embeddingModelId || defaultEmbeddingModelIds[embeddingVendor] || '',
              })
            }}
          />
          <Input
            label="API Key（可选）"
            type={showApiKey ? 'text' : 'password'}
            placeholder="向量服务对应的 API Key"
            value={formData.embeddingApiKey}
            onChange={(e) => update({ embeddingApiKey: e.target.value })}
          />
          <Input
            label="端点（可选）"
            placeholder="如：https://api.openai.com/v1"
            value={formData.embeddingApiEndpoint}
            onChange={(e) => update({ embeddingApiEndpoint: e.target.value })}
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="模型 ID（可选）"
              placeholder="如：text-embedding-3-small"
              value={formData.embeddingModelId}
              onChange={(e) => update({ embeddingModelId: e.target.value })}
            />
            <Input
              label="维度（可选）"
              type="number"
              min={64}
              max={3072}
              placeholder="256"
              value={formData.embeddingDimensions}
              onChange={(e) => update({ embeddingDimensions: e.target.value })}
            />
          </div>
        </div>
      )}

      {testResult && (
        <div className={`mt-4 flex items-center gap-2.5 p-3 rounded-xl text-sm ${
          testResult.success
            ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
            : 'bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800'
        }`}>
          <span className={`flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-xs ${
            testResult.success
              ? 'bg-emerald-100 dark:bg-emerald-900/50'
              : 'bg-red-100 dark:bg-red-900/50'
          }`}>
            {testResult.success ? '✓' : '✗'}
          </span>
          {testResult.message}
        </div>
      )}

      <div className="flex gap-3 justify-end pt-5 mt-2 border-t border-gray-100 dark:border-gray-800">
        <Button type="button" variant="outline" onClick={onCancel}>
          取消
        </Button>
        <Button type="button" variant="outline" onClick={onTest} disabled={testing || submitting}>
          {testing ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Play className="h-4 w-4 mr-1.5" />}
          测试连接
        </Button>
        <Button type="button" variant="primary" onClick={onSubmit} disabled={submitting || testing}>
          {submitting ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : null}
          {editing ? '保存' : '添加'}
        </Button>
      </div>
    </div>
  )
}

function SectionHeader({
  icon,
  title,
  subtitle,
  collapsible,
  expanded,
  onToggle,
}: {
  icon: React.ReactNode
  title: string
  subtitle?: string
  collapsible?: boolean
  expanded?: boolean
  onToggle?: () => void
}) {
  const content = (
    <div className="flex items-center gap-2">
      <span className="text-gray-500 dark:text-gray-400">{icon}</span>
      <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">{title}</span>
      {subtitle && (
        <span className="text-xs text-gray-400 dark:text-gray-500 font-normal">{subtitle}</span>
      )}
    </div>
  )

  if (collapsible && onToggle) {
    return (
      <button
        type="button"
        onClick={onToggle}
        className="flex items-center justify-between w-full py-3 mt-1"
      >
        {content}
        <span className="text-gray-400 dark:text-gray-500 transition-transform duration-200"
          style={{ transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)' }}>
          <ChevronDown className="h-4 w-4" />
        </span>
      </button>
    )
  }

  return <div className="py-3 mt-1">{content}</div>
}

export {
  vendorMeta,
  vendorOptions,
  modelPresets,
  defaultModelIds,
  defaultApiEndpoints,
  defaultEmbeddingModelIds,
  defaultEmbeddingApiEndpoints,
  defaultEmbeddingDimensions,
}