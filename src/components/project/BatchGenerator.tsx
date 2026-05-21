'use client'

import { useState } from 'react'
import { Button, Modal } from '@/components/ui'
import { Sparkles, ChevronDown, ChevronUp, BookOpen, PenLine, Sliders, Info } from 'lucide-react'
import { CostEstimationModal } from './CostEstimationModal'

interface Chapter {
  id: number
  chapterNumber: number
  title: string
  wordCount: number
  status: string
  content?: string | null
}

// 预设字数选项
const WORD_COUNT_PRESETS = [
  { label: '短篇', value: 2000, desc: '~2000字' },
  { label: '标准', value: 3000, desc: '~3000字' },
  { label: '长篇', value: 5000, desc: '~5000字' },
]

// 预设风格选项（隐藏复杂参数）
const STYLE_PRESETS = [
  { label: '保守', temperature: 0.4, desc: '内容稳定、风格一致' },
  { label: '均衡', temperature: 0.7, desc: '兼顾稳定与创意（推荐）' },
  { label: '创意', temperature: 1.0, desc: '更多变化和惊喜' },
]

// 参考章节数选项
const CONTEXT_OPTIONS = [
  { value: 1, label: '仅前1章' },
  { value: 3, label: '前3章（推荐）' },
  { value: 5, label: '前5章' },
  { value: 10, label: '前10章' },
]

interface BatchGeneratorProps {
  projectId: number
  chapters: Chapter[]
  buttonLabel?: string
  buttonVariant?: 'default' | 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger'
  buttonSize?: 'sm' | 'md' | 'lg'
  onGenerate: (options: {
    chapterIds?: number[]
    useContext: boolean
    contextChapterCount: number
    temperature: number
    targetWordCount: number
  }) => void
}

export function BatchGenerator({
  projectId,
  chapters,
  buttonLabel = '启动 AI 生产',
  buttonVariant = 'primary',
  buttonSize = 'sm',
  onGenerate,
}: BatchGeneratorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [showCostModal, setShowCostModal] = useState(false)
  const [generationType, setGenerationType] = useState<'all' | 'selected'>('all')
  const [selectedChapterIds, setSelectedChapterIds] = useState<number[]>([])
  const [useContext, setUseContext] = useState(true)
  const [contextChapterCount, setContextChapterCount] = useState(3)
  const [temperature, setTemperature] = useState(0.7)
  const [targetWordCount, setTargetWordCount] = useState(3000)
  const [isGenerating, setIsGenerating] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)

  const pendingChapters = chapters.filter(
    (ch) => !ch.content || ch.wordCount === 0
  )

  const chapterCountToGenerate = generationType === 'all'
    ? pendingChapters.length
    : selectedChapterIds.length

  const handleOpen = () => {
    setSelectedChapterIds(pendingChapters.map((ch) => ch.id))
    setIsOpen(true)
  }

  const handleGenerateClick = () => {
    if (chapterCountToGenerate > 0) {
      setShowCostModal(true)
    }
  }

  const handleConfirmGenerate = () => {
    setShowCostModal(false)
    setIsOpen(false)
    setIsGenerating(true)

    const options = {
      useContext,
      contextChapterCount,
      temperature,
      targetWordCount,
      ...(generationType === 'selected' ? { chapterIds: selectedChapterIds } : {}),
    }

    onGenerate(options)
    setTimeout(() => setIsGenerating(false), 500)
  }

  const toggleChapter = (id: number) => {
    setSelectedChapterIds((prev) =>
      prev.includes(id)
        ? prev.filter((i) => i !== id)
        : [...prev, id]
    )
  }

  return (
    <>
      <Button
        variant={buttonVariant}
        size={buttonSize}
        onClick={handleOpen}
        disabled={chapters.length === 0 || pendingChapters.length === 0}
        title={pendingChapters.length === 0 ? '暂无待写章节' : undefined}
      >
        <Sparkles className="h-4 w-4 mr-2" />
        {pendingChapters.length > 0 ? `${buttonLabel} (${pendingChapters.length})` : '暂无待写章节'}
      </Button>

      <Modal
        open={isOpen}
        onClose={() => setIsOpen(false)}
        title={
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-blue-500" />
            <span>{buttonLabel}</span>
          </div>
        }
        className="max-w-lg"
      >
        <div className="space-y-4">
          {/* ===== 生成范围 ===== */}
          <SectionCard icon={<BookOpen className="w-4 h-4" />} title="生成目标">
            <RadioGroup
              options={[
                {
                  value: 'all',
                  label: '全部待写章节',
                  badge: `${pendingChapters.length} 章`,
                },
                {
                  value: 'selected',
                  label: '指定章节',
                  badge: generationType === 'selected'
                    ? `${selectedChapterIds.length} 章`
                    : undefined,
                },
              ]}
              value={generationType}
              onChange={(v) => setGenerationType(v as 'all' | 'selected')}
            />

            {generationType === 'selected' && (
              <div className="mt-3 max-h-36 overflow-y-auto space-y-1 bg-gray-50 dark:bg-gray-800/50 rounded-lg p-2 border border-gray-100 dark:border-gray-700">
                {chapters.map((chapter) => {
                  const isPending = pendingChapters.some((p) => p.id === chapter.id)
                  return (
                    <label
                      key={chapter.id}
                      className={`flex items-center gap-2 cursor-pointer px-2 py-1.5 rounded-md transition-colors ${
                        isPending ? 'hover:bg-white/70 dark:hover:bg-gray-700/50' : 'opacity-40'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedChapterIds.includes(chapter.id)}
                        onChange={() => toggleChapter(chapter.id)}
                        disabled={!isPending}
                        className="w-4 h-4 accent-blue-600 rounded"
                      />
                      <span className="text-sm flex-1 truncate">
                        第{chapter.chapterNumber}章 {chapter.title || '无标题'}
                      </span>
                      {!isPending && (
                        <span className="text-xs text-gray-400">已生成</span>
                      )}
                    </label>
                  )
                })}
              </div>
            )}
          </SectionCard>

          {/* ===== 创作风格 ===== */}
          <SectionCard icon={<PenLine className="w-4 h-4" />} title="生成风格">
            {/* 字数选择 - 按钮组 */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-gray-500">目标字数</label>
              <div className="flex gap-2">
                {WORD_COUNT_PRESETS.map((preset) => (
                  <button
                    key={preset.value}
                    type="button"
                    onClick={() => setTargetWordCount(preset.value)}
                    className={`flex-1 px-3 py-2 text-sm rounded-lg border transition-all ${
                      targetWordCount === preset.value
                        ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                        : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-600 hover:border-blue-300 hover:text-blue-600'
                    }`}
                  >
                    <div className="font-medium">{preset.label}</div>
                    <div className={`text-xs ${targetWordCount === preset.value ? 'text-blue-100' : 'text-gray-400'}`}>
                      {preset.desc}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* 风格选择 - 卡片式 */}
            <div className="space-y-2 mt-3">
              <label className="text-xs font-medium text-gray-500">AI 生成风格</label>
              <div className="grid grid-cols-3 gap-2">
                {STYLE_PRESETS.map((style) => {
                  const isActive = style.temperature === temperature
                  return (
                    <button
                      key={style.label}
                      type="button"
                      onClick={() => setTemperature(style.temperature)}
                      className={`relative p-2.5 rounded-lg border text-left transition-all ${
                        isActive
                          ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-400 ring-1 ring-blue-400/30'
                          : 'bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 hover:border-gray-300'
                      }`}
                    >
                      <div className={`font-medium text-sm ${isActive ? 'text-blue-700 dark:text-blue-300' : 'text-gray-700 dark:text-gray-300'}`}>
                        {style.label}
                      </div>
                      <div className={`text-xs mt-0.5 ${isActive ? 'text-blue-500' : 'text-gray-400'}`}>
                        {style.desc}
                      </div>
                      {isActive && (
                        <div className="absolute top-1.5 right-1.5 w-2 h-2 bg-blue-500 rounded-full" />
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          </SectionCard>

          {/* ===== 高级选项（可折叠）===== */}
          <div className="border border-dashed border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="w-full flex items-center justify-between px-4 py-3 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
            >
              <span className="flex items-center gap-2">
                <Sliders className="w-4 h-4" />
                高级选项
              </span>
              {showAdvanced ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </button>

            {showAdvanced && (
              <div className="px-4 pb-4 space-y-3 pt-1 border-t border-gray-100 dark:border-gray-700">
                {/* 上下文开关 */}
                <label className="flex items-center gap-2.5 cursor-pointer py-1">
                  <input
                    type="checkbox"
                    checked={useContext}
                    onChange={(e) => setUseContext(e.target.checked)}
                    className="w-4 h-4 accent-blue-600 rounded"
                  />
                  <div>
                    <span className="text-sm">启用上下文参考</span>
                    <p className="text-xs text-gray-400">AI 会参考已生成的前文章节内容</p>
                  </div>
                </label>

                {/* 参考章节数 - 下拉选择 */}
                {useContext && (
                  <div className="ml-6 flex items-center gap-2">
                    <label className="text-sm text-gray-500 whitespace-nowrap">参考范围：</label>
                    <select
                      value={contextChapterCount}
                      onChange={(e) => setContextChapterCount(Number(e.target.value))}
                      className="h-9 px-3 pr-8 border rounded-lg bg-white dark:bg-gray-800 dark:border-gray-600 text-sm appearance-none bg-no-repeat bg-right"
                      style={{
                        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%239ca3af' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
                        backgroundPosition: `right 0.5rem center`,
                      }}
                    >
                      {CONTEXT_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                    <Info className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                  </div>
                )}

                {/* 自定义温度显示 */}
                <div className="ml-6 flex items-center gap-2 text-xs text-gray-400">
                  <span>当前温度值：</span>
                  <kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded font-mono">{temperature}</kbd>
                  <span>· 由上方风格选项自动设定</span>
                </div>
              </div>
            )}
          </div>

          {/* ===== 底部操作栏 ===== */}
          <div className="flex justify-end gap-3 pt-3 border-t border-gray-100 dark:border-gray-700">
            <Button variant="outline" onClick={() => setIsOpen(false)}>
              取消
            </Button>
            <Button
              variant="primary"
              onClick={handleGenerateClick}
              disabled={generationType === 'selected' && selectedChapterIds.length === 0}
            >
              <Sparkles className="h-4 w-4 mr-2" />
              下一步：确认成本
            </Button>
          </div>
        </div>
      </Modal>

      {/* 成本预估确认模态框 */}
      <CostEstimationModal
        open={showCostModal}
        onClose={() => setShowCostModal(false)}
        onConfirm={handleConfirmGenerate}
        projectId={projectId}
        chapterCount={chapterCountToGenerate}
        targetWordCount={targetWordCount}
        loading={isGenerating}
      />
    </>
  )
}

// ===== 子组件 =====

function SectionCard({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="bg-gradient-to-br from-slate-50 to-gray-50/50 dark:from-gray-800/80 dark:to-gray-800/40 rounded-xl p-4 border border-gray-100/80 dark:border-gray-700/50">
      <div className="flex items-center gap-2 mb-3 text-gray-700 dark:text-gray-200">
        <span className="text-blue-500">{icon}</span>
        <span className="text-sm font-semibold">{title}</span>
      </div>
      {children}
    </div>
  )
}

function RadioGroup({
  options,
  value,
  onChange,
}: {
  options: { value: string; label: string; badge?: string }[]
  value: string
  onChange: (value: string) => void
}) {
  return (
    <div className="space-y-1.5">
      {options.map((opt) => (
        <label
          key={opt.value}
          className={`flex items-center gap-3 cursor-pointer p-2.5 rounded-lg transition-all ${
            value === opt.value
              ? 'bg-blue-50/60 dark:bg-blue-900/15 ring-1 ring-blue-200/50 dark:ring-blue-800/30'
              : 'hover:bg-white/60 dark:hover:bg-gray-700/40'
          }`}
        >
          <input
            type="radio"
            name="generationType"
            value={opt.value}
            checked={value === opt.value}
            onChange={() => onChange(opt.value)}
            className="w-4 h-4 accent-blue-600"
          />
          <span className="flex-1 text-sm">{opt.label}</span>
          {opt.badge && (
            <span className={`text-sm font-medium px-2 py-0.5 rounded-full ${
              value === opt.value
                ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300'
                : 'text-gray-500 dark:text-gray-400'
            }`}>
              {opt.badge}
            </span>
          )}
        </label>
      ))}
    </div>
  )
}
