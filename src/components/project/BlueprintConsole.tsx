'use client'

import { useMemo, useState } from 'react'
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Textarea, toast } from '@/components/ui'
import { RefreshCw, Sparkles, Target, Wand2, Orbit, BrainCircuit, GitBranchPlus, ShieldAlert } from 'lucide-react'
import type { BlueprintConsoleSnapshot } from '@/lib/engine/blueprint-console'
import type { StorySteering } from '@/types'
import { StorySteeringPanel } from '@/components/ai'
import { formatDisplayDateTime } from '@/lib/helpers'

interface BlueprintConsoleProps {
  projectId: number
  initialData: BlueprintConsoleSnapshot
  steeringValues: Partial<StorySteering>
  aiStatus?: {
    hasBlueprint: boolean
    hasArcPlans: boolean
    hasStoryState: boolean
    maintenanceActive: boolean
    completedChapters: number
    totalChapters: number
    chapterSummaryCount: number
    volumeSummaryCount: number
    bookSummaryReady: boolean
    primaryAction?: string
  }
  onRefreshed?: () => void
  onEditBaseInfo?: () => void
}

const QUICK_TWEAKS = [
  '提高爽点密度',
  '增加隐藏势力',
  '主角更腹黑',
  '节奏再快一点',
  '增加搞笑属性',
  '减少修仙感',
  '增加超自然元素',
  '强化资本博弈',
]

const AI_BOUNDARY_ITEMS = [
  '卷数、章节数与批次大小',
  '阶段推进与高潮分布',
  '伏笔回收与终局时机',
]

const USER_STEERING_ITEMS = [
  '节奏快慢',
  '黑暗度与幽默感',
  '浪漫、悬念、冲突、成长速度',
]

export function BlueprintConsole({ projectId, initialData, steeringValues, aiStatus, onRefreshed, onEditBaseInfo }: BlueprintConsoleProps) {
  const [snapshot, setSnapshot] = useState(initialData)
  const [guidance, setGuidance] = useState('')
  const [refreshing, setRefreshing] = useState(false)

  const generatedAt = useMemo(() => {
    if (!snapshot.generatedAt) return ''
    return formatDisplayDateTime(snapshot.generatedAt)
  }, [snapshot.generatedAt])

  const handleRefresh = async (inputGuidance?: string) => {
    setRefreshing(true)
    try {
      const res = await fetch(`/api/novel/projects/${projectId}/blueprint-console`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guidance: inputGuidance || guidance || undefined }),
      })
      const result = await res.json()
      if (!result.success) {
        toast.error(result.error?.message || '刷新失败')
        return
      }
      setSnapshot(result.data)
      setGuidance('')
      toast.success(inputGuidance ? '方向已微调并同步到蓝图中枢' : '蓝图状态已刷新')
      onRefreshed?.()
    } catch {
      toast.error('刷新失败')
    } finally {
      setRefreshing(false)
    }
  }

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden border-blue-200 dark:border-blue-900/40">
        <div className="bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.18),_transparent_50%),linear-gradient(135deg,_rgba(15,23,42,0.98),_rgba(30,41,59,0.96))] p-6 text-white">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full bg-white/12 px-3 py-1 text-xs font-medium tracking-wide text-blue-100">
                <Sparkles className="h-3.5 w-3.5" />
                AI 动态控制台
              </div>
              <div>
                <p className="text-sm text-blue-100/90">这是一本</p>
                <h2 className="mt-1 text-2xl font-semibold">{snapshot.blueprintCard.category}</h2>
              </div>
              <p className="max-w-3xl text-sm leading-6 text-blue-50/95">
                核心卖点：{snapshot.blueprintCard.coreSell}
              </p>
              <div className="flex flex-wrap gap-2 text-xs">
                <span className="rounded-full bg-white/10 px-3 py-1 text-blue-100">Blueprint / Arc / StoryState 由 AI 驱动</span>
                <span className="rounded-full bg-white/10 px-3 py-1 text-blue-100">用户只能微调 Story Steering</span>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {onEditBaseInfo && (
                <Button variant="outline" size="sm" onClick={onEditBaseInfo} className="border-white/20 bg-white/10 text-white hover:bg-white/20">
                  调整基础方向
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleRefresh()}
                loading={refreshing}
                className="border-white/20 bg-white/10 text-white hover:bg-white/20"
              >
                <RefreshCw className="h-4 w-4" />
                刷新蓝图状态
              </Button>
            </div>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-xl border border-white/10 bg-white/8 p-4">
              <div className="text-xs text-blue-100/80">当前阶段</div>
              <div className="mt-2 text-sm font-medium">{snapshot.blueprintCard.currentPhase}</div>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/8 p-4">
              <div className="text-xs text-blue-100/80">当前世界等级</div>
              <div className="mt-2 text-sm font-medium">{snapshot.blueprintCard.worldLevel}</div>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/8 p-4">
              <div className="text-xs text-blue-100/80">当前主线</div>
              <div className="mt-2 text-sm font-medium">{snapshot.blueprintCard.currentMainline}</div>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/8 p-4">
              <div className="text-xs text-blue-100/80">当前节奏</div>
              <div className="mt-2 text-sm font-medium">{snapshot.blueprintCard.pacing}</div>
            </div>
          </div>

          <div className="mt-5 grid gap-3 xl:grid-cols-2">
            <div className="rounded-xl border border-white/10 bg-white/8 p-4">
              <div className="flex items-center gap-2 text-xs font-medium text-blue-100">
                <BrainCircuit className="h-3.5 w-3.5" />
                AI 自动控制
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {AI_BOUNDARY_ITEMS.map(item => (
                  <span key={item} className="rounded-full bg-white/10 px-3 py-1 text-xs text-blue-50">
                    {item}
                  </span>
                ))}
              </div>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/8 p-4">
              <div className="flex items-center gap-2 text-xs font-medium text-blue-100">
                <Target className="h-3.5 w-3.5" />
                用户可调方向
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {USER_STEERING_ITEMS.map(item => (
                  <span key={item} className="rounded-full bg-white/10 px-3 py-1 text-xs text-blue-50">
                    {item}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {generatedAt && (
            <div className="mt-4 text-xs text-blue-100/70">
              最近同步：{generatedAt}
            </div>
          )}
        </div>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-6">
          {aiStatus && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">AI 驱动状态</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <div className="rounded-xl border border-gray-200 p-4 dark:border-gray-800">
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <Orbit className="h-3.5 w-3.5" />
                      Blueprint
                    </div>
                    <div className="mt-2 text-sm font-medium text-gray-900 dark:text-gray-100">
                      {aiStatus.hasBlueprint ? 'AI 已接管蓝图' : '等待蓝图初始化'}
                    </div>
                  </div>
                  <div className="rounded-xl border border-gray-200 p-4 dark:border-gray-800">
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <GitBranchPlus className="h-3.5 w-3.5" />
                      Arc Plan
                    </div>
                    <div className="mt-2 text-sm font-medium text-gray-900 dark:text-gray-100">
                      {aiStatus.hasArcPlans ? '批次阶段已建立' : '等待阶段规划'}
                    </div>
                  </div>
                  <div className="rounded-xl border border-gray-200 p-4 dark:border-gray-800">
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <BrainCircuit className="h-3.5 w-3.5" />
                      StoryState
                    </div>
                    <div className="mt-2 text-sm font-medium text-gray-900 dark:text-gray-100">
                      {aiStatus.hasStoryState ? '状态记忆已在线' : '等待故事状态初始化'}
                    </div>
                  </div>
                  <div className="rounded-xl border border-gray-200 p-4 dark:border-gray-800">
                    <div className="text-xs text-gray-500">分层记忆</div>
                    <div className="mt-2 text-sm font-medium text-gray-900 dark:text-gray-100">
                      {aiStatus.chapterSummaryCount} / {aiStatus.volumeSummaryCount} / {aiStatus.bookSummaryReady ? '全书已汇总' : '全书待汇总'}
                    </div>
                  </div>
                </div>

                <div className={`rounded-xl border p-4 ${
                  aiStatus.maintenanceActive
                    ? 'border-blue-200 bg-blue-50 dark:border-blue-900/40 dark:bg-blue-950/20'
                    : 'border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-900/30'
                }`}>
                  <div className="flex items-center gap-2 text-xs font-medium">
                    <ShieldAlert className="h-3.5 w-3.5" />
                    控制边界
                  </div>
                  <p className="mt-2 text-sm leading-6 text-gray-700 dark:text-gray-300">
                    当前项目已完成 {aiStatus.completedChapters} / {aiStatus.totalChapters} 章。你在这里的操作应当是观察 AI 当前控制状态并微调方向，而不是手动指定卷数、章节数或高潮节点。
                  </p>
                  {aiStatus.primaryAction && (
                    <div className="mt-3 text-xs text-gray-500 dark:text-gray-400">
                      AI 当前建议动作：{aiStatus.primaryAction}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">世界设定</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-900/30">
                {snapshot.world.summary}
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-lg border border-gray-200 p-4 dark:border-gray-800">
                  <div className="text-xs text-gray-500">地图推进</div>
                  <div className="mt-2 text-sm font-medium">
                    {snapshot.world.mapRoute.length > 0 ? snapshot.world.mapRoute.join(' → ') : '待 AI 补全'}
                  </div>
                </div>
                <div className="rounded-lg border border-gray-200 p-4 dark:border-gray-800">
                  <div className="text-xs text-gray-500">隐藏层级</div>
                  <div className="mt-2 text-sm font-medium">{snapshot.world.hiddenHierarchy}</div>
                </div>
                <div className="rounded-lg border border-gray-200 p-4 dark:border-gray-800">
                  <div className="text-xs text-gray-500">势力结构</div>
                  <div className="mt-2 text-sm font-medium">{snapshot.world.factions}</div>
                </div>
                <div className="rounded-lg border border-gray-200 p-4 dark:border-gray-800">
                  <div className="text-xs text-gray-500">世界扩张路线</div>
                  <div className="mt-2 text-sm font-medium">{snapshot.world.expansionRoute}</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">主角设定</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-3 text-sm">
              <div className="rounded-lg border border-gray-200 p-4 dark:border-gray-800">
                <div className="text-xs text-gray-500">核心人设</div>
                <div className="mt-2 leading-6">{snapshot.protagonist.summary}</div>
              </div>
              <div className="rounded-lg border border-gray-200 p-4 dark:border-gray-800">
                <div className="text-xs text-gray-500">当前状态</div>
                <div className="mt-2 leading-6">{snapshot.protagonist.currentState}</div>
              </div>
              <div className="rounded-lg border border-gray-200 p-4 dark:border-gray-800">
                <div className="text-xs text-gray-500">成长路线</div>
                <div className="mt-2 leading-6">{snapshot.protagonist.growthRoute}</div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">风格控制</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-900/30">
                <div className="text-xs text-gray-500">当前风格策略</div>
                <div className="mt-2 leading-6">{snapshot.style.strategy}</div>
              </div>
              <div className="rounded-xl border border-gray-200 p-4 dark:border-gray-800">
                <div className="text-xs text-gray-500">爽点策略</div>
                <div className="mt-2 leading-6">{snapshot.style.payoffStrategy}</div>
              </div>
              <div className="flex flex-wrap gap-2">
                {snapshot.style.toneTags.map(tag => (
                  <Badge key={tag} variant="secondary">
                    {tag}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>

          <StorySteeringPanel
            key={JSON.stringify(steeringValues)}
            projectId={projectId}
            initialValues={steeringValues}
            title="故事方向盘"
            description="这里不是项目设定表单，而是 AI 长篇流水线的方向盘。你调的是倾向，不是结构；Blueprint、Arc 和 StoryState 会读取这些值来偏转后续章节。"
            submitLabel="保存并影响后续 AI 生成"
            onSave={() => onRefreshed?.()}
          />
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Target className="h-4 w-4 text-blue-600" />
                方向微调
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 text-xs leading-5 text-gray-600 dark:border-gray-800 dark:bg-gray-900/30 dark:text-gray-300">
                点击这些短语，不是直接改数据库结构字段，而是把偏好交给 AI 蓝图中枢，让它在下一轮 Blueprint / Arc / StoryState 刷新中吸收。
              </div>
              <div className="flex flex-wrap gap-2">
                {[...snapshot.suggestedTweaks, ...QUICK_TWEAKS].slice(0, 10).map(action => (
                  <button
                    key={action}
                    type="button"
                    onClick={() => handleRefresh(action)}
                    className="rounded-full border border-gray-200 px-3 py-1.5 text-xs text-gray-700 transition-colors hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 dark:border-gray-700 dark:text-gray-300 dark:hover:border-blue-700 dark:hover:bg-blue-950/30 dark:hover:text-blue-300"
                  >
                    {action}
                  </button>
                ))}
              </div>

              <Textarea
                label="修正方向"
                rows={4}
                value={guidance}
                onChange={event => setGuidance(event.target.value)}
                placeholder="例如：增加超自然元素，但保留都市资本博弈主线；主角更果断一些。"
              />

              <Button variant="primary" onClick={() => handleRefresh()} loading={refreshing} className="w-full gap-1.5">
                <Wand2 className="h-4 w-4" />
                提交微调给 AI
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">使用边界</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-gray-600 dark:text-gray-300">
              <p>这里展示的是 AI 当前理解的全书状态，不是让你从零填写世界观、卷数或高潮表。</p>
              <p>你的动作应当是查看、微调、修正方向，AI 会据此重算后续蓝图、批次目录和章节策略。</p>
              <p>如果书名、题材或基础定位有误，再去调整基础信息；其他结构性控制请交给 AI 自动推进。</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
