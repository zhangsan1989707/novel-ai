'use client'

import { useForm } from 'react-hook-form'
import { Button, Input, Textarea, Select } from '@/components/ui'
import { WriterType } from '@/types'

export interface WriterFormData {
  name: string
  description?: string
  writerType: WriterType
  isPublic: boolean
  tags?: string
}

interface WriterFormProps {
  defaultValues?: Partial<WriterFormData>
  onSubmit: (data: WriterFormData) => Promise<void>
  onCancel?: () => void
  loading?: boolean
}

const writerTypeOptions = [
  { label: '真实作家', value: WriterType.REAL_AUTHOR },
  { label: '自定义作家', value: WriterType.CUSTOM },
]

export function WriterForm({ defaultValues, onSubmit, onCancel, loading }: WriterFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<WriterFormData>({
    defaultValues: {
      name: '',
      description: '',
      writerType: WriterType.CUSTOM,
      isPublic: false,
      tags: '',
      ...defaultValues,
    },
  })

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <Input
        label="作家名称"
        placeholder="请输入作家名称"
        error={errors.name?.message}
        {...register('name', { required: '请输入作家名称' })}
      />

      <Textarea
        label="简介"
        placeholder="请输入作家简介"
        rows={3}
        {...register('description')}
      />

      <Select
        label="类型"
        options={writerTypeOptions}
        {...register('writerType')}
      />

      <Input
        label="标签（用逗号分隔）"
        placeholder="如：玄幻，都市，热血"
        {...register('tags')}
      />

      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="isPublic"
          {...register('isPublic')}
          className="rounded"
        />
        <label htmlFor="isPublic" className="text-sm">公开此作家</label>
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            取消
          </Button>
        )}
        <Button type="submit" loading={loading}>
          保存
        </Button>
      </div>
    </form>
  )
}
