'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useForm, useWatch } from 'react-hook-form'
import { Button, Input, Select, Textarea, toast } from '@/components/ui'
import {
  AlertCircle,
  ArrowLeft,
  Bot,
  BookOpen,
  CheckCircle2,
  Circle,
  FileText,
  Gauge,
  Layers,
  Settings,
  Sparkles,
  Wand2,
} from 'lucide-react'
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

const wordCountPresets = [
  { label: '10 万', value: 100000 },
  { label: '30 万', value: 300000 },
  { label: '100 万', value: 1000000 },
]

function formatNumber(value?: number | null) {
  if (!value || Number.isNaN(value)) return '-'
  return new Intl.NumberFormat('zh-CN').format(value)
}

export default function NewProjectPage() {
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)
  const [generatingSynopsis, setGeneratingSynopsis] = useState(false)
  const [aiConfigs, setAiConfigs] = useState<AIConfig[]>([])
  const [loadingConfigs, setLoadingConfigs] = useState(true)

  const {
    register,
    handleSubmit,
    control,
    setValue,
    formState: { errors },
  } = useForm<NewProjectForm>({
    defaultValues: {
      title: '',
      description: '',
      genre: '',
      writingStyle: '',
      targetAudience: '',
      targetWordCount: 300000,
      chapterWordCount: 3000,
      totalVolumes: 4,
      aiModelId: undefined,
    },
  })

  const formValues = useWatch({ control })
  const targetWords = Number(formValues.targetWordCount) || 0
  const chapterWords = Number(formValues.chapterWordCount) || 3000
  const totalVolumes = Number(formValues.totalVolumes) || 4
  const estimatedChapters = targetWords && chapterWords ? Math.ceil(targetWords / chapterWords) : 0
  const chaptersPerVolume = estimatedChapters && totalVolumes ? Math.ceil(estimatedChapters / totalVolumes) : 0
  const completedRequired = [
    Boolean(formValues.title?.trim()),
    Boolean(formValues.description?.trim()),
    Boolean(formValues.genre),
  ].filter(Boolean).length
  const completionPercent = Math.round((completedRequired / 3) * 100)
  const selectedAiConfig = aiConfigs.find(config => config.id === Number(formValues.aiModelId))
  const activeModel = selectedAiConfig || aiConfigs.find(config => config.isDefault) || aiConfigs[0]

  const steps = [
    {
      label: '基础设定',
      done: Boolean(formValues.title?.trim()) && Boolean(formValues.description?.trim()) && Boolean(formValues.genre),
    },
    {
      label: '写作规模',
      done: Boolean(targetWords) && Boolean(chapterWords) && Boolean(totalVolumes),
    },
    {
      label: 'AI 配置',
      done: Boolean(activeModel),
    },
  ]

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
        toast.success('简介已更新')
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
      <header className="sticky top-0 z-10 border-b bg-white/95 backdrop-blur dark:bg-gray-800/95">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <button
                onClick={() => router.back()}
                className="rounded-lg p-2 transition-colors hover:bg-gray-100 dark:hover:bg-gray-700"
                aria-label="返回"
              >
                <ArrowLeft className="h-5 w-5 text-gray-600 dark:text-gray-300" />
              </button>
              <div>
                <h1 className="text-xl font-semibold text-gray-950 dark:text-white">新建小说项目</h1>
                <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">从灵感、规模到 AI 模型，一次完成项目初始化</p>
              </div>
            </div>

            <div className="flex items-center gap-2 rounded-full border border-gray-200 bg-gray-50 px-3 py-2 dark:border-gray-700 dark:bg-gray-900">
              {steps.map((step, index) => (
                <div key={step.label} className="flex items-center gap-2">
                  <span className={`flex items-center gap-1.5 text-xs font-medium ${step.done ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400'}`}>
                    {step.done ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Circle className="h-3.5 w-3.5" />}
                    {step.label}
                  </span>
                  {index < steps.length - 1 && <span className="h-px w-5 bg-gray-200 dark:bg-gray-700" />}
                </div>
              ))}
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:px-8">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-blue-600" />
                <div>
                  <h2 className="font-semibold text-gray-950 dark:text-white">1. 基础设定</h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400">标题、简介、类型决定后续大纲和目录质量</p>
                </div>
              </div>
              <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                必填
              </span>
            </div>

            <div className="space-y-5">
              <Input
                label="小说标题 *"
                placeholder="例如：星港记忆清洗师"
                error={errors.title?.message}
                maxLength={200}
                {...register('title', {
                  required: '请输入小说标题',
                  maxLength: { value: 200, message: '标题不能超过200字' },
                })}
              />

              <div className="grid gap-4 md:grid-cols-3">
                <Select
                  label="小说类型 *"
                  options={genreOptions}
                  placeholder="选择类型"
                  error={errors.genre?.message}
                  {...register('genre', { required: '请选择小说类型' })}
                />
                <Select
                  label="写作风格"
                  options={writingStyleOptions}
                  placeholder="选择风格"
                  {...register('writingStyle')}
                />
                <Select
                  label="目标受众"
                  options={targetAudienceOptions}
                  placeholder="男频/女频"
                  {...register('targetAudience')}
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    简介 *
                  </label>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={handleGenerateSynopsis}
                    disabled={generatingSynopsis}
                    className="h-8"
                  >
                    {generatingSynopsis ? (
                      <>
                        <div className="h-3.5 w-3.5 animate-spin rounded-full border border-blue-600 border-t-transparent" />
                        生成中
                      </>
                    ) : (
                      <>
                        <Wand2 className="h-3.5 w-3.5" />
                        {formValues.description ? 'AI 优化简介' : 'AI 生成简介'}
                      </>
                    )}
                  </Button>
                </div>
                <Textarea
                  placeholder="一句话写清主角、目标、冲突和卖点；也可以先输入标题后用 AI 生成"
                  rows={5}
                  error={errors.description?.message}
                  {...register('description', { required: '请输入小说简介' })}
                />
              </div>
            </div>
          </section>

          <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
            <div className="mb-4 flex items-center gap-2">
              <Gauge className="h-5 w-5 text-emerald-600" />
              <div>
                <h2 className="font-semibold text-gray-950 dark:text-white">2. 写作规模</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">这里决定目录长度、生成批次和成本估算</p>
              </div>
            </div>

            <div className="mb-4 flex flex-wrap gap-2">
              {wordCountPresets.map(preset => (
                <button
                  key={preset.value}
                  type="button"
                  onClick={() => setValue('targetWordCount', preset.value)}
                  className={`rounded-lg border px-3 py-1.5 text-sm transition-colors ${
                    targetWords === preset.value
                      ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                      : 'border-gray-200 bg-white text-gray-600 hover:border-blue-300 hover:text-blue-600 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Input
                label="目标字数"
                type="number"
                placeholder="300000"
                min={1000}
                max={100000000}
                {...register('targetWordCount', { valueAsNumber: true })}
              />
              <Input
                label="每章字数"
                type="number"
                placeholder="3000"
                min={100}
                max={100000}
                {...register('chapterWordCount', { valueAsNumber: true })}
              />
              <Input
                label="总卷数"
                type="number"
                placeholder="4"
                min={1}
                max={100}
                {...register('totalVolumes', { valueAsNumber: true })}
              />
            </div>
          </section>

          <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
            <div className="mb-4 flex items-center gap-2">
              <Bot className="h-5 w-5 text-violet-600" />
              <div>
                <h2 className="font-semibold text-gray-950 dark:text-white">3. AI 配置</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">选择模型后会用于简介、大纲、目录和章节生成</p>
              </div>
            </div>

            {loadingConfigs ? (
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-900">
                加载 AI 配置中...
              </div>
            ) : aiConfigs.length === 0 ? (
              <div className="flex flex-wrap items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-800 dark:border-amber-900/50 dark:bg-amber-900/20 dark:text-amber-300">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                <span className="text-sm">暂无可用的 AI 配置，创建后将无法直接生成内容。</span>
                <Button type="button" size="sm" variant="outline" onClick={() => router.push('/settings')}>
                  <Settings className="h-4 w-4" />
                  去配置
                </Button>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    AI 模型配置
                  </label>
                  <select
                    className="h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
                    {...register('aiModelId', { valueAsNumber: true })}
                  >
                    <option value="">使用默认配置</option>
                    {aiConfigs.map((config) => (
                      <option key={config.id} value={config.id}>
                        {config.name} ({config.vendor} / {config.modelId})
                      </option>
                    ))}
                  </select>
                </div>
                <Button type="button" variant="outline" onClick={() => router.push('/settings')}>
                  <Settings className="h-4 w-4" />
                  管理配置
                </Button>
              </div>
            )}
          </section>

          <div className="sticky bottom-0 z-10 -mx-4 border-t border-gray-200 bg-white/95 px-4 py-4 backdrop-blur dark:border-gray-700 dark:bg-gray-900/95 sm:mx-0 sm:rounded-lg sm:border sm:shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                创建后会进入项目工作台，继续生成大纲、目录和正文。
              </p>
              <div className="flex justify-end gap-3">
                <Button type="button" variant="outline" onClick={() => router.back()}>
                  取消
                </Button>
                <Button type="submit" loading={submitting}>
                  开始创作
                </Button>
              </div>
            </div>
          </div>
        </form>

        <aside className="space-y-5 lg:sticky lg:top-24 lg:self-start">
          <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-blue-600" />
                <h2 className="font-semibold text-gray-950 dark:text-white">创作计划</h2>
              </div>
              <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                {completionPercent}%
              </span>
            </div>

            <div className="space-y-3">
              <PlanMetric icon={<FileText className="h-4 w-4" />} label="目标字数" value={`${formatNumber(targetWords)} 字`} />
              <PlanMetric icon={<Layers className="h-4 w-4" />} label="预计章节" value={estimatedChapters ? `${estimatedChapters} 章` : '-'} />
              <PlanMetric icon={<BookOpen className="h-4 w-4" />} label="卷章结构" value={chaptersPerVolume ? `${totalVolumes} 卷，每卷约 ${chaptersPerVolume} 章` : '-'} />
              <PlanMetric icon={<Sparkles className="h-4 w-4" />} label="当前模型" value={activeModel ? `${activeModel.name} / ${activeModel.modelId}` : '未配置'} />
            </div>

            <div className="mt-5 rounded-lg bg-gray-50 p-3 dark:bg-gray-900">
              <div className="mb-2 flex items-center justify-between text-xs text-gray-500">
                <span>项目完整度</span>
                <span>{completedRequired}/3</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                <div className="h-full rounded-full bg-blue-600 transition-all" style={{ width: `${completionPercent}%` }} />
              </div>
            </div>
          </section>

          <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
            <InspirationPanel compact limit={3} onSelect={handleInspirationSelect} />
          </section>
        </aside>
      </main>
    </div>
  )
}

function PlanMetric({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: string
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 dark:border-gray-700 dark:bg-gray-900">
      <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
        <span className="text-gray-400">{icon}</span>
        <span>{label}</span>
      </div>
      <span className="max-w-[180px] truncate text-right text-sm font-medium text-gray-900 dark:text-gray-100" title={value}>
        {value}
      </span>
    </div>
  )
}
