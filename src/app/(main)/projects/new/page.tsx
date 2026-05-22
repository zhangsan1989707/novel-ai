'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { Button, Input, Select, Textarea, toast, CollapsibleSection } from '@/components/ui'
import { ArrowLeft, Sparkles, Settings } from 'lucide-react'
import { genreOptions, writingStyleOptions } from '@/components/project'
import { InspirationPanel } from '@/components/inspiration'
import type { Platform, LengthType } from '@/types'
import { PLATFORM_LABELS, LENGTH_TYPE_LABELS } from '@/types'
import type { HotInspiration } from '@/lib/inspiration/data'

interface AIConfig {
  id: number
  name: string
  vendor: string
  modelId: string
  isDefault: boolean
}

interface NewProjectForm {
  platform: Platform | ''
  genre: string
  corePitch: string
  writingStyle: string
  lengthType: LengthType | ''
  targetAudience?: 'MALE' | 'FEMALE'
  title: string
  description: string
  targetWordCount: number | undefined
  chapterWordCount: number
  aiModelId: number | undefined
}

const PLATFORM_ENUM_MAP: Record<Platform, string> = {
  qidian: 'QIDIAN',
  fanqie: 'FANQIE',
  feilu: 'FEILU',
  jinjiang: 'JINJIANG',
  qimao: 'QIMAO',
}

const LENGTH_TYPE_ENUM_MAP: Record<LengthType, string> = {
  short: 'SHORT',
  medium: 'MEDIUM',
  long: 'LONG',
  ultra_long: 'ULTRA_LONG',
}

const PLATFORM_LIST: Platform[] = ['qidian', 'fanqie', 'feilu', 'jinjiang', 'qimao']
const LENGTH_TYPE_LIST: LengthType[] = ['short', 'medium', 'long', 'ultra_long']

export default function NewProjectPage() {
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)
  const [generatingTitle, setGeneratingTitle] = useState(false)
  const [aiConfigs, setAiConfigs] = useState<AIConfig[]>([])
  const [loadingConfigs, setLoadingConfigs] = useState(true)

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<NewProjectForm>({
    defaultValues: {
      platform: '',
      genre: '',
      corePitch: '',
      writingStyle: '',
      lengthType: '',
      targetAudience: undefined,
      title: '',
      description: '',
      targetWordCount: undefined,
      chapterWordCount: 3000,
      aiModelId: undefined,
    },
  })

  const platform = watch('platform')
  const lengthType = watch('lengthType')

  const selectedAiModelId = watch('aiModelId')

  const handleInspirationSelect = useCallback(async (inspiration: HotInspiration) => {
    setGeneratingTitle(true)
    setValue('title', '正在生成书名...', { shouldDirty: true, shouldValidate: true })
    setValue('corePitch', `${inspiration.title}：${inspiration.description}`, { shouldDirty: true, shouldValidate: true })
    setValue('description', inspiration.sampleSummary, { shouldDirty: true, shouldValidate: true })
    setValue('genre', inspiration.sampleGenre, { shouldDirty: true, shouldValidate: true })
    setValue('writingStyle', inspiration.sampleWritingStyle, { shouldDirty: true, shouldValidate: true })
    setValue('targetAudience', inspiration.category === 'male' ? 'MALE' : inspiration.category === 'female' ? 'FEMALE' : undefined, { shouldDirty: true, shouldValidate: true })
    try {
      const res = await fetch('/api/novel/ai/generate-title', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inspirationTitle: inspiration.title,
          inspirationDescription: inspiration.description,
          genre: inspiration.sampleGenre || undefined,
          writingStyle: inspiration.sampleWritingStyle || undefined,
          targetAudience: inspiration.category === 'male' ? 'MALE' : inspiration.category === 'female' ? 'FEMALE' : undefined,
          aiModelId: selectedAiModelId || undefined,
        }),
      })
      const result = await res.json()

      if (result.success && result.data?.title) {
        setValue('title', result.data.title, { shouldDirty: true, shouldValidate: true })
        toast.success(`已应用灵感「${inspiration.title}」，已自动生成书名`)
        return
      }
    } catch {
    } finally {
      setGeneratingTitle(false)
    }

    setValue('title', inspiration.sampleTitle, { shouldDirty: true, shouldValidate: true })
    toast.success(`已应用灵感「${inspiration.title}」`)
  }, [selectedAiModelId, setValue])

  useEffect(() => {
    fetch('/api/novel/ai-configs')
      .then((res) => res.json())
      .then((data) => { if (data.success) setAiConfigs(data.data) })
      .catch(() => {})
      .finally(() => setLoadingConfigs(false))
  }, [])

  const onSubmit = async (data: NewProjectForm) => {
    if (generatingTitle) {
      toast.error('书名仍在生成，请稍候再创建')
      return
    }
    if (!data.platform) {
      toast.error('请选择平台')
      return
    }
    if (!data.lengthType) {
      toast.error('请选择长度类型')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch('/api/novel/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: data.title || undefined,
          description: data.description || undefined,
          genre: data.genre || undefined,
          writingStyle: data.writingStyle || undefined,
          corePitch: data.corePitch || undefined,
          targetAudience: data.targetAudience || undefined,
          targetWordCount: data.targetWordCount || undefined,
          chapterWordCount: data.chapterWordCount || undefined,
          aiModelId: data.aiModelId || undefined,
          platform: PLATFORM_ENUM_MAP[data.platform],
          lengthType: LENGTH_TYPE_ENUM_MAP[data.lengthType],
        }),
      })
      const result = await res.json()
      if (result.success) {
        router.push(`/projects/${result.data.id}`)
      } else {
        toast.error(result.error?.message || '创建小说失败')
      }
    } catch {
      toast.error('创建小说失败，请稍后重试')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <header className="sticky top-0 z-10 border-b bg-white/95 backdrop-blur dark:bg-gray-800/95">
        <div className="mx-auto max-w-2xl px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.back()}
              className="rounded-lg p-2 transition-colors hover:bg-gray-100 dark:hover:bg-gray-700"
              aria-label="返回"
            >
              <ArrowLeft className="h-5 w-5 text-gray-600 dark:text-gray-300" />
            </button>
            <div>
              <h1 className="text-xl font-semibold text-gray-950 dark:text-white">新建小说</h1>
              <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">只提供方向，创建后即可开始 AI 生成，并自动维护全书设定</p>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        <form onSubmit={handleSubmit(onSubmit)} className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-6">
            <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
              <div className="space-y-5">
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  平台选择 <span className="text-red-500">*</span>
                </label>
                <div className="flex flex-wrap gap-2">
                  {PLATFORM_LIST.map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setValue('platform', p, { shouldValidate: true })}
                      className={`rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
                        platform === p
                          ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                          : 'border-gray-200 bg-white text-gray-600 hover:border-blue-300 hover:text-blue-600 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300'
                      }`}
                    >
                      {PLATFORM_LABELS[p]}
                    </button>
                  ))}
                </div>
                {errors.platform && <p className="mt-1 text-sm text-red-500">{errors.platform.message}</p>}
              </div>

              <Select
                label="题材"
                options={genreOptions}
                placeholder="选择题材"
                error={errors.genre?.message}
                {...register('genre', { required: '请选择题材' })}
              />

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  灵感 <span className="text-red-500">*</span>
                </label>
                <Textarea
                  placeholder="例：社畜穿越成赘婿，靠996卷死修仙界；也可以直接从上面的市场趋势灵感里选"
                  rows={3}
                  error={errors.corePitch?.message}
                  {...register('corePitch', { required: '请输入灵感' })}
                />
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  这里是给 AI 的创作方向，后续会自动生成标题、蓝图、阶段规划和小说设定中枢。
                </p>
              </div>

              <Select
                label="风格"
                options={writingStyleOptions}
                placeholder="选择写作风格"
                error={errors.writingStyle?.message}
                {...register('writingStyle', { required: '请选择写作风格' })}
              />

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  长度类型 <span className="text-red-500">*</span>
                </label>
                <div className="flex flex-wrap gap-2">
                  {LENGTH_TYPE_LIST.map((lt) => (
                    <button
                      key={lt}
                      type="button"
                      onClick={() => setValue('lengthType', lt, { shouldValidate: true })}
                      className={`rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
                        lengthType === lt
                          ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                          : 'border-gray-200 bg-white text-gray-600 hover:border-blue-300 hover:text-blue-600 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300'
                      }`}
                    >
                      {LENGTH_TYPE_LABELS[lt]}
                    </button>
                  ))}
                </div>
                {errors.lengthType && <p className="mt-1 text-sm text-red-500">{errors.lengthType.message}</p>}
              </div>
            </div>
            </div>

            <CollapsibleSection title="高级设置" description="标题、字数、AI 模型（可选）">
              <div className="space-y-4 pt-1">
                <Input
                  label="小说标题"
                  placeholder={generatingTitle ? '正在生成书名...' : '留空则自动生成，不会用灵感代替'}
                  maxLength={200}
                  disabled={generatingTitle}
                  {...register('title')}
                />
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  标题和灵感是两个字段；留空时系统会自动补一个标题。
                </p>

                <Textarea
                  label="描述 / 世界观"
                  placeholder="可选，补充更多设定信息"
                  rows={3}
                  {...register('description')}
                />

                <div className="grid gap-4 sm:grid-cols-2">
                  <Input
                    label="目标字数"
                    type="number"
                    placeholder="例如 300000"
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
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                    AI 模型配置
                  </label>
                  {loadingConfigs ? (
                    <p className="text-sm text-gray-500">加载中...</p>
                  ) : aiConfigs.length === 0 ? (
                    <div className="flex items-center gap-2 text-sm text-amber-600">
                      <span>暂无可用的 AI 配置</span>
                      <Button type="button" size="sm" variant="outline" onClick={() => router.push('/settings')}>
                        <Settings className="h-3.5 w-3.5" />
                        去配置
                      </Button>
                    </div>
                  ) : (
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
                  )}
                </div>
              </div>
            </CollapsibleSection>

            <div className="sticky bottom-0 -mx-4 border-t border-gray-200 bg-white/95 px-4 py-4 backdrop-blur dark:border-gray-700 dark:bg-gray-900/95 sm:mx-0 sm:rounded-lg sm:border sm:shadow-sm">
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  先给方向，创建后由 AI 接管设定生成与维护
                </p>
                <div className="flex gap-3">
                  <Button type="button" variant="outline" onClick={() => router.back()}>
                    取消
                  </Button>
                  <Button type="submit" loading={submitting} disabled={submitting || generatingTitle}>
                    <Sparkles className="h-4 w-4" />
                    {generatingTitle ? '生成书名中...' : '开始创作'}
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <aside className="lg:sticky lg:top-20 lg:self-start">
            <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800 lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto">
              <div className="mb-4">
                <h2 className="text-base font-semibold text-gray-900 dark:text-white">实时互联网热榜灵感库</h2>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  优先抓取起点、番茄、晋江的最新公开榜单；抓取失败时才会退回本地趋势数据。
                </p>
              </div>
              <InspirationPanel onSelect={handleInspirationSelect} compact limit={4} />
            </section>
          </aside>
        </form>
      </main>
    </div>
  )
}
