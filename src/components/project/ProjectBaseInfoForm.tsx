'use client'

import { useState, type FormEvent } from 'react'
import { Button, Input, Textarea, Select } from '@/components/ui'

export interface ProjectBaseInfoFormData {
  title: string
  description?: string
  genre?: string
  writingStyle?: string
  targetAudience?: string
}

interface ProjectBaseInfoFormProps {
  defaultValues?: Partial<ProjectBaseInfoFormData>
  onSubmit: (data: ProjectBaseInfoFormData) => Promise<void>
  onCancel?: () => void
  loading?: boolean
}

export function ProjectBaseInfoForm({ defaultValues, onSubmit, onCancel, loading }: ProjectBaseInfoFormProps) {
  const [formData, setFormData] = useState<ProjectBaseInfoFormData>({
    title: defaultValues?.title || '',
    description: defaultValues?.description || '',
    genre: defaultValues?.genre || '',
    writingStyle: defaultValues?.writingStyle || '',
    targetAudience: defaultValues?.targetAudience || '',
  })

  const updateField = <K extends keyof ProjectBaseInfoFormData>(key: K, value: ProjectBaseInfoFormData[K]) => {
    setFormData(prev => ({ ...prev, [key]: value }))
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    await onSubmit({
      title: formData.title.trim(),
      description: formData.description?.trim() || undefined,
      genre: formData.genre?.trim() || undefined,
      writingStyle: formData.writingStyle?.trim() || undefined,
      targetAudience: formData.targetAudience?.trim() || undefined,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <Input
        label="小说标题"
        placeholder="请输入小说标题"
        value={formData.title}
        onChange={event => updateField('title', event.target.value)}
        required
      />

      <Textarea
        label="简介"
        placeholder="简要描述你的小说"
        value={formData.description || ''}
        onChange={event => updateField('description', event.target.value)}
      />

      <Input
        label="题材"
        placeholder="如：玄幻、都市、科幻"
        value={formData.genre || ''}
        onChange={event => updateField('genre', event.target.value)}
      />

      <Input
        label="写作风格"
        placeholder="如：轻松幽默、严肃深沉"
        value={formData.writingStyle || ''}
        onChange={event => updateField('writingStyle', event.target.value)}
      />

      <Select
        label="目标读者"
        value={formData.targetAudience || ''}
        onChange={event => updateField('targetAudience', event.target.value)}
        options={[
          { value: '', label: '不限' },
          { value: 'MALE', label: '男频' },
          { value: 'FEMALE', label: '女频' },
        ]}
      />

      <div className="flex justify-end gap-3 border-t pt-4">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            取消
          </Button>
        )}
        <Button type="submit" loading={loading}>
          保存信息
        </Button>
      </div>
    </form>
  )
}
