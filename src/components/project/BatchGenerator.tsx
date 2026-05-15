'use client'

import { useState } from 'react'
import { Button, Modal } from '@/components/ui'
import { Sparkles, CheckSquare, Square, Loader2 } from 'lucide-react'

interface Chapter {
  id: number
  chapterNumber: number
  title: string
  wordCount: number
  status: string
  content?: string | null
}

interface BatchGeneratorProps {
  projectId: number
  chapters: Chapter[]
  onGenerate: (options: {
    chapterIds?: number[]
    useContext: boolean
    contextChapterCount: number
    temperature: number
    targetWordCount: number
  }) => void
}

export function BatchGenerator({ projectId, chapters, onGenerate }: BatchGeneratorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [generationType, setGenerationType] = useState<'all' | 'selected'>('all')
  const [selectedChapterIds, setSelectedChapterIds] = useState<number[]>([])
  const [useContext, setUseContext] = useState(true)
  const [contextChapterCount, setContextChapterCount] = useState(3)
  const [temperature, setTemperature] = useState(0.7)
  const [targetWordCount, setTargetWordCount] = useState(3000)

  const pendingChapters = chapters.filter(
    (ch) => !ch.content || ch.wordCount === 0
  )

  const handleOpen = () => {
    setSelectedChapterIds(pendingChapters.map((ch) => ch.id))
    setIsOpen(true)
  }

  const handleGenerate = () => {
    const options = {
      useContext,
      contextChapterCount,
      temperature,
      targetWordCount,
      ...(generationType === 'selected' ? { chapterIds: selectedChapterIds } : {}),
    }
    onGenerate(options)
    setIsOpen(false)
  }

  const toggleChapter = (id: number) => {
    setSelectedChapterIds((prev) =>
      prev.includes(id)
        ? prev.filter((i) => i !== id)
        : [...prev, id]
    )
  }

  if (pendingChapters.length === 0) {
    return null
  }

  return (
    <>
      <Button
        variant="primary"
        size="sm"
        onClick={handleOpen}
        disabled={chapters.length === 0}
      >
        <Sparkles className="h-4 w-4 mr-2" />
        一键生成 ({pendingChapters.length})
      </Button>

      <Modal
        open={isOpen}
        onClose={() => setIsOpen(false)}
        title={
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-blue-500" />
            <span>批量生成章节内容</span>
          </div>
        }
        className="max-w-lg"
      >
        <div className="space-y-5">
          {/* 生成范围 */}
          <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-gray-800 dark:to-gray-800 rounded-xl p-4">
            <label className="block text-sm font-medium mb-3">生成范围</label>

            <div className="space-y-2">
              <label className="flex items-center gap-3 cursor-pointer p-2.5 rounded-lg hover:bg-white/50 dark:hover:bg-gray-700/50 transition-colors">
                <input
                  type="radio"
                  name="generationType"
                  value="all"
                  checked={generationType === 'all'}
                  onChange={() => setGenerationType('all')}
                  className="w-4 h-4 accent-blue-600"
                />
                <span className="flex-1">全部待生成章节</span>
                <span className="text-sm text-blue-600 dark:text-blue-400 font-medium">
                  {pendingChapters.length} 章
                </span>
              </label>

              <label className="flex items-center gap-3 cursor-pointer p-2.5 rounded-lg hover:bg-white/50 dark:hover:bg-gray-700/50 transition-colors">
                <input
                  type="radio"
                  name="generationType"
                  value="selected"
                  checked={generationType === 'selected'}
                  onChange={() => setGenerationType('selected')}
                  className="w-4 h-4 accent-blue-600"
                />
                <span className="flex-1">选择特定章节</span>
              </label>

              {generationType === 'selected' && (
                <div className="ml-7 mt-2 max-h-40 overflow-y-auto space-y-1 bg-white/30 dark:bg-gray-700/30 rounded-lg p-2">
                  {chapters.map((chapter) => {
                    const isPending = pendingChapters.some((p) => p.id === chapter.id)
                    return (
                      <label
                        key={chapter.id}
                        className={`flex items-center gap-2 cursor-pointer p-1.5 rounded ${
                          isPending ? 'hover:bg-white/50 dark:hover:bg-gray-600/50' : 'opacity-50'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={selectedChapterIds.includes(chapter.id)}
                          onChange={() => toggleChapter(chapter.id)}
                          disabled={!isPending}
                          className="w-4 h-4 accent-blue-600"
                        />
                        <span className="text-sm">
                          第{chapter.chapterNumber}章 {chapter.title || '无标题'}
                        </span>
                        {!isPending && (
                          <span className="text-xs text-gray-400 ml-auto">已有内容</span>
                        )}
                      </label>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          {/* 生成设置 */}
          <div className="space-y-3">
            <label className="block text-sm font-medium">生成设置</label>

            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={useContext}
                onChange={(e) => setUseContext(e.target.checked)}
                className="w-4 h-4 accent-blue-600"
              />
              <span>使用上下文（参考前文章节）</span>
            </label>

            {useContext && (
              <div className="ml-6 space-y-2">
                <div className="flex items-center gap-2">
                  <label className="text-sm whitespace-nowrap">参考章节数：</label>
                  <input
                    type="number"
                    value={contextChapterCount}
                    onChange={(e) => setContextChapterCount(Math.max(1, parseInt(e.target.value) || 1))}
                    min={1}
                    max={10}
                    className="w-20 h-8 px-2 border rounded dark:bg-gray-800 dark:border-gray-600"
                  />
                  <span className="text-sm text-gray-500">（最多10章）</span>
                </div>
              </div>
            )}

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <label className="text-sm whitespace-nowrap">温度参数：</label>
                <input
                  type="number"
                  value={temperature}
                  onChange={(e) => setTemperature(Math.max(0, Math.min(2, parseFloat(e.target.value) || 0.7)))}
                  min={0}
                  max={2}
                  step={0.1}
                  className="w-20 h-8 px-2 border rounded dark:bg-gray-800 dark:border-gray-600"
                />
              </div>

              <div className="flex items-center gap-2">
                <label className="text-sm whitespace-nowrap">目标字数：</label>
                <input
                  type="number"
                  value={targetWordCount}
                  onChange={(e) => setTargetWordCount(Math.max(100, parseInt(e.target.value) || 3000))}
                  min={100}
                  className="w-24 h-8 px-2 border rounded dark:bg-gray-800 dark:border-gray-600"
                />
              </div>
            </div>
          </div>

          {/* 操作按钮 */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button variant="outline" onClick={() => setIsOpen(false)}>
              取消
            </Button>
            <Button
              variant="primary"
              onClick={handleGenerate}
              disabled={generationType === 'selected' && selectedChapterIds.length === 0}
            >
              <Sparkles className="h-4 w-4 mr-2" />
              开始生成
            </Button>
          </div>
        </div>
      </Modal>
    </>
  )
}
