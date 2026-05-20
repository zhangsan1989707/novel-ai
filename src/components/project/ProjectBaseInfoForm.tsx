'use client'

import { useState, type FormEvent } from 'react'
import { Button, Input } from '@/components/ui'

export interface ProjectBaseInfoFormData {
  title: string
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
  })

  const updateField = <K extends keyof ProjectBaseInfoFormData>(key: K, value: ProjectBaseInfoFormData[K]) => {
    setFormData(prev => ({ ...prev, [key]: value }))
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    await onSubmit({
      title: formData.title.trim(),
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

      <div className="flex justify-end gap-3 border-t pt-4">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            取消
          </Button>
        )}
        <Button type="submit" loading={loading}>
          保存标题
        </Button>
      </div>
    </form>
  )
}
