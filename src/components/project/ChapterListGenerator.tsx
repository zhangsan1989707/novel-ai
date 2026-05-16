'use client'

import { useState } from 'react'
import { Button, Input, Modal } from '@/components/ui'
import { Sparkles, Edit2, Check, X, Plus, Trash2, BookOpen, FileText, Sparkle } from 'lucide-react'

interface ChapterItem {
  chapterNumber: number
  title: string
  summary: string
}

interface ChapterListGeneratorProps {
  projectId: number
  projectTitle: string
  genre?: string
  writingStyle?: string
  worldSetting?: string
  protagonistProfile?: string
  protagonistGoal?: string
  antagonistSetting?: string
  endingPlan?: string
  outline?: string
  outlineStages?: any
  aiModelId?: number
  chapters?: ChapterItem[]
  onApply: (chapters: ChapterItem[]) => void
  isExpanded?: boolean
  onToggle?: (expanded: boolean) => void
}

type TitleStyle = 'webnovel' | 'traditional' | 'poetry'

const titleStyleOptions = [
  {
    value: 'webnovel',
    label: '网文风格',
    desc: '吸睛、有悬念',
    icon: '⚡',
    example: '"他竟然是隐藏的首富？"',
  },
  {
    value: 'traditional',
    label: '传统风格',
    desc: '简洁概括',
    icon: '📖',
    example: '"第三章 意外的相遇"',
  },
  {
    value: 'poetry',
    label: '诗词风格',
    desc: '文艺对仗',
    icon: '🌙',
    example: '"第三回 风雪夜归人"',
  },
]

export function ChapterListGenerator({
  projectId,
  projectTitle,
  genre,
  writingStyle,
  worldSetting,
  protagonistProfile,
  protagonistGoal,
  antagonistSetting,
  endingPlan,
  outline,
  outlineStages,
  aiModelId,
  chapters: externalChapters = [],
  onApply,
  isExpanded,
  onToggle,
}: ChapterListGeneratorProps) {
  const [internalOpen, setInternalOpen] = useState(false)
  const isOpen = isExpanded !== undefined ? isExpanded : internalOpen
  const setIsOpen = onToggle || setInternalOpen
  const [generating, setGenerating] = useState(false)
  const [totalChapters, setTotalChapters] = useState(30)
  const [titleStyle, setTitleStyle] = useState<TitleStyle>('webnovel')
  const [chapters, setChapters] = useState<ChapterItem[]>([])
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [error, setError] = useState('')

  const currentStyle = titleStyleOptions.find((o) => o.value === titleStyle)!

  const handleGenerate = async () => {
    setGenerating(true)
    setError('')

    try {
      const requestBody = {
        projectId,
        projectTitle,
        genre,
        writingStyle,
        worldSetting,
        protagonistProfile,
        protagonistGoal,
        antagonistSetting,
        endingPlan,
        outline,
        outlineStages,
        totalChapters,
        titleStyle,
        aiModelId,
      }

      const res = await fetch('/api/novel/ai/generate-chapter-list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      })

      const data = await res.json()

      if (data.success && data.data.chapterList?.chapters) {
        const newChapters: ChapterItem[] = data.data.chapterList.chapters
        setChapters((prev) => {
          if (prev.length === 0) return newChapters
          // 追加模式：已有章节时继续生成，章节号自动续接
          const startNum = prev.length + 1
          const appended = newChapters.map((ch, i) => ({
            ...ch,
            chapterNumber: startNum + i,
          }))
          return [...prev, ...appended]
        })
        // 显示警告信息
        if (data.warning) {
          setError(`⚠️ ${data.warning}`)
        }
      } else if (data.success && data.data.content) {
        const jsonMatch = data.data.content.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
          try {
            // 清理 AI 常见的 JSON 格式问题（尾随逗号）
            const cleaned = jsonMatch[0].replace(/,\s*([\]}])/g, '$1')
            const parsed = JSON.parse(cleaned)
            if (parsed.chapters) {
              const newChapters: ChapterItem[] = parsed.chapters
              setChapters((prev) => {
                if (prev.length === 0) return newChapters
                const startNum = prev.length + 1
                const appended = newChapters.map((ch, i) => ({
                  ...ch,
                  chapterNumber: startNum + i,
                }))
                return [...prev, ...appended]
              })
            } else {
              setError('生成格式有误，请重试')
            }
          } catch {
            setError('AI 返回格式异常，请重试')
          }
        } else {
          setError('生成格式有误，请重试')
        }
      } else {
        setError(data.error?.message || '生成失败')
      }
    } catch (err) {
      console.error('[ChapterListGenerator] Error:', err)
      const errorMessage = err instanceof Error ? err.message : String(err)
      setError('网络错误，请重试')
    } finally {
      setGenerating(false)
    }
  }

  const handleEditStart = (index: number, title: string) => {
    setEditingIndex(index)
    setEditTitle(title)
  }

  const handleEditSave = (index: number) => {
    const newChapters = [...chapters]
    newChapters[index].title = editTitle
    setChapters(newChapters)
    setEditingIndex(null)
  }

  const handleDeleteChapter = (index: number) => {
    const newChapters = chapters.filter((_, i) => i !== index)
    setChapters(newChapters.map((ch, i) => ({
      ...ch,
      chapterNumber: i + 1,
    })))
  }

  const handleAddChapter = (afterIndex: number) => {
    const newChapter: ChapterItem = {
      chapterNumber: afterIndex + 2,
      title: `第${afterIndex + 2}章 新章节`,
      summary: '待补充章节概要',
    }
    const newChapters = [...chapters]
    newChapters.splice(afterIndex + 1, 0, newChapter)
    setChapters(newChapters.map((ch, i) => ({
      ...ch,
      chapterNumber: i + 1,
    })))
  }

  const handleApply = () => {
    if (chapters.length === 0) return
    onApply(chapters)
    setIsOpen(false)
    // Reset state for next open
    setChapters([])
    setError('')
  }

  const handleClose = () => {
    setIsOpen(false)
    setChapters([])
    setError('')
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setIsOpen(true)}>
        <Sparkles className="h-4 w-4 mr-2" />
        智能生成目录
      </Button>

      <Modal
        open={isOpen}
        onClose={handleClose}
        title={
          <div className="flex items-center gap-2">
            <Sparkle className="h-5 w-5 text-blue-500" />
            <span>智能生成章节目录</span>
          </div>
        }
        className="max-w-4xl"
      >
        <div className="space-y-6">
          {/* 生成设置区 */}
          <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-gray-800 dark:to-gray-800 rounded-xl p-5">
            <div className="flex flex-wrap items-end gap-6">
              {/* 章节数 */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-gray-500 dark:text-gray-400">章节数量</label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    value={totalChapters}
                    onChange={(e) => setTotalChapters(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-24"
                    min={1}
                    max={500}
                  />
                  <span className="text-sm text-gray-500">章</span>
                </div>
              </div>

              {/* 标题风格 */}
              <div className="space-y-1.5 flex-1">
                <label className="text-xs font-medium text-gray-500 dark:text-gray-400">标题风格</label>
                <div className="flex gap-2">
                  {titleStyleOptions.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setTitleStyle(opt.value as TitleStyle)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-150 ${
                        titleStyle === opt.value
                          ? 'bg-blue-600 text-white shadow-md'
                          : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 active:scale-95'
                      }`}
                    >
                      <span className="mr-1">{opt.icon}</span>
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 生成按钮 */}
              <div className="flex gap-2 shrink-0">
                {externalChapters.length > 0 && (
                  <Button
                    variant="outline"
                    onClick={() => setChapters([])}
                    disabled={generating}
                  >
                    清空重来
                  </Button>
                )}
                <Button
                  variant="primary"
                  onClick={handleGenerate}
                  loading={generating}
                  disabled={generating}
                >
                  <Sparkles className="h-4 w-4 mr-2" />
                  {generating ? '生成中...' : externalChapters.length > 0 ? '继续生成' : '生成目录'}
                </Button>
              </div>
            </div>

            {/* 当前风格说明 */}
            <div className="mt-4 flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
              <span className="text-blue-600 dark:text-blue-400">{currentStyle.icon} {currentStyle.desc}</span>
              <span className="text-gray-300 dark:text-gray-600">|</span>
              <span>示例：{currentStyle.example}</span>
            </div>
          </div>

          {/* 错误提示 */}
          {error && (
            <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* 章节列表 */}
          {chapters.length > 0 ? (
            <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
              <div className="bg-gray-50 dark:bg-gray-800 px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <BookOpen className="h-4 w-4 text-gray-500" />
                    <span className="text-sm font-medium">生成结果</span>
                    <span className="text-xs text-gray-400">共 {chapters.length} 章</span>
                  </div>
                  <span className="text-xs text-gray-400">
                    点击标题可直接编辑 · 鼠标悬停显示操作按钮
                  </span>
                </div>
              </div>
              <div className="max-h-80 overflow-y-auto">
                <table className="w-full text-sm">
                  <tbody>
                    {chapters.map((chapter, index) => (
                      <tr
                        key={index}
                        className="border-t border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                      >
                        <td className="px-4 py-3 text-gray-400 w-12">
                          <span className="flex items-center justify-center w-6 h-6 rounded-full bg-gray-100 dark:bg-gray-700 text-xs font-medium">
                            {chapter.chapterNumber}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {editingIndex === index ? (
                            <div className="flex items-center gap-2">
                              <Input
                                value={editTitle}
                                onChange={(e) => setEditTitle(e.target.value)}
                                className="flex-1 text-sm"
                                autoFocus
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleEditSave(index)
                                  if (e.key === 'Escape') setEditingIndex(null)
                                }}
                              />
                              <Button size="sm" variant="ghost" onClick={() => handleEditSave(index)}>
                                <Check className="h-4 w-4 text-green-500" />
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => setEditingIndex(null)}>
                                <X className="h-4 w-4 text-gray-400" />
                              </Button>
                            </div>
                          ) : (
                            <div
                              className="flex items-center gap-2 group cursor-pointer"
                              onClick={() => handleEditStart(index, chapter.title)}
                            >
                              <span className="font-medium text-gray-800 dark:text-gray-200">{chapter.title}</span>
                              <Edit2 className="h-3 w-3 text-gray-300 dark:text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-gray-500 text-xs max-w-xs">
                          <div className="flex items-start gap-2">
                            <FileText className="h-3 w-3 mt-0.5 shrink-0 text-gray-400" />
                            <span className="line-clamp-2">{chapter.summary}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 w-24">
                          <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleAddChapter(index)}
                              className="hover:text-blue-500"
                            >
                              <Plus className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDeleteChapter(index)}
                              disabled={chapters.length <= 1}
                              className="hover:text-red-500"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="py-16 text-center border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-800 mb-4">
                <Sparkles className="h-8 w-8 text-gray-400" />
              </div>
              <p className="text-gray-500 dark:text-gray-400 mb-1">点击上方&quot;生成目录&quot;按钮</p>
              <p className="text-sm text-gray-400 dark:text-gray-500">AI 将根据项目设定生成专业的章节目录</p>
            </div>
          )}

          {/* 操作按钮 */}
          {chapters.length > 0 && (
            <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
              <Button variant="outline" onClick={handleClose}>
                取消
              </Button>
              <Button variant="primary" onClick={handleApply}>
                <Check className="h-4 w-4 mr-2" />
                应用到项目（创建 {chapters.length} 章）
              </Button>
            </div>
          )}
        </div>
      </Modal>
    </>
  )
}