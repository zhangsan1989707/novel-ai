'use client'

import { useState, useCallback } from 'react'
import { Button, Input, Select, Card, CardHeader, CardTitle, CardContent, Badge, Progress } from '@/components/ui'
import {
  Sparkles,
  BookOpen,
  Heart,
  RotateCcw,
  Anchor,
  PenTool,
  Loader2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'

interface Section {
  id: string
  sectionNumber: number
  title: string
  content: string | null
  wordCount: number
  sectionType: string
  emotionalTarget: number
}

interface ShortStoryData {
  id: string
  projectId: number
  structure: string
  targetWordCount: number
  currentWordCount: number
  premise: string | null
  emotionalDesign: Record<string, unknown> | null
  reversalDesign: Record<string, unknown> | null
  hookDesign: Record<string, unknown> | null
  sections: Section[]
}

interface ShortStoryPanelProps {
  projectId: number
}

const STRUCTURE_OPTIONS = [
  { value: 'three_act', label: '三幕式' },
  { value: 'four_act', label: '四幕式' },
  { value: 'five_act', label: '五幕式' },
]

const SECTION_TYPE_LABELS: Record<string, string> = {
  setup: '开端/铺垫',
  rising: '发展/上升',
  climax: '高潮',
  falling: '下降/转折',
  resolution: '结局/收束',
}

const SECTION_TYPE_COLORS: Record<string, string> = {
  setup: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  rising: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  climax: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  falling: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  resolution: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
}

function EmotionChart({ sections }: { sections: Section[] }) {
  if (sections.length === 0) return null

  const maxEmotion = 100
  const chartHeight = 120
  const barWidth = 60
  const gap = 20
  const totalWidth = sections.length * (barWidth + gap) - gap

  return (
    <div className="overflow-x-auto">
      <div
        className="relative mx-auto"
        style={{ width: Math.max(totalWidth, 200), height: chartHeight + 40 }}
      >
        {[0, 25, 50, 75, 100].map((val) => (
          <div key={val} className="absolute left-0 right-0 flex items-center" style={{ bottom: (val / maxEmotion) * chartHeight }}>
            <span className="text-xs text-gray-400 w-8">{val}</span>
            <div className="flex-1 border-t border-gray-200 dark:border-gray-700 border-dashed" />
          </div>
        ))}
        <div className="absolute left-10 right-0 bottom-0" style={{ height: chartHeight }}>
          <svg
            className="w-full h-full"
            viewBox={`0 0 ${totalWidth} ${chartHeight}`}
            preserveAspectRatio="none"
          >
            <polyline
              fill="none"
              stroke="rgb(59, 130, 246)"
              strokeWidth="2"
              points={sections
                .map((s, i) => {
                  const x = i * (barWidth + gap) + barWidth / 2
                  const y = chartHeight - (s.emotionalTarget / maxEmotion) * chartHeight
                  return `${x},${y}`
                })
                .join(' ')}
            />
            {sections.map((s, i) => {
              const x = i * (barWidth + gap) + barWidth / 2
              const y = chartHeight - (s.emotionalTarget / maxEmotion) * chartHeight
              return (
                <circle key={s.id} cx={x} cy={y} r="4" fill="rgb(59, 130, 246)" />
              )
            })}
          </svg>
        </div>
        <div className="absolute left-10 right-0 flex" style={{ top: chartHeight + 8 }}>
          {sections.map((s) => (
            <div
              key={s.id}
              className="text-center text-xs text-gray-500 truncate"
              style={{ width: barWidth, marginRight: gap }}
            >
              {s.sectionNumber}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export function ShortStoryPanel({ projectId }: ShortStoryPanelProps) {
  const [story, setStory] = useState<ShortStoryData | null>(null)
  const [structure, setStructure] = useState<string>('three_act')
  const [targetWordCount, setTargetWordCount] = useState<number>(10000)
  const [loading, setLoading] = useState<string | null>(null)
  const [expandedSection, setExpandedSection] = useState<number | null>(null)
  const [writingContent, setWritingContent] = useState<Record<number, string>>({})

  const fetchStory = useCallback(async () => {
    try {
      const res = await fetch(`/api/short-story/${projectId}`)
      if (res.ok) {
        const data = await res.json()
        if (data.success) {
          setStory(data.data)
          if (data.data.structure) setStructure(data.data.structure)
          if (data.data.targetWordCount) setTargetWordCount(data.data.targetWordCount)
        }
      }
    } catch {
      // ignore
    }
  }, [projectId])

  const handleGenerateOutline = async () => {
    setLoading('outline')
    try {
      const res = await fetch('/api/short-story/outline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, structure, targetWordCount }),
      })
      const data = await res.json()
      if (data.success) {
        setStory(data.data)
      }
    } catch {
      // ignore
    } finally {
      setLoading(null)
    }
  }

  const handleDesignEmotion = async () => {
    setLoading('emotion')
    try {
      const res = await fetch('/api/short-story/emotion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId }),
      })
      const data = await res.json()
      if (data.success) {
        await fetchStory()
      }
    } catch {
      // ignore
    } finally {
      setLoading(null)
    }
  }

  const handleDesignReversal = async () => {
    setLoading('reversal')
    try {
      const res = await fetch('/api/short-story/reversal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId }),
      })
      const data = await res.json()
      if (data.success) {
        await fetchStory()
      }
    } catch {
      // ignore
    } finally {
      setLoading(null)
    }
  }

  const handleDesignHooks = async () => {
    setLoading('hooks')
    try {
      const res = await fetch('/api/short-story/hooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId }),
      })
      const data = await res.json()
      if (data.success) {
        await fetchStory()
      }
    } catch {
      // ignore
    } finally {
      setLoading(null)
    }
  }

  const handleWriteSection = async (sectionNumber: number) => {
    setLoading(`write-${sectionNumber}`)
    setWritingContent((prev) => ({ ...prev, [sectionNumber]: '' }))

    try {
      const res = await fetch('/api/short-story/write', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, sectionNumber, stream: true }),
      })

      if (!res.ok || !res.body) {
        setLoading(null)
        return
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (line.startsWith('event: token')) {
            continue
          }
          if (line.startsWith('data: ')) {
            try {
              const event = JSON.parse(line.slice(6))
              if (event.type === 'chunk' || (event.data && event.data.content)) {
                const content = event.data?.content || event.content || ''
                setWritingContent((prev) => ({
                  ...prev,
                  [sectionNumber]: (prev[sectionNumber] || '') + content,
                }))
              }
            } catch {
              // ignore parse errors
            }
          }
        }
      }

      await fetchStory()
    } catch {
      // ignore
    } finally {
      setLoading(null)
    }
  }

  const handleWriteAll = async () => {
    if (!story) return
    for (const section of story.sections) {
      if (!section.content) {
        await handleWriteSection(section.sectionNumber)
        break
      }
    }
  }

  const nextUnwrittenSection = story?.sections.find((s) => !s.content)

  const progressPercent = story
    ? Math.round((story.currentWordCount / story.targetWordCount) * 100)
    : 0

  const completedSections = story?.sections.filter((s) => s.content).length || 0
  const totalSections = story?.sections.length || 0

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 mb-4">
        <BookOpen className="h-5 w-5 text-blue-600" />
        <h3 className="text-lg font-semibold">短篇创作</h3>
      </div>

      {!story && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">创建短篇大纲</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Select
                label="结构选择"
                value={structure}
                onChange={(e) => setStructure(e.target.value)}
                options={STRUCTURE_OPTIONS}
              />
              <Input
                label="目标字数"
                type="number"
                value={targetWordCount}
                onChange={(e) => setTargetWordCount(parseInt(e.target.value) || 10000)}
                min={1000}
                max={50000}
              />
            </div>
            <div className="flex justify-end">
              <Button
                onClick={handleGenerateOutline}
                loading={loading === 'outline'}
                variant="primary"
              >
                <Sparkles className="h-4 w-4 mr-2" />
                生成大纲
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {story && (
        <>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-500">
                进度：{completedSections}/{totalSections} 段落 · {story.currentWordCount}/{story.targetWordCount} 字
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleGenerateOutline}
                  loading={loading === 'outline'}
                >
                  <RotateCcw className="h-3 w-3 mr-1" />
                  重新生成大纲
                </Button>
              </div>
            </div>
            <Progress value={progressPercent} />
          </div>

          {story.premise && (
            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <div className="text-xs text-blue-600 dark:text-blue-400 font-medium mb-1">核心前提</div>
              <div className="text-sm text-gray-700 dark:text-gray-300">{story.premise}</div>
            </div>
          )}

          <div className="grid grid-cols-3 gap-3">
            <Button
              variant={story.emotionalDesign && Object.keys(story.emotionalDesign).length > 0 ? 'outline' : 'primary'}
              size="sm"
              onClick={handleDesignEmotion}
              loading={loading === 'emotion'}
              disabled={loading !== null}
            >
              <Heart className="h-4 w-4 mr-1" />
              {story.emotionalDesign && Object.keys(story.emotionalDesign).length > 0 ? '重新设计情绪' : '设计情绪'}
            </Button>
            <Button
              variant={story.reversalDesign && Object.keys(story.reversalDesign).length > 0 ? 'outline' : 'primary'}
              size="sm"
              onClick={handleDesignReversal}
              loading={loading === 'reversal'}
              disabled={loading !== null}
            >
              <RotateCcw className="h-4 w-4 mr-1" />
              {story.reversalDesign && Object.keys(story.reversalDesign).length > 0 ? '重新设计反转' : '设计反转'}
            </Button>
            <Button
              variant={story.hookDesign && Object.keys(story.hookDesign).length > 0 ? 'outline' : 'primary'}
              size="sm"
              onClick={handleDesignHooks}
              loading={loading === 'hooks'}
              disabled={loading !== null}
            >
              <Anchor className="h-4 w-4 mr-1" />
              {story.hookDesign && Object.keys(story.hookDesign).length > 0 ? '重新设计钩子' : '设计钩子'}
            </Button>
          </div>

          {story.emotionalDesign && Object.keys(story.emotionalDesign).length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Heart className="h-4 w-4 text-pink-500" />
                  情绪曲线
                </CardTitle>
              </CardHeader>
              <CardContent>
                <EmotionChart sections={story.sections} />
                {(story.emotionalDesign as { overallArc?: string }).overallArc && (
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-3">
                    {(story.emotionalDesign as { overallArc: string }).overallArc}
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {story.reversalDesign && Object.keys(story.reversalDesign).length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <RotateCcw className="h-4 w-4 text-purple-500" />
                  反转设计
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {((story.reversalDesign as { reversals?: Array<{ type: string; description: string; sectionNumber: number }> }).reversals || []).map((r, i) => (
                    <div key={i} className="flex items-start gap-2 p-2 bg-purple-50 dark:bg-purple-900/20 rounded">
                      <Badge variant="outline">{r.type}</Badge>
                      <div className="text-sm">
                        <span className="text-gray-500">段落{r.sectionNumber}：</span>
                        <span className="text-gray-700 dark:text-gray-300">{r.description}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {story.hookDesign && Object.keys(story.hookDesign).length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Anchor className="h-4 w-4 text-teal-500" />
                  钩子设计
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {((story.hookDesign as { hooks?: Array<{ sectionNumber: number; openingHook: { type: string; description: string }; closingHook: { type: string; description: string } }> }).hooks || []).map((h, i) => (
                    <div key={i} className="p-2 bg-teal-50 dark:bg-teal-900/20 rounded">
                      <div className="text-xs text-gray-500 mb-1">段落 {h.sectionNumber}</div>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <Badge variant="outline" className="mb-1">开头 · {h.openingHook.type}</Badge>
                          <p className="text-gray-600 dark:text-gray-400">{h.openingHook.description}</p>
                        </div>
                        <div>
                          <Badge variant="outline" className="mb-1">结尾 · {h.closingHook.type}</Badge>
                          <p className="text-gray-600 dark:text-gray-400">{h.closingHook.description}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-base font-medium">段落大纲</h4>
              {nextUnwrittenSection && (
                <Button
                  size="sm"
                  variant="primary"
                  onClick={handleWriteAll}
                  loading={loading?.startsWith('write') || false}
                  disabled={loading !== null}
                >
                  <PenTool className="h-4 w-4 mr-1" />
                  写写下一段
                </Button>
              )}
              {!nextUnwrittenSection && story.sections.length > 0 && (
                <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                  全部完成
                </Badge>
              )}
            </div>

            {story.sections.map((section) => (
              <Card key={section.id}>
                <div
                  className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                  onClick={() =>
                    setExpandedSection(expandedSection === section.sectionNumber ? null : section.sectionNumber)
                  }
                >
                  <div className="flex items-center gap-3">
                    <span className="text-lg font-bold text-gray-400">{section.sectionNumber}</span>
                    <div>
                      <div className="font-medium">{section.title}</div>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge className={SECTION_TYPE_COLORS[section.sectionType] || ''}>
                          {SECTION_TYPE_LABELS[section.sectionType] || section.sectionType}
                        </Badge>
                        <span className="text-xs text-gray-400">
                          情绪目标 {section.emotionalTarget}
                        </span>
                        {section.content && (
                          <span className="text-xs text-green-600">{section.wordCount}字</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {!section.content && !writingContent[section.sectionNumber] && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleWriteSection(section.sectionNumber)
                        }}
                        loading={loading === `write-${section.sectionNumber}`}
                        disabled={loading !== null}
                      >
                        <PenTool className="h-3 w-3 mr-1" />
                        写作
                      </Button>
                    )}
                    {(loading === `write-${section.sectionNumber}` || writingContent[section.sectionNumber]) && (
                      <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                    )}
                    {expandedSection === section.sectionNumber ? (
                      <ChevronUp className="h-4 w-4 text-gray-400" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-gray-400" />
                    )}
                  </div>
                </div>

                {expandedSection === section.sectionNumber && (
                  <CardContent className="pt-0 border-t">
                    <div className="prose prose-sm dark:prose-invert max-w-none">
                      {writingContent[section.sectionNumber] && (
                        <div className="whitespace-pre-wrap text-gray-700 dark:text-gray-300">
                          {writingContent[section.sectionNumber]}
                        </div>
                      )}
                      {!writingContent[section.sectionNumber] && section.content && (
                        <div className="whitespace-pre-wrap text-gray-700 dark:text-gray-300">
                          {section.content}
                        </div>
                      )}
                      {!writingContent[section.sectionNumber] && !section.content && (
                        <div className="text-gray-400 text-center py-4">
                          尚未写作，点击上方按钮开始
                        </div>
                      )}
                    </div>
                  </CardContent>
                )}
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
