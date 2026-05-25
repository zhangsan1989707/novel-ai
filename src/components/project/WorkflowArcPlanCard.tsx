'use client'

import { useState } from 'react'
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Modal, Textarea, toast } from '@/components/ui'

type StoryRoadmapItem = {
  arcId?: string
  arcNumber: number
  title: string
  chapterRange: string
  summary: string
  mainEmotion: string
  stagePayoff: string
  conflictFocus: string
  hookStrategy: string
  highlights: string[]
  forbidden: string[]
}

interface WorkflowArcPlanCardProps {
  projectId: number
  roadmap: StoryRoadmapItem[]
  confirmed: boolean
  disabled?: boolean
  onUpdated?: () => void
}

export function WorkflowArcPlanCard({ projectId, roadmap, confirmed, disabled, onUpdated }: WorkflowArcPlanCardProps) {
  const [confirming, setConfirming] = useState(false)
  const [regeneratingArcId, setRegeneratingArcId] = useState<string | null>(null)
  const [noteArcId, setNoteArcId] = useState<string | null>(null)
  const [userNote, setUserNote] = useState('')

  const handleConfirm = async () => {
    setConfirming(true)
    try {
      const res = await fetch(`/api/novel/projects/${projectId}/arc-plans/confirm`, {
        method: 'POST',
      })
      const data = await res.json()
      if (!data.success) {
        toast.error(data.error?.message || '确认故事路线失败')
        return
      }
      toast.success('故事路线已确认，可以开始生成')
      onUpdated?.()
    } catch {
      toast.error('确认故事路线失败')
    } finally {
      setConfirming(false)
    }
  }

  const regenerateStage = async (arcId: string, note?: string) => {
    setRegeneratingArcId(arcId)
    try {
      const res = await fetch(`/api/novel/projects/${projectId}/story-roadmap/${arcId}/regenerate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userNote: note || undefined }),
      })
      const data = await res.json()
      if (!data.success) {
        toast.error(data.error?.message || '重生成阶段路线失败')
        return
      }
      toast.success(note ? '已按补充要求重写这一阶段' : '这一阶段已重生成')
      setNoteArcId(null)
      setUserNote('')
      onUpdated?.()
    } catch {
      toast.error('重生成阶段路线失败')
    } finally {
      setRegeneratingArcId(null)
    }
  }

  return (
    <>
      <Card className={`border-amber-200 bg-amber-50/60 dark:border-amber-900/40 dark:bg-amber-950/20 ${disabled ? 'opacity-60' : ''}`}>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base">2. 故事路线图</CardTitle>
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                AI 已为你规划好全书发展路线。你只需要确认方向是否顺眼，不需要理解底层 ArcPlan 结构。
              </p>
            </div>
            <Badge variant={confirmed ? 'success' : 'warning'}>
              {confirmed ? '已确认' : '待确认'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {roadmap.length === 0 ? (
            <div className="rounded-lg border border-dashed border-amber-300 px-4 py-6 text-sm text-amber-800 dark:border-amber-800 dark:text-amber-200">
              当前还没有故事路线图。先确认蓝图并等待 AI 自动生成路线。
            </div>
          ) : roadmap.map(item => (
            <div key={item.arcId || item.arcNumber} className="rounded-2xl border border-amber-200 bg-white/80 p-5 dark:border-amber-900/40 dark:bg-slate-950/40">
              <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">{item.title}</div>
                  <div className="mt-1 text-sm text-gray-500">{item.chapterRange}</div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => item.arcId && regenerateStage(item.arcId)}
                    loading={regeneratingArcId === item.arcId}
                    disabled={disabled || !item.arcId}
                  >
                    重生成这一阶段
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setNoteArcId(item.arcId || null)
                      setUserNote('')
                    }}
                    disabled={disabled || !item.arcId}
                  >
                    补充一句话要求
                  </Button>
                </div>
              </div>

              <div className="mt-4 space-y-4">
                <div>
                  <div className="text-sm font-medium text-gray-900 dark:text-gray-100">这一阶段主要写</div>
                  <p className="mt-1 text-sm leading-6 text-gray-700 dark:text-gray-300">{item.summary}</p>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <div className="rounded-xl bg-amber-50 p-3 dark:bg-amber-950/20">
                    <div className="text-xs text-amber-700 dark:text-amber-300">主情绪</div>
                    <div className="mt-1 text-sm font-medium text-gray-900 dark:text-gray-100">{item.mainEmotion}</div>
                  </div>
                  <div className="rounded-xl bg-amber-50 p-3 dark:bg-amber-950/20">
                    <div className="text-xs text-amber-700 dark:text-amber-300">阶段爽点</div>
                    <div className="mt-1 text-sm font-medium text-gray-900 dark:text-gray-100">{item.stagePayoff}</div>
                  </div>
                  <div className="rounded-xl bg-amber-50 p-3 dark:bg-amber-950/20">
                    <div className="text-xs text-amber-700 dark:text-amber-300">阶段冲突</div>
                    <div className="mt-1 text-sm font-medium text-gray-900 dark:text-gray-100">{item.conflictFocus}</div>
                  </div>
                  <div className="rounded-xl bg-amber-50 p-3 dark:bg-amber-950/20">
                    <div className="text-xs text-amber-700 dark:text-amber-300">阶段钩子</div>
                    <div className="mt-1 text-sm font-medium text-gray-900 dark:text-gray-100">{item.hookStrategy}</div>
                  </div>
                </div>

                <div>
                  <div className="text-sm font-medium text-gray-900 dark:text-gray-100">读者看点</div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {item.highlights.map(highlight => (
                      <span key={highlight} className="rounded-full bg-amber-100 px-3 py-1 text-xs text-amber-900 dark:bg-amber-900/30 dark:text-amber-200">
                        {highlight}
                      </span>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="text-sm font-medium text-gray-900 dark:text-gray-100">本阶段不写</div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {item.forbidden.map(rule => (
                      <span key={rule} className="rounded-full bg-red-50 px-3 py-1 text-xs text-red-700 dark:bg-red-950/30 dark:text-red-300">
                        {rule}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ))}
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" onClick={handleConfirm} loading={confirming} disabled={disabled || roadmap.length === 0}>
              确认路线
            </Button>
          </div>
        </CardContent>
      </Card>

      <Modal
        open={Boolean(noteArcId)}
        onClose={() => {
          setNoteArcId(null)
          setUserNote('')
        }}
        title="补充一句话要求"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-300">
            例如：第二阶段我希望多写宗门斗争，不要太快去秘境。
          </p>
          <Textarea
            value={userNote}
            onChange={(e) => setUserNote(e.target.value)}
            rows={4}
            placeholder="补充你对这一阶段的一句话要求"
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setNoteArcId(null)}>
              取消
            </Button>
            <Button
              variant="primary"
              onClick={() => noteArcId && regenerateStage(noteArcId, userNote)}
              loading={Boolean(noteArcId && regeneratingArcId === noteArcId)}
              disabled={!noteArcId || !userNote.trim()}
            >
              提交并重写这一阶段
            </Button>
          </div>
        </div>
      </Modal>
    </>
  )
}
