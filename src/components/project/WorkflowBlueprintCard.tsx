'use client'

import { useEffect, useMemo, useState } from 'react'
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Input, Modal, Textarea, toast } from '@/components/ui'

type BlueprintRecord = {
  corePitch: string
  worldDirection?: string | null
  mainlineDirection?: string | null
  growthDirection?: string | null
  endingDirection?: string | null
  platformStrategy?: string | null
  genreStrategy?: string | null
  styleStrategy?: string | null
  popularFictionProfile?: {
    emotionEngine?: { primaryEmotion?: string; openingBomb?: string; readerPayoff?: string } | null
    cheatAbility?: { name?: string; oneLineRule?: string; readerFantasy?: string; limitation?: string } | null
    conflictEngine?: { conflictTypes?: string[]; conflictFrequency?: string; payoffInterval?: string; hookStrategy?: string } | null
    characterTagEngine?: { protagonistTags?: string[] } | null
  } | null
  constraints?: string[]
}

interface WorkflowBlueprintCardProps {
  projectId: number
  blueprint?: BlueprintRecord | null
  confirmed: boolean
  confirmedAt?: string | null
  onUpdated?: () => void
}

function createBlueprintForm(blueprint?: BlueprintRecord | null): BlueprintRecord {
  return {
    corePitch: blueprint?.corePitch || '',
    worldDirection: blueprint?.worldDirection || '',
    mainlineDirection: blueprint?.mainlineDirection || '',
    growthDirection: blueprint?.growthDirection || '',
    endingDirection: blueprint?.endingDirection || '',
    platformStrategy: blueprint?.platformStrategy || '',
    genreStrategy: blueprint?.genreStrategy || '',
    styleStrategy: blueprint?.styleStrategy || '',
    popularFictionProfile: blueprint?.popularFictionProfile || null,
    constraints: blueprint?.constraints || [],
  }
}

function normalizeBlueprint(record: BlueprintRecord) {
  return {
    corePitch: record.corePitch.trim(),
    worldDirection: (record.worldDirection || '').trim(),
    mainlineDirection: (record.mainlineDirection || '').trim(),
    growthDirection: (record.growthDirection || '').trim(),
    endingDirection: (record.endingDirection || '').trim(),
    platformStrategy: (record.platformStrategy || '').trim(),
    genreStrategy: (record.genreStrategy || '').trim(),
    styleStrategy: (record.styleStrategy || '').trim(),
    popularFictionProfile: record.popularFictionProfile || null,
    constraints: (record.constraints || []).map(item => item.trim()).filter(Boolean),
  }
}

function summaryText(value?: string | null, fallback = '未补充'): string {
  const text = value?.trim()
  return text && text.length > 0 ? text : fallback
}

export function WorkflowBlueprintCard({ projectId, blueprint, confirmed, confirmedAt, onUpdated }: WorkflowBlueprintCardProps) {
  const sourceBlueprint = useMemo(() => createBlueprintForm(blueprint), [blueprint])
  const [form, setForm] = useState<BlueprintRecord>(sourceBlueprint)
  const [saving, setSaving] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [editorOpen, setEditorOpen] = useState(false)

  useEffect(() => {
    setForm(sourceBlueprint)
  }, [sourceBlueprint])

  const dirty = JSON.stringify(normalizeBlueprint(form)) !== JSON.stringify(normalizeBlueprint(sourceBlueprint))
  const constraintCount = (blueprint?.constraints || []).filter(Boolean).length
  const emotionValue = blueprint?.popularFictionProfile?.emotionEngine?.primaryEmotion || '爽感驱动'
  const conflictValue = blueprint?.popularFictionProfile?.conflictEngine?.conflictTypes?.slice(0, 2).join('、') || '高压冲突'

  const updateField = (key: keyof BlueprintRecord, value: string) => {
    setForm(current => ({ ...current, [key]: value }))
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch(`/api/novel/projects/${projectId}/blueprint`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          constraints: form.constraints || [],
        }),
      })
      const data = await res.json()
      if (!data.success) {
        toast.error(data.error?.message || '保存蓝图失败')
        return false
      }
      toast.success(confirmed ? '蓝图修改已保存，生成前请重新确认' : '蓝图已保存，需重新确认')
      onUpdated?.()
      return true
    } catch {
      toast.error('保存蓝图失败')
      return false
    } finally {
      setSaving(false)
    }
  }

  const handleConfirm = async () => {
    setConfirming(true)
    try {
      const saved = await handleSave()
      if (!saved) return
      const res = await fetch(`/api/novel/projects/${projectId}/blueprint/confirm`, {
        method: 'POST',
      })
      const data = await res.json()
      if (!data.success) {
        toast.error(data.error?.message || '确认蓝图失败')
        return
      }
      toast.success(confirmed ? '蓝图变更已重新确认' : '蓝图已确认，进入故事路线图确认')
      onUpdated?.()
    } catch {
      toast.error('确认蓝图失败')
    } finally {
      setConfirming(false)
    }
  }

  const renderEditor = () => (
    <div className="space-y-4">
      {confirmed ? (
        <div className="rounded-xl border border-blue-200 bg-white/80 px-4 py-3 text-sm text-blue-800 dark:border-blue-900/40 dark:bg-slate-950/40 dark:text-blue-200">
          蓝图已生效。只有在你主动调整方向时，才需要重新编辑并重新确认。
        </div>
      ) : null}
      <Input label="核心卖点" value={form.corePitch} onChange={(e) => updateField('corePitch', e.target.value)} />
      <Textarea label="世界方向" value={form.worldDirection || ''} onChange={(e) => updateField('worldDirection', e.target.value)} rows={4} />
      <Textarea label="主线方向" value={form.mainlineDirection || ''} onChange={(e) => updateField('mainlineDirection', e.target.value)} rows={4} />
      <Textarea label="成长方向" value={form.growthDirection || ''} onChange={(e) => updateField('growthDirection', e.target.value)} rows={4} />
      <Textarea label="终局方向" value={form.endingDirection || ''} onChange={(e) => updateField('endingDirection', e.target.value)} rows={4} />
      <Textarea label="平台策略" value={form.platformStrategy || ''} onChange={(e) => updateField('platformStrategy', e.target.value)} rows={4} />
      <Textarea label="题材策略" value={form.genreStrategy || ''} onChange={(e) => updateField('genreStrategy', e.target.value)} rows={4} />
      <Textarea label="风格策略" value={form.styleStrategy || ''} onChange={(e) => updateField('styleStrategy', e.target.value)} rows={4} />
      {form.popularFictionProfile && (
        <div className="rounded-2xl border border-blue-200 bg-white/80 p-4 dark:border-blue-900/40 dark:bg-slate-950/40">
          <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">爆款四因子</div>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <div className="rounded-xl bg-blue-50 p-3 dark:bg-blue-950/20">
              <div className="text-xs text-blue-700 dark:text-blue-300">情绪价值</div>
              <div className="mt-1 text-sm text-gray-900 dark:text-gray-100">
                {form.popularFictionProfile.emotionEngine?.primaryEmotion || '爽'} · {form.popularFictionProfile.emotionEngine?.readerPayoff || '给读者明确回报'}
              </div>
              <div className="mt-1 text-xs text-gray-500">{form.popularFictionProfile.emotionEngine?.openingBomb || '开篇应快速制造情绪炸弹'}</div>
            </div>
            <div className="rounded-xl bg-blue-50 p-3 dark:bg-blue-950/20">
              <div className="text-xs text-blue-700 dark:text-blue-300">金手指</div>
              <div className="mt-1 text-sm text-gray-900 dark:text-gray-100">
                {form.popularFictionProfile.cheatAbility?.name || '主角优势'}
              </div>
              <div className="mt-1 text-xs text-gray-500">{form.popularFictionProfile.cheatAbility?.oneLineRule || '一句话讲清能力规则'}</div>
            </div>
            <div className="rounded-xl bg-blue-50 p-3 dark:bg-blue-950/20">
              <div className="text-xs text-blue-700 dark:text-blue-300">冲突节奏</div>
              <div className="mt-1 text-sm text-gray-900 dark:text-gray-100">
                {form.popularFictionProfile.conflictEngine?.conflictTypes?.join('、') || '强冲突'}
              </div>
              <div className="mt-1 text-xs text-gray-500">{form.popularFictionProfile.conflictEngine?.hookStrategy || '每章结尾留钩子'}</div>
            </div>
            <div className="rounded-xl bg-blue-50 p-3 dark:bg-blue-950/20">
              <div className="text-xs text-blue-700 dark:text-blue-300">主角标签</div>
              <div className="mt-1 text-sm text-gray-900 dark:text-gray-100">
                {form.popularFictionProfile.characterTagEngine?.protagonistTags?.join('、') || '鲜明主角标签'}
              </div>
              <div className="mt-1 text-xs text-gray-500">{form.popularFictionProfile.cheatAbility?.readerFantasy || '让读者快速代入主角优势'}</div>
            </div>
          </div>
        </div>
      )}
      <Textarea
        label="硬约束"
        value={(form.constraints || []).join('\n')}
        onChange={(e) => setForm(current => ({
          ...current,
          constraints: e.target.value.split('\n').map(item => item.trim()).filter(Boolean),
        }))}
        rows={5}
      />
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={handleSave} loading={saving} disabled={confirmed ? !dirty : false}>
          {confirmed ? '保存修改' : '保存蓝图'}
        </Button>
        <Button variant="primary" onClick={handleConfirm} loading={confirming} disabled={confirmed ? !dirty : false}>
          {confirmed ? '重新确认变更' : '确认蓝图'}
        </Button>
        {confirmed ? (
          <Button variant="ghost" onClick={() => setEditorOpen(false)}>
            关闭
          </Button>
        ) : null}
      </div>
    </div>
  )

  return (
    <>
      <Card className="border-blue-200 bg-blue-50/60 dark:border-blue-900/40 dark:bg-blue-950/20">
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base">1. 蓝图确认</CardTitle>
              {confirmed ? (
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                  蓝图已生效{confirmedAt ? '，默认沿用这份方向继续生成。' : '，默认沿用当前方向继续生成。'}
                </p>
              ) : null}
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={confirmed ? 'success' : 'warning'}>
                {confirmed ? '已确认' : '待确认'}
              </Badge>
              {confirmed ? (
                <Button variant="outline" size="sm" onClick={() => setEditorOpen(true)}>
                  查看蓝图详情
                </Button>
              ) : null}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {confirmed ? (
            <>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-2xl border border-blue-200 bg-white/80 p-4 dark:border-blue-900/40 dark:bg-slate-950/40">
                  <div className="text-xs text-blue-700 dark:text-blue-300">核心卖点</div>
                  <div className="mt-2 text-sm font-medium leading-6 text-gray-900 dark:text-gray-100">{summaryText(blueprint?.corePitch)}</div>
                </div>
                <div className="rounded-2xl border border-blue-200 bg-white/80 p-4 dark:border-blue-900/40 dark:bg-slate-950/40">
                  <div className="text-xs text-blue-700 dark:text-blue-300">蓝图结论</div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <span className="rounded-full bg-blue-50 px-3 py-1 text-xs text-blue-800 dark:bg-blue-950/30 dark:text-blue-200">主情绪：{emotionValue}</span>
                    <span className="rounded-full bg-blue-50 px-3 py-1 text-xs text-blue-800 dark:bg-blue-950/30 dark:text-blue-200">冲突：{conflictValue}</span>
                    <span className="rounded-full bg-blue-50 px-3 py-1 text-xs text-blue-800 dark:bg-blue-950/30 dark:text-blue-200">硬约束：{constraintCount} 条</span>
                  </div>
                </div>
                <div className="rounded-2xl border border-blue-200 bg-white/80 p-4 dark:border-blue-900/40 dark:bg-slate-950/40">
                  <div className="text-xs text-blue-700 dark:text-blue-300">世界方向</div>
                  <div className="mt-2 text-sm leading-6 text-gray-700 dark:text-gray-300">{summaryText(blueprint?.worldDirection)}</div>
                </div>
                <div className="rounded-2xl border border-blue-200 bg-white/80 p-4 dark:border-blue-900/40 dark:bg-slate-950/40">
                  <div className="text-xs text-blue-700 dark:text-blue-300">主线方向</div>
                  <div className="mt-2 text-sm leading-6 text-gray-700 dark:text-gray-300">{summaryText(blueprint?.mainlineDirection)}</div>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => setEditorOpen(true)}>
                  重新编辑蓝图
                </Button>
              </div>
            </>
          ) : renderEditor()}
        </CardContent>
      </Card>

      {confirmed ? (
        <Modal
          open={editorOpen}
          onClose={() => setEditorOpen(false)}
          title="蓝图详情与调整"
          description="这里的修改会影响后续生成方向，保存后需要重新确认。"
          className="max-w-5xl"
        >
          {renderEditor()}
        </Modal>
      ) : null}
    </>
  )
}
