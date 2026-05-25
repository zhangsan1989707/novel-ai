'use client'

import { useState } from 'react'
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Input, Textarea, toast } from '@/components/ui'

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
  onUpdated?: () => void
}

export function WorkflowBlueprintCard({ projectId, blueprint, confirmed, onUpdated }: WorkflowBlueprintCardProps) {
  const [form, setForm] = useState<BlueprintRecord>({
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
  })
  const [saving, setSaving] = useState(false)
  const [confirming, setConfirming] = useState(false)

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
      toast.success('蓝图已保存，需重新确认')
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
      toast.success('蓝图已确认，进入故事路线图确认')
      onUpdated?.()
    } catch {
      toast.error('确认蓝图失败')
    } finally {
      setConfirming(false)
    }
  }

  return (
    <Card className="border-blue-200 bg-blue-50/60 dark:border-blue-900/40 dark:bg-blue-950/20">
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-base">1. 蓝图确认</CardTitle>
          <Badge variant={confirmed ? 'success' : 'warning'}>
            {confirmed ? '已确认' : '待确认'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
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
          <Button variant="outline" onClick={handleSave} loading={saving}>
            保存蓝图
          </Button>
          <Button variant="primary" onClick={handleConfirm} loading={confirming}>
            确认蓝图
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
