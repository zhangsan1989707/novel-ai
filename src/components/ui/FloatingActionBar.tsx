import { cn } from '@/lib/utils'
import { Button } from './Button'
import { X, Trash2, Download, Edit3, Sparkles, Check } from 'lucide-react'

interface FloatingActionBarProps {
  selectedCount: number
  onClear: () => void
  actions: {
    label: string
    icon?: React.ReactNode
    onClick: () => void
    variant?: 'default' | 'danger' | 'primary'
  }[]
  className?: string
}

export function FloatingActionBar({
  selectedCount,
  onClear,
  actions,
  className,
}: FloatingActionBarProps) {
  if (selectedCount === 0) return null

  return (
    <div
      className={cn(
        'fixed bottom-6 left-1/2 -translate-x-1/2 z-50',
        'bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700',
        'px-4 py-3 flex items-center gap-4',
        'animate-in slide-in-from-bottom-4 fade-in-0 duration-200',
        className
      )}
    >
      {/* 选中数量 */}
      <div className="flex items-center gap-2 text-sm font-medium">
        <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs">
          <Check className="w-4 h-4" />
        </span>
        <span className="text-gray-700 dark:text-gray-200">
          已选择 <span className="text-primary font-bold">{selectedCount}</span> 项
        </span>
      </div>

      {/* 分隔线 */}
      <div className="h-6 w-px bg-gray-200 dark:bg-gray-700" />

      {/* 操作按钮 */}
      <div className="flex items-center gap-2">
        {actions.map((action, index) => (
          <Button
            key={index}
            variant={action.variant === 'danger' ? 'danger' : action.variant === 'primary' ? 'primary' : 'outline'}
            size="sm"
            onClick={action.onClick}
            className="gap-1.5"
          >
            {action.icon}
            {action.label}
          </Button>
        ))}
      </div>

      {/* 关闭按钮 */}
      <button
        onClick={onClear}
        className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
        title="取消选择"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  )
}

// 批量生成操作栏
interface BatchGenerateActionBarProps {
  selectedCount: number
  onClear: () => void
  onGenerate: () => void
  onDelete: () => void
  className?: string
}

export function BatchChapterActionBar({
  selectedCount,
  onClear,
  onGenerate,
  onDelete,
  className,
}: BatchGenerateActionBarProps) {
  return (
    <FloatingActionBar
      selectedCount={selectedCount}
      onClear={onClear}
      actions={[
        {
          label: '生成',
          icon: <Sparkles className="w-4 h-4" />,
          onClick: onGenerate,
          variant: 'primary',
        },
        {
          label: '删除',
          icon: <Trash2 className="w-4 h-4" />,
          onClick: onDelete,
          variant: 'danger',
        },
      ]}
      className={className}
    />
  )
}
