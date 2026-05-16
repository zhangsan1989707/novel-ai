import { cn } from '@/lib/utils'
import { Button } from './Button'
import { AlertTriangle, X, Check } from 'lucide-react'
import { useEffect, useState } from 'react'

interface ConfirmToastProps {
  open: boolean
  title: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'danger' | 'warning' | 'default'
  onConfirm: () => void
  onCancel: () => void
  loading?: boolean
  autoClose?: number // 自动关闭时间（毫秒）
  className?: string
}

export function ConfirmToast({
  open,
  title,
  description,
  confirmLabel = '确认',
  cancelLabel = '取消',
  variant = 'danger',
  onConfirm,
  onCancel,
  loading = false,
  autoClose,
  className,
}: ConfirmToastProps) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (open) {
      setVisible(true)
    } else {
      const timer = setTimeout(() => setVisible(false), 200)
      return () => clearTimeout(timer)
    }
  }, [open])

  useEffect(() => {
    if (autoClose && open) {
      const timer = setTimeout(onCancel, autoClose)
      return () => clearTimeout(timer)
    }
  }, [autoClose, open, onCancel])

  if (!visible && !open) return null

  const variantStyles = {
    danger: {
      bg: 'bg-red-50 dark:bg-red-950/50',
      border: 'border-red-200 dark:border-red-800',
      icon: 'text-red-600 dark:text-red-400',
      button: 'bg-red-600 hover:bg-red-700 text-white',
    },
    warning: {
      bg: 'bg-amber-50 dark:bg-amber-950/50',
      border: 'border-amber-200 dark:border-amber-800',
      icon: 'text-amber-600 dark:text-amber-400',
      button: 'bg-amber-600 hover:bg-amber-700 text-white',
    },
    default: {
      bg: 'bg-white dark:bg-gray-800',
      border: 'border-gray-200 dark:border-gray-700',
      icon: 'text-gray-600 dark:text-gray-400',
      button: 'bg-primary hover:bg-primary/90 text-primary-foreground',
    },
  }

  const style = variantStyles[variant]

  return (
    <div
      className={cn(
        'fixed bottom-6 left-1/2 -translate-x-1/2 z-[100]',
        'transition-all duration-200',
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4',
        className
      )}
    >
      <div
        className={cn(
          'flex items-center gap-4 px-5 py-4 rounded-2xl shadow-2xl border',
          'animate-in slide-in-from-bottom-4 fade-in-0 duration-200',
          style.bg,
          style.border
        )}
      >
        <AlertTriangle className={cn('w-5 h-5 flex-shrink-0', style.icon)} />
        <div className="flex-1 min-w-0">
          <p className="font-medium text-foreground">{title}</p>
          {description && (
            <p className="text-sm text-muted-foreground mt-0.5">{description}</p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={onCancel}
            disabled={loading}
          >
            {cancelLabel}
          </Button>
          <Button
            size="sm"
            onClick={onConfirm}
            loading={loading}
            className={style.button}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}

// Hook for managing confirm state
export function useConfirmDialog() {
  const [confirmState, setConfirmState] = useState<{
    open: boolean
    title: string
    description?: string
    onConfirm: () => void
    variant?: 'danger' | 'warning' | 'default'
    confirmLabel?: string
  }>({
    open: false,
    title: '',
    onConfirm: () => {},
  })

  const confirm = (options: {
    title: string
    description?: string
    onConfirm: () => void
    variant?: 'danger' | 'warning' | 'default'
    confirmLabel?: string
  }) => {
    setConfirmState({
      open: true,
      ...options,
    })
  }

  const close = () => {
    setConfirmState((prev) => ({ ...prev, open: false }))
  }

  return {
    confirm,
    close,
    ConfirmDialog: () => (
      <ConfirmToast
        open={confirmState.open}
        title={confirmState.title}
        description={confirmState.description}
        variant={confirmState.variant}
        confirmLabel={confirmState.confirmLabel}
        onConfirm={() => {
          confirmState.onConfirm()
          close()
        }}
        onCancel={close}
      />
    ),
  }
}
