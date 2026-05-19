'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { Button, Input, Select, Textarea, toast, CollapsibleSection } from '@/components/ui'
import { ArrowLeft, Sparkles, Settings } from 'lucide-react'
import { genreOptions, writingStyleOptions } from '@/components/project'
import type { Platform, LengthType } from '@/types'
import { PLATFORM_LABELS, LENGTH_TYPE_LABELS } from '@/types'

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
      title: '',
      description: '',
      targetWordCount: undefined,
      chapterWordCount: 3000,
      aiModelId: undefined,
    },
  })

  const platform = watch('platform')
  const lengthType = watch('lengthType')

  useEffect(() => {
    fetch('/api/novel/ai-configs')
      .then((res) => res.json())
      .then((data) => { if (data.success) setAiConfigs(data.data) })
      .catch(() => {})
      .finally(() => setLoadingConfigs(false))
  }, [])

  const onSubmit = async (data: NewProjectForm) => {
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
              <h1 className="text-xl font-semibold text-gray-950 dark:text-white">新建小说项目</h1>
              <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">填写核心设定，AI 帮你完成后续创作</p>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-6 sm:px-6">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
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
                  一句话卖点 <span className="text-red-500">*</span>
                </label>
                <Textarea
                  placeholder="例：社畜穿越成赘婿，靠996卷死修仙界"
                  rows={3}
                  error={errors.corePitch?.message}
                  {...register('corePitch', { required: '请输入一句话卖点' })}
                />
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
                placeholder="留空则由 AI 自动生成"
                maxLength={200}
                {...register('title')}
              />

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
                填写核心设定即可快速创建项目
              </p>
              <div className="flex gap-3">
                <Button type="button" variant="outline" onClick={() => router.back()}>
                  取消
                </Button>
                <Button type="submit" loading={submitting}>
                  <Sparkles className="h-4 w-4" />
                  开始创作
                </Button>
              </div>
            </div>
          </div>
        </form>
      </main>
    </div>
  )
}