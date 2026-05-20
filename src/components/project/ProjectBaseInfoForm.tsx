'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { AlertCircle, Settings } from 'lucide-react'
import { Button, Input, Select, Textarea } from '@/components/ui'
import { genreOptions, writingStyleOptions } from './ProjectForm'
import { AIVendor } from '@/types'

interface AIConfig {
  id: number
  name: string
  vendor: AIVendor
  modelId: string
}

export interface ProjectBaseInfoFormData {
  title: string
  description?: string
  genre?: string
  writingStyle?: string
  targetWordCount?: number
  chapterWordCount?: number
  totalVolumes?: number
  coverImage?: string
  aiModelId?: number
}

interface ProjectBaseInfoFormProps {
  defaultValues?: Partial<ProjectBaseInfoFormData>
  onSubmit: (data: ProjectBaseInfoFormData) => Promise<void>
  onCancel?: () => void
  loading?: boolean
}

export function ProjectBaseInfoForm({ defaultValues, onSubmit, onCancel, loading }: ProjectBaseInfoFormProps) {
  const router = useRouter()
  const [formData, setFormData] = useState<ProjectBaseInfoFormData>({
    title: defaultValues?.title || '',
    description: defaultValues?.description || '',
    genre: defaultValues?.genre || '',
    writingStyle: defaultValues?.writingStyle || '',
    targetWordCount: defaultValues?.targetWordCount,
    chapterWordCount: defaultValues?.chapterWordCount || 3000,
    totalVolumes: defaultValues?.totalVolumes || 4,
    coverImage: defaultValues?.coverImage || '',
    aiModelId: defaultValues?.aiModelId,
  })
  const [aiConfigs, setAiConfigs] = useState<AIConfig[]>([])
  const [loadingConfigs, setLoadingConfigs] = useState(true)

  useEffect(() => {
    let mounted = true
    fetch('/api/novel/ai-configs')
      .then(res => res.json())
      .then(data => {
        if (mounted && data.success) {
          setAiConfigs(data.data)
        }
      })
      .catch(() => {})
      .finally(() => {
        if (mounted) setLoadingConfigs(false)
      })

    return () => {
      mounted = false
    }
  }, [])

  const updateField = <K extends keyof ProjectBaseInfoFormData>(key: K, value: ProjectBaseInfoFormData[K]) => {
    setFormData(prev => ({ ...prev, [key]: value }))
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    await onSubmit({
      ...formData,
      title: formData.title.trim(),
      description: formData.description?.trim() || undefined,
      genre: formData.genre || undefined,
      writingStyle: formData.writingStyle || undefined,
      coverImage: formData.coverImage?.trim() || undefined,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <Input
        label="项目标题"
        placeholder="请输入项目标题"
        value={formData.title}
        onChange={event => updateField('title', event.target.value)}
        required
      />

      <Textarea
        label="项目简介"
        placeholder="可选，用于补充项目背景"
        rows={3}
        value={formData.description || ''}
        onChange={event => updateField('description', event.target.value)}
      />

      <div className="grid grid-cols-2 gap-4">
        <Select
          label="题材"
          options={genreOptions}
          placeholder="选择题材"
          value={formData.genre || ''}
          onChange={event => updateField('genre', event.target.value)}
        />
        <Select
          label="写作风格"
          options={writingStyleOptions}
          placeholder="选择风格"
          value={formData.writingStyle || ''}
          onChange={event => updateField('writingStyle', event.target.value)}
        />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Input
          label="目标字数"
          type="number"
          value={formData.targetWordCount ?? ''}
          onChange={event => updateField('targetWordCount', event.target.value ? Number(event.target.value) : undefined)}
        />
        <Input
          label="每章字数"
          type="number"
          value={formData.chapterWordCount ?? 3000}
          onChange={event => updateField('chapterWordCount', event.target.value ? Number(event.target.value) : undefined)}
        />
        <Input
          label="总卷数"
          type="number"
          value={formData.totalVolumes ?? 4}
          onChange={event => updateField('totalVolumes', event.target.value ? Number(event.target.value) : undefined)}
        />
      </div>

      <Input
        label="封面图片 URL"
        placeholder="https://..."
        value={formData.coverImage || ''}
        onChange={event => updateField('coverImage', event.target.value)}
      />

      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          AI 模型配置
        </label>
        {loadingConfigs ? (
          <div className="text-sm text-gray-500">加载中...</div>
        ) : aiConfigs.length === 0 ? (
          <div className="flex items-center gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-700 dark:bg-amber-900/20 dark:text-amber-400">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            <span>暂无可用的 AI 配置</span>
            <button
              type="button"
              onClick={() => router.push('/settings')}
              className="inline-flex items-center gap-1 text-blue-600 hover:underline"
            >
              <Settings className="h-3 w-3" />
              去配置
            </button>
          </div>
        ) : (
          <select
            className="h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
            value={formData.aiModelId ?? ''}
            onChange={event => updateField('aiModelId', event.target.value ? Number(event.target.value) : undefined)}
          >
            <option value="">使用默认配置</option>
            {aiConfigs.map(config => (
              <option key={config.id} value={config.id}>
                {config.name} ({config.modelId})
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="flex justify-end gap-3 border-t pt-4">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            取消
          </Button>
        )}
        <Button type="submit" loading={loading}>
          保存基础信息
        </Button>
      </div>
    </form>
  )
}
