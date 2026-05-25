'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useForm, useWatch } from 'react-hook-form'
import { Button, Input, Select, Textarea, toast } from '@/components/ui'
import { Settings, AlertCircle, ChevronDown, ChevronUp, Sparkles, Wand2 } from 'lucide-react'
import { AIVendor } from '@/types'
import { InspirationPanel } from '@/components/inspiration'
import type { HotInspiration } from '@/lib/inspiration/data'

// ============================================
// Type 定义
// ============================================

interface AIConfig {
  id: number
  name: string
  vendor: AIVendor
  modelId: string
  isDefault: boolean
}

export interface ProjectFormData {
  title: string
  description?: string
  corePitch?: string
  targetAudience?: 'MALE' | 'FEMALE'
  genre?: string
  writingStyle?: string
  lengthType?: 'short' | 'medium' | 'long' | 'ultra_long'
  targetWordCount?: number
  chapterWordCount?: number
  coverImage?: string
  totalVolumes?: number
  worldSetting?: string
  powerSystem?: string
  protagonistProfile?: string
  protagonistGoal?: string
  antagonistSetting?: string
  endingPlan?: string
  writingPrompt?: string
  aiModelId?: number
}

// ============================================
// 常量选项
// ============================================

export const genreOptions = [
  { label: '玄幻', value: '玄幻' },
  { label: '奇幻', value: '奇幻' },
  { label: '仙侠', value: '仙侠' },
  { label: '都市', value: '都市' },
  { label: '科幻', value: '科幻' },
  { label: '历史', value: '历史' },
  { label: '游戏', value: '游戏' },
  { label: '悬疑', value: '悬疑' },
  { label: '言情', value: '言情' },
  { label: '军事', value: '军事' },
  { label: '体育', value: '体育' },
  { label: '轻小说', value: '轻小说' },
]

export const writingStyleOptions = [
  { label: '轻松幽默', value: '轻松幽默' },
  { label: '热血激昂', value: '热血激昂' },
  { label: '暗黑沉重', value: '暗黑沉重' },
  { label: '唯美文艺', value: '唯美文艺' },
  { label: '悬疑烧脑', value: '悬疑烧脑' },
  { label: '搞笑吐槽', value: '搞笑吐槽' },
  { label: '史诗宏大', value: '史诗宏大' },
  { label: '细腻温情', value: '细腻温情' },
  { label: '快节奏爽文', value: '快节奏爽文' },
  { label: '慢热养成', value: '慢热养成' },
]

export const targetAudienceOptions = [
  { label: '男频', value: 'MALE' },
  { label: '女频', value: 'FEMALE' },
]

const LENGTH_TYPE_OPTIONS = [
  { label: '短篇', value: 'short' },
  { label: '中篇', value: 'medium' },
  { label: '长篇', value: 'long' },
  { label: '超长篇', value: 'ultra_long' },
] as const

function inferWritingStyle(genre: string, corePitch: string) {
  const text = `${genre} ${corePitch}`
  if (/(悬疑|规则|刑侦|怪谈|惊悚)/.test(text)) return '悬疑烧脑'
  if (/(甜|宠|婚恋|恋爱|心动)/.test(text)) return '情绪拉扯'
  if (/(种田|家族|经营|历史|朝堂)/.test(text)) return '慢热养成'
  if (/(玄幻|仙侠|高武|末世|系统|无敌|升级)/.test(text)) return '快节奏爽文'
  if (/(科幻|未来|机甲|星际)/.test(text)) return '热血激昂'
  return '市场向选题'
}

function inferLengthType(genre: string, corePitch: string): ProjectFormData['lengthType'] {
  const text = `${genre} ${corePitch}`
  if (/(短篇|短文|小故事)/.test(text)) return 'short'
  if (/(超长篇|千万字|史诗|群像|家族|经营|王朝|争霸|种田|慢热|地图扩张|文明|宗门)/.test(text)) return 'ultra_long'
  if (/(悬疑|规则|都市|轻小说|日常|科幻)/.test(text)) return 'long'
  return 'ultra_long'
}

// ============================================
// Component
// ============================================

interface ProjectFormProps {
  defaultValues?: Partial<ProjectFormData>
  onSubmit: (data: ProjectFormData) => Promise<void>
  onCancel?: () => void
  loading?: boolean
  submitLabel?: string
  showAdvancedFields?: boolean
}

export function ProjectForm({ defaultValues, onSubmit, onCancel, loading, submitLabel, showAdvancedFields = true }: ProjectFormProps) {
  const router = useRouter()
  const [aiConfigs, setAiConfigs] = useState<AIConfig[]>([])
  const [loadingConfigs, setLoadingConfigs] = useState(true)
  const [showMoreSettings, setShowMoreSettings] = useState(() =>
    Boolean(defaultValues?.worldSetting || defaultValues?.powerSystem || defaultValues?.protagonistProfile)
  )
  const [generatingSynopsis, setGeneratingSynopsis] = useState(false)
  const [generatingSettings, setGeneratingSettings] = useState(false)
  const [generatingTitle, setGeneratingTitle] = useState(false)
  const [showInspiration, setShowInspiration] = useState(true)

  useEffect(() => {
    let cancelled = false

    const loadAIConfigs = async () => {
      try {
        const res = await fetch('/api/novel/ai-configs')
        const data = await res.json()
        if (!cancelled && data.success) {
          setAiConfigs(data.data)
        }
      } catch (error) {
        console.error('获取 AI 配置失败:', error)
      } finally {
        if (!cancelled) {
          setLoadingConfigs(false)
        }
      }
    }

    void loadAIConfigs()

    return () => {
      cancelled = true
    }
  }, [])

  const {
    register,
    handleSubmit,
    control,
    setValue,
    formState: { errors },
  } = useForm<ProjectFormData>({
    defaultValues: {
      title: '',
      description: '',
      corePitch: '',
      targetAudience: undefined,
      genre: '',
      writingStyle: '',
      lengthType: undefined,
      targetWordCount: undefined,
      chapterWordCount: 3000,
      coverImage: '',
      totalVolumes: 4,
      worldSetting: '',
      powerSystem: '',
      protagonistProfile: '',
      protagonistGoal: '',
      antagonistSetting: '',
      endingPlan: '',
      writingPrompt: '',
      ...defaultValues,
    },
  })

  const formValues = useWatch({ control })

  const handleInspirationSelect = async (inspiration: HotInspiration) => {
    setValue('corePitch', inspiration.aiInsight || `${inspiration.title}：${inspiration.description}`)
    setValue('description', inspiration.sampleSummary)
    setValue('genre', inspiration.sampleGenre)
    setValue('writingStyle', inspiration.sampleWritingStyle)
    setValue('targetAudience', inspiration.category === 'male' ? 'MALE' : inspiration.category === 'female' ? 'FEMALE' : undefined)
    setValue('lengthType', inferLengthType(inspiration.sampleGenre, inspiration.aiInsight || inspiration.description))
    setShowInspiration(false)

    setGeneratingTitle(true)
    setValue('title', '正在生成书名...')
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
          aiModelId: formValues.aiModelId || undefined,
        }),
      })
      const data = await res.json()
      if (data.success && data.data.title) {
        setValue('title', data.data.title)
        toast.success(`已应用「${inspiration.title}」灵感，已自动生成书名`)
      } else {
        setValue('title', inspiration.sampleTitle)
        toast.success(`已应用「${inspiration.title}」灵感`)
      }
    } catch {
      setValue('title', inspiration.sampleTitle)
        toast.success(`已应用「${inspiration.title}」灵感`)
    } finally {
      setGeneratingTitle(false)
    }
  }

  const handleGenerateSynopsis = async () => {
    const title = formValues.title
    if (!title?.trim()) {
      toast.error('请先输入小说标题')
      return
    }

    setGeneratingSynopsis(true)

    try {
      const formData = {
        projectTitle: title,
        existingSynopsis: formValues.description || undefined,
        targetAudience: formValues.targetAudience || undefined,
        genre: formValues.genre || undefined,
        writingStyle: formValues.writingStyle || inferWritingStyle(formValues.genre || '', formValues.corePitch || ''),
        worldSetting: formValues.worldSetting || undefined,
        powerSystem: formValues.powerSystem || undefined,
        protagonistProfile: formValues.protagonistProfile || undefined,
        protagonistGoal: formValues.protagonistGoal || undefined,
        antagonistSetting: formValues.antagonistSetting || undefined,
        endingPlan: formValues.endingPlan || undefined,
        aiModelId: formValues.aiModelId || undefined,
      }

      const res = await fetch('/api/novel/ai/generate-synopsis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      const data = await res.json()
      if (data.success && data.data.synopsis) {
        setValue('description', data.data.synopsis)
      } else {
        toast.error(data.error?.message || '生成简介失败')
      }
    } catch (error) {
      console.error('生成简介失败:', error)
      toast.error('生成简介失败，请稍后重试')
    } finally {
      setGeneratingSynopsis(false)
    }
  }

  const handleGenerateAllSettings = async () => {
    const title = formValues.title
    if (!title?.trim()) {
      toast.error('请先输入小说标题')
      return
    }

    setGeneratingSettings(true)

    try {
      const formData = {
        projectTitle: title,
        genre: formValues.genre || undefined,
        writingStyle: formValues.writingStyle || inferWritingStyle(formValues.genre || '', formValues.corePitch || ''),
        targetAudience: formValues.targetAudience || undefined,
        existingWorldSetting: formValues.worldSetting || undefined,
        existingPowerSystem: formValues.powerSystem || undefined,
        existingProtagonistProfile: formValues.protagonistProfile || undefined,
        existingProtagonistGoal: formValues.protagonistGoal || undefined,
        existingAntagonistSetting: formValues.antagonistSetting || undefined,
        existingEndingPlan: formValues.endingPlan || undefined,
        aiModelId: formValues.aiModelId || undefined,
      }

      const res = await fetch('/api/novel/ai/generate-idea', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      const data = await res.json()
      if (data.success && data.data) {
        if (data.data.worldSetting) setValue('worldSetting', data.data.worldSetting)
        if (data.data.powerSystem) setValue('powerSystem', data.data.powerSystem)
        if (data.data.protagonistProfile) setValue('protagonistProfile', data.data.protagonistProfile)
        if (data.data.protagonistGoal) setValue('protagonistGoal', data.data.protagonistGoal)
        if (data.data.antagonistSetting) setValue('antagonistSetting', data.data.antagonistSetting)
        if (data.data.endingPlan) setValue('endingPlan', data.data.endingPlan)
        toast.success('设定生成成功！')
      } else {
        toast.error(data.error?.message || '生成设定失败')
      }
    } catch (error) {
      console.error('生成设定失败:', error)
      toast.error('生成设定失败，请稍后重试')
    } finally {
      setGeneratingSettings(false)
    }
  }

  const processSubmit = (data: ProjectFormData) => {
      const processed: ProjectFormData = {
        ...data,
        targetWordCount: data.targetWordCount ? Number(data.targetWordCount) : undefined,
        chapterWordCount: data.chapterWordCount ? Number(data.chapterWordCount) : 3000,
        totalVolumes: data.totalVolumes ? Number(data.totalVolumes) : 4,
        aiModelId: data.aiModelId ? Number(data.aiModelId) : undefined,
        writingStyle: data.writingStyle || inferWritingStyle(data.genre || '', data.corePitch || data.description || ''),
        lengthType: data.lengthType || inferLengthType(data.genre || '', data.corePitch || data.description || ''),
      }

    if (!showAdvancedFields) {
      processed.worldSetting = defaultValues?.worldSetting
      processed.powerSystem = defaultValues?.powerSystem
      processed.protagonistProfile = defaultValues?.protagonistProfile
      processed.protagonistGoal = defaultValues?.protagonistGoal
      processed.antagonistSetting = defaultValues?.antagonistSetting
      processed.endingPlan = defaultValues?.endingPlan
      processed.writingPrompt = defaultValues?.writingPrompt
    }

    return onSubmit(processed)
  }

  return (
    <form onSubmit={handleSubmit(processSubmit)} className="space-y-6">
      {showInspiration && (
        <InspirationPanel onSelect={handleInspirationSelect} />
      )}
      <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4 text-sm text-gray-700 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-gray-300">
        <p className="font-semibold text-amber-800 dark:text-amber-300">AI 先接管方向，再补齐设定。</p>
        <p className="mt-1">首屏只保留最少输入：标题、题材、一句话方向。风格、长度、受众和世界观都可以交给 AI 推导或后置微调。</p>
      </div>

      <div className="space-y-4">
        <Input
          label="标题"
          placeholder="请输入小说标题"
          error={errors.title?.message}
          maxLength={200}
          disabled={generatingTitle}
          {...register('title', { required: '请输入标题', maxLength: { value: 200, message: '标题不能超过200字' } })}
        />
        {generatingTitle && (
          <p className="text-xs text-blue-600 dark:text-blue-400 flex items-center gap-1.5 -mt-2">
            <span className="inline-block h-3 w-3 animate-spin rounded-full border border-blue-600 border-t-transparent" />
            AI 正在为你的小说生成书名...
          </p>
        )}

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              一句话方向
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
            label="一句话方向"
            placeholder="例：社畜穿越成赘婿，靠996卷死修仙界"
            rows={4}
            error={errors.corePitch?.message}
            {...register('corePitch', { required: '请输入方向' })}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Select
            label="类型"
            options={genreOptions}
            placeholder="选择小说类型"
            error={errors.genre?.message}
            {...register('genre')}
          />
        </div>

        <div className="grid grid-cols-3 gap-4">
          <Input
            label="目标字数"
            type="number"
            placeholder="如 100000"
            min={1000}
            max={100000000}
            {...register('targetWordCount', { valueAsNumber: true, min: { value: 1000, message: '目标字数至少1000' }, max: { value: 100000000, message: '目标字数不能超过1亿' } })}
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

        <Input
          label="封面图片 URL"
          placeholder="https://..."
          {...register('coverImage')}
        />

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

      {/* 更多设定 - 可折叠 */}
      <div className="border-t pt-4">
        {!showAdvancedFields ? (
          <div className="rounded-lg border border-dashed border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40 p-4 text-sm text-gray-500 dark:text-gray-400">
            世界观、力量体系、主角/反派设定、结局规划等内容由系统 AI 自动维护，默认不对外开放编辑。
          </div>
        ) : (
          <>
            <button
              type="button"
              onClick={() => setShowMoreSettings(!showMoreSettings)}
              className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 transition-colors"
            >
              {showMoreSettings ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
              {showMoreSettings ? '收起' : '更多'}小说设定
            </button>

            {showMoreSettings && (
              <div className="space-y-4 mt-4">
                <div className="flex justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleGenerateAllSettings}
                    disabled={generatingSettings}
                  >
                    {generatingSettings ? (
                      <>
                        <div className="h-4 w-4 animate-spin rounded-full border border-blue-600 border-t-transparent mr-2" />
                        生成中...
                      </>
                    ) : (
                      <>
                        <Wand2 className="h-4 w-4 mr-2" />
                        自动生成设定
                      </>
                    )}
                  </Button>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Select
                    label="写作风格"
                    options={writingStyleOptions}
                    placeholder="让 AI 自动判断或手动覆盖"
                    error={errors.writingStyle?.message}
                    {...register('writingStyle')}
                  />
                  <Select
                    label="目标受众"
                    options={targetAudienceOptions}
                    placeholder="由 AI 自动判断"
                    {...register('targetAudience')}
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Select
                    label="长度类型"
                    options={LENGTH_TYPE_OPTIONS.map(option => ({ label: option.label, value: option.value }))}
                    placeholder="让 AI 自动判断"
                    {...register('lengthType')}
                  />
                  <div className="rounded-lg border border-dashed border-gray-200 dark:border-gray-700 bg-gray-50/70 dark:bg-gray-900/30 p-3 text-xs text-gray-500 dark:text-gray-400">
                    风格、受众和长度都可以留空，创建时会由 AI 自动推导。
                  </div>
                </div>

                <Textarea
                  label="世界观设定"
                  placeholder="描述小说所在的世界观设定..."
                  rows={3}
                  {...register('worldSetting')}
                />

                <Textarea
                  label="力量体系"
                  placeholder="描述小说中的力量体系设定..."
                  rows={2}
                  {...register('powerSystem')}
                />

                <Textarea
                  label="主角人设"
                  placeholder="描述主角的性格、外貌、背景等..."
                  rows={3}
                  {...register('protagonistProfile')}
                />

                <Textarea
                  label="主角目标"
                  placeholder="描述主角的主要目标和动机..."
                  rows={2}
                  {...register('protagonistGoal')}
                />

                <Textarea
                  label="反派设定"
                  placeholder="描述反派/ antagonists 的设定..."
                  rows={2}
                  {...register('antagonistSetting')}
                />

                <Textarea
                  label="结局规划"
                  placeholder="描述小说的结局规划..."
                  rows={2}
                  {...register('endingPlan')}
                />

                <Textarea
                  label="写作提示词"
                  placeholder="额外的 AI 写作提示词..."
                  rows={2}
                  {...register('writingPrompt')}
                />
              </div>
            )}
          </>
        )}
      </div>

      {/* 操作按钮 */}
      <div className="flex justify-end gap-3 pt-4 border-t">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            取消
          </Button>
        )}
        <Button type="submit" loading={loading}>
          {submitLabel || '创建小说'}
        </Button>
      </div>
    </form>
  )
}
