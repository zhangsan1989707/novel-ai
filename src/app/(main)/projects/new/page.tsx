'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useForm, useWatch } from 'react-hook-form'
import { Button, Input, Select, Textarea, toast, CollapsibleSection } from '@/components/ui'
import { ArrowLeft, Sparkles, Settings } from 'lucide-react'
import { genreOptions, writingStyleOptions } from '@/components/project'
import { InspirationPanel } from '@/components/inspiration'
import { TitleCandidatePanel } from '@/components/project/TitleCandidatePanel'
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
  writingStyle?: string
  lengthType?: LengthType | ''
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

function inferWritingStyle(genre: string, corePitch: string) {
  const text = `${genre} ${corePitch}`
  if (/(悬疑|规则|刑侦|怪谈|惊悚)/.test(text)) return '悬疑烧脑'
  if (/(甜|宠|婚恋|恋爱|心动)/.test(text)) return '情绪拉扯'
  if (/(种田|家族|经营|历史|朝堂)/.test(text)) return '慢热养成'
  if (/(玄幻|仙侠|高武|末世|系统|无敌|升级)/.test(text)) return '快节奏爽文'
  if (/(科幻|未来|机甲|星际)/.test(text)) return '热血激昂'
  return '市场向选题'
}

function inferLengthType(platform: Platform | '', genre: string, corePitch: string): LengthType {
  const text = `${genre} ${corePitch}`
  if (/(超长篇|千万字|史诗|群像|家族|经营|王朝|争霸|种田|慢热|地图扩张|文明|宗门)/.test(text)) return 'ultra_long'
  if (/(短篇|短文|短故事|单元短打)/.test(text)) return 'short'
  if (platform === 'jinjiang') return /(史诗|群像|家族|经营|慢热)/.test(text) ? 'long' : 'medium'
  if (platform === 'fanqie') return /(轻松|日常|悬疑|都市)/.test(text) ? 'long' : 'ultra_long'
  if (platform === 'qimao') return /(科幻|悬疑|都市)/.test(text) ? 'long' : 'ultra_long'
  if (platform === 'feilu') return /(军事|玄幻|系统|无敌)/.test(text) ? 'ultra_long' : 'long'
  return /(悬疑|都市|轻小说|日常|科幻)/.test(text) ? 'long' : 'ultra_long'
}

function inferGenre(corePitch: string): string {
  const text = corePitch.trim()
  if (!text) return ''
  if (/(规则|怪谈|悬疑|推理|刑侦|惊悚|密室|恐怖)/.test(text)) return '悬疑'
  if (/(修仙|修真|仙侠|御剑|灵气|筑基|渡劫)/.test(text)) return '仙侠'
  if (/(玄幻|高武|斗气|魔法|异世界|系统|无敌|升级|觉醒)/.test(text)) return '玄幻'
  if (/(穿越|重生|穿书|穿成|回到过去)/.test(text)) return '都市'
  if (/(豪门|总裁|婚恋|恋爱|甜宠|虐恋|追妻|离婚|退婚|真假千金|替身|团宠)/.test(text)) return '言情'
  if (/(古言|古代|朝堂|宫斗|宅斗|种田经商|嫡女|庶女)/.test(text)) return '古言'
  if (/(末世|丧尸|废土|灾变|生存)/.test(text)) return '科幻'
  if (/(科幻|未来|星际|机甲|赛博|太空|AI|机器人)/.test(text)) return '科幻'
  if (/(历史|三国|大唐|明朝|架空历史|争霸)/.test(text)) return '历史'
  if (/(游戏|电竞|网游|副本|地下城|LitRPG)/.test(text)) return '游戏'
  if (/(都市|职场|娱乐圈|校园|现代)/.test(text)) return '都市'
  if (/(克苏鲁|无限流|恐怖|灵异)/.test(text)) return '悬疑'
  return ''
}

function inferPlatform(targetAudience: string | undefined, corePitch: string): Platform | '' {
  const text = corePitch.trim()
  // keyword-based override
  if (/(赘婿|系统|无敌|签到|打卡|抽奖|模拟器)/.test(text)) return 'fanqie'
  if (/(古言|宫斗|宅斗|纯爱|嫡女|庶女|双男主|百合)/.test(text)) return 'jinjiang'
  if (/(万古|神帝|修仙|仙尊|长生|大道|渡劫|筑基)/.test(text)) return 'qidian'
  if (/(快穿|短篇|短打|微小说)/.test(text)) return 'feilu'
  if (/(种田|年代|轻松日常|乡村|田园)/.test(text)) return 'qimao'
  // default by channel
  if (targetAudience === 'FEMALE') return 'jinjiang'
  if (targetAudience === 'MALE') return 'fanqie'
  return ''
}

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
    control,
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

  const platform = useWatch({ control, name: 'platform' })
  const lengthType = useWatch({ control, name: 'lengthType' })
  const selectedAiModelId = useWatch({ control, name: 'aiModelId' })
  const formValues = useWatch({ control })

  const handleInspirationSelect = useCallback(async (inspiration: HotInspiration) => {
    setGeneratingTitle(true)
    setValue('title', '正在生成书名...', { shouldDirty: true, shouldValidate: true })
    setValue('corePitch', inspiration.aiInsight || `${inspiration.title}：${inspiration.description}`, { shouldDirty: true, shouldValidate: true })
    setValue('description', inspiration.sampleSummary, { shouldDirty: true, shouldValidate: true })
    setValue('genre', inspiration.sampleGenre, { shouldDirty: true, shouldValidate: true })
    setValue('writingStyle', inspiration.sampleWritingStyle, { shouldDirty: true, shouldValidate: true })
    setValue('lengthType', inferLengthType(platform, inspiration.sampleGenre, inspiration.aiInsight || inspiration.description), { shouldDirty: true, shouldValidate: true })
    const resolvedAudience = inspiration.category === 'male' ? 'MALE' as const : inspiration.category === 'female' ? 'FEMALE' as const : undefined
    setValue('targetAudience', resolvedAudience, { shouldDirty: true, shouldValidate: true })
    const pitch = inspiration.aiInsight || `${inspiration.title}：${inspiration.description}`
    const inferredPlatform = inferPlatform(resolvedAudience, pitch)
    if (inferredPlatform) setValue('platform', inferredPlatform, { shouldDirty: true, shouldValidate: true })
    try {
      const res = await fetch('/api/novel/ai/generate-title', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inspirationTitle: inspiration.title,
          inspirationDescription: inspiration.description,
          fallbackTitle: inspiration.sampleTitle,
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
  }, [platform, selectedAiModelId, setValue])

  // 自动推导题材 + 平台
  const corePitchValue = formValues.corePitch || ''
  const targetAudienceValue = formValues.targetAudience
  useEffect(() => {
    if (!corePitchValue.trim()) return
    const currentGenre = formValues.genre || ''
    if (!currentGenre) {
      const inferred = inferGenre(corePitchValue)
      if (inferred) setValue('genre', inferred, { shouldDirty: true })
    }
    const currentPlatform = formValues.platform || ''
    if (!currentPlatform) {
      const inferredPlatform = inferPlatform(targetAudienceValue, corePitchValue)
      if (inferredPlatform) setValue('platform', inferredPlatform, { shouldDirty: true })
    }
  }, [corePitchValue, targetAudienceValue, formValues.genre, formValues.platform, setValue])

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
    setSubmitting(true)
    try {
      const normalizedCorePitch = data.corePitch?.trim() || data.description?.trim() || ''
      const derivedWritingStyle = data.writingStyle || inferWritingStyle(data.genre || '', normalizedCorePitch)
      const derivedLengthType = data.lengthType || inferLengthType(data.platform, data.genre || '', normalizedCorePitch)

      const res = await fetch('/api/novel/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: data.title || undefined,
          description: data.description || undefined,
          genre: data.genre || inferGenre(normalizedCorePitch) || undefined,
          writingStyle: derivedWritingStyle || undefined,
          corePitch: normalizedCorePitch || undefined,
          targetAudience: data.targetAudience || undefined,
          targetWordCount: data.targetWordCount || undefined,
          chapterWordCount: data.chapterWordCount || undefined,
          aiModelId: data.aiModelId || undefined,
          platform: PLATFORM_ENUM_MAP[(data.platform || inferPlatform(data.targetAudience, normalizedCorePitch) || 'fanqie') as Platform],
          lengthType: LENGTH_TYPE_ENUM_MAP[derivedLengthType],
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
                  平台
                </label>
                {platform ? (
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center rounded-full bg-indigo-50 dark:bg-indigo-900/30 px-3 py-1.5 text-sm font-medium text-indigo-700 dark:text-indigo-300">
                      {PLATFORM_LABELS[platform as Platform]}
                    </span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">AI 推荐，可在高级调校中覆盖</span>
                  </div>
                ) : (
                  <p className="text-sm text-gray-400 dark:text-gray-500">填写方向后 AI 自动推荐</p>
                )}
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  小说标题
                </label>
                <Input
                  placeholder={generatingTitle ? '正在生成书名...' : '留空则自动生成，也可从下方智能推荐中选择'}
                  maxLength={200}
                  disabled={generatingTitle}
                  {...register('title')}
                />
                {generatingTitle && (
                  <p className="text-xs text-blue-600 dark:text-blue-400 flex items-center gap-1.5 mt-1">
                    <span className="inline-block h-3 w-3 animate-spin rounded-full border border-blue-600 border-t-transparent" />
                    AI 正在为你的小说生成书名...
                  </p>
                )}
                <TitleCandidatePanel
                  currentTitle={formValues.title}
                  coreHook={formValues.corePitch || formValues.description || ''}
                  genre={formValues.genre}
                  platform={formValues.platform || undefined}
                  channel={formValues.targetAudience === 'MALE' ? 'male' : formValues.targetAudience === 'FEMALE' ? 'female' : undefined}
                  protagonistIdentity={undefined}
                  aiModelId={formValues.aiModelId}
                  onSelectTitle={(title) => setValue('title', title, { shouldDirty: true, shouldValidate: true })}
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  一句话方向 <span className="text-red-500">*</span>
                </label>
                <Textarea
                  placeholder="例：社畜穿越成赘婿，靠996卷死修仙界；也可以直接从上面的灵感卡里选"
                  rows={4}
                  error={errors.corePitch?.message}
                  {...register('corePitch', { required: '请输入灵感' })}
                />
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  只要给出一个方向，AI 会自动补全风格、长度、开局和阶段结构。
                </p>
              </div>
            </div>
            </div>

            <CollapsibleSection title="AI 高级调校" description="风格、长度、题材、平台、AI 模型（可选）">
              <div className="space-y-4 pt-1">
                <div className="rounded-lg border border-dashed border-gray-200 dark:border-gray-700 bg-gray-50/70 dark:bg-gray-900/30 p-3 text-xs text-gray-500 dark:text-gray-400">
                  标题已提升到上方独立区域，支持 AI 智能推荐和评分选择。
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                    题材 <span className="text-xs text-gray-400 font-normal">（AI 自动推导）</span>
                  </label>
                  {formValues.genre ? (
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center rounded-full bg-blue-50 dark:bg-blue-900/30 px-3 py-1.5 text-sm font-medium text-blue-700 dark:text-blue-300">
                        {formValues.genre}
                      </span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">根据方向自动识别，创建后 AI 可调整</span>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-400 dark:text-gray-500">填写方向后自动判断</p>
                  )}
                  <input type="hidden" {...register('genre')} />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                    平台 <span className="text-xs text-gray-400 font-normal">（AI 推荐，可手动覆盖）</span>
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {PLATFORM_LIST.map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setValue('platform', p, { shouldValidate: true })}
                        className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
                          platform === p
                            ? 'border-indigo-500 bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300'
                            : 'border-gray-200 bg-white text-gray-600 hover:border-indigo-300 hover:text-indigo-600 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300'
                        }`}
                      >
                        {PLATFORM_LABELS[p]}
                      </button>
                    ))}
                  </div>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    AI 根据方向推荐，手动选择可覆盖。
                  </p>
                  <input type="hidden" {...register('platform')} />
                </div>

                <Textarea
                  label="描述 / 世界观"
                  placeholder="可选，补充更多设定信息"
                  rows={3}
                  {...register('description')}
                />

                <div className="grid gap-4 sm:grid-cols-2">
                  <Select
                    label="风格"
                    options={writingStyleOptions}
                    placeholder="让 AI 自动判断或手动覆盖"
                    error={errors.writingStyle?.message}
                    {...register('writingStyle')}
                  />
                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                      长度类型
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
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      默认由 AI 根据平台和题材自动判断，手动选只是覆盖值。
                    </p>
                  </div>
                </div>

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
                <h2 className="text-base font-semibold text-gray-900 dark:text-white">AI 爆款灵感卡</h2>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  不显示原始榜单，只展示 AI 提炼后的可开写方向。
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
