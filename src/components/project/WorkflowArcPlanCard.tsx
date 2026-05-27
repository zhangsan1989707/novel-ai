'use client'

import { useState } from 'react'
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Modal, Textarea, toast, ExpandableList } from '@/components/ui'

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

const INITIAL_VISIBLE_ROADMAP_ITEMS = 3

export function WorkflowArcPlanCard({ projectId, roadmap, confirmed, disabled, onUpdated }: WorkflowArcPlanCardProps) {
  const [confirming, setConfirming] = useState(false)
  const [regeneratingArcId, setRegeneratingArcId] = useState<string | null>(null)
  const [noteArcId, setNoteArcId] = useState<string | null>(null)
  const [userNote, setUserNote] = useState('')
  const [detailOpen, setDetailOpen] = useState(false)

  const nextArc = roadmap[0]
  const totalHighlights = roadmap.reduce((sum, item) => sum + item.highlights.length, 0)

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

  const renderRoadmapList = () => (
    <>
      {confirmed ? (
        <div className="rounded-xl border border-amber-200 bg-white/80 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-slate-950/40 dark:text-amber-200">
          路线图已生效。这里只在你要微调某个阶段时再展开，不会持续占住主流程区域。
        </div>
      ) : null}
      <ExpandableList
        items={roadmap}
        initialVisibleCount={INITIAL_VISIBLE_ROADMAP_ITEMS}
        className="space-y-4"
        buttonClassName="gap-1.5"
        collapsedLabel={(hiddenCount) => `展开剩余 ${hiddenCount} 个阶段`}
        expandedLabel="收起目录"
        getKey={(item) => item.arcId || item.arcNumber}
        renderItem={(item) => (
          <div className="rounded-2xl border border-amber-200 bg-white/80 p-5 dark:border-amber-900/40 dark:bg-slate-950/40">
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
        )}
      />
    </>
  )

  return (
    <>
      <Card className={`border-amber-200 bg-amber-50/60 dark:border-amber-900/40 dark:bg-amber-950/20 ${disabled ? 'opacity-60' : ''}`}>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base">2. 故事路线图</CardTitle>
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                {confirmed
                  ? '路线图已生效，默认按当前节奏往下生成。'
                  : 'AI 已为你规划好全书发展路线。你只需要确认方向是否顺眼，不需要理解底层 ArcPlan 结构。'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={confirmed ? 'success' : 'warning'}>
                {confirmed ? '已确认' : '待确认'}
              </Badge>
              {confirmed ? (
                <Button variant="outline" size="sm" onClick={() => setDetailOpen(true)}>
                  查看完整路线图
                </Button>
              ) : null}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {roadmap.length === 0 ? (
            <div className="rounded-lg border border-dashed border-amber-300 px-4 py-6 text-sm text-amber-800 dark:border-amber-800 dark:text-amber-200">
              当前还没有故事路线图。先确认蓝图并等待 AI 自动生成路线。
            </div>
          ) : confirmed ? (
            <>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-2xl border border-amber-200 bg-white/80 p-4 dark:border-amber-900/40 dark:bg-slate-950/40">
                  <div className="text-xs text-amber-700 dark:text-amber-300">路线状态</div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <span className="rounded-full bg-amber-50 px-3 py-1 text-xs text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">共 {roadmap.length} 个阶段</span>
                    <span className="rounded-full bg-amber-50 px-3 py-1 text-xs text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">累计看点 {totalHighlights} 个</span>
                  </div>
                </div>
                <div className="rounded-2xl border border-amber-200 bg-white/80 p-4 dark:border-amber-900/40 dark:bg-slate-950/40">
                  <div className="text-xs text-amber-700 dark:text-amber-300">当前阶段</div>
                  <div className="mt-2 text-sm font-medium leading-6 text-gray-900 dark:text-gray-100">{nextArc?.title || '待生成阶段'}</div>
                  <div className="mt-1 text-xs text-gray-500">{nextArc?.chapterRange || '等待 AI 规划后显示'}</div>
                </div>
                <div className="rounded-2xl border border-amber-200 bg-white/80 p-4 dark:border-amber-900/40 dark:bg-slate-950/40">
                  <div className="text-xs text-amber-700 dark:text-amber-300">这一段主要写</div>
                  <div className="mt-2 text-sm leading-6 text-gray-700 dark:text-gray-300">{nextArc?.summary || '当前还没有路线摘要。'}</div>
                </div>
                <div className="rounded-2xl border border-amber-200 bg-white/80 p-4 dark:border-amber-900/40 dark:bg-slate-950/40">
                  <div className="text-xs text-amber-700 dark:text-amber-300">阶段爽点与钩子</div>
                  <div className="mt-2 text-sm text-gray-900 dark:text-gray-100">{nextArc?.stagePayoff || '待补充阶段回报'}</div>
                  <div className="mt-1 text-xs text-gray-500">{nextArc?.hookStrategy || '待补充阶段钩子'}</div>
                </div>
              </div>
              {nextArc?.highlights?.length ? (
                <div>
                  <div className="text-sm font-medium text-gray-900 dark:text-gray-100">当前阶段看点</div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {nextArc.highlights.slice(0, 4).map(highlight => (
                      <span key={highlight} className="rounded-full bg-amber-100 px-3 py-1 text-xs text-amber-900 dark:bg-amber-900/30 dark:text-amber-200">
                        {highlight}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => setDetailOpen(true)}>
                  微调阶段
                </Button>
              </div>
            </>
          ) : (
            renderRoadmapList()
          )}
          {!confirmed ? (
            <div className="flex flex-wrap gap-2">
              <Button variant="primary" onClick={handleConfirm} loading={confirming} disabled={disabled || roadmap.length === 0}>
                确认路线
              </Button>
            </div>
          ) : null}
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

      {confirmed ? (
        <Modal
          open={detailOpen}
          onClose={() => setDetailOpen(false)}
          title="故事路线图与阶段微调"
          description="这里保留完整阶段规划。只有当你需要改节奏、补限制或重生成某个阶段时，再进来调整。"
          className="max-w-5xl"
        >
          {renderRoadmapList()}
        </Modal>
      ) : null}
    </>
  )
}
