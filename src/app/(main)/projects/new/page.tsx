'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { Button, Input, Select, Textarea, toast } from '@/components/ui'
import { ArrowLeft, Sparkles, ChevronDown, ChevronUp, Settings, AlertCircle } from 'lucide-react'
import { InspirationPanel } from '@/components/inspiration'
import { genreOptions, writingStyleOptions, targetAudienceOptions } from '@/components/project'
import type { HotInspiration } from '@/lib/inspiration/data'

interface AIConfig {
  id: number
  name: string
  vendor: string
  modelId: string
  isDefault: boolean
}

interface NewProjectForm {
  title: string
  description: string
  genre: string
  writingStyle: string
  targetAudience: 'MALE' | 'FEMALE' | ''
  targetWordCount: number | undefined
  chapterWordCount: number
  totalVolumes: number
  aiModelId: number | undefined
}

export default function NewProjectPage() {
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [generatingSynopsis, setGeneratingSynopsis] = useState(false)
  const [aiConfigs, setAiConfigs] = useState<AIConfig[]>([])
  const [loadingConfigs, setLoadingConfigs] = useState(true)

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<NewProjectForm>({
    defaultValues: {
      title: '',
      description: '',
      genre: '',
      writingStyle: '',
      targetAudience: '',
      targetWordCount: undefined,
      chapterWordCount: 3000,
      totalVolumes: 4,
      aiModelId: undefined,
    },
  })

  const formValues = watch()

  useEffect(() => {
    fetch('/api/novel/ai-configs')
      .then((res) => res.json())
      .then((data) => { if (data.success) setAiConfigs(data.data) })
      .catch(() => {})
      .finally(() => setLoadingConfigs(false))
  }, [])

  const handleInspirationSelect = (inspiration: HotInspiration) => {
    setValue('title', inspiration.sampleTitle)
    setValue('description', inspiration.sampleSummary)
    setValue('genre', inspiration.sampleGenre)
    setValue('writingStyle', inspiration.sampleWritingStyle)
    if (inspiration.category === 'male') setValue('targetAudience', 'MALE')
    else if (inspiration.category === 'female') setValue('targetAudience', 'FEMALE')
    toast.success(`已应用「${inspiration.title}」灵感`)
  }

  const handleGenerateSynopsis = async () => {
    const title = formValues.title
    if (!title?.trim()) {
      toast.error('请先输入小说标题')
      return
    }
    setGeneratingSynopsis(true)
    try {
      const res = await fetch('/api/novel/ai/generate-synopsis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectTitle: title,
          existingSynopsis: formValues.description || undefined,
          genre: formValues.genre || undefined,
          writingStyle: formValues.writingStyle || undefined,
          targetAudience: formValues.targetAudience || undefined,
          aiModelId: formValues.aiModelId || undefined,
        }),
      })
      const data = await res.json()
      if (data.success && data.data.synopsis) {
        setValue('description', data.data.synopsis)
      } else {
        toast.error(data.error?.message || '生成简介失败')
      }
    } catch {
      toast.error('生成简介失败，请稍后重试')
    } finally {
      setGeneratingSynopsis(false)
    }
  }

  const onSubmit = async (data: NewProjectForm) => {
    setSubmitting(true)
    try {
      const res = await fetch('/api/novel/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          targetAudience: data.targetAudience || undefined,
          targetWordCount: data.targetWordCount || undefined,
          aiModelId: data.aiModelId || undefined,
        }),
      })
      const result = await res.json()
      if (result.success) {
        router.push(`/projects/${result.data.id}`)
      } else {
        toast.error(result.error?.message || '创建项目失败')
      }
    } catch {
      toast.error('创建项目失败，请稍后重试')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-white dark:bg-gray-800 border-b">
        <div className="mx-auto max-w-3xl px-4 py-4 sm:px-6">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.back()}
              className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <ArrowLeft className="h-5 w-5 text-gray-600 dark:text-gray-400" />
            </button>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">新建小说项目</h1>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
          {/* 灵感区 */}
          <section>
            <InspirationPanel onSelect={handleInspirationSelect} />
          </section>

          {/* 分隔线 */}
          <div className="border-t border-gray-200 dark:border-gray-700" />

          {/* 基本信息 */}
          <section className="space-y-5">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-lg">📝</span>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">基本信息</h2>
              <span className="text-sm text-gray-400">（以下均可后期修改）</span>
            </div>

            <Input
              label="小说标题 *"
              placeholder="例如：我在深夜凝视深渊"
              error={errors.title?.message}
              maxLength={200}
              {...register('title', {
                required: '请输入小说标题',
                maxLength: { value: 200, message: '标题不能超过200字' },
              })}
            />

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  简介 *
                </label>
                <button
                  type="button"
                  onClick={handleGenerateSynopsis}
                  disabled={generatingSynopsis}
                  className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 disabled:opacity-50"
                >
                  {generatingSynopsis ? (
                    <>
                      <div className="h-3 w-3 animate-spin rounded-full border border-blue-600 border-t-transparent" />
                      生成中...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-3 w-3" />
                      AI 润色
                    </>
                  )}
                </button>
              </div>
              <Textarea
                placeholder="一句话描述你的小说核心梗概，或点击「AI 润色」自动生成"
                rows={3}
                error={errors.description?.message}
                {...register('description', { required: '请输入小说简介' })}
              />
            </div>

            <Select
              label="小说类型 *"
              options={genreOptions}
              placeholder="选择小说类型"
              error={errors.genre?.message}
              {...register('genre', { required: '请选择小说类型' })}
            />
          </section>

          {/* 高级设置 */}
          <section className="border-t border-gray-200 dark:border-gray-700 pt-4">
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 transition-colors"
            >
              {showAdvanced ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              ⚙️ 高级设置
            </button>

            {showAdvanced && (
              <div className="mt-4 space-y-5">
                <div className="grid grid-cols-2 gap-4">
                  <Select
                    label="写作风格"
                    options={writingStyleOptions}
                    placeholder="选择写作风格"
                    {...register('writingStyle')}
                  />
                  <Select
                    label="目标受众"
                    options={targetAudienceOptions}
                    placeholder="选择男频/女频"
                    {...register('targetAudience')}
                  />
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <Input
                    label="目标字数"
                    type="number"
                    placeholder="默认不限"
                    min={1000}
                    max={100000000}
                    {...register('targetWordCount', { valueAsNumber: true })}
                  />
                  <Input
                    label="每章字数"
                    type="number"
                    placeholder="默认 3000"
                    min={100}
                    max={100000}
                    {...register('chapterWordCount', { valueAsNumber: true })}
                  />
                  <Input
                    label="总卷数"
                    type="number"
                    placeholder="默认 4"
                    min={1}
                    max={100}
                    {...register('totalVolumes', { valueAsNumber: true })}
                  />
                </div>

                {/* AI 配置 */}
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    AI 模型配置
                  </label>
                  {loadingConfigs ? (
                    <div className="text-sm text-gray-500">加载中...</div>
                  ) : aiConfigs.length === 0 ? (
                    <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg text-amber-700 dark:text-amber-400">
                      <AlertCircle className="h-4 w-4 flex-shrink-0" />
                      <span className="text-sm">暂无可用的 AI 配置</span>
                      <button
                        type="button"
                        onClick={() => router.push('/settings')}
                        className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline"
                      >
                        <Settings className="h-3 w-3" />
                        去配置
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-4">
                      <select
                        className="flex-1 h-10 px-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm"
                        {...register('aiModelId', { valueAsNumber: true })}
                      >
                        <option value="">使用默认配置</option>
                        {aiConfigs.map((config) => (
                          <option key={config.id} value={config.id}>
                            {config.name} ({config.modelId})
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => router.push('/settings')}
                        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                      >
                        <Settings className="h-4 w-4" />
                        管理
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </section>

          {/* 操作按钮 */}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <Button type="button" variant="outline" onClick={() => router.back()}>
              取消
            </Button>
            <Button type="submit" loading={submitting}>
              开始创作 →
            </Button>
          </div>
        </form>
      </main>
    </div>
  )
}
